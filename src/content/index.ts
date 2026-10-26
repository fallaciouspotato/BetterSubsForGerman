import type { CaptionTrack, CuePair } from './captions/types';
import type { Word } from '../db/schema';
import { selectTracks } from './captions/extractor';
import { fetchTimedText, alignSegments, tokenizeWords } from './captions/fetcher';
import { attachOverlay, hideNativeCaptions, type OverlayContainer } from './overlay/container';
import { SubtitleSyncController } from './overlay/sync';
import { renderQuizBanner, hideQuizBanner } from './overlay/renderer';
import { lookupWordLocal, lookupWordAsync, cleanWord } from '../dictionary/lookup';
import { dictionaryLoader } from '../dictionary/loader';
import { decodeHtmlEntities } from '../utils/text';

function isExtensionValid(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
}

export class DualSubManager {
  private container: OverlayContainer | null = null;
  private syncController: SubtitleSyncController | null = null;
  private currentVideoId: string | null = null;
  private currentVideoEl: HTMLVideoElement | null = null;
  private hoverTimeout: number | null = null;
  private leaveTimeout: number | null = null;
  private activeWord: string | null = null;
  private isMouseOverCard: boolean = false;
  private sentenceTranslationPending = new Set<string>();
  private sessionSavedLemmas = new Set<string>();
  // Tracks how far ahead subtitles have been batch-buffered
  private bufferedUntilIndex: number = -1;
  private isProcessingTracks: boolean = false;
  private learningMode: 'immersion' | 'reverse' = 'immersion';

  constructor() {
    dictionaryLoader.load().catch((err) => {
      console.warn('[dual-sub] Failed to load local dictionary:', err);
    });
  }

  public hasCues(): boolean {
    return !!(this.syncController && this.syncController.getCuesCount() > 0);
  }

  public onVideoNavigated(newVideoId: string): void {
    if (this.currentVideoId === newVideoId && this.hasCues()) {
      // Already has cues for this video; do not wipe them
      return;
    }
    this.isProcessingTracks = false;
    this.learningMode = 'immersion';
    this.currentVideoId = newVideoId;
    this.sessionSavedLemmas.clear();
    this.sentenceTranslationPending.clear();
    this.bufferedUntilIndex = -1;
    if (this.syncController) {
      this.syncController.setCues([]);
    }
    if (this.container?.wrapper) {
      hideQuizBanner(this.container.wrapper);
    }
  }

  public resetVideo(): void {
    this.isProcessingTracks = false;
    this.learningMode = 'immersion';
    this.currentVideoId = null;
    this.sessionSavedLemmas.clear();
    this.sentenceTranslationPending.clear();
    this.bufferedUntilIndex = -1;
    if (this.syncController) {
      this.syncController.setCues([]);
    }
    if (this.container?.wrapper) {
      hideQuizBanner(this.container.wrapper);
    }
  }

