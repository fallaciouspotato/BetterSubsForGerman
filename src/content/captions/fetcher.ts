import type { RawTimedTextJson3, TimedSegment, CuePair } from './types';

function isExtensionValid(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
}

/**
 * Parses YouTube's timedtext JSON3 payload into standardized TimedSegments.
 */
export function parseTimedTextJson3(data: RawTimedTextJson3): TimedSegment[] {
  if (!data?.events) return [];

  const segments: TimedSegment[] = [];

  for (const event of data.events) {
    if (!event.segs || event.segs.length === 0) continue;

    const startMs = event.tStartMs ?? 0;
    const durationMs = event.dDurationMs ?? 0;
    const endMs = startMs + durationMs;

    const rawText = event.segs.map((s) => s.utf8 || '').join('');
    // Normalize whitespace and newlines
    const text = rawText.replace(/\n+/g, ' ').trim();

    if (text) {
      segments.push({
        startMs,
        durationMs,
        endMs,
        text,
      });
    }
  }

  return segments;
}

/**
 * Parses YouTube's XML timedtext payload (both format 3 with <p t="..." d="..."> and format 1 with <text start="..." dur="...">).
 * Handles &amp;, &lt;, &gt;, &#39;, &quot; and other XML entities, plus nested <s> span tags.
 */
