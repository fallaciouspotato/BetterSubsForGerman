import { db, type Occurrence } from './schema';

/**
 * Retrieves all occurrences recorded for a given word ID.
 */
export async function getOccurrencesForWord(wordId: number): Promise<Occurrence[]> {
  return await db.occurrences.where('wordId').equals(wordId).toArray();
}

/**
 * Retrieves the most recent occurrence context for a given word ID.
 */
export async function getLatestOccurrenceForWord(wordId: number): Promise<Occurrence | undefined> {
  const list = await db.occurrences.where('wordId').equals(wordId).reverse().toArray();
  return list[0];
}

/**
 * Retrieves all recorded occurrences.
 */
export async function getAllOccurrences(): Promise<Occurrence[]> {
  return await db.occurrences.toArray();
}
