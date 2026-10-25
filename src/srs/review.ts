import { Rating, type Grade, type ReviewLog } from 'ts-fsrs';
import type { Word } from '../db/schema';
import { db } from '../db/schema';
import { parseCard, scheduleNextReview } from './scheduler';

export type StageTransition = 'promoted' | 'demoted' | 'unchanged';

export interface ReviewResult {
  word: Word;
  reviewLog: ReviewLog;
  stageTransition: StageTransition;
}

/**
 * Pure state transformation: applies a review rating to a Word entity.
 * Enforces the 2-day promotion rule:
 *  - Advances stage (1->2 or 2->3) only after correct reviews on at least 2 distinct calendar days.
 *  - A miss (Rating.Again) demotes one stage (never below 1) and resets correctDays.
 */
export function applyReviewToWord(
  word: Word,
  rating: Grade,
  now: Date = new Date()
): ReviewResult {
  const currentCard = parseCard(word.srsCardJson, now);
  const { card: nextCard, log: reviewLog } = scheduleNextReview(currentCard, rating, now);

  const todayIsoDate = now.toISOString().slice(0, 10);
  let stage = word.stage;
  let correctDays = [...(word.correctDays || [])];
  let stageTransition: StageTransition = 'unchanged';

  if (rating === Rating.Again) {
    // Demote one stage (min stage 1) and reset accumulated correct days
    if (stage > 1) {
      stage = (stage - 1) as 1 | 2 | 3;
      stageTransition = 'demoted';
    }
    correctDays = [];
  } else {
    // Correct answer (Hard, Good, or Easy)
    if (!correctDays.includes(todayIsoDate)) {
      correctDays.push(todayIsoDate);
    }

    // Advance stage after correct answers on >= 2 distinct calendar days
    if (correctDays.length >= 2) {
      if (stage < 3) {
        stage = (stage + 1) as 1 | 2 | 3;
        stageTransition = 'promoted';
      }
      correctDays = []; // Reset for the next stage promotion
    }
  }

  const updatedWord: Word = {
    ...word,
    stage,
    correctDays,
    srsCardJson: JSON.stringify(nextCard),
  };

  return {
    word: updatedWord,
    reviewLog,
    stageTransition,
  };
}

/**
 * Executes review in the database: updates Word and appends to Reviews log.
 */
export async function processReview(
  wordId: number,
  rating: Grade,
  now: Date = new Date()
): Promise<ReviewResult> {
  const word = await db.words.get(wordId);
  if (!word) {
    throw new Error(`Word with id ${wordId} not found in database.`);
  }

  const result = applyReviewToWord(word, rating, now);

  await db.words.update(wordId, {
    stage: result.word.stage,
    correctDays: result.word.correctDays,
    srsCardJson: result.word.srsCardJson,
  });

  await db.reviews.add({
    wordId,
    date: now.toISOString(),
    result: rating,
  });

  return result;
}