export function parseTimedTextXml(xmlString: string): TimedSegment[] {
  if (!xmlString) return [];

  const segments: TimedSegment[] = [];

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, 'text/xml');
      // Query both format 3 (<p>) and format 1 (<text>) elements
      const cueNodes = doc.querySelectorAll('p, text');
      for (let i = 0; i < cueNodes.length; i++) {
        const node = cueNodes[i];

        let startMs = 0;
        let durationMs = 0;

        // Format 3: t and d are in milliseconds
        if (node.hasAttribute('t')) {
          startMs = parseInt(node.getAttribute('t') || '0', 10) || 0;
        } else if (node.hasAttribute('start')) {
          startMs = Math.round((parseFloat(node.getAttribute('start') || '0') || 0) * 1000);
        }

        if (node.hasAttribute('d')) {
          durationMs = parseInt(node.getAttribute('d') || '0', 10) || 0;
        } else if (node.hasAttribute('dur')) {
          durationMs = Math.round((parseFloat(node.getAttribute('dur') || '0') || 0) * 1000);
        }

        const rawContent = node.textContent || '';
        const decoded = rawContent
          .replace(/<[^>]+>/g, '')
          .replace(/\n+/g, ' ')
          .trim();

        if (decoded) {
          segments.push({
            startMs,
            durationMs,
            endMs: startMs + durationMs,
            text: decoded,
          });
        }
      }
      if (segments.length > 0) {
        // Auto-fill zero durations to span to the next segment's start time
        for (let i = 0; i < segments.length; i++) {
          if (segments[i].durationMs <= 0) {
            const nextStart = i + 1 < segments.length ? segments[i + 1].startMs : segments[i].startMs + 3000;
            segments[i].endMs = Math.max(segments[i].startMs + 500, nextStart);
            segments[i].durationMs = segments[i].endMs - segments[i].startMs;
          }
        }
        return segments;
      }
    } catch {
      // Fall through to regex
    }
  }

  // Regex fallback for format 3 (<p ...>...</p>) and format 1 (<text ...>...</text>)
  const cueRegex = /<(?:p|text)\b([^>]*)>([\s\S]*?)<\/(?:p|text)>/gi;
  let match: RegExpExecArray | null;
  while ((match = cueRegex.exec(xmlString)) !== null) {
    const attrString = match[1] || '';
    const rawContent = match[2] || '';

    let startMs = 0;
    let durationMs = 0;

    const tMatch = attrString.match(/\bt=["'](\d+)["']/i);
    const startMatch = attrString.match(/\bstart=["']([\d.]+)["']/i);
    if (tMatch) {
      startMs = parseInt(tMatch[1], 10) || 0;
    } else if (startMatch) {
      startMs = Math.round((parseFloat(startMatch[1]) || 0) * 1000);
    }

    const dMatch = attrString.match(/\bd=["'](\d+)["']/i);
    const durMatch = attrString.match(/\bdur=["']([\d.]+)["']/i);
    if (dMatch) {
      durationMs = parseInt(dMatch[1], 10) || 0;
    } else if (durMatch) {
      durationMs = Math.round((parseFloat(durMatch[1]) || 0) * 1000);
    }

    const decoded = rawContent
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/<[^>]+>/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (decoded) {
      segments.push({
        startMs,
        durationMs,
        endMs: startMs + durationMs,
        text: decoded,
      });
    }
  }

  if (segments.length > 0) {
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].durationMs <= 0) {
        const nextStart = i + 1 < segments.length ? segments[i + 1].startMs : segments[i].startMs + 3000;
        segments[i].endMs = Math.max(segments[i].startMs + 500, nextStart);
        segments[i].durationMs = segments[i].endMs - segments[i].startMs;
      }
    }
  }

  return segments;
}

/**
 * Splits text into words while keeping words clean for lookup.
 */
export function tokenizeWords(text: string): string[] {
  // Matches words with German characters (ä, ö, ü, ß)
  const matches = text.match(/[A-Za-zÄÖÜäöüß]+/g);
  return matches || [];
}

/**
 * Aligns target language segments and native language segments into synchronized CuePairs.
 * Segments that overlap in time are paired together.
 */
export function alignSegments(
  targetSegments: TimedSegment[],
  nativeSegments: TimedSegment[]
): CuePair[] {
  // If we only have native segments (e.g. English video, target German will be translated dynamically)
  if (targetSegments.length === 0 && nativeSegments.length > 0) {
    return nativeSegments.map((nSeg) => ({
      startMs: nSeg.startMs,
      endMs: nSeg.endMs,
      target: '',
      native: nSeg.text,
      targetWords: [],
    }));
  }

  if (targetSegments.length === 0) {
    return [];
  }

  const cues: CuePair[] = [];

  for (const tSeg of targetSegments) {
    // Find matching native segments that overlap with this target segment
    const matchingNative = nativeSegments.filter(
      (nSeg) => Math.max(tSeg.startMs, nSeg.startMs) < Math.min(tSeg.endMs, nSeg.endMs)
    );

    const nativeText = matchingNative.map((n) => n.text).join(' ');

    cues.push({
      startMs: tSeg.startMs,
      endMs: tSeg.endMs,
      target: tSeg.text,
      native: nativeText,
      targetWords: tokenizeWords(tSeg.text),
    });
  }

  return cues;
}

/**
 * Safely appends fmt=json3 without re-encoding existing query parameters (which breaks HMAC signatures).
 */
export function appendFmt(baseUrl: string, fmt: string = 'json3'): string {
  if (baseUrl.includes('fmt=')) {
    return baseUrl.replace(/fmt=[^&]*/, `fmt=${fmt}`);
  }
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}fmt=${fmt}`;
}

let mainWorldListenerInitialized = false;
const pendingFetches = new Map<string, { resolve: (text: string | null) => void; timer: any }>();

function initMainWorldListener(): void {
  if (mainWorldListenerInitialized || typeof window === 'undefined') return;
  mainWorldListenerInitialized = true;

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.type === 'DUAL_SUB_FETCH_RESPONSE' && event.data.requestId) {
      const pending = pendingFetches.get(event.data.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        pendingFetches.delete(event.data.requestId);
        if (event.data.success && typeof event.data.text === 'string') {
          pending.resolve(event.data.text);
        } else {
          pending.resolve(null);
        }
      }
    }
  });
}

/**
 * Requests the MAIN world script (which has the page origin and user session) to fetch a caption URL.
 */
export function fetchViaMainWorld(url: string, timeoutMs: number = 3500): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  initMainWorldListener();

  return new Promise((resolve) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timer = setTimeout(() => {
      pendingFetches.delete(requestId);
      resolve(null);
    }, timeoutMs);

    pendingFetches.set(requestId, { resolve, timer });

    window.postMessage(
      {
        type: 'DUAL_SUB_FETCH_REQUEST',
        requestId,
        url,
      },
      '*'
    );
  });
}

function toFullUrl(url: string): string {
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `https://www.youtube.com${url}`;
  return url;
}

export interface RawFetchResult {
  text: string | null;
  status?: number;
  isFatal?: boolean;
}

/**
 * Low-level text fetcher with triple redundancy:
 *  1. MAIN world bridge FIRST (runs in genuine page session with YouTube origin & cookies)
 *  2. Background Service Worker (has host_permissions, immune to page CSP)
 *  3. Content script direct fetch
 */
export async function fetchRawText(url: string): Promise<RawFetchResult> {
  const fullUrl = toFullUrl(url);

  // 1. Delegate to MAIN world script FIRST (runs in genuine page session with YouTube origin & cookies)
  try {
    const mainText = await fetchViaMainWorld(fullUrl, 3500);
    if (mainText && !mainText.startsWith('<!DOCTYPE') && !mainText.startsWith('<html')) {
      return { text: mainText.trim(), status: 200 };
    }
  } catch {
    // Fall through
  }

  // 2. Delegate to background worker (immune to page CSP, has host_permissions)
  if (isExtensionValid()) {
    try {
      const bgResp = await chrome.runtime.sendMessage({
        type: 'FETCH_TIMED_TEXT',
        url: fullUrl,
      });
      if (bgResp && bgResp.success && typeof bgResp.text === 'string') {
        const text = bgResp.text.trim();
        if (text && !text.startsWith('<!DOCTYPE') && !text.startsWith('<html')) {
          return { text, status: 200 };
        }
      }
    } catch {
      // Fall through
    }
  }

  // 3. Direct fetch from content script
  try {
    const res = await fetch(fullUrl);
    if (res.ok) {
      const text = (await res.text()).trim();
      if (text && !text.startsWith('<!DOCTYPE') && !text.startsWith('<html')) {
        return { text, status: res.status };
      }
    }
  } catch {
    // Fall through
  }

  return { text: null };
}

/**
 * Parses either XML or JSON3 timedtext payload.
 */
export function parseCaptionPayload(rawText: string): TimedSegment[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // Check if XML (Format 3 with <timedtext> / <p>, or Format 1 with <transcript> / <text>)
  if (
    trimmed.startsWith('<?xml') ||
    trimmed.includes('<transcript') ||
    trimmed.includes('<timedtext') ||
    trimmed.includes('<body>') ||
    trimmed.includes('<text') ||
    trimmed.includes('<p ') ||
    trimmed.includes('<p>')
  ) {
    const xmlSegs = parseTimedTextXml(trimmed);
    if (xmlSegs.length > 0) return xmlSegs;
  }

  // Check if JSON3
  try {
    const json: RawTimedTextJson3 = JSON.parse(trimmed);
    const segs = parseTimedTextJson3(json);
    if (segs.length > 0) return segs;
  } catch {
    if (trimmed.includes('<text') || trimmed.includes('<p') || trimmed.includes('<timedtext')) {
      return parseTimedTextXml(trimmed);
    }
  }

  return [];
}

/**
 * Fetches timed text from YouTube API endpoint.
 * Robustly tries:
 *  1. Raw baseUrl FIRST (preserves signed HMAC query params without breaking signatures)
 *  2. If not a 403/404 fatal error, try appendFmt(baseUrl, 'json3') or 'srv3'
 */
export async function fetchTimedText(baseUrl: string): Promise<TimedSegment[]> {
  if (!baseUrl) return [];

  // 1. Fetch raw baseUrl FIRST
  const rawResult = await fetchRawText(baseUrl);
  if (rawResult.text) {
    const segments = parseCaptionPayload(rawResult.text);
    if (segments.length > 0) {
      return segments;
    }
  }

  // 2. Try with fmt=json3
  const jsonUrl = appendFmt(baseUrl, 'json3');
  const jsonResult = await fetchRawText(jsonUrl);
  if (jsonResult.text) {
    const segments = parseCaptionPayload(jsonResult.text);
    if (segments.length > 0) {
      return segments;
    }
  }

  // 3. Try with fmt=srv3 (modern YouTube Format 3 XML)
  const srv3Url = appendFmt(baseUrl, 'srv3');
  const srv3Result = await fetchRawText(srv3Url);
  if (srv3Result.text) {
    const segments = parseCaptionPayload(srv3Result.text);
    if (segments.length > 0) {
      return segments;
    }
  }

  throw new Error('Could not fetch caption track text (network or signature error)');
}
