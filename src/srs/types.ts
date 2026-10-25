import type { Card } from 'ts-fsrs';

/** Word learning stage: 1 = both shown, 2 = native gloss masked, 3 = both masked. */
export type WordStage = 1 | 2 | 3;

export interface WordSrsState {
  wordId: number;
  card: Card;
  stage: WordStage;
  correctDays: string[]; // ISO date strings of distinct days with correct answers
}
