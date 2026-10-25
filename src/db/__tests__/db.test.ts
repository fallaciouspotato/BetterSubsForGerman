import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../schema';
import { saveWord, isWordSaved, getAllWords } from '../words';

describe('db/words', () => {
  beforeEach(async () => {
    await db.words.clear();
    await db.occurrences.clear();
  });

  it('saves a new word and adds an occurrence', async () => {
    const res = await saveWord({
      lemma: 'hund',
      glosses: ['dog'],
      videoId: 'vid123',
      timestampMs: 4500,
      sentenceTarget: 'Das ist ein Hund.',
      sentenceNative: 'That is a dog.',
    });

    expect(res.isNew).toBe(true);
    expect(res.word.lemma).toBe('hund');
    expect(res.word.stage).toBe(1);

    const saved = await isWordSaved('hund');
    expect(saved).toBe(true);

    const occurrences = await db.occurrences.where('wordId').equals(res.word.id!).toArray();
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].videoId).toBe('vid123');
  });

  it('increments timesSeen for an already saved word', async () => {
    await saveWord({
      lemma: 'gehen',
      glosses: ['to go'],
      videoId: 'v1',
      timestampMs: 1000,
      sentenceTarget: 'Ich gehe.',
      sentenceNative: 'I go.',
    });

    const res2 = await saveWord({
      lemma: 'gehen',
      glosses: ['to go'],
      videoId: 'v2',
      timestampMs: 2000,
      sentenceTarget: 'Wir gehen.',
      sentenceNative: 'We go.',
    });

    expect(res2.isNew).toBe(false);
    expect(res2.word.timesSeen).toBe(2);

    const all = await getAllWords();
    expect(all).toHaveLength(1);

    const occurrences = await db.occurrences.where('wordId').equals(res2.word.id!).toArray();
    expect(occurrences).toHaveLength(2);
  });
});
