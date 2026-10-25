import { describe, it, expect, beforeEach } from 'vitest';
import { SubtitleSyncController } from '../sync';
import { renderCue, renderCard } from '../renderer';
import type { CuePair } from '../../captions/types';

describe('overlay/sync and card interactions', () => {
  let wrapper: HTMLElement;
  let sampleCues: CuePair[];

  beforeEach(() => {
    wrapper = document.createElement('div');
    sampleCues = [
      {
        startMs: 1000,
        endMs: 3000,
        target: 'Hallo Welt',
        native: 'Hello World',
        targetWords: ['Hallo', 'Welt'],
      },
    ];
  });

  it('renders hover and click cards', () => {
    renderCard(wrapper, {
      word: 'Hunde',
      entry: {
        lemma: 'hund',
        pos: 'noun',
        glosses: ['dog'],
      },
      isSaved: false,
      onSave: () => {},
    });

    const card = wrapper.querySelector('.dual-sub-card');
    expect(card).not.toBeNull();

    const lemma = card?.querySelector('.card-lemma');
    expect(lemma?.textContent).toBe('hund');

    const gloss = card?.querySelector('.card-glosses');
    expect(gloss?.textContent).toBe('dog');

    const saveBtn = card?.querySelector('.card-save-btn');
    expect(saveBtn?.textContent).toBe('+ Save Word');
  });

  it('renders close button on card and triggers onClose', () => {
    let closed = false;
    renderCard(wrapper, {
      word: 'Hunde',
      entry: { lemma: 'hund', pos: 'noun', glosses: ['dog'] },
      isSaved: false,
      isPinned: true,
      onSave: () => {},
      onClose: () => {
        closed = true;
      },
    });

    const closeBtn = wrapper.querySelector('.card-close-btn') as HTMLElement;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();
    expect(closed).toBe(true);
  });

  it('unpins and dismisses card on Escape key in SubtitleSyncController', () => {
    const controller = new SubtitleSyncController(wrapper);
    controller.showCard(
      {
        word: 'Hund',
        entry: null,
        isSaved: false,
        onSave: () => {},
      },
      true
    );

    expect(controller.getIsCardPinned()).toBe(true);
    expect(controller.isCardOpen()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(controller.getIsCardPinned()).toBe(false);
    expect(controller.isCardOpen()).toBe(false);

    controller.stop();
  });

  it('fires hover and click handlers on word elements', () => {
    let hovered = '';
    let clicked = '';

    renderCue(wrapper, sampleCues[0], new Set(), {
      onWordHover: (w) => {
        hovered = w;
      },
      onWordClick: (w) => {
        clicked = w;
      },
    });

    const words = wrapper.querySelectorAll('.dual-sub-word');
    expect(words).toHaveLength(2);

    words[0].dispatchEvent(new MouseEvent('mouseenter'));
    expect(hovered).toBe('Hallo');

    (words[1] as HTMLElement).click();
    expect(clicked).toBe('Welt');
  });

  it('indicates saved words with .saved class', () => {
    const saved = new Set(['welt']);
    renderCue(wrapper, sampleCues[0], saved);

    const words = wrapper.querySelectorAll('.dual-sub-word');
    expect(words[0].classList.contains('saved')).toBe(false);
    expect(words[1].classList.contains('saved')).toBe(true);
  });

  it('correctly finds cues during playback including overlapping cues', () => {
    const controller = new SubtitleSyncController(wrapper);
    controller.setCues([
      { startMs: 1000, endMs: 3000, target: 'Cue 1', native: '', targetWords: ['Cue', '1'] },
      { startMs: 2500, endMs: 4500, target: 'Cue 2', native: '', targetWords: ['Cue', '2'] },
      { startMs: 5000, endMs: 7000, target: 'Cue 3', native: '', targetWords: ['Cue', '3'] },
    ]);

    // Before any cue
    expect(controller.findCueAtTime(500).cue).toBeNull();

    // In Cue 1
    const match1 = controller.findCueAtTime(1500);
    expect(match1.cue?.target).toBe('Cue 1');
    expect(match1.index).toBe(0);

    // In Cue 1 / Cue 2 overlap
    const matchOverlap = controller.findCueAtTime(2600);
    expect(matchOverlap.cue).not.toBeNull();

    // In gap between Cue 2 and Cue 3
    expect(controller.findCueAtTime(4800).cue).toBeNull();

    // In Cue 3
    const match3 = controller.findCueAtTime(6000);
    expect(match3.cue?.target).toBe('Cue 3');
    expect(match3.index).toBe(2);

    controller.stop();
  });

  it('allows updating the wrapper dynamically', () => {
    const controller = new SubtitleSyncController(wrapper);
    const newWrapper = document.createElement('div');
    controller.setWrapper(newWrapper);
    controller.setCues(sampleCues);

    expect(controller.getCuesCount()).toBe(1);
    controller.stop();
  });
});
