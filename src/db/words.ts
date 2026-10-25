import { db, type Word } from './schema';
import { createEmptyCard } from 'ts-fsrs';

export interface SaveWordParams {
  lemma: string;
  language?: string;
  glosses: string[];
  videoId: string;
  timestampMs: number;
  sentenceTarget: string;
  sentenceNative: string;
}

/**
 * Saves a word to the words table (or increments its occurrence count)
 * and records the occurrence in occurrences table.
 */
export async function saveWord(params: SaveWordParams): Promise<{ word: Word; isNew: boolean }> {
  const language = params.language || 'de';
  const nowIso = new Date().toISOString();

  // Check if word already exists
  let word = await db.words.where({ lemma: params.lemma, language }).first();
  let isNew = false;

  if (!word) {
    isNew = true;
    const initialCard = createEmptyCard(new Date());
    const newWord: Word = {
      lemma: params.lemma,
      language,
      glosses: params.glosses,
      stage: 1,
      srsCardJson: JSON.stringify(initialCard),
      correctDays: [],
      firstSeen: nowIso,
      timesSeen: 1,
    };

    const id = await db.words.add(newWord);
    newWord.id = id;
    word = newWord;
  } else {
    // Word exists; increment seen counter
    const updatedTimesSeen = (word.timesSeen || 1) + 1;
    await db.words.update(word.id!, { timesSeen: updatedTimesSeen });
    word.timesSeen = updatedTimesSeen;
  }

  // Insert occurrence
  await db.occurrences.add({
    wordId: word.id!,
    videoId: params.videoId,
    timestampMs: params.timestampMs,
    sentenceTarget: params.sentenceTarget,
    sentenceNative: params.sentenceNative,
  });

  return { word, isNew };
}

/**
 * Checks if a lemma has been saved.
 */
export async function isWordSaved(lemma: string, language: string = 'de'): Promise<boolean> {
  const count = await db.words.where({ lemma, language }).count();
  return count > 0;
}

/**
 * Retrieves all saved words.
 */
export async function getAllWords(language: string = 'de'): Promise<Word[]> {
  return await db.words.where('language').equals(language).toArray();
}