  public async onTracksDiscovered(rawTracks: CaptionTrack[], videoId?: string): Promise<void> {
    const activeVideoId = videoId || new URLSearchParams(window.location.search).get('v');
    if (!activeVideoId) return;

    if (this.currentVideoId === activeVideoId && this.hasCues()) {
      return;
    }

    if (this.isProcessingTracks && this.currentVideoId === activeVideoId) {
      return;
    }

    // Normalize track items
    const tracks: CaptionTrack[] = rawTracks
      .map((t: any) => ({
        baseUrl: t.baseUrl || t.url || '',
        languageCode: t.languageCode || t.language_code || t.lang || '',
        vssId: t.vssId || t.vss_id || '',
        name: typeof t.name === 'string' ? { simpleText: t.name } : t.name,
        kind: t.kind,
        isTranslatable: t.isTranslatable ?? t.is_translatable,
      }))
      .filter((t) => !!t.baseUrl);

    if (tracks.length === 0) return;

    this.isProcessingTracks = true;
    try {
      // Immediately hide YouTube native captions so they never bleed through while processing
      hideNativeCaptions();

      // Reset session state if switching to a new video
      if (this.currentVideoId !== activeVideoId) {
        this.sessionSavedLemmas.clear();
        this.sentenceTranslationPending.clear();
        this.bufferedUntilIndex = -1;
        if (this.syncController) {
          this.syncController.setCues([]);
        }
        if (this.container?.wrapper) {
          hideQuizBanner(this.container.wrapper);
        }
      }

      this.currentVideoId = activeVideoId;
      console.log(`[dual-sub:bridge] Processing ${tracks.length} tracks for video: ${activeVideoId}`);

      const { targetTrack, nativeTrack } = selectTracks(tracks, 'de', 'en');

      let targetSegments: import('./captions/types').TimedSegment[] = [];
      let nativeSegments: import('./captions/types').TimedSegment[] = [];

      // Fetch target track (German) and native track (English) concurrently for minimal latency
      const [targetResult, nativeResult] = await Promise.allSettled([
        targetTrack && targetTrack.baseUrl
          ? fetchTimedText(targetTrack.baseUrl)
          : Promise.resolve([]),
        nativeTrack && nativeTrack.baseUrl
          ? fetchTimedText(nativeTrack.baseUrl)
          : Promise.resolve([]),
      ]);

      if (targetResult.status === 'fulfilled') {
        targetSegments = targetResult.value;
      } else {
        if (targetTrack?.vssId?.startsWith('t.')) {
          console.log('[dual-sub:bridge] Auto-translated target track not available via URL; using dynamic lookahead translation.');
        } else {
          console.warn('[dual-sub:bridge] Target track fetch failed; will attempt fallback:', targetResult.reason?.message);
        }
      }

      if (nativeResult.status === 'fulfilled') {
        nativeSegments = nativeResult.value;
      } else {
        console.log('[dual-sub:bridge] Native track fetch failed:', nativeResult.reason?.message);
      }

      // 3. Fallback: if both failed or target was empty, try raw tracks from YouTube directly
      if (targetSegments.length === 0 && nativeSegments.length === 0) {
        for (const track of tracks) {
          try {
            const fallbackSegments = await fetchTimedText(track.baseUrl);
            if (fallbackSegments.length > 0) {
              console.log('[dual-sub:bridge] Loaded fallback track:', track.name?.simpleText || track.languageCode);
              if (track.languageCode === 'de') {
                targetSegments = fallbackSegments;
              } else {
                nativeSegments = fallbackSegments;
              }
              break;
            }
          } catch {
            // Try next track
          }
        }
      }

      if (targetSegments.length === 0 && nativeSegments.length === 0) {
        console.warn('[dual-sub:bridge] Could not retrieve captions from any available tracks.');
        return;
      }

      // Detect Learning Mode:
      // - "reverse": English (or non-German) video dialogue with German target subtitles (either auto-translated from YouTube or dynamically translated)
      // - "immersion": German video dialogue with English reference
      const hasNativeGermanTrack = tracks.some(
        (t) =>
          (t.languageCode?.toLowerCase() === 'de' || t.languageCode?.toLowerCase().startsWith('de-')) &&
          (!t.vssId || !t.vssId.startsWith('t.')) &&
          !t.baseUrl.includes('tlang=')
      );
      const isReverseMode =
        !hasNativeGermanTrack ||
        targetTrack?.vssId?.startsWith('t.') ||
        targetTrack?.baseUrl?.includes('tlang=') ||
        (targetSegments.length === 0 && nativeSegments.length > 0);

      this.learningMode = isReverseMode ? 'reverse' : 'immersion';
      console.log(
        `[dual-sub:bridge] Mode set to: ${this.learningMode.toUpperCase()} (${
          isReverseMode
            ? 'Reverse Learning: English speech -> German target subtitles'
            : 'Immersion: German speech -> English reference'
        })`
      );

      const cues = alignSegments(targetSegments, nativeSegments);
      console.log(`[dual-sub:bridge] Synchronized ${cues.length} dual-subtitle cues.`);

      await this.initOverlay(cues);

      // Pre-buffer the first chunk of cues immediately (15 cues covers ~45-60s of video)
      this.bufferedUntilIndex = Math.min(DualSubManager.LOOKAHEAD_SIZE, cues.length);
      this.prefetchLookahead(0, DualSubManager.LOOKAHEAD_SIZE, cues);
    } catch (err) {
      console.error('[dual-sub:bridge] Error initializing overlay cues:', err);
    } finally {
      this.isProcessingTracks = false;
    }
  }

