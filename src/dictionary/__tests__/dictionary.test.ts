import { describe, it, expect, beforeAll } from 'vitest';
import { lookupWord, cleanWord } from '../lookup';
import { dictionaryLoader } from '../loader';

describe('dictionary/lookup', () => {
  beforeAll(async () => {
    await dictionaryLoader.load();
  });

  it('cleans punctuation and casing', () => {
    expect(cleanWord('"Hunde!"')).toBe('hunde');
    expect(cleanWord('...groß???')).toBe('groß');
  });

  it('lemmatizes irregular verbs correctly', () => {
    const ging = lookupWord('ging');
    expect(ging).not.toBeNull();
    expect(ging?.lemma).toBe('gehen');
    expect(ging?.glosses).toContain('to go');

    const ist = lookupWord('ist');
    expect(ist?.lemma).toBe('sein');
    expect(ist?.glosses).toContain('to be');
  });

  it('lemmatizes noun plural forms', () => {
    const hunde = lookupWord('Hunde');
    expect(hunde?.lemma).toBe('hund');
    expect(hunde?.glosses).toContain('dog');
  });

  it('looks up direct base forms', () => {
    const sonne = lookupWord('Sonne');
    expect(sonne?.lemma).toBe('sonne');
    expect(sonne?.glosses).toContain('sun');
  });

  it('returns null for unknown words', () => {
    const unknown = lookupWord('xyzabc123');
    expect(unknown).toBeNull();
  });
});
