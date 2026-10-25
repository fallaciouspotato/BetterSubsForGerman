import {
  fsrs,
  createEmptyCard,
  Rating,
  type Card,
  type ReviewLog,
  type Grade,
} from 'ts-fsrs';
import type { Word } from '../db/schema';

// Initialize FSRS with standard language-learning retention (90%)
export const f = fsrs({
  request_retention: 0.9,
  maximum_interval: 365,
});

export { Rating, type Card, type ReviewLog, type Grade };

/**
 * Creates an empty FSRS card initialized for a newly saved word.
 */
export function createInitialCard(now: Date = new Date()): Card {
  return createEmptyCard(now);
}

/**
 * Computes next FSRS scheduling state given a rating and review timestamp.
 */
export function scheduleNextReview(
  card: Card,
  rating: Grade,
  now: Date = new Date()
): { card: Card; log: ReviewLog } {
  const result = f.next(card, now, rating);
  return {
    card: result.card,
    log: result.log,
  };
}

/**
 * Parses serialized FSRS card JSON from the database safely.
 */
export function parseCard(cardJson: string, fallbackDate: Date = new Date()): Card {
  try {
    const raw = JSON.parse(cardJson);
    return {
      ...raw,
      due: new Date(raw.due),
      last_review: raw.last_review ? new Date(raw.last_review) : undefined,
    };
  } catch {
    return createInitialCard(fallbackDate);
  }
}

/**
 * Determines whether a word is currently due for review.
 */
export function isWordDue(card: Card, now: Date = new Date()): boolean {
  const dueDate = card.due instanceof Date ? card.due : new Date(card.due);
  return dueDate.getTime() <= now.getTime();
}

/**
 * Filters a list of words to those due for review, sorted most overdue first.
 */
export function filterDueWords(words: Word[], now: Date = new Date()): Word[] {
  return words
    .filter((w) => {
      const card = parseCard(w.srsCardJson, now);
      return isWordDue(card, now);
    })
    .sort((a, b) => {
      const cardA = parseCard(a.srsCardJson, now);
      const cardB = parseCard(b.srsCardJson, now);
      return new Date(cardA.due).getTime() - new Date(cardB.due).getTime();
    });
}
