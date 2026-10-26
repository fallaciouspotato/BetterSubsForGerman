/**
 * Background service worker.
 * Handles:
 *  1. Word and sentence translation fallback via MyMemory
 *  2. Centralized word saving and storage in extension IndexedDB
 *  3. SRS review execution
 *  4. Extension lifecycle events
 */

import { db } from '../db/schema';
import { saveWord, isWordSaved, getAllWords } from '../db/words';
import { processReview } from '../srs/review';
import { getLatestOccurrenceForWord } from '../db/occurrences';
import { decodeHtmlEntities } from '../utils/text';

console.log('[dual-sub:background] Service worker initialized.');

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[dual-sub:background] Extension installed/updated:', details.reason);
});

// Centralized message router for content scripts and popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return false;

  switch (message.type) {
    case 'TRANSLATE_WORD': {
      handleTranslateWord(message.word, message.fromLang || 'de', message.toLang || 'en')
        .then((result) => sendResponse({ success: true, data: result }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'TRANSLATE_SENTENCE': {
      handleTranslateSentence(message.text, message.fromLang || 'de', message.toLang || 'en')
        .then((result) => sendResponse({ success: true, translation: result }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'TRANSLATE_SENTENCES_BATCH': {
      // Translates an array of texts in a single Google Translate request using newline batching.
      // message.texts: string[]  message.fromLang: string  message.toLang: string
      handleTranslateSentencesBatch(message.texts, message.fromLang || 'de', message.toLang || 'en')
        .then((translations) => sendResponse({ success: true, translations }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'SAVE_WORD': {
      saveWord(message.params)
        .then((result) => sendResponse({ success: true, data: result }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'IS_WORD_SAVED': {
      isWordSaved(message.lemma, message.language)
        .then((isSaved) => sendResponse({ success: true, isSaved }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'GET_ALL_WORDS': {
      getAllWords(message.language)
        .then((words) => sendResponse({ success: true, words }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'PROCESS_REVIEW': {
      processReview(message.wordId, message.rating, message.now ? new Date(message.now) : new Date())
        .then((result) => sendResponse({ success: true, result }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'GET_LATEST_OCCURRENCE': {
      getLatestOccurrenceForWord(message.wordId)
        .then((occurrence) => sendResponse({ success: true, occurrence }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'OPEN_QUIZ': {
      const quizUrl = chrome.runtime.getURL('src/popup/index.html');
      chrome.tabs.create({ url: quizUrl });
      sendResponse({ success: true });
      return true;
    }

    case 'FETCH_TIMED_TEXT': {
      handleFetchTimedText(message.url)
        .then((text) => sendResponse({ success: true, text, status: 200 }))
        .catch((err) => {
          const statusMatch = err.message.match(/HTTP (\d+)/);
          const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;
          sendResponse({ success: false, error: err.message, status });
        });
      return true;
    }

    default:
      return false;
  }
});

const sentenceCache = new Map<string, string>();
let googleCoolingDownUntil = 0;

class RequestQueue {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;

  public enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const res = await fn();
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    const task = this.queue.shift();
    if (task) {
      try {
        await task();
      } finally {
        setTimeout(() => {
          this.isProcessing = false;
          this.process();
        }, 40);
      }
    }
  }
}

const translationQueue = new RequestQueue();

async function handleTranslateWord(surfaceWord: string, fromLang: string = 'de', toLang: string = 'en') {
  const cleaned = surfaceWord.trim().toLowerCase();
  if (!cleaned) return null;

  const cacheKey = `${fromLang}:${toLang}:${cleaned}`;

  try {
    const cached =
      (await db.dictCache.get(cacheKey)) ||
      (fromLang === 'de' && toLang === 'en' ? await db.dictCache.get(cleaned) : undefined);
    if (cached) {
      return {
        lemma: cached.lemma,
        pos: cached.pos || 'word',
        glosses: cached.glosses,
      };
    }
  } catch (err) {
    console.warn('[dual-sub:background] Cache read error:', err);
  }

  // 1. Try Google Translate API if not cooling down
  if (Date.now() > googleCoolingDownUntil) {
    try {
      const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(cleaned)}`;
      const res = await fetch(gUrl);
      if (res.status === 429) {
        console.warn('[dual-sub:background] Google Translate rate limited. Cooling down for 5 mins.');
        googleCoolingDownUntil = Date.now() + 5 * 60 * 1000;
      } else if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0]) && data[0].length > 0) {
          const rawTrans = data[0].map((part: any) => part[0]).join('').trim().toLowerCase();
          const trans = decodeHtmlEntities(rawTrans);
          if (trans && trans !== cleaned) {
            const entry = {
              lemma: cleaned,
              pos: 'word',
              glosses: [trans],
            };

            db.dictCache
              .put({
                word: cacheKey,
                lemma: cleaned,
                pos: 'word',
                glosses: [trans],
                cachedAt: new Date().toISOString(),
              })
              .catch(() => {});

            return entry;
          }
        }
      } else {
        googleCoolingDownUntil = Date.now() + 5 * 60 * 1000;
      }
    } catch {
      googleCoolingDownUntil = Date.now() + 5 * 60 * 1000;
      // Fall back to MyMemory
    }
  }

  // 2. Fallback to MyMemory
  try {
    const queryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleaned)}&langpair=${fromLang}|${toLang}`;
    const res = await fetch(queryUrl);
    if (res.ok) {
      const data = await res.json();
      const translation = data?.responseData?.translatedText;

      if (translation && typeof translation === 'string') {
        const cleanTranslation = decodeHtmlEntities(translation.trim().toLowerCase());
        if (cleanTranslation && cleanTranslation !== cleaned && !cleanTranslation.includes('mymemory warning')) {
          const entry = {
            lemma: cleaned,
            pos: 'word',
            glosses: [cleanTranslation],
          };

          db.dictCache
            .put({
              word: cacheKey,
              lemma: cleaned,
              pos: 'word',
              glosses: [cleanTranslation],
              cachedAt: new Date().toISOString(),
            })
            .catch((err) => console.warn('[dual-sub:background] Cache write error:', err));

          return entry;
        }
      }
    }
  } catch (err) {
    console.warn('[dual-sub:background] Online translation fetch failed:', err);
  }

  return null;
}

async function doTranslateSentence(text: string, fromLang: string = 'de', toLang: string = 'en'): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const cacheKey = `${fromLang}:${toLang}:${trimmed}`;
  if (sentenceCache.has(cacheKey)) {
    return sentenceCache.get(cacheKey)!;
  }

  // 1. Try Google Translate API (rate-limit guard; no manual redirect to avoid opaque responses)
  if (Date.now() > googleCoolingDownUntil) {
    try {
      const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(trimmed)}`;
      const res = await fetch(gUrl);

      if (res.status === 429) {
        console.warn('[dual-sub:background] Google Translate rate limited (429). Cooling down for 5 mins.');
        googleCoolingDownUntil = Date.now() + 5 * 60 * 1000;
      } else if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0]) && data[0].length > 0) {
          const raw = data[0].map((part: any) => part[0]).join('').trim();
          const translation = decodeHtmlEntities(raw);
          if (translation) {
            sentenceCache.set(cacheKey, translation);
            return translation;
          }
        }
      } else {
        googleCoolingDownUntil = Date.now() + 5 * 60 * 1000;
      }
    } catch {
      googleCoolingDownUntil = Date.now() + 5 * 60 * 1000;
      // Fall through to MyMemory
    }
  }

  // 2. Fallback to MyMemory
  try {
    const queryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${fromLang}|${toLang}`;
    const res = await fetch(queryUrl);
    if (res.ok) {
      const data = await res.json();
      const translation = data?.responseData?.translatedText;
      if (translation && typeof translation === 'string' && !translation.includes('MYMEMORY WARNING')) {
        const cleanTranslation = decodeHtmlEntities(translation.trim());
        sentenceCache.set(cacheKey, cleanTranslation);
        return cleanTranslation;
      }
    }
  } catch (err) {
    console.warn('[dual-sub:background] Sentence translation error:', err);
  }

  return '';
}

async function handleTranslateSentence(text: string, fromLang: string = 'de', toLang: string = 'en'): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const cacheKey = `${fromLang}:${toLang}:${trimmed}`;
  if (sentenceCache.has(cacheKey)) {
    return sentenceCache.get(cacheKey)!;
  }

  return translationQueue.enqueue(() => doTranslateSentence(text, fromLang, toLang));
}

/**
 * Batch-translates multiple strings in a single HTTP request by joining them with a sentinel
 * separator (`\n|||\n`). Pipes are preserved verbatim by translation APIs and do not trigger
 * phrase alteration.
 */
const BATCH_SEP = '\n|||\n';

async function handleTranslateSentencesBatch(
  texts: string[],
  fromLang: string = 'de',
  toLang: string = 'en'
): Promise<string[]> {
  if (!texts || texts.length === 0) return [];

  // Check per-item cache first; only request uncached items
  const results: string[] = new Array(texts.length).fill('');
  const uncachedIndexes: number[] = [];
  const uncachedTexts: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const trimmed = texts[i].trim();
    if (!trimmed) continue;
    const cacheKey = `${fromLang}:${toLang}:${trimmed}`;
    if (sentenceCache.has(cacheKey)) {
      results[i] = sentenceCache.get(cacheKey)!;
    } else {
      uncachedIndexes.push(i);
      uncachedTexts.push(trimmed);
    }
  }

  if (uncachedTexts.length === 0) return results;

  // Join with sentinel separator and translate in one shot
  const joined = uncachedTexts.join(BATCH_SEP);

  return translationQueue.enqueue(async () => {
    let translatedParts: string[] | null = null;

    // 1. Try Google Translate
    if (Date.now() > googleCoolingDownUntil) {
      try {
        const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(joined)}`;
        const res = await fetch(gUrl);
        if (res.status === 429) {
          console.warn('[dual-sub:background] Google Translate rate limited (429). Cooling down for 5 mins.');
          googleCoolingDownUntil = Date.now() + 5 * 60 * 1000;
        } else if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && Array.isArray(data[0]) && data[0].length > 0) {
            const full = data[0].map((part: any) => part[0]).join('').trim();
            if (full) {
              // Try pipe split first
              const pipeParts = full.split(/\s*\|{2,4}\s*/).map((s: string) => decodeHtmlEntities(s.trim()));
              if (pipeParts.length === uncachedTexts.length) {
                translatedParts = pipeParts;
              } else {
                // Secondary check: newline split
                const lineParts = full.split(/\r?\n+/).map((s: string) => decodeHtmlEntities(s.trim())).filter(Boolean);
                if (lineParts.length === uncachedTexts.length) {
                  translatedParts = lineParts;
                }
              }
            }
          }
        } else {
          googleCoolingDownUntil = Date.now() + 5 * 60 * 1000;
        }
      } catch {
        googleCoolingDownUntil = Date.now() + 5 * 60 * 1000;
        // Fall through to direct fallback
      }
    }

    // 2. Direct fallback (sequential to prevent overwhelming MyMemory rate limits)
    if (!translatedParts || translatedParts.length !== uncachedTexts.length) {
      translatedParts = [];
      for (const t of uncachedTexts) {
        const trans = await doTranslateSentence(t, fromLang, toLang);
        translatedParts.push(trans);
        if (uncachedTexts.length > 1) {
          await new Promise((r) => setTimeout(r, 60));
        }
      }
    }

    // Write back results and populate cache
    for (let j = 0; j < uncachedIndexes.length; j++) {
      const originalIdx = uncachedIndexes[j];
      const translation = translatedParts[j] ?? '';
      results[originalIdx] = translation;
      if (translation) {
        const cacheKey = `${fromLang}:${toLang}:${texts[originalIdx].trim()}`;
        sentenceCache.set(cacheKey, translation);
      }
    }

    return results;
  });
}

async function handleFetchTimedText(url: string): Promise<string> {
  const fullUrl = url.startsWith('//')
    ? `https:${url}`
    : url.startsWith('/')
    ? `https://www.youtube.com${url}`
    : url;

  const res = await fetch(fullUrl, {
    credentials: 'omit',
    headers: {
      'Accept': '*/*',
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return await res.text();
}
