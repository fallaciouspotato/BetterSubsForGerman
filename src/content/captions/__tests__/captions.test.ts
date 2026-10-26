import { describe, it, expect } from 'vitest';
import { selectTracks } from '../extractor';
import {
  parseTimedTextJson3,
  parseTimedTextXml,
  parseCaptionPayload,
  alignSegments,
  tokenizeWords,
  fetchTimedText,
  appendFmt,
  isSentenceEnd,
  mergeTextWithOverlap,
  mergeSentenceSegments,
} from '../fetcher';
import type { CaptionTrack, RawTimedTextJson3, TimedSegment } from '../types';

describe('captions/extractor', () => {
  const sampleTracks: CaptionTrack[] = [
    {
      baseUrl: 'https://www.youtube.com/api/timedtext?v=1&lang=de',
      languageCode: 'de',
      name: { simpleText: 'German' },
      vssId: '.de',
      isTranslatable: true,
    },
    {
      baseUrl: 'https://www.youtube.com/api/timedtext?v=1&lang=de&kind=asr',
      languageCode: 'de',
      name: { simpleText: 'German (auto-generated)' },
      vssId: 'a.de',
      kind: 'asr',
      isTranslatable: true,
    },
    {
      baseUrl: 'https://www.youtube.com/api/timedtext?v=1&lang=en',
      languageCode: 'en',
      name: { simpleText: 'English' },
      vssId: '.en',
      isTranslatable: true,
    },
  ];

  it('selects manual tracks over auto-generated tracks', () => {
    const selected = selectTracks(sampleTracks, 'de', 'en');
    expect(selected.targetTrack?.vssId).toBe('.de');
    expect(selected.nativeTrack?.vssId).toBe('.en');
  });

  it('selects regional language variants (e.g. de-DE, en-US)', () => {
    const regionalTracks: CaptionTrack[] = [
      {
        baseUrl: 'https://www.youtube.com/api/timedtext?v=1&lang=de-DE',
        languageCode: 'de-DE',
        name: { simpleText: 'German (Germany)' },
        vssId: '.de-DE',
        isTranslatable: true,
      },
      {
        baseUrl: 'https://www.youtube.com/api/timedtext?v=1&lang=en-US',
        languageCode: 'en-US',
        name: { simpleText: 'English (United States)' },
        vssId: '.en-US',
        isTranslatable: true,
      },
    ];
    const selected = selectTracks(regionalTracks, 'de', 'en');
    expect(selected.targetTrack?.languageCode).toBe('de-DE');
    expect(selected.nativeTrack?.languageCode).toBe('en-US');
  });

  it('falls back to auto-generated track if manual is unavailable', () => {
    const tracksOnlyAsr: CaptionTrack[] = [sampleTracks[1]];
    const selected = selectTracks(tracksOnlyAsr, 'de', 'en');
    expect(selected.targetTrack?.vssId).toBe('a.de');
    // Native falls back to auto-translated from target
    expect(selected.nativeTrack?.baseUrl).toContain('tlang=en');
  });

  it('handles video with ONLY 1 English subtitle track by auto-translating to German', () => {
    const onlyEnglish: CaptionTrack[] = [sampleTracks[2]];
    const selected = selectTracks(onlyEnglish, 'de', 'en');
    expect(selected.nativeTrack?.languageCode).toBe('en');
    expect(selected.targetTrack?.baseUrl).toContain('tlang=de');
  });

  it('resolves track language from vssId if languageCode is missing', () => {
    const tracksWithoutLangCode: CaptionTrack[] = [
      {
        baseUrl: 'https://www.youtube.com/api/timedtext?v=1&lang=en',
        vssId: 'a.en',
        kind: 'asr',
        languageCode: '',
        name: { simpleText: 'English' },
      },
    ];
    const selected = selectTracks(tracksWithoutLangCode, 'de', 'en');
    expect(selected.nativeTrack?.vssId).toBe('a.en');
    expect(selected.targetTrack?.baseUrl).toContain('tlang=de');
  });

  it('returns null tracks if list is empty', () => {
    const selected = selectTracks([], 'de', 'en');
    expect(selected.targetTrack).toBeNull();
    expect(selected.nativeTrack).toBeNull();
  });
});

