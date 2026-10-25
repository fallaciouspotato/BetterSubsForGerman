import { describe, it, expect } from 'vitest';
import { decodeHtmlEntities } from '../text';

describe('decodeHtmlEntities', () => {
  it('decodes numeric apostrophes and quotes', () => {
    const raw = "n&#39;t do much. Anyway, I&#39;m bored, and they&#39;ll ask us at";
    const expected = "n't do much. Anyway, I'm bored, and they'll ask us at";
    expect(decodeHtmlEntities(raw)).toBe(expected);
  });

  it('decodes named entities', () => {
    const raw = '&quot;Hello&quot; &amp; welcome &lt;here&gt;';
    expect(decodeHtmlEntities(raw)).toBe('"Hello" & welcome <here>');
  });

  it('returns untouched strings without ampersands', () => {
    expect(decodeHtmlEntities('plain text')).toBe('plain text');
  });
});
