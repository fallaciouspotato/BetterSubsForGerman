export const OVERLAY_STYLES = `
:host {
  all: initial;
  display: block;
  position: absolute;
  bottom: 72px;
  left: 0;
  width: 100%;
  pointer-events: none;
  z-index: 90;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  text-align: center;
}

.dual-sub-box {
  display: inline-block;
  position: relative;
  max-width: 85%;
  margin: 0 auto;
  padding: 8px 16px;
  background-color: rgba(10, 10, 15, 0.78);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  pointer-events: auto;
  user-select: text;
  transition: opacity 0.15s ease;
}

.dual-sub-target {
  font-size: 22px;
  line-height: 1.4;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0,0,0,0.8);
  margin-bottom: 4px;
}

.dual-sub-native {
  font-size: 15px;
  line-height: 1.3;
  font-weight: 400;
  color: #a0c4ff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
}

.dual-sub-word {
  display: inline-block;
  cursor: pointer;
  border-radius: 4px;
  padding: 1px 4px;
  transition: background-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
}

.dual-sub-word:hover {
  background-color: rgba(255, 230, 109, 0.28);
  color: #ffe66d;
  transform: translateY(-1px);
}

.dual-sub-word.saved {
  border-bottom: 2px solid #48cae4;
}

/* Masked tokens (Stage 2 native gloss, Stage 3 target word & native gloss) */
.dual-sub-masked {
  display: inline-block;
  cursor: pointer;
  padding: 1px 4px;
  border-bottom: 2px dashed #f5a97f;
  background-color: rgba(245, 169, 127, 0.15);
  border-radius: 4px;
  color: #f5a97f;
  font-weight: 600;
  letter-spacing: 1px;
  transition: all 0.2s ease;
}

.dual-sub-masked:hover {
  background-color: rgba(245, 169, 127, 0.3);
  color: #eed49f;
}

.dual-sub-masked.revealed {
  border-bottom: 2px solid #a6da95;
  background-color: rgba(166, 218, 149, 0.2);
  color: #a6da95;
  letter-spacing: normal;
}

.dual-sub-gloss {
  display: inline;
}

/* Card Tooltip on Hover / Click */
.dual-sub-card {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  background: #181926;
  color: #cad3f5;
  border: 1px solid #363a4f;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.4;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  z-index: 1000;
  min-width: 180px;
  max-width: 280px;
  text-align: left;
  pointer-events: auto;
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translate(-50%, 4px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  border-bottom: 1px solid #24273a;
  padding-bottom: 4px;
  gap: 8px;
}

.card-close-btn {
  background: transparent;
  border: none;
  color: #a5adcb;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
  margin-left: auto;
  border-radius: 4px;
  transition: color 0.15s ease, background 0.15s ease;
}

.card-close-btn:hover {
  color: #ed8796;
  background: rgba(237, 135, 150, 0.2);
}

.card-lemma {
  font-size: 15px;
  font-weight: bold;
  color: #8aadf4;
}

.card-pos {
  font-size: 11px;
  color: #a5adcb;
  text-transform: uppercase;
  background: #24273a;
  padding: 2px 6px;
  border-radius: 4px;
}

.card-glosses {
  margin: 6px 0 8px 0;
  color: #eed49f;
  font-weight: 500;
}

.card-save-btn {
  width: 100%;
  padding: 5px 8px;
  background: #a6da95;
  color: #181926;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  font-size: 12px;
  transition: opacity 0.15s ease;
}

.card-save-btn:hover {
  opacity: 0.9;
}

.card-save-btn.saved {
  background: #494d64;
  color: #b8c0e0;
  cursor: default;
}

/* Post-Video Quiz Banner */
.dual-sub-quiz-banner {
  position: absolute;
  bottom: calc(100% + 14px);
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #1e1e2e 0%, #252538 100%);
  border: 1px solid #cba6f7;
  border-radius: 10px;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.7);
  z-index: 1001;
  pointer-events: auto;
  white-space: nowrap;
  animation: slideUp 0.25s ease-out;
}

@keyframes slideUp {
  from { opacity: 0; transform: translate(-50%, 8px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

.quiz-banner-text {
  font-size: 14px;
  font-weight: 500;
  color: #cdd6f4;
}

.quiz-banner-text strong {
  color: #f9e2af;
}

.quiz-banner-btn {
  background: #cba6f7;
  color: #11111b;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-weight: bold;
  font-size: 13px;
  cursor: pointer;
  transition: transform 0.1s ease, filter 0.15s ease;
}

.quiz-banner-btn:hover {
  filter: brightness(1.1);
  transform: scale(1.03);
}

.quiz-banner-dismiss {
  background: transparent;
  border: none;
  color: #6c7086;
  font-size: 16px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.quiz-banner-dismiss:hover {
  color: #f38ba8;
}

.dual-sub-hidden {
  display: none !important;
}
`;
