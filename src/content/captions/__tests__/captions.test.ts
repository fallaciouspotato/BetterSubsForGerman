import { describe, it, expect } from 'vitest';
import { selectTracks } from '../extractor';
import { parseTimedTextJson3, parseTimedTextXml, parseCaptionPayload, alignSegments, tokenizeWords } from '../fetcher';
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
});
