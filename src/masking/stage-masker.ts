import type { CuePair } from '../content/captions/types';
import type { Word } from '../db/schema';
import type { MaskedCuePair, MaskedToken } from './types';
import { findEnglishGloss, type GlossMatch } from './gloss-matcher';
import { lookupWordLocal } from '../dictionary/lookup';

/**
 * Normalizes an array or map of saved words into a fast lowercase-lemma lookup map.
 */
export function buildSavedWordsMap(savedWords: Word[] | Map<string, Word>): Map<string, Word> {
  if (savedWords instanceof Map) {
    return savedWords;
  }
  const map = new Map<string, Word>();
  for (const word of savedWords) {
    if (word && word.lemma) {
      map.set(word.lemma.toLowerCase(), word);
    }
  }
  return map;
}

/**
 * Finds if a German surface token corresponds to any saved word.
 */
export function resolveSavedWord(
  token: string,
  savedMap: Map<string, Word>
): Word | undefined {
  const clean = token.toLowerCase();
  // 1. Direct match with lemma
  const direct = savedMap.get(clean);
  if (direct) return direct;

  // 2. Morphological lookup via local dictionary
  try {
    const entry = lookupWordLocal(token);
    if (entry && entry.lemma) {
      const byLemma = savedMap.get(entry.lemma.toLowerCase());
      if (byLemma) return byLemma;
    }
  } catch {
    // If dictionary is offline or loading, fallback gracefully
  }

  return undefined;
}

/**
 * Applies stage-based masking to a CuePair:
 *
 * - Stage 1: Both German target and English native are fully visible.
 * - Stage 2: Target German is visible; English native gloss is masked as `___`.
 * - Stage 3: Target German is masked as `___`; English native gloss is also masked as `___`.
 */
export function applyStageMasking(
  cue: CuePair,
  savedWords: Word[] | Map<string, Word>
): MaskedCuePair {
  const savedMap = buildSavedWordsMap(savedWords);

  const result: MaskedCuePair = {
    startMs: cue.startMs,
    endMs: cue.endMs,
    targetTokens: [],
    nativeTokens: [],
  };

  // 1. Process target German sentence
  const targetText = cue.target || '';
  const targetWordsFound: Word[] = [];

  if (targetText) {
    // Tokenize into words and non-words
    const tokens = targetText.split(/([A-Za-zÄÖÜäöüß]+)/);

    for (const token of tokens) {
      if (!token) continue;
      const isWord = /[A-Za-zÄÖÜäöüß]+/.test(token);

      if (isWord) {
        const saved = resolveSavedWord(token, savedMap);

        if (saved) {
          targetWordsFound.push(saved);

          if (saved.stage === 3) {
            // Stage 3: Mask the German target word
            result.targetTokens.push({
              text: token,
              originalText: token,
              visible: false,
              lemma: saved.lemma,
              stage: 3,
            });
          } else {
            // Stage 1 or 2: Show the German target word
            result.targetTokens.push({
              text: token,
              visible: true,
              lemma: saved.lemma,
              stage: saved.stage,
            });
          }
        } else {
          // Unsaved word: fully visible
          result.targetTokens.push({
            text: token,
            visible: true,
          });
        }
      } else {
        // Non-word punctuation / spaces
        result.targetTokens.push({
          text: token,
          visible: true,
        });
      }
    }
  }

  // 2. Process native English sentence
  const nativeText = cue.native || '';

  if (!nativeText) {
    return result;
  }

  // Find saved words that require native gloss masking (Stage 2 and Stage 3)
  const wordsToMaskInNative = targetWordsFound.filter(
    (w) => w.stage === 2 || w.stage === 3
  );

  if (wordsToMaskInNative.length === 0) {
    // No stage 2/3 words found in target; native sentence remains fully visible
    result.nativeTokens = [{ text: nativeText, visible: true }];
    return result;
  }

  // Find matching spans in the native sentence for each word
  interface MatchSpan extends GlossMatch {
    lemma: string;
    stage: 1 | 2 | 3;
  }

  const spans: MatchSpan[] = [];

  for (const word of wordsToMaskInNative) {
    const match = findEnglishGloss(word.lemma, nativeText, word.glosses);
    if (match) {
      spans.push({
        ...match,
        lemma: word.lemma,
        stage: word.stage,
      });
    }
  }

  if (spans.length === 0) {
    // No unambiguous gloss matches found: fail-safe leaves entire sentence visible
    result.nativeTokens = [{ text: nativeText, visible: true }];
    return result;
  }

  // Sort spans by start index and eliminate overlapping spans
  spans.sort((a, b) => a.start - b.start);
  const nonOverlappingSpans: MatchSpan[] = [];
  let lastEnd = -1;

  for (const span of spans) {
    if (span.start >= lastEnd) {
      nonOverlappingSpans.push(span);
      lastEnd = span.end;
    }
  }

  // Segment native text into visible and masked tokens
  let curr = 0;
  for (const span of nonOverlappingSpans) {
    if (span.start > curr) {
      result.nativeTokens.push({
        text: nativeText.slice(curr, span.start),
        visible: true,
      });
    }

    result.nativeTokens.push({
      text: span.matched,
      originalText: span.matched,
      visible: false,
      lemma: span.lemma,
      stage: span.stage,
    });

    curr = span.end;
  }

  if (curr < nativeText.length) {
    result.nativeTokens.push({
      text: nativeText.slice(curr),
      visible: true,
    });
  }

  return result;
}
