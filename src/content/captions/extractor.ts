import type { CaptionTrack } from './types';

export interface SelectedTracks {
  targetTrack: CaptionTrack | null;
  nativeTrack: CaptionTrack | null;
}

/**
 * Safely appends or updates tlang without altering or re-encoding other parameters (which would break HMAC signature).
 */
export function appendTlang(baseUrl: string, lang: string): string {
  if (!baseUrl) return '';
  if (baseUrl.includes('tlang=')) {
    return baseUrl.replace(/tlang=[^&]*/, `tlang=${lang}`);
  }
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}tlang=${lang}`;
}

function getTrackLanguage(tr: CaptionTrack): string {
  if (tr.languageCode) return tr.languageCode.toLowerCase();
  if (tr.vssId) {
    const clean = tr.vssId.replace(/^[a.]*/, '').split('.')[0];
    if (clean) return clean.toLowerCase();
  }
  return '';
}

function findBestTrack(tracks: CaptionTrack[], targetLang: string): CaptionTrack | null {
  const t = targetLang.toLowerCase();

  // 1. Exact match manual
  const exactManual = tracks.find(
    (tr) => getTrackLanguage(tr) === t && (!tr.vssId || !tr.vssId.startsWith('a.')) && tr.kind !== 'asr'
  );
  if (exactManual) return exactManual;

  // 2. Regional match manual (e.g. de-DE, de-AT)
  const regionalManual = tracks.find(
    (tr) => getTrackLanguage(tr).startsWith(`${t}-`) && (!tr.vssId || !tr.vssId.startsWith('a.')) && tr.kind !== 'asr'
  );
  if (regionalManual) return regionalManual;

  // 3. Exact match ASR
  const exactAsr = tracks.find(
    (tr) => getTrackLanguage(tr) === t && ((tr.vssId && tr.vssId.startsWith('a.')) || tr.kind === 'asr')
  );
  if (exactAsr) return exactAsr;

  // 4. Regional match ASR (e.g. a.de-DE)
  const regionalAsr = tracks.find(
    (tr) => getTrackLanguage(tr).startsWith(`${t}-`) && ((tr.vssId && tr.vssId.startsWith('a.')) || tr.kind === 'asr')
  );
  if (regionalAsr) return regionalAsr;

  return null;
}

/**
 * Selects the best target and native caption tracks given preferred language codes.
 * Prioritizes manual tracks over auto-generated (ASR) tracks.
 * Seamlessly handles single-caption videos by creating auto-translate candidates.
 */
export function selectTracks(
  tracks: CaptionTrack[],
  targetLang: string = 'de',
  nativeLang: string = 'en'
): SelectedTracks {
  if (!tracks || tracks.length === 0) {
    return { targetTrack: null, nativeTrack: null };
  }

  let targetTrack = findBestTrack(tracks, targetLang);
  let nativeTrack = findBestTrack(tracks, nativeLang);

  // 3. Fallback A: Video has German subtitles, but no English -> candidate auto-translate to English
  if (targetTrack && !nativeTrack && targetTrack.isTranslatable !== false) {
    nativeTrack = {
      baseUrl: appendTlang(targetTrack.baseUrl, nativeLang),
      languageCode: nativeLang,
      name: { simpleText: `English (auto-translated)` },
      vssId: `t.${nativeLang}`,
      kind: 'asr',
    };
  }

  // 4. Fallback B: Video has English subtitles, but no German -> candidate auto-translate to German
  if (!targetTrack && tracks.length > 0) {
    const baseTrack = nativeTrack || tracks[0];
    if (baseTrack && baseTrack.isTranslatable !== false) {
      targetTrack = {
        baseUrl: appendTlang(baseTrack.baseUrl, targetLang),
        languageCode: targetLang,
        name: { simpleText: `German (auto-translated)` },
        vssId: `t.${targetLang}`,
        kind: 'asr',
      };
    }

    if (!nativeTrack) {
      const isBaseNative =
        baseTrack.languageCode?.toLowerCase() === nativeLang.toLowerCase() ||
        baseTrack.languageCode?.toLowerCase().startsWith(`${nativeLang.toLowerCase()}-`);
      if (isBaseNative) {
        nativeTrack = baseTrack;
      } else if (baseTrack && baseTrack.isTranslatable !== false) {
        nativeTrack = {
          baseUrl: appendTlang(baseTrack.baseUrl, nativeLang),
          languageCode: nativeLang,
          name: { simpleText: `English (auto-translated)` },
          vssId: `t.${nativeLang}`,
          kind: 'asr',
        };
      }
    }
  }

  return { targetTrack, nativeTrack };
}