describe('captions/fetcher', () => {
  it('parses timed text json3 into segments', () => {
    const json3: RawTimedTextJson3 = {
      events: [
        {
          tStartMs: 1000,
          dDurationMs: 2500,
          segs: [{ utf8: 'Hallo ' }, { utf8: 'Welt\n' }],
        },
        {
          tStartMs: 4000,
          dDurationMs: 1500,
          segs: [{ utf8: 'Guten Tag' }],
        },
      ],
    };

    const segments = parseTimedTextJson3(json3);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({
      startMs: 1000,
      durationMs: 2500,
      endMs: 3500,
      text: 'Hallo Welt',
    });
    expect(segments[1].text).toBe('Guten Tag');
  });

  it('parses legacy YouTube XML timedtext payload with entities and reversed attribute order', () => {
    const xml = `<?xml version="1.0" encoding="utf-8" ?>
<transcript>
  <text dur="2.16" start="1.54">Hallo &amp; Willkommen!</text>
  <text id="cue2" start='4.20' dur='3.00'>Hier ist ein &#39;Test&#39;.</text>
</transcript>`;

    const segments = parseTimedTextXml(xml);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({
      startMs: 1540,
      durationMs: 2160,
      endMs: 3700,
      text: 'Hallo & Willkommen!',
    });
    expect(segments[1].text).toBe("Hier ist ein 'Test'.");
  });

  it('parses modern YouTube format 3 XML with <p t="..." d="..."> and nested <s> spans', () => {
    const format3Xml = `<?xml version="1.0" encoding="utf-8" ?>
<timedtext format="3">
<head>
<wp id="0" ap="7" ah="20" av="100" rc="1" cc="40"/>
<ws id="0" ju="2" pd="0" sd="0"/>
</head>
<body>
<p t="1240" d="3560" wp="0" ws="0"><s>Hallo</s><s t="200"> zusammen,</s><s t="500"> wie</s><s t="700"> geht&#39;s?</s></p>
<p t="4800" d="2100" wp="0" ws="0">Das ist das zweite Segment.</p>
</body>
</timedtext>`;

    const segments = parseTimedTextXml(format3Xml);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({
      startMs: 1240,
      durationMs: 3560,
      endMs: 4800,
      text: "Hallo zusammen, wie geht's?",
    });
    expect(segments[1]).toEqual({
      startMs: 4800,
      durationMs: 2100,
      endMs: 6900,
      text: 'Das ist das zweite Segment.',
    });
  });

  it('parses caption payload whether it is XML or JSON3', () => {
    const xml = `<transcript><text start="0.5" dur="1.5">XML text</text></transcript>`;
    const json = JSON.stringify({
      events: [{ tStartMs: 500, dDurationMs: 1500, segs: [{ utf8: 'JSON text' }] }],
    });

    const xmlSegs = parseCaptionPayload(xml);
    expect(xmlSegs).toHaveLength(1);
    expect(xmlSegs[0].text).toBe('XML text');

    const jsonSegs = parseCaptionPayload(json);
    expect(jsonSegs).toHaveLength(1);
    expect(jsonSegs[0].text).toBe('JSON text');
  });

  it('tokenizes German words with umlauts and ß properly', () => {
    const words = tokenizeWords('Das Mädchen läuft über die große Straße!');
    expect(words).toEqual(['Das', 'Mädchen', 'läuft', 'über', 'die', 'große', 'Straße']);
  });

  it('aligns target and native segments by time overlap', () => {
    const target: TimedSegment[] = [
      { startMs: 1000, durationMs: 3000, endMs: 4000, text: 'Das ist ein Hund.' },
      { startMs: 4500, durationMs: 2000, endMs: 6500, text: 'Er bellt laut.' },
    ];

    const native: TimedSegment[] = [
      { startMs: 800, durationMs: 3300, endMs: 4100, text: 'That is a dog.' },
      { startMs: 4600, durationMs: 1800, endMs: 6400, text: 'He barks loudly.' },
    ];

    const cues = alignSegments(target, native);
    expect(cues).toHaveLength(2);
    expect(cues[0].target).toBe('Das ist ein Hund.');
    expect(cues[0].native).toBe('That is a dog.');
    expect(cues[0].targetWords).toEqual(['Das', 'ist', 'ein', 'Hund']);
    expect(cues[1].native).toBe('He barks loudly.');
  });

  it('aligns native-only segments when target is empty (for dynamic translation)', () => {
    const native: TimedSegment[] = [
      { startMs: 1000, durationMs: 2000, endMs: 3000, text: 'Welcome to the channel.' },
    ];

    const cues = alignSegments([], native);
    expect(cues).toHaveLength(1);
    expect(cues[0].native).toBe('Welcome to the channel.');
    expect(cues[0].target).toBe('');
  });

  it('correctly detects sentence endings vs abbreviations', () => {
    expect(isSentenceEnd('Das ist ein Satz.')).toBe(true);
    expect(isSentenceEnd('Wie geht es dir?')).toBe(true);
    expect(isSentenceEnd('Achtung!')).toBe(true);
    expect(isSentenceEnd('Wie auch immer,')).toBe(false);
    expect(isSentenceEnd('Das ist z.B.')).toBe(false);
    expect(isSentenceEnd('Hello Dr.')).toBe(false);
    expect(isSentenceEnd('plain word without punctuation')).toBe(false);
  });

  it('merges overlapping suffix-prefix text without duplicating words', () => {
    expect(mergeTextWithOverlap('Anyway, I am bored,', 'and this must change.')).toBe(
      'Anyway, I am bored, and this must change.'
    );
    // Overlapping words
    expect(mergeTextWithOverlap("Anyway, I'm bored,", "I'm bored, and this situation")).toBe(
      "Anyway, I'm bored, and this situation"
    );
  });

  it('pre-merges fragmented phrase segments into complete sentences', () => {
    const rawSegments: TimedSegment[] = [
      { startMs: 1000, durationMs: 2000, endMs: 3000, text: 'Wie auch immer, ich langweile mich,' },
      { startMs: 3000, durationMs: 3000, endMs: 6000, text: 'und diese Situation muss sofort geändert werden.' },
      { startMs: 8000, durationMs: 2000, endMs: 10000, text: 'Wir müssen los.' },
    ];

    const merged = mergeSentenceSegments(rawSegments);
    expect(merged).toHaveLength(2);
    expect(merged[0].text).toBe('Wie auch immer, ich langweile mich, und diese Situation muss sofort geändert werden.');
    expect(merged[0].startMs).toBe(1000);
    expect(merged[0].endMs).toBe(6000);
    expect(merged[1].text).toBe('Wir müssen los.');
  });

  it('guarantees the German subtitle shows the whole sentence matching the English subtitle', () => {
    // English subtitle is a whole sentence spanning 1000ms to 6000ms
    const native: TimedSegment[] = [
      {
        startMs: 1000,
        durationMs: 5000,
        endMs: 6000,
        text: "Anyway, I'm bored, and this situation must be changed immediately.",
      },
    ];

    // German subtitle is fragmented into 2 parts
    const target: TimedSegment[] = [
      { startMs: 1000, durationMs: 2500, endMs: 3500, text: 'Wie auch immer, ich langweile mich,' },
      { startMs: 3500, durationMs: 2500, endMs: 6000, text: 'und diese Situation muss sofort geändert werden.' },
    ];

    const cues = alignSegments(target, native);
    expect(cues).toHaveLength(1);
    // Crucial: German subtitle shows the WHOLE sentence, not just a fragment!
    expect(cues[0].target).toBe('Wie auch immer, ich langweile mich, und diese Situation muss sofort geändert werden.');
    expect(cues[0].native).toBe("Anyway, I'm bored, and this situation must be changed immediately.");
    expect(cues[0].startMs).toBe(1000);
    expect(cues[0].endMs).toBe(6000);
    expect(cues[0].targetWords).toContain('Situation');
    expect(cues[0].targetWords).toContain('geändert');
  });

  it('guarantees both subtitles show the whole sentence in reverse learning mode', () => {
    // English video with fragmented speech
    const native: TimedSegment[] = [
      { startMs: 1000, durationMs: 2000, endMs: 3000, text: 'The first thing they will ask us' },
      { startMs: 3000, durationMs: 3000, endMs: 6000, text: 'at the border is our passport.' },
    ];

    // German auto-translated track has 2 segments
    const target: TimedSegment[] = [
      { startMs: 1000, durationMs: 2500, endMs: 3500, text: 'Das Erste, was sie uns an der Grenze fragen werden,' },
      { startMs: 3500, durationMs: 2500, endMs: 6000, text: 'ist unser Reisepass.' },
    ];

    const cues = alignSegments(target, native);
    expect(cues).toHaveLength(1);
    expect(cues[0].target).toBe('Das Erste, was sie uns an der Grenze fragen werden, ist unser Reisepass.');
    expect(cues[0].native).toBe('The first thing they will ask us at the border is our passport.');
    expect(cues[0].targetWords).toContain('Reisepass');
  });

  it('correctly appends fmt=json3 to urls with and without existing query params', () => {
    expect(appendFmt('https://youtube.com/api/timedtext?v=1', 'json3')).toBe(
      'https://youtube.com/api/timedtext?v=1&fmt=json3'
    );
    expect(appendFmt('https://youtube.com/api/timedtext?v=1&fmt=srv3', 'json3')).toBe(
      'https://youtube.com/api/timedtext?v=1&fmt=json3'
    );
  });

  it('fetches auto-translated tlang track by querying fmt=json3 first', async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls: string[] = [];

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      requestedUrls.push(url);
      if (url.includes('fmt=json3')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              events: [
                {
                  tStartMs: 500,
                  dDurationMs: 2000,
                  segs: [{ utf8: 'Hallo auf Deutsch' }],
                },
              ],
            }),
        } as Response;
      }
      return { ok: false, status: 400, text: async () => '' } as Response;
    };

    try {
      const segments = await fetchTimedText('https://www.youtube.com/api/timedtext?v=1&lang=en&tlang=de');
      expect(segments).toHaveLength(1);
      expect(segments[0].text).toBe('Hallo auf Deutsch');
      // Verify fmt=json3 was requested first for tlang
      expect(requestedUrls[0]).toContain('fmt=json3');
      expect(requestedUrls[0]).toContain('tlang=de');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
