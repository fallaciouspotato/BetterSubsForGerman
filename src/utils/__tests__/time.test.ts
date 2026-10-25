import { describe, it, expect } from 'vitest';
import { msToSeconds, secondsToMs, formatTimestamp, todayISODate } from '../time';

describe('time utils', () => {
  it('converts ms to seconds and back', () => {
    expect(msToSeconds(1500)).toBe(1.5);
    expect(secondsToMs(1.5)).toBe(1500);
  });

  it('formats timestamp as mm:ss', () => {
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(65000)).toBe('1:05');
    expect(formatTimestamp(3600000)).toBe('60:00');
  });

  it('formats today as YYYY-MM-DD', () => {
    expect(todayISODate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
