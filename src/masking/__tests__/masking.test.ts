import { describe, it, expect, beforeAll } from 'vitest';
import { findEnglishGloss } from '../gloss-matcher';
import { applyStageMasking } from '../stage-masker';
import type { Word } from '../../db/schema';
import type { CuePair } from '../../content/captions/types';
import { dictionaryLoader } from '../../dictionary/loader';

describe('Masking Engine', () => {
  beforeAll(async () => {
    // Load local dictionary for morphological lookup
    await dictionaryLoader.load();
  });

  describe('findEnglishGloss', () => {
    it('matches simple direct gloss', () => {
      const match = findEnglishGloss('Haus', 'The house is very large.', ['house', 'building']);
      expect(match).not.toBeNull();
      expect(match?.matched).toBe('house');
      expect(match?.start).toBe(4);
      expect(match?.end).toBe(9);
    });

    it('matches verb without "to " prefix', () => {
      const match = findEnglishGloss('sehen', 'I see the mountains in the distance.', ['to see', 'look']);
      expect(match).not.toBeNull();
      expect(match?.matched).toBe('see');
    });

    it('matches infinitive with "to " prefix if present in sentence', () => {
      const match = findEnglishGloss('gehen', 'We want to go now.', ['to go', 'walk']);
      expect(match).not.toBeNull();
      expect(match?.matched).toBe('to go');
    });

    it('matches plural noun forms', () => {
      const match = findEnglishGloss('Katze', 'The cats are playing outside.', ['cat']);
      expect(match).not.toBeNull();
      expect(match?.matched).toBe('cats');
    });

    it('rejects ambiguous matches where the gloss appears multiple times', () => {
      const match = findEnglishGloss('Katze', 'One cat looked at another cat.', ['cat']);
      expect(match).toBeNull(); // Fail-safe: do not mask ambiguous words
    });

    it('rejects common stop words for non-function lemmas', () => {
      const match = findEnglishGloss('Hund', 'The dog is on the rug.', ['is', 'dog']);
      // 'is' is a stop word and should be skipped; it should match 'dog'
      expect(match).not.toBeNull();
      expect(match?.matched).toBe('dog');
    });

    it('returns null when no gloss matches', () => {
      const match = findEnglishGloss('Apfel', 'The car is speeding away.', ['apple']);
      expect(match).toBeNull();
    });

    it('handles case-insensitive sentences and patterns', () => {
      const match = findEnglishGloss('Wasser', 'Water is essential for life.', ['water']);
      expect(match).not.toBeNull();
      expect(match?.matched).toBe('Water');
    });

    it('matches exact word boundaries and avoids substrings', () => {
      const match = findEnglishGloss('Katze', 'He caught a large fish.', ['cat']);
      expect(match).toBeNull();
    });

    it('handles empty inputs gracefully', () => {
      expect(findEnglishGloss('', '', [])).toBeNull();
      expect(findEnglishGloss('Haus', '', ['house'])).toBeNull();
      expect(findEnglishGloss('Haus', 'The house', [])).toBeNull();
    });
  });

  describe('applyStageMasking', () => {
    const makeWord = (lemma: string, stage: 1 | 2 | 3, glosses: string[]): Word => ({
      lemma,
      language: 'de',
      stage,
      glosses,
      srsCardJson: '{}',
      correctDays: [],
      firstSeen: new Date().toISOString(),
      timesSeen: 1,
    });

    it('Stage 1: Leaves both German and English visible', () => {
      const cue: CuePair = {
        startMs: 0,
        endMs: 2000,
        target: 'Das Haus ist schön.',
        native: 'The house is beautiful.',
      };
      const saved = [makeWord('Haus', 1, ['house'])];
      const result = applyStageMasking(cue, saved);

      // All target tokens must be visible
      expect(result.targetTokens.every((t) => t.visible)).toBe(true);
      // All native tokens must be visible
      expect(result.nativeTokens.every((t) => t.visible)).toBe(true);
    });

    it('Stage 2: Target German is visible, English gloss is masked', () => {
      const cue: CuePair = {
        startMs: 0,
        endMs: 2000,
        target: 'Das Haus ist schön.',
        native: 'The house is beautiful.',
      };
      const saved = [makeWord('Haus', 2, ['house'])];
      const result = applyStageMasking(cue, saved);

      // German "Haus" is visible
      const hausToken = result.targetTokens.find((t) => t.text === 'Haus');
      expect(hausToken).toBeDefined();
      expect(hausToken?.visible).toBe(true);
      expect(hausToken?.stage).toBe(2);

      // English "house" is masked
      const maskedGloss = result.nativeTokens.find((t) => !t.visible);
      expect(maskedGloss).toBeDefined();
      expect(maskedGloss?.text).toBe('house');
      expect(maskedGloss?.stage).toBe(2);
      expect(maskedGloss?.lemma).toBe('Haus');
    });

    it('Stage 3: Both German target and English gloss are masked', () => {
      const cue: CuePair = {
        startMs: 0,
        endMs: 2000,
        target: 'Die Katze schläft.',
        native: 'The cat is sleeping.',
      };
      const saved = [makeWord('Katze', 3, ['cat'])];
      const result = applyStageMasking(cue, saved);

      // German "Katze" is masked
      const katzeToken = result.targetTokens.find((t) => t.text === 'Katze');
      expect(katzeToken).toBeDefined();
      expect(katzeToken?.visible).toBe(false);
      expect(katzeToken?.stage).toBe(3);

      // English "cat" is masked
      const maskedGloss = result.nativeTokens.find((t) => !t.visible);
      expect(maskedGloss).toBeDefined();
      expect(maskedGloss?.text).toBe('cat');
      expect(maskedGloss?.stage).toBe(3);
    });

    it('Handles multiple saved words at different stages in the same sentence', () => {
      const cue: CuePair = {
        startMs: 0,
        endMs: 3000,
        target: 'Der Hund und die Katze sind Freunde.',
        native: 'The dog and the cat are friends.',
      };
      const saved = [
        makeWord('Hund', 2, ['dog']),
        makeWord('Katze', 3, ['cat']),
      ];
      const result = applyStageMasking(cue, saved);

      // Hund: Stage 2 -> German visible, English masked
      const hundGerman = result.targetTokens.find((t) => t.text === 'Hund');
      expect(hundGerman?.visible).toBe(true);
      expect(hundGerman?.stage).toBe(2);

      // Katze: Stage 3 -> German masked, English masked
      const katzeGerman = result.targetTokens.find((t) => t.text === 'Katze');
      expect(katzeGerman?.visible).toBe(false);
      expect(katzeGerman?.stage).toBe(3);

      // Native sentence should have both "dog" and "cat" masked
      const maskedGlosses = result.nativeTokens.filter((t) => !t.visible);
      expect(maskedGlosses.length).toBe(2);
      expect(maskedGlosses.map((g) => g.text)).toEqual(['dog', 'cat']);
    });

    it('Recognizes inflected German verb forms (e.g. ging -> gehen)', () => {
      const cue: CuePair = {
        startMs: 1000,
        endMs: 3000,
        target: 'Er ging nach Hause.',
        native: 'He went home.',
      };
      // Saved lemma is "gehen"
      const saved = [makeWord('gehen', 3, ['to go', 'go', 'went'])];
      const result = applyStageMasking(cue, saved);

      const gingToken = result.targetTokens.find((t) => t.text === 'ging');
      expect(gingToken).toBeDefined();
      expect(gingToken?.visible).toBe(false);
      expect(gingToken?.lemma).toBe('gehen');
      expect(gingToken?.stage).toBe(3);

      const maskedNative = result.nativeTokens.find((t) => !t.visible);
      expect(maskedNative).toBeDefined();
      expect(maskedNative?.text).toBe('went');
    });

    it('Leaves unsaved words visible in both sentences', () => {
      const cue: CuePair = {
        startMs: 0,
        endMs: 2000,
        target: 'Wir trinken Wasser.',
        native: 'We drink water.',
      };
      const result = applyStageMasking(cue, []);

      expect(result.targetTokens.every((t) => t.visible)).toBe(true);
      expect(result.nativeTokens.every((t) => t.visible)).toBe(true);
    });

    it('Preserves whitespace and punctuation in targetTokens', () => {
      const cue: CuePair = {
        startMs: 0,
        endMs: 2000,
        target: 'Hallo, wie geht es dir?',
        native: 'Hello, how are you?',
      };
      const result = applyStageMasking(cue, []);
      const reconstructed = result.targetTokens.map((t) => t.text).join('');
      expect(reconstructed).toBe('Hallo, wie geht es dir?');
    });

    it('Preserves exact text in nativeTokens when glosses are masked', () => {
      const cue: CuePair = {
        startMs: 0,
        endMs: 2000,
        target: 'Das Buch liegt auf dem Tisch.',
        native: 'The book is lying on the table.',
      };
      const saved = [makeWord('Buch', 2, ['book'])];
      const result = applyStageMasking(cue, saved);

      const reconstructed = result.nativeTokens.map((t) => t.text).join('');
      expect(reconstructed).toBe('The book is lying on the table.');
    });

    it('Gracefully handles missing target or native strings', () => {
      const cue: CuePair = {
        startMs: 0,
        endMs: 1000,
        target: '',
        native: '',
      };
      const result = applyStageMasking(cue, [makeWord('Haus', 3, ['house'])]);
      expect(result.targetTokens).toEqual([]);
      expect(result.nativeTokens).toEqual([]);
    });

    it('Fails safely when native gloss cannot be identified', () => {
      const cue: CuePair = {
        startMs: 0,
        endMs: 2000,
        target: 'Er liest ein Buch.',
        native: 'He is reading a novel.', // "novel" doesn't match gloss "book"
      };
      const saved = [makeWord('Buch', 2, ['book'])];
      const result = applyStageMasking(cue, saved);

      // German word is visible
      const buch = result.targetTokens.find((t) => t.text === 'Buch');
      expect(buch?.visible).toBe(true);
      // English sentence stays fully visible because gloss match failed safely
      expect(result.nativeTokens.every((t) => t.visible)).toBe(true);
    });
  });
});