  /**
   * Batch-translates cues in a sliding window of LOOKAHEAD_SIZE starting at `fromIndex`.
   * Only requests cues that are still missing their translation, grouped into a single
   * HTTP request to avoid triggering Google rate-limits.
   */
  private static readonly LOOKAHEAD_SIZE = 15;

  private prefetchLookahead(fromIndex: number, count: number, cues: CuePair[]): void {
    if (!isExtensionValid() || cues.length === 0) return;

    const start = Math.max(0, fromIndex);
    const end = Math.min(start + count, cues.length);
    const missing: Array<{ cue: CuePair; key: string; direction: 'de->en' | 'en->de' }> = [];

    for (let i = start; i < end; i++) {
      const cue = cues[i];
      if (!cue.native && cue.target) {
        const key = `de:${cue.target}`;
        if (!this.sentenceTranslationPending.has(key)) {
          missing.push({ cue, key, direction: 'de->en' });
          this.sentenceTranslationPending.add(key);
        }
      } else if (!cue.target && cue.native) {
        const key = `en:${cue.native}`;
        if (!this.sentenceTranslationPending.has(key)) {
          missing.push({ cue, key, direction: 'en->de' });
          this.sentenceTranslationPending.add(key);
        }
      }
    }

    if (missing.length === 0) return;

    // Separate by direction and batch each group in a single request
    const deToEn = missing.filter((m) => m.direction === 'de->en');
    const enToDe = missing.filter((m) => m.direction === 'en->de');

    if (deToEn.length > 0) {
      chrome.runtime
        .sendMessage({
          type: 'TRANSLATE_SENTENCES_BATCH',
          texts: deToEn.map((m) => m.cue.target!),
          fromLang: 'de',
          toLang: 'en',
        })
        .then((resp) => {
          if (resp && resp.success && Array.isArray(resp.translations)) {
            deToEn.forEach((m, i) => {
              const translation: string = decodeHtmlEntities(resp.translations[i] ?? '');
              if (translation) {
                m.cue.native = translation;
                if (this.syncController?.getCurrentCue() === m.cue) {
                  this.syncController.renderCurrentCue();
                }
              }
            });
          }
        })
        .catch(() => {})
        .finally(() => deToEn.forEach((m) => this.sentenceTranslationPending.delete(m.key)));
    }

    if (enToDe.length > 0) {
      chrome.runtime
        .sendMessage({
          type: 'TRANSLATE_SENTENCES_BATCH',
          texts: enToDe.map((m) => m.cue.native!),
          fromLang: 'en',
          toLang: 'de',
        })
        .then((resp) => {
          if (resp && resp.success && Array.isArray(resp.translations)) {
            enToDe.forEach((m, i) => {
              const translation: string = decodeHtmlEntities(resp.translations[i] ?? '');
              if (translation) {
                m.cue.target = translation;
                m.cue.targetWords = tokenizeWords(translation);
                if (this.syncController?.getCurrentCue() === m.cue) {
                  this.syncController.renderCurrentCue();
                }
              }
            });
          }
        })
        .catch(() => {})
        .finally(() => enToDe.forEach((m) => this.sentenceTranslationPending.delete(m.key)));
    }
  }

