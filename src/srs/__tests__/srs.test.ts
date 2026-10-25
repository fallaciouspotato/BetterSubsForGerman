import { describe, it, expect, beforeEach } from 'vitest';
import { Rating, createInitialCard, parseCard, isWordDue, filterDueWords } from '../scheduler';
import { applyReviewToWord, processReview } from '../review';
import { db, type Word } from '../../db/schema';

describe('srs/scheduler', () => {
  it('creates an empty initial card with state New', () => {
    const card = createInitialCard();
    expect(card.state).toBe(0); // State.New
    expect(card.reps).toBe(0);
    expect(card.due).toBeInstanceOf(Date);
  });

  it('determines if card is due based on timestamp', () => {
    const now = new Date('2026-10-25T12:00:00Z');
    const pastCard = { ...createInitialCard(now), due: new Date('2026-10-25T10:00:00Z') };
    const futureCard = { ...createInitialCard(now), due: new Date('2026-10-25T15:00:00Z') };

    expect(isWordDue(pastCard, now)).toBe(true);
    expect(isWordDue(futureCard, now)).toBe(false);
  });

  it('filters and sorts due words most overdue first', () => {
    const now = new Date('2026-10-25T12:00:00Z');

    const word1: Word = {
      id: 1,
      lemma: 'hund',
      language: 'de',
      glosses: ['dog'],
      stage: 1,
      srsCardJson: JSON.stringify({ ...createInitialCard(now), due: new Date('2026-10-25T08:00:00Z') }),
      correctDays: [],
      firstSeen: now.toISOString(),
      timesSeen: 1,
    };

    const word2: Word = {
      id: 2,
      lemma: 'katze',
      language: 'de',
      glosses: ['cat'],
      stage: 1,
      srsCardJson: JSON.stringify({ ...createInitialCard(now), due: new Date('2026-10-25T10:00:00Z') }),
      correctDays: [],
      firstSeen: now.toISOString(),
      timesSeen: 1,
    };

    const word3: Word = {
      id: 3,
      lemma: 'pferd',
      language: 'de',
      glosses: ['horse'],
      stage: 1,
      srsCardJson: JSON.stringify({ ...createInitialCard(now), due: new Date('2026-10-25T14:00:00Z') }), // not due
      correctDays: [],
      firstSeen: now.toISOString(),
      timesSeen: 1,
    };

    const due = filterDueWords([word2, word3, word1], now);
    expect(due).toHaveLength(2);
    expect(due[0].lemma).toBe('hund'); // 08:00 is more overdue than 10:00
    expect(due[1].lemma).toBe('katze');
  });
});

describe('srs/review - 2-Day Promotion Rule', () => {
  function makeWord(stage: 1 | 2 | 3 = 1, correctDays: string[] = []): Word {
    const now = new Date('2026-10-20T10:00:00Z');
    return {
      id: 1,
      lemma: 'schwein',
      language: 'de',
      glosses: ['pig'],
      stage,
      srsCardJson: JSON.stringify(createInitialCard(now)),
      correctDays,
      firstSeen: now.toISOString(),
      timesSeen: 1,
    };
  }

  it('keeps word at Stage 1 after only 1 correct day', () => {
    const day1 = new Date('2026-10-25T10:00:00Z');
    const word = makeWord(1, []);

    const res = applyReviewToWord(word, Rating.Good, day1);
    expect(res.word.stage).toBe(1);
    expect(res.stageTransition).toBe('unchanged');
    expect(res.word.correctDays).toEqual(['2026-10-25']);
  });

  it('does not increment days if multiple correct reviews happen on the same calendar day', () => {
    const day1Morning = new Date('2026-10-25T09:00:00Z');
    const day1Evening = new Date('2026-10-25T20:00:00Z');
    let word = makeWord(1, []);

    word = applyReviewToWord(word, Rating.Good, day1Morning).word;
    const res = applyReviewToWord(word, Rating.Good, day1Evening);

    expect(res.word.stage).toBe(1);
    expect(res.word.correctDays).toEqual(['2026-10-25']);
  });

  it('promotes word from Stage 1 to Stage 2 on second distinct correct day', () => {
    const day1 = new Date('2026-10-25T10:00:00Z');
    const day2 = new Date('2026-10-26T10:00:00Z');
    let word = makeWord(1, []);

    word = applyReviewToWord(word, Rating.Good, day1).word;
    const res = applyReviewToWord(word, Rating.Good, day2);

    expect(res.stageTransition).toBe('promoted');
    expect(res.word.stage).toBe(2);
    // Counter resets after promotion
    expect(res.word.correctDays).toEqual([]);
  });

  it('promotes word from Stage 2 to Stage 3 after two more distinct days', () => {
    const day3 = new Date('2026-10-28T10:00:00Z');
    const day4 = new Date('2026-10-29T10:00:00Z');
    let word = makeWord(2, []);

    word = applyReviewToWord(word, Rating.Good, day3).word;
    const res = applyReviewToWord(word, Rating.Good, day4);

    expect(res.stageTransition).toBe('promoted');
    expect(res.word.stage).toBe(3);
  });

  it('caps promotion at Stage 3', () => {
    const day5 = new Date('2026-11-01T10:00:00Z');
    const day6 = new Date('2026-11-02T10:00:00Z');
    let word = makeWord(3, []);

    word = applyReviewToWord(word, Rating.Good, day5).word;
    const res = applyReviewToWord(word, Rating.Easy, day6);

    expect(res.word.stage).toBe(3);
  });

  it('demotes word from Stage 2 to Stage 1 on Rating.Again (miss)', () => {
    const day = new Date('2026-10-25T10:00:00Z');
    const word = makeWord(2, ['2026-10-24']);

    const res = applyReviewToWord(word, Rating.Again, day);
    expect(res.stageTransition).toBe('demoted');
    expect(res.word.stage).toBe(1);
    expect(res.word.correctDays).toEqual([]);
  });

  it('demotes word from Stage 3 to Stage 2 on Rating.Again (miss)', () => {
    const day = new Date('2026-10-25T10:00:00Z');
    const word = makeWord(3, ['2026-10-24']);

    const res = applyReviewToWord(word, Rating.Again, day);
    expect(res.stageTransition).toBe('demoted');
    expect(res.word.stage).toBe(2);
    expect(res.word.correctDays).toEqual([]);
  });

  it('never demotes below Stage 1', () => {
    const day = new Date('2026-10-25T10:00:00Z');
    const word = makeWord(1, []);

    const res = applyReviewToWord(word, Rating.Again, day);
    expect(res.word.stage).toBe(1);
    expect(res.stageTransition).toBe('unchanged');
    expect(res.word.correctDays).toEqual([]);
  });
});
