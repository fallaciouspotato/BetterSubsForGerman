export interface DictionaryEntry {
  lemma: string;
  pos?: string;
  glosses: string[];
}

export type FormToLemmaMap = Record<string, string>;
export type LemmaToGlossMap = Record<string, { pos?: string; glosses: string[] }>;