  private translateCueIfNeeded(cue: CuePair): void {
    if (!isExtensionValid()) return;

    if (!cue.native && cue.target) {
      const key = `de:${cue.target}`;
      if (this.sentenceTranslationPending.has(key)) return;
      this.sentenceTranslationPending.add(key);
      chrome.runtime
        .sendMessage({ type: 'TRANSLATE_SENTENCE', text: cue.target, fromLang: 'de', toLang: 'en' })
        .then((resp) => {
          if (resp?.success && resp.translation) {
            cue.native = decodeHtmlEntities(resp.translation);
            if (this.syncController?.getCurrentCue() === cue) {
              this.syncController.renderCurrentCue();
            }
          }
        })
        .catch(() => {})
        .finally(() => this.sentenceTranslationPending.delete(key));
      return;
    }

    if (!cue.target && cue.native) {
      const key = `en:${cue.native}`;
      if (this.sentenceTranslationPending.has(key)) return;
      this.sentenceTranslationPending.add(key);
      chrome.runtime
        .sendMessage({ type: 'TRANSLATE_SENTENCE', text: cue.native, fromLang: 'en', toLang: 'de' })
        .then((resp) => {
          if (resp?.success && resp.translation) {
            const decoded = decodeHtmlEntities(resp.translation);
            cue.target = decoded;
            cue.targetWords = tokenizeWords(decoded);
            if (this.syncController?.getCurrentCue() === cue) {
              this.syncController.renderCurrentCue();
            }
          }
        })
        .catch(() => {})
        .finally(() => this.sentenceTranslationPending.delete(key));
    }
  }

  private async initOverlay(cues: CuePair[]): Promise<void> {
    const player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
    const isContainerValid = this.container && this.container.host.isConnected && (!player || player.contains(this.container.host));

    if (!isContainerValid) {
      let retries = 0;
      while (retries < 15) {
        this.container = attachOverlay();
        if (this.container) break;
        retries++;
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    if (!this.container) {
      console.error('[dual-sub:bridge] Could not find YouTube player element to attach overlay.');
      return;
    }

    if (!this.syncController) {
      this.syncController = new SubtitleSyncController(this.container.wrapper, {
        onWordHover: (word, _element) => {
          this.handleWordHover(word);
        },
        onWordLeave: () => {
          this.handleWordLeave();
        },
        onWordClick: (word, _element) => {
          this.handleWordClick(word);
        },
        onCueChange: (cue) => {
          const currentCueIndex = this.syncController?.getCurrentCueIndex() ?? -1;
          const allCues = this.syncController?.getCues() ?? [];

          if (allCues.length > 0 && currentCueIndex >= 0) {
            // 1. Detect seek (jumped forward past buffer, or jumped far backward)
            if (
              currentCueIndex >= this.bufferedUntilIndex ||
              currentCueIndex < this.bufferedUntilIndex - DualSubManager.LOOKAHEAD_SIZE * 2
            ) {
              this.bufferedUntilIndex = Math.min(currentCueIndex + DualSubManager.LOOKAHEAD_SIZE, allCues.length);
              this.prefetchLookahead(currentCueIndex, DualSubManager.LOOKAHEAD_SIZE, allCues);
            }
            // 2. Continuous playback: extend when within 5 cues of the end of the buffered window
            else if (currentCueIndex >= this.bufferedUntilIndex - 5 && this.bufferedUntilIndex < allCues.length) {
              const nextCount = Math.min(DualSubManager.LOOKAHEAD_SIZE, allCues.length - this.bufferedUntilIndex);
              this.prefetchLookahead(this.bufferedUntilIndex, nextCount, allCues);
              this.bufferedUntilIndex += nextCount;
            }
          }

          // Safety net: immediately translate current cue if still missing
          this.translateCueIfNeeded(cue);
        },
      });
    } else {
      this.syncController.setWrapper(this.container.wrapper);
    }

    this.syncController.setLearningMode(this.learningMode);
    this.syncController.setCues(cues);

    // Retrieve saved words via background service worker
    try {
      if (isExtensionValid()) {
        const resp = await chrome.runtime.sendMessage({ type: 'GET_ALL_WORDS', language: 'de' });
        if (resp && resp.success && Array.isArray(resp.words)) {
          this.syncController.setSavedWords(resp.words);
        }
      }
    } catch {
      // Ignore background message failure
    }

    let videoEl = (document.querySelector('#movie_player video') ||
      document.querySelector('video.html5-main-video') ||
      document.querySelector('video')) as HTMLVideoElement | null;

    if (!videoEl) {
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 200));
        videoEl = (document.querySelector('#movie_player video') ||
          document.querySelector('video.html5-main-video') ||
          document.querySelector('video')) as HTMLVideoElement | null;
        if (videoEl) break;
      }
    }

