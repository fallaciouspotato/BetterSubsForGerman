/**
 * Caption track types — extracted from YouTube player response.
 */

export interface CaptionTrack {
  baseUrl: string;
  name: { simpleText?: string; runs?: Array<{ text: string }> };
  languageCode: string;
  vssId: string;
  kind?: string; // 'asr' for auto-generated
  isTranslatable?: boolean;
}

/** Raw timed segment from YouTube timedtext JSON3 format. */
export interface RawTimedTextJson3 {
  events?: Array<{
    tStartMs?: number;
    dDurationMs?: number;
    wWinId?: number;
    segs?: Array<{
      utf8: string;
      tOffsetMs?: number;
      ac?: number;
    }>;
  }>;
}

/** Normalized timed subtitle segment. */
export interface TimedSegment {
  startMs: number;
  durationMs: number;
  endMs: number;
  text: string;
}

/** A paired cue — target (German) + native (English) aligned by timing. */
export interface CuePair {
  startMs: number;
  endMs: number;
  target: string; // German text
  native: string; // English text
  targetWords?: string[]; // Clean individual German tokens
}
