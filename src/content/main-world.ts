/**
 * main-world.ts — Runs in the MAIN world (page JS context).
 *
 * Intercepts YouTube's player response to extract caption tracks.
 * Employs multiple redundant mechanisms:
 *  1. movie_player.getPlayerResponse() via active polling & event triggers
 *  2. movie_player.getOption('captions', 'tracklist')
 *  3. window.ytInitialPlayerResponse trap & inspection
 *  4. fetch() monkey-patch for InnerTube /youtubei/v1/player requests
 *  5. Direct handshake with bridge.ts via DUAL_SUB_REQUEST_TRACKS
 * Communicates with bridge.ts via window.postMessage.
 */

let lastDispatchedVideoId: string | null = null;
let lastDispatchedTracks: any[] = [];

function normalizeTrack(t: any): any {
  if (!t) return null;
  let baseUrl = t.baseUrl || t.url || '';
  if (!baseUrl) return null;

  if (baseUrl.startsWith('//')) {
    baseUrl = `https:${baseUrl}`;
  } else if (baseUrl.startsWith('/')) {
    baseUrl = `https://www.youtube.com${baseUrl}`;
  }

  const languageCode = t.languageCode || t.language_code || t.lang || '';
  const vssId = t.vssId || t.vss_id || '';
  const name = typeof t.name === 'string' ? { simpleText: t.name } : t.name;
  const kind = t.kind;
  const isTranslatable = t.isTranslatable ?? t.is_translatable;

  return {
    baseUrl,
    languageCode,
    vssId,
    name,
    kind,
    isTranslatable,
  };
}

function notifyTracks(tracks: any[], videoId?: string, force = false): boolean {
  if (Array.isArray(tracks) && tracks.length > 0) {
    const normalized = tracks.map(normalizeTrack).filter(Boolean);
    if (normalized.length === 0) return false;

    if (!force && videoId && videoId === lastDispatchedVideoId) {
      return true; // Already notified for this video
    }

    if (videoId) {
      lastDispatchedVideoId = videoId;
    }
    lastDispatchedTracks = normalized;

    console.log('[dual-sub:main-world] Emitting DUAL_SUB_TRACKS:', normalized.length, 'tracks for video', videoId);
    window.postMessage(
      {
        type: 'DUAL_SUB_TRACKS',
        tracks: normalized,
        videoId,
      },
      '*'
    );
    return true;
  }
  return false;
}

function checkMoviePlayer(force = false): boolean {
  try {
    const moviePlayer: any = document.getElementById('movie_player');
    if (moviePlayer) {
      const currentUrlVideoId = new URLSearchParams(window.location.search).get('v') || undefined;

      // 1. Check getPlayerResponse()
      if (typeof moviePlayer.getPlayerResponse === 'function') {
        const resp = moviePlayer.getPlayerResponse();
        const videoId = resp?.videoDetails?.videoId || currentUrlVideoId;
        const tracks = resp?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (tracks && tracks.length > 0) {
          if (notifyTracks(tracks, videoId, force)) {
            return true;
          }
        }
      }

      // 2. Check getOption('captions', 'tracklist')
      if (typeof moviePlayer.getOption === 'function') {
        const tracklist = moviePlayer.getOption('captions', 'tracklist');
        if (Array.isArray(tracklist) && tracklist.length > 0) {
          if (notifyTracks(tracklist, currentUrlVideoId, force)) {
            return true;
          }
        }
      }
    }
  } catch (e) {
    // Ignore player lookup errors
  }
  return false;
}

// 1. Initial and recurring check on load & video events
function triggerCheckWithRetries(retries = 12, delay = 350) {
  let count = 0;
  const timer = setInterval(() => {
    count++;
    if (checkMoviePlayer() || count >= retries) {
      clearInterval(timer);
    }
  }, delay);
}

// 2. Trap window.ytInitialPlayerResponse
let _ytInitialPlayerResponse: any = (window as any).ytInitialPlayerResponse;

try {
  Object.defineProperty(window, 'ytInitialPlayerResponse', {
    set(val) {
      _ytInitialPlayerResponse = val;
      const tracks = val?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      const videoId = val?.videoDetails?.videoId;
      if (tracks) {
        notifyTracks(tracks, videoId);
      }
    },
    get() {
      return _ytInitialPlayerResponse;
    },
    configurable: true,
  });
} catch {
  // Ignore defineProperty errors
}

