import { OVERLAY_STYLES } from './styles';

export interface OverlayContainer {
  host: HTMLElement;
  shadow: ShadowRoot;
  wrapper: HTMLElement;
  detach: () => void;
}

const HOST_ID = 'dual-sub-overlay-host';

/**
 * Attaches the Shadow DOM overlay to the YouTube player element (#movie_player).
 * Also injects a page-level style to hide native YouTube subtitles.
 */
export function attachOverlay(): OverlayContainer | null {
  const player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
  if (!player) {
    return null;
  }

  // Check if already attached and valid
  let host = document.getElementById(HOST_ID);
  if (host && host.isConnected && player.contains(host) && host.shadowRoot) {
    const wrapper = host.shadowRoot.querySelector('.dual-sub-box') as HTMLElement;
    if (wrapper) {
      return {
        host,
        shadow: host.shadowRoot,
        wrapper,
        detach: () => host?.remove(),
      };
    }
  }

  if (host) {
    host.remove();
  }

  // Hide YouTube native captions
  hideNativeCaptions();

  host = document.createElement('div');
  host.id = HOST_ID;
  host.style.position = 'absolute';
  host.style.bottom = '72px';
  host.style.left = '0';
  host.style.width = '100%';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '90';
  host.style.textAlign = 'center';
  const shadow = host.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = OVERLAY_STYLES;
  shadow.appendChild(styleEl);

  const wrapper = document.createElement('div');
  wrapper.className = 'dual-sub-box dual-sub-hidden';
  shadow.appendChild(wrapper);

  player.appendChild(host);

  return {
    host,
    shadow,
    wrapper,
    detach: () => {
      host?.remove();
    },
  };
}

let nativeStylesInjected = false;
export function hideNativeCaptions(): void {
  if (nativeStylesInjected) return;
  const style = document.createElement('style');
  style.id = 'dual-sub-hide-native';
  style.textContent = `
    .ytp-caption-window-container,
    .ytp-caption-window-bottom {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
  nativeStylesInjected = true;
}
