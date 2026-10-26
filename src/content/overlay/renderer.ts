import type { CuePair } from '../captions/types';
import type { MaskedCuePair, MaskedToken } from '../../masking/types';
import type { DictionaryEntry } from '../../dictionary/types';
import { decodeHtmlEntities } from '../../utils/text';

export interface WordInteractionHandlers {
  onWordHover?: (word: string, element: HTMLElement) => void;
  onWordLeave?: () => void;
  onWordClick?: (word: string, element: HTMLElement) => void;
}

export interface CardState {
  word: string;
  entry: DictionaryEntry | null;
  isSaved: boolean;
  isPinned?: boolean;
  onSave: () => void;
  onClose?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/**
 * Creates or updates the interactive word hover/click card inside the Shadow DOM wrapper.
 */
export function renderCard(wrapper: HTMLElement, state: CardState | null): void {
  let cardSlot = wrapper.querySelector('.dual-sub-card-slot') as HTMLElement;
  if (!cardSlot) {
    cardSlot = document.createElement('div');
    cardSlot.className = 'dual-sub-card-slot';
    wrapper.appendChild(cardSlot);
  }

  cardSlot.innerHTML = '';
  if (!state) return;

  const card = document.createElement('div');
  card.className = 'dual-sub-card';

  // Prevent video clicks / subtitle sync dismissals when interacting with the card
  card.addEventListener('click', (e) => e.stopPropagation());
  card.addEventListener('mouseenter', (e) => {
    e.stopPropagation();
    state.onMouseEnter?.();
  });
  card.addEventListener('mouseleave', (e) => {
    e.stopPropagation();
    state.onMouseLeave?.();
  });

  const header = document.createElement('div');
  header.className = 'card-header';

  const lemmaSpan = document.createElement('span');
  lemmaSpan.className = 'card-lemma';
  lemmaSpan.textContent = state.entry ? state.entry.lemma : state.word;
  header.appendChild(lemmaSpan);

  if (state.entry?.pos) {
    const posSpan = document.createElement('span');
    posSpan.className = 'card-pos';
    posSpan.textContent = state.entry.pos;
    header.appendChild(posSpan);
  }

  // Dismiss button for pinned or hovered cards
  const closeBtn = document.createElement('button');
  closeBtn.className = 'card-close-btn';
  closeBtn.innerHTML = '&times;';
  closeBtn.title = 'Close (Esc)';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.onClose?.();
  });
  header.appendChild(closeBtn);

  card.appendChild(header);

  const glossesDiv = document.createElement('div');
  glossesDiv.className = 'card-glosses';
  if (state.entry && state.entry.glosses && state.entry.glosses.length > 0) {
    glossesDiv.textContent = state.entry.glosses.join(', ');
  } else {
    glossesDiv.textContent = 'Looking up translation...';
    glossesDiv.style.fontStyle = 'italic';
    glossesDiv.style.color = '#9399b2';
  }
  card.appendChild(glossesDiv);

  const saveBtn = document.createElement('button');
  saveBtn.className = `card-save-btn ${state.isSaved ? 'saved' : ''}`;
  saveBtn.textContent = state.isSaved ? '✓ Saved' : '+ Save Word';
  if (!state.isSaved) {
    saveBtn.addEventListener('click', () => {
      state.onSave();
      saveBtn.className = 'card-save-btn saved';
      saveBtn.textContent = '✓ Saved';
    });
  }
  card.appendChild(saveBtn);

  cardSlot.appendChild(card);
}

/**
 * Helper to render an individual German target token with masking and reveal support.
 */
function createTargetTokenElement(
  token: MaskedToken,
  savedLemmas: Set<string>,
  handlers?: WordInteractionHandlers
): HTMLElement | Text {
  const isWord = /[A-Za-zÄÖÜäöüß]+/.test(token.text);
  if (!isWord) {
    return document.createTextNode(token.text);
  }

  const span = document.createElement('span');
  span.className = 'dual-sub-word';

  const originalWord = token.originalText || token.text;

  if (token.visible) {
    span.textContent = token.text;
    if (savedLemmas.has(token.text.toLowerCase()) || (token.lemma && savedLemmas.has(token.lemma.toLowerCase()))) {
      span.classList.add('saved');
    }
  } else {
    // Stage 3 Masked target word
    span.classList.add('dual-sub-masked');
    span.textContent = '___';
    span.title = 'Click or hover to reveal';

    let isRevealedLocked = false;

    span.addEventListener('mouseenter', () => {
      span.textContent = originalWord;
      span.classList.add('revealed');
    });

    span.addEventListener('mouseleave', () => {
      if (!isRevealedLocked) {
        span.textContent = '___';
        span.classList.remove('revealed');
      }
    });

    span.addEventListener('click', (e) => {
      e.stopPropagation();
      isRevealedLocked = !isRevealedLocked;
      if (isRevealedLocked) {
        span.textContent = originalWord;
        span.classList.add('revealed');
      } else {
        span.textContent = '___';
        span.classList.remove('revealed');
      }
    });
  }

  if (handlers) {
    if (handlers.onWordHover) {
      span.addEventListener('mouseenter', () => {
        handlers.onWordHover!(originalWord, span);
      });
    }
    if (handlers.onWordLeave) {
      span.addEventListener('mouseleave', () => {
        handlers.onWordLeave!();
      });
    }
    if (handlers.onWordClick) {
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.onWordClick!(originalWord, span);
      });
    }
  }

  return span;
}

/**
 * Helper to render an individual English native token with masking and reveal support.
 */