if (_ytInitialPlayerResponse) {
  const tracks = _ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  const videoId = _ytInitialPlayerResponse?.videoDetails?.videoId;
  if (tracks) {
    notifyTracks(tracks, videoId);
  }
}

// 3. Monkey-patch fetch for SPA navigations
const originalFetch = window.fetch;
window.fetch = async function (...args: Parameters<typeof fetch>): Promise<Response> {
  const response = await originalFetch.apply(this, args);
  try {
    const url = args[0] instanceof Request ? args[0].url : String(args[0]);
    if (typeof url === 'string' && url.includes('/youtubei/v1/player')) {
      const clone = response.clone();
      clone
        .json()
        .then((data: any) => {
          const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
          const videoId = data?.videoDetails?.videoId;
          if (tracks) {
            notifyTracks(tracks, videoId);
          }
        })
        .catch(() => {});
    }
  } catch {
    // Ignore
  }
  return response;
};

// 4. Continuous detection on player & video events
document.addEventListener('play', () => checkMoviePlayer(false), true);
document.addEventListener('playing', () => checkMoviePlayer(false), true);

// 5. Listen to YouTube lifecycle events
['yt-navigate-finish', 'yt-player-updated', 'yt-page-data-updated', 'spfdone'].forEach((eventName) => {
  window.addEventListener(eventName, () => {
    if (location.pathname === '/watch') {
      const currentVid = new URLSearchParams(location.search).get('v');
      if (currentVid && currentVid !== lastDispatchedVideoId) {
        lastDispatchedVideoId = null;
        lastDispatchedTracks = [];
      }
      triggerCheckWithRetries(15, 300);
    }
  });
});

// Run immediate check
if (location.pathname === '/watch') {
  triggerCheckWithRetries(15, 300);
}

// 6. Respond to messages from content script bridge
window.addEventListener('message', async (event) => {
  if (event.source !== window || !event.data) return;

  // Handshake: content script requests current caption tracks
  if (event.data.type === 'DUAL_SUB_REQUEST_TRACKS') {
    const currentUrlVideoId = new URLSearchParams(window.location.search).get('v') || undefined;
    if (lastDispatchedTracks.length > 0 && currentUrlVideoId && currentUrlVideoId === lastDispatchedVideoId) {
      window.postMessage(
        {
          type: 'DUAL_SUB_TRACKS',
          tracks: lastDispatchedTracks,
          videoId: lastDispatchedVideoId,
        },
        '*'
      );
    } else {
      checkMoviePlayer(true);
    }
    return;
  }

  // Caption fetch requests (runs in genuine page session)
  if (event.data.type === 'DUAL_SUB_FETCH_REQUEST' && event.data.requestId && event.data.url) {
    const { requestId, url } = event.data;
    const fetchUrl = url.startsWith('//')
      ? `https:${url}`
      : url.startsWith('/')
      ? `https://www.youtube.com${url}`
      : url;

    let text: string | null = null;

    // 1. Try standard window.fetch without credentials: 'include' (avoids wildcard CORS failure on googlevideo.com)
    try {
      const res = await window.fetch(fetchUrl);
      if (res.ok) {
        const t = await res.text();
        if (t && !t.startsWith('<!DOCTYPE') && !t.startsWith('<html')) {
          text = t;
        }
      }
    } catch {}

    // 2. Fallback to XMLHttpRequest in page context
    if (!text) {
      text = await new Promise<string | null>((resolve) => {
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', fetchUrl, true);
          xhr.timeout = 5000;
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
              const t = xhr.responseText;
              if (!t.startsWith('<!DOCTYPE') && !t.startsWith('<html')) {
                resolve(t);
                return;
              }
            }
            resolve(null);
          };
          xhr.onerror = () => resolve(null);
          xhr.ontimeout = () => resolve(null);
          xhr.send();
        } catch {
          resolve(null);
        }
      });
    }

    if (text) {
      window.postMessage(
        {
          type: 'DUAL_SUB_FETCH_RESPONSE',
          requestId,
          success: true,
          text,
        },
        '*'
      );
    } else {
      window.postMessage(
        {
          type: 'DUAL_SUB_FETCH_RESPONSE',
          requestId,
          success: false,
          error: 'Main world fetch returned no text',
        },
        '*'
      );
    }
  }
});
