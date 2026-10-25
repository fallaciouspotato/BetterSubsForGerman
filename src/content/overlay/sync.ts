import type { CuePair } from '../captions/types';
import type { Word } from '../../db/schema';
import { renderCue, renderCard, type WordInteractionHandlers, type CardState } from './renderer';
import { applyStageMasking, buildSavedWordsMap } from '../../masking/stage-masker';

export interface SubtitleSyncCallbacks extends WordInteractionHandlers {
  onCueChange?: (cue: CuePair) => void;
}

export class SubtitleSyncController {
  private video: HTMLVideoElement | null = null;
  private cues: CuePair[] = [];
  private wrapper: HTMLElement;
  private handlers?: SubtitleSyncCallbacks;
  private animationFrameId: number | null = null;
  private currentCueIndex: number = -1;
  private isRunning: boolean = false;
  private savedLemmas: Set<string> = new Set();
  private savedWordsMap: Map<string, Word> = new Map();
  private isCardPinned: boolean = false;

  constructor(wrapper: HTMLElement, handlers?: SubtitleSyncCallbacks) {
    this.wrapper = wrapper;
    this.handlers = handlers;
    document.addEventListener('click', this.handleDocumentClick);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  public hasSavedLemma(lemma: string): boolean {
    return this.savedLemmas.has(lemma.toLowerCase());
  }

  public getIsCardPinned(): boolean {
    return this.isCardPinned;
  }

  public isCardOpen(): boolean {
    return !!this.wrapper.querySelector('.dual-sub-card');
  }

  public setWrapper(wrapper: HTMLElement): void {
    this.wrapper = wrapper;
  }

  public getCuesCount(): number {
    return this.cues.length;
  }

  public getCues(): CuePair[] {
    return this.cues;
  }

  public getCurrentCueIndex(): number {
    return this.currentCueIndex;
  }

  public setCues(cues: CuePair[]): void {
    this.cues = cues.slice().sort((a, b) => a.startMs - b.startMs);
    this.currentCueIndex = -1;
    if (this.video) {
      this.updateForTime(this.video.currentTime * 1000);
    }
  }

  public setSavedLemmas(lemmas: Set<string>): void {
    this.savedLemmas = lemmas;
    this.renderCurrentCue();
  }

  public setSavedWords(words: Word[]): void {
    this.savedWordsMap = buildSavedWordsMap(words);
    this.savedLemmas = new Set(words.map((w) => w.lemma.toLowerCase()));
    this.renderCurrentCue();
  }

  public addSavedWord(word: Word): void {
    this.savedWordsMap.set(word.lemma.toLowerCase(), word);
    this.savedLemmas.add(word.lemma.toLowerCase());
    this.renderCurrentCue();
  }

  public addSavedLemma(lemma: string): void {
    this.savedLemmas.add(lemma.toLowerCase());
    this.renderCurrentCue();
  }

  public showCard(state: CardState, pinned: boolean = false): void {
    if (this.isCardPinned && !pinned) {
      // Don't overwrite a pinned card with a hover card
      return;
    }
    this.isCardPinned = pinned;
    renderCard(this.wrapper, {
      ...state,
      isPinned: pinned,
      onClose: () => {
        this.hideCard(true);
        state.onClose?.();
      },
    });
  }

  public hideCard(force: boolean = false): void {
    if (this.isCardPinned && !force) {
      return;
    }
    this.isCardPinned = false;
    renderCard(this.wrapper, null);
  }

  private handleDocumentClick = (e: MouseEvent): void => {
    if (!this.isCardOpen()) return;
    const target = e.target as Node | null;
    if (!target) return;
    // Check if clicked inside host or wrapper
    const host = document.getElementById('dual-sub-overlay-host');
    if (host && (host === target || host.contains(target))) return;
    if (this.wrapper.contains(target)) return;

    this.hideCard(true);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.hideCard(true);
    }
  };

  public getCurrentCue(): CuePair | null {
    if (this.currentCueIndex >= 0 && this.currentCueIndex < this.cues.length) {
      return this.cues[this.currentCueIndex];
    }
    return null;
  }