    if (videoEl) {
      if (this.currentVideoEl && this.currentVideoEl !== videoEl) {
        this.currentVideoEl.removeEventListener('ended', this.handleVideoEnded);
      }
      this.currentVideoEl = videoEl;
      this.currentVideoEl.addEventListener('ended', this.handleVideoEnded);
      this.syncController.attachVideo(videoEl);
      console.log('[dual-sub:bridge] Video element attached to subtitle sync controller.');
    } else {
      console.warn('[dual-sub:bridge] Video element not found to attach subtitle sync.');
    }
  }

  private handleVideoEnded = (): void => {
    if (this.sessionSavedLemmas.size > 0 && this.container?.wrapper) {
      renderQuizBanner(
        this.container.wrapper,
        this.sessionSavedLemmas.size,
        () => {
          if (isExtensionValid()) {
            chrome.runtime.sendMessage({ type: 'OPEN_QUIZ' });
          }
          if (this.container?.wrapper) {
            hideQuizBanner(this.container.wrapper);
          }
        },
        () => {
          if (this.container?.wrapper) {
            hideQuizBanner(this.container.wrapper);
          }
        }
      );
    }
  };

  private handleWordHover(word: string): void {
    this.activeWord = word;
    if (this.leaveTimeout !== null) {
      window.clearTimeout(this.leaveTimeout);
      this.leaveTimeout = null;
    }
    if (this.hoverTimeout !== null) {
      window.clearTimeout(this.hoverTimeout);
    }

    this.hoverTimeout = window.setTimeout(() => {
      if (this.activeWord === word) {
        this.presentCard(word, false);
      }
    }, 120);
  }

  private handleWordLeave(): void {
    if (this.hoverTimeout !== null) {
      window.clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }

    this.scheduleHideCard();
  }

  private scheduleHideCard(): void {
    if (this.leaveTimeout !== null) {
      window.clearTimeout(this.leaveTimeout);
    }
    this.leaveTimeout = window.setTimeout(() => {
      if (!this.isMouseOverCard) {
        this.activeWord = null;
        this.syncController?.hideCard(false);
      }
    }, 180);
  }

  private handleWordClick(word: string): void {
    // If user clicked the word whose card is already pinned, toggle it closed!
    if (this.syncController?.getIsCardPinned() && this.activeWord === word) {
      this.activeWord = null;
      this.isMouseOverCard = false;
      this.syncController.hideCard(true);
      return;
    }

    this.activeWord = word;
    if (this.hoverTimeout !== null) {
      window.clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    if (this.leaveTimeout !== null) {
      window.clearTimeout(this.leaveTimeout);
      this.leaveTimeout = null;
    }

    this.presentCard(word, true);
  }

  private presentCard(word: string, pinned: boolean): void {
    if (!this.syncController) return;

    // Fast path: synchronous local lookup
    let entry = lookupWordLocal(word);
    const lemma = entry ? entry.lemma : cleanWord(word);

    // Synchronous saved check
    let alreadySaved =
      this.sessionSavedLemmas.has(lemma) || this.syncController.hasSavedLemma(lemma);

    const currentCue = this.syncController.getCurrentCue();
    const currentMs = this.currentVideoEl ? Math.round(this.currentVideoEl.currentTime * 1000) : 0;

    const renderCurrentState = (currentEntry: typeof entry, savedStatus: boolean) => {
      // Guard: if user has already hovered away and card isn't pinned or hovered, do not show
      if (!pinned && this.activeWord !== word && !this.isMouseOverCard) {
        return;
      }

      this.syncController?.showCard(
        {
          word,
          entry: currentEntry,
          isSaved: savedStatus,
          isPinned: pinned,
          onSave: async () => {
            alreadySaved = true;
            const targetLemma = currentEntry ? currentEntry.lemma : lemma;
            const glosses = currentEntry ? currentEntry.glosses : [];
            this.sessionSavedLemmas.add(targetLemma);

            try {
              if (isExtensionValid()) {
                const resp = await chrome.runtime.sendMessage({
                  type: 'SAVE_WORD',
                  params: {
                    lemma: targetLemma,
                    language: 'de',
                    glosses,
                    videoId: this.currentVideoId || 'unknown',
                    timestampMs: currentMs,
                    sentenceTarget: currentCue ? currentCue.target : '',
                    sentenceNative: currentCue ? currentCue.native : '',
                  },
                });

                if (resp && resp.success && resp.data) {
                  this.syncController?.addSavedWord(resp.data);
                } else {
                  this.syncController?.addSavedLemma(targetLemma);
                }
              } else {
                this.syncController?.addSavedLemma(targetLemma);
              }
            } catch (err: any) {
              if (err?.message?.includes?.('Extension context invalidated')) {
                this.cleanup();
                return;
              }
              this.syncController?.addSavedLemma(targetLemma);
            }
          },
          onClose: () => {
            this.activeWord = null;
            this.isMouseOverCard = false;
            this.syncController?.hideCard(true);
          },
          onMouseEnter: () => {
            this.isMouseOverCard = true;
            if (this.leaveTimeout !== null) {
              window.clearTimeout(this.leaveTimeout);
              this.leaveTimeout = null;
            }
          },
          onMouseLeave: () => {
            this.isMouseOverCard = false;
            if (!pinned) {
              this.scheduleHideCard();
            }
          },
        },
        pinned
      );
    };

    // Render immediately (0ms) — No await beforehand!
    renderCurrentState(entry, alreadySaved);

    // Asynchronously verify if word is saved (if not already known)
    if (isExtensionValid() && !alreadySaved) {
      chrome.runtime
        .sendMessage({ type: 'IS_WORD_SAVED', lemma, language: 'de' })
        .then((resp) => {
          if (resp && resp.success && resp.isSaved) {
            alreadySaved = true;
            if (this.activeWord === word || pinned) {
              renderCurrentState(entry, true);
            }
          }
        })
        .catch((err) => {
          if (err?.message?.includes?.('Extension context invalidated')) {
            this.cleanup();
          }
        });
    }

    // If local dictionary didn't have an entry or glosses, fetch async from background
    if (!entry || !entry.glosses || entry.glosses.length === 0) {
      lookupWordAsync(word)
        .then((asyncEntry) => {
          if (this.activeWord === word || pinned) {
            if (asyncEntry && asyncEntry.glosses && asyncEntry.glosses.length > 0) {
              entry = asyncEntry;
              renderCurrentState(asyncEntry, alreadySaved);
            } else {
              renderCurrentState(
                {
                  lemma,
                  pos: 'word',
                  glosses: ['(no translation available)'],
                },
                alreadySaved
              );
            }
          }
        })
        .catch((err) => {
          if (err?.message?.includes?.('Extension context invalidated')) {
            this.cleanup();
            return;
          }
          if (this.activeWord === word || pinned) {
            renderCurrentState(
              {
                lemma,
                pos: 'word',
                glosses: ['(no translation available)'],
              },
              alreadySaved
            );
          }
        });
    }
  }

  public cleanup(): void {
    this.activeWord = null;
    this.isMouseOverCard = false;
    this.sessionSavedLemmas.clear();
    this.sentenceTranslationPending.clear();
    if (this.hoverTimeout !== null) {
      window.clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    if (this.leaveTimeout !== null) {
      window.clearTimeout(this.leaveTimeout);
      this.leaveTimeout = null;
    }
    if (this.currentVideoEl) {
      this.currentVideoEl.removeEventListener('ended', this.handleVideoEnded);
      this.currentVideoEl = null;
    }
    if (this.syncController) {
      this.syncController.stop();
    }
    if (this.container) {
      hideQuizBanner(this.container.wrapper);
      this.container.detach();
      this.container = null;
      this.syncController = null;
    }
  }
}
