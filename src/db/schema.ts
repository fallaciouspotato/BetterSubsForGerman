import Dexie, { type EntityTable } from 'dexie';

/** Database schema for the extension's local-first data. */

export interface Word {
  id?: number;
  lemma: string;
  language: string;
  glosses: string[];
  stage: 1 | 2 | 3;
  srsCardJson: string; // Serialized ts-fsrs Card
  correctDays: string[]; // ISO date strings for distinct correct-answer days
  firstSeen: string; // ISO datetime
  timesSeen: number;
}

export interface Occurrence {
  id?: number;
  wordId: number;
  videoId: string;
  timestampMs: number;
  sentenceTarget: string;
  sentenceNative: string;
}

export interface Review {
  id?: number;
  wordId: number;
  date: string; // ISO datetime
  result: number; // ts-fsrs Rating enum value
}

export interface Video {
  videoId: string; // primary key
  title: string;
  tracksAvailable: string;
  lastWatched: string; // ISO datetime
}

export interface Settings {
  key: string; // primary key
  value: string;
}

export interface DictCache {
  word: string; // primary key (clean lowercase word)
  lemma: string;
  pos?: string;
  glosses: string[];
  cachedAt: string;
}

export class DualSubDB extends Dexie {
  words!: EntityTable<Word, 'id'>;
  occurrences!: EntityTable<Occurrence, 'id'>;
  reviews!: EntityTable<Review, 'id'>;
  videos!: EntityTable<Video, 'videoId'>;
  settings!: EntityTable<Settings, 'key'>;
  dictCache!: EntityTable<DictCache, 'word'>;

  constructor() {
    super('DualSubDB');

    // Schema version 3 ensures all stores are recognized cleanly across any previous versions
    this.version(3).stores({
      words: '++id, lemma, language, [lemma+language]',
      occurrences: '++id, wordId, videoId',
      reviews: '++id, wordId, date',
      videos: 'videoId',
      settings: 'key',
      dictCache: 'word',
    });
  }
}

export const db = new DualSubDB();