  public renderCurrentCue(): void {
    const cue = this.getCurrentCue();
    if (!cue) {
      renderCue(this.wrapper, null, this.savedLemmas, this.handlers);
      return;
    }

    const masked = applyStageMasking(cue, this.savedWordsMap);
    renderCue(this.wrapper, cue, this.savedLemmas, this.handlers, masked);
  }

  public attachVideo(video: HTMLVideoElement): void {
    if (this.video && this.video !== video) {
      this.video.removeEventListener('seeked', this.handleSeeked);
      this.video.removeEventListener('timeupdate', this.handleTimeUpdate);
    }
    this.video = video;
    this.video.addEventListener('seeked', this.handleSeeked);
    this.video.addEventListener('timeupdate', this.handleTimeUpdate);
    this.start();
    this.updateForTime(video.currentTime * 1000);
  }

  private handleSeeked = (): void => {
    if (this.video) {
      this.updateForTime(this.video.currentTime * 1000);
    }
  };

  private handleTimeUpdate = (): void => {
    if (this.video) {
      this.updateForTime(this.video.currentTime * 1000);
    }
  };

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.tick();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.video) {
      this.video.removeEventListener('seeked', this.handleSeeked);
      this.video.removeEventListener('timeupdate', this.handleTimeUpdate);
      this.video = null;
    }
    document.removeEventListener('click', this.handleDocumentClick);
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  private tick = (): void => {
    if (!this.isRunning) return;

    // Verify video element is still active and connected to the DOM
    if (!this.video || !this.video.isConnected) {
      const activeVideo = (document.querySelector('#movie_player video') ||
        document.querySelector('video.html5-main-video') ||
        document.querySelector('video')) as HTMLVideoElement | null;
      if (activeVideo && activeVideo !== this.video) {
        this.attachVideo(activeVideo);
      }
    }

    if (this.video && this.cues.length > 0) {
      const currentMs = this.video.currentTime * 1000;
      this.updateForTime(currentMs);
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  public findCueAtTime(timeMs: number): { cue: CuePair | null; index: number } {
    if (this.cues.length === 0) {
      return { cue: null, index: -1 };
    }

    // 1. Fast path: check current cue
    if (this.currentCueIndex >= 0 && this.currentCueIndex < this.cues.length) {
      const current = this.cues[this.currentCueIndex];
      if (timeMs >= current.startMs && timeMs <= current.endMs) {
        return { cue: current, index: this.currentCueIndex };
      }
      // Check next cue (typical sequential playback)
      const nextIndex = this.currentCueIndex + 1;
      if (nextIndex < this.cues.length) {
        const next = this.cues[nextIndex];
        if (timeMs >= next.startMs && timeMs <= next.endMs) {
          return { cue: next, index: nextIndex };
        }
      }
    }

    // 2. Full scan: handles overlapping cues without dropping matches
    for (let i = 0; i < this.cues.length; i++) {
      const cue = this.cues[i];
      if (timeMs >= cue.startMs && timeMs <= cue.endMs) {
        return { cue, index: i };
      }
      // Since sorted by startMs, if cue is far in the future, stop scanning
      if (cue.startMs > timeMs + 10000) {
        break;
      }
    }

    return { cue: null, index: -1 };
  }

  private updateForTime(timeMs: number): void {
    if (this.currentCueIndex >= 0 && this.currentCueIndex < this.cues.length) {
      const currentCue = this.cues[this.currentCueIndex];
      if (timeMs >= currentCue.startMs && timeMs <= currentCue.endMs) {
        if (this.wrapper.classList.contains('dual-sub-hidden')) {
          this.renderCurrentCue();
        }
        return;
      }
    }

    const { cue, index } = this.findCueAtTime(timeMs);
    if (index !== this.currentCueIndex) {
      this.currentCueIndex = index;
      if (!cue) {
        renderCue(this.wrapper, null, this.savedLemmas, this.handlers);
      } else {
        const masked = applyStageMasking(cue, this.savedWordsMap);
        renderCue(this.wrapper, cue, this.savedLemmas, this.handlers, masked);
      }

      // Dismiss hover cards on cue change if not pinned
      if (!this.isCardPinned) {
        this.hideCard(true);
      }
      if (cue && this.handlers?.onCueChange) {
        this.handlers.onCueChange(cue);
      }
    }
  }
}
