import type { DictionaryEntry } from './types';
import { dictionaryLoader } from './loader';

/**
 * Strips punctuation and normalizes to lower case for dictionary indexing.
 */
export function cleanWord(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/^[^\w\u00C4\u00D6\u00DC\u00E4\u00F6\u00FC\u00DF]+|[^\w\u00C4\u00D6\u00DC\u00E4\u00F6\u00FC\u00DF]+$/g, '')
    .toLowerCase();
}

/**
 * 1. Synchronous local dictionary + morphological lemmatizer.
 */
export function lookupWordLocal(surfaceWord: string): DictionaryEntry | null {
  const cleaned = cleanWord(surfaceWord);
  if (!cleaned) return null;

  const formMap = dictionaryLoader.getFormMap();
  const glossMap = dictionaryLoader.getGlossMap();

  // 1. Direct form -> lemma lookup
  let lemma = formMap[cleaned];

  // 2. Rule-based German verb inflection heuristics
  if (!lemma) {
    // Past tense regular: machte -> machen, spielte -> spielen
    if (cleaned.endsWith('te') && cleaned.length > 4) {
      const stem = cleaned.slice(0, -2);
      if (glossMap[stem + 'en']) lemma = stem + 'en';
    } else if (cleaned.endsWith('test') && cleaned.length > 6) {
      const stem = cleaned.slice(0, -4);
      if (glossMap[stem + 'en']) lemma = stem + 'en';
    } else if (cleaned.endsWith('ten') && cleaned.length > 5) {
      const stem = cleaned.slice(0, -3);
      if (glossMap[stem + 'en']) lemma = stem + 'en';
    } else if (cleaned.endsWith('tet') && cleaned.length > 5) {
      const stem = cleaned.slice(0, -3);
      if (glossMap[stem + 'en']) lemma = stem + 'en';
    }
    // Present tense 3rd person / 2nd person plural: spielt -> spielen, lacht -> lachen
    else if (cleaned.endsWith('t') && cleaned.length > 3) {
      const stem = cleaned.slice(0, -1);
      if (glossMap[stem + 'en']) lemma = stem + 'en';
    }
    // Present tense 2nd person singular: spielst -> spielen
    else if (cleaned.endsWith('st') && cleaned.length > 4) {
      const stem = cleaned.slice(0, -2);
      if (glossMap[stem + 'en']) lemma = stem + 'en';
    }
    // Present tense 1st person singular: spiele -> spielen
    else if (cleaned.endsWith('e') && cleaned.length > 3) {
      const stem = cleaned.slice(0, -1);
      if (glossMap[stem + 'en']) lemma = stem + 'en';
    }
    // Ge- past participle prefix: gespielt -> spielen, gemacht -> machen
    else if (cleaned.startsWith('ge') && cleaned.endsWith('t') && cleaned.length > 5) {
      const stem = cleaned.slice(2, -1);
      if (glossMap[stem + 'en']) lemma = stem + 'en';
    }
  }

  // 3. Rule-based German noun plural heuristics
  if (!lemma) {
    if (cleaned.endsWith('en') && cleaned.length > 4) {
      const stem = cleaned.slice(0, -2);
      if (glossMap[stem]) lemma = stem;
      else if (glossMap[stem + 'e']) lemma = stem + 'e';
    } else if (cleaned.endsWith('er') && cleaned.length > 4) {
      const stem = cleaned.slice(0, -2);
      if (glossMap[stem]) lemma = stem;
    } else if (cleaned.endsWith('e') && cleaned.length > 3) {
      const stem = cleaned.slice(0, -1);
      if (glossMap[stem]) lemma = stem;
    }
  }

  // 4. Fallback: treat cleaned surface form as lemma candidate
  if (!lemma) {
    lemma = cleaned;
  }

  const entry = glossMap[lemma];
  if (entry) {
    return {
      lemma,
      pos: entry.pos,
      glosses: entry.glosses,
    };
  }

  if (lemma !== cleaned && glossMap[cleaned]) {
    const directEntry = glossMap[cleaned];
    return {
      lemma: cleaned,
      pos: directEntry.pos,
      glosses: directEntry.glosses,
    };
  }

  return null;
}

/**
 * 2. Async Lookup with Background Service Worker Delegation.
 */
export async function lookupWordAsync(surfaceWord: string): Promise<DictionaryEntry | null> {
  const cleaned = cleanWord(surfaceWord);
  if (!cleaned) return null;

  // 1. Synchronous check
  const local = lookupWordLocal(surfaceWord);
  if (local) return local;

  // 2. Delegate to background worker if context is valid
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.runtime?.sendMessage) {
      const response = await chrome.runtime.sendMessage({
        type: 'TRANSLATE_WORD',
        word: surfaceWord,
      });

      if (response && response.success && response.data) {
        return response.data as DictionaryEntry;
      }
    }
  } catch (err) {
    // Fail silently without console spam if context invalidated
  }

  return null;
}

export const lookupWord = lookupWordLocal;
