export interface MaskedToken {
  text: string;
  visible: boolean;
  lemma?: string;
  stage?: 1 | 2 | 3;
  originalText?: string;
}

export interface MaskedCuePair {
  startMs: number;
  endMs: number;
  targetTokens: MaskedToken[];
  nativeTokens: MaskedToken[];
}