function createNativeTokenElement(token: MaskedToken): HTMLElement | Text {
  if (token.visible) {
    return document.createTextNode(decodeHtmlEntities(token.text));
  }

  // Stage 2 or 3 Masked English gloss
  const span = document.createElement('span');
  span.className = 'dual-sub-gloss dual-sub-masked';
  span.textContent = '___';
  span.title = 'Click or hover to reveal';

  const originalText = decodeHtmlEntities(token.originalText || token.text);
  let isRevealedLocked = false;

  span.addEventListener('mouseenter', () => {
    span.textContent = originalText;
    span.classList.add('revealed');
  });

  span.addEventListener('mouseleave', () => {
    if (!isRevealedLocked) {
      span.textContent = '___';
      span.classList.remove('revealed');
    }
  });

  span.addEventListener('click', (e) => {
    e.stopPropagation();
    isRevealedLocked = !isRevealedLocked;
    if (isRevealedLocked) {
      span.textContent = originalText;
      span.classList.add('revealed');
    } else {
      span.textContent = '___';
      span.classList.remove('revealed');
    }
  });

  return span;
}

/**
 * Renders target and native text into the overlay container with hover, click, and masking listeners.
 */
export function renderCue(
  wrapper: HTMLElement,
  cue: CuePair | null,
  savedLemmas: Set<string> = new Set(),
  handlers?: WordInteractionHandlers,
  maskedCue?: MaskedCuePair | null,
  learningMode: 'immersion' | 'reverse' = 'immersion'
): void {
  let textSlot = wrapper.querySelector('.dual-sub-text-slot') as HTMLElement;
  if (!textSlot) {
    textSlot = document.createElement('div');
    textSlot.className = 'dual-sub-text-slot';
    wrapper.insertBefore(textSlot, wrapper.firstChild);
  }

  if (!cue || (!cue.target && !cue.native)) {
    wrapper.classList.add('dual-sub-hidden');
    textSlot.innerHTML = '';
    return;
  }

  wrapper.classList.remove('dual-sub-hidden');
  textSlot.innerHTML = '';

  // Mode badge
  let badge = wrapper.querySelector('.dual-sub-mode-badge') as HTMLElement;
  if (learningMode === 'reverse') {
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'dual-sub-mode-badge';
      wrapper.appendChild(badge);
    }
    badge.textContent = 'Reverse: EN ➔ DE';
    badge.title = 'Reverse Learning Mode: Translating English speech into German target subtitles';
  } else if (badge) {
    badge.remove();
  }

  // 1. Target track container (German)
  if (maskedCue && maskedCue.targetTokens && maskedCue.targetTokens.length > 0) {
    const targetEl = document.createElement('div');
    targetEl.className = 'dual-sub-target';
    for (const token of maskedCue.targetTokens) {
      targetEl.appendChild(createTargetTokenElement(token, savedLemmas, handlers));
    }
    textSlot.appendChild(targetEl);
  } else {
    const targetText = cue.target || '';
    if (targetText) {
      const targetEl = document.createElement('div');
      targetEl.className = 'dual-sub-target';
      const tokens = targetText.split(/([A-Za-zÄÖÜäöüß]+)/);
      for (const token of tokens) {
        if (!token) continue;
        targetEl.appendChild(createTargetTokenElement({ text: token, visible: true }, savedLemmas, handlers));
      }
      textSlot.appendChild(targetEl);
    } else if (learningMode === 'reverse' && cue.native) {
      // Smooth loading placeholder while English line is translating to German
      const targetEl = document.createElement('div');
      targetEl.className = 'dual-sub-target dual-sub-translating';
      const textSpan = document.createElement('span');
      textSpan.className = 'dual-sub-translating-text';
      textSpan.textContent = '... Translating to German ...';
      targetEl.appendChild(textSpan);
      textSlot.appendChild(targetEl);
    }
  }

  // 2. Native track container (English)
  if (maskedCue && maskedCue.nativeTokens && maskedCue.nativeTokens.length > 0) {
    const nativeEl = document.createElement('div');
    nativeEl.className = 'dual-sub-native';
    for (const token of maskedCue.nativeTokens) {
      nativeEl.appendChild(createNativeTokenElement(token));
    }
    textSlot.appendChild(nativeEl);
  } else if (cue.native) {
    const nativeEl = document.createElement('div');
    nativeEl.className = 'dual-sub-native';
    nativeEl.textContent = decodeHtmlEntities(cue.native);
    textSlot.appendChild(nativeEl);
  }
}

/**
 * Renders the non-intrusive post-video quiz prompt banner.
 */
export function renderQuizBanner(
  wrapper: HTMLElement,
  savedCount: number,
  onStartQuiz: () => void,
  onDismiss: () => void
): void {
  hideQuizBanner(wrapper);

  const banner = document.createElement('div');
  banner.className = 'dual-sub-quiz-banner';

  const text = document.createElement('span');
  text.className = 'quiz-banner-text';
  text.innerHTML = `You saved <strong>${savedCount} word${savedCount === 1 ? '' : 's'}</strong> in this video! Ready for a quick quiz?`;
  banner.appendChild(text);

  const startBtn = document.createElement('button');
  startBtn.className = 'quiz-banner-btn';
  startBtn.textContent = 'Start Quiz';
  startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onStartQuiz();
  });
  banner.appendChild(startBtn);

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'quiz-banner-dismiss';
  dismissBtn.textContent = '✕';
  dismissBtn.title = 'Dismiss';
  dismissBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onDismiss();
    banner.remove();
  });
  banner.appendChild(dismissBtn);

  wrapper.appendChild(banner);
}

/**
 * Removes the quiz prompt banner if present.
 */
export function hideQuizBanner(wrapper: HTMLElement): void {
  const existing = wrapper.querySelector('.dual-sub-quiz-banner');
  if (existing) {
    existing.remove();
  }
}
