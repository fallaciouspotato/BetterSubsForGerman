import { DualSubManager } from './index';

console.log('[dual-sub] bridge.ts loaded');

const manager = new DualSubManager();

window.addEventListener('unhandledrejection', (event) => {
  // Prevent noisy uncaught extension rejection traces if context reloads
  if (event.reason?.message?.includes?.('Extension context invalidated')) {
    event.preventDefault();
    manager.cleanup();
  }
});

window.addEventListener('error', (event) => {
  if (event.message?.includes?.('Extension context invalidated')) {
    event.preventDefault();
    manager.cleanup();
  }
});

// Listen for caption tracks posted from main-world.ts
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data) return;

  if (event.data.type === 'DUAL_SUB_TRACKS' && Array.isArray(event.data.tracks)) {
    console.log('[dual-sub:bridge] Received DUAL_SUB_TRACKS:', event.data.tracks.length, 'tracks for video', event.data.videoId);
    manager.onTracksDiscovered(event.data.tracks, event.data.videoId);
  }
});

function requestTracks(): void {
  if (location.pathname === '/watch') {
    window.postMessage({ type: 'DUAL_SUB_REQUEST_TRACKS' }, '*');
  }
}

// Request tracks immediately upon bridge initialization
requestTracks();

let pollTimer: any = null;
function startPollingForTracks(): void {
  if (pollTimer) clearInterval(pollTimer);
  let count = 0;
  pollTimer = setInterval(() => {
    count++;
    if (manager.hasCues() || count > 14) {
      clearInterval(pollTimer);
      pollTimer = null;
    } else {
      requestTracks();
    }
  }, 700);
}

startPollingForTracks();

// Detect SPA navigation when the user navigates between videos
let currentVideoId = location.pathname === '/watch' ? new URLSearchParams(location.search).get('v') : null;

function handleNavigationChange(): void {
  const isWatch = location.pathname === '/watch';
  const newVideoId = isWatch ? new URLSearchParams(location.search).get('v') : null;

  if (newVideoId !== currentVideoId) {
    console.log(`[dual-sub:bridge] Video transition: "${currentVideoId}" -> "${newVideoId}"`);
    currentVideoId = newVideoId;

    if (!isWatch || !newVideoId) {
      manager.cleanup();
    } else {
      manager.onVideoNavigated(newVideoId);
      requestTracks();
      startPollingForTracks();
    }
  }
}

// Watch DOM mutations for pushState URL changes
const observer = new MutationObserver(() => {
  handleNavigationChange();
});
observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

// Listen directly to YouTube SPA navigation lifecycle events
['yt-navigate-finish', 'yt-player-updated', 'yt-page-data-updated'].forEach((eventName) => {
  window.addEventListener(eventName, () => {
    handleNavigationChange();
  });
});
