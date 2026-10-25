/** Time conversion utilities. */

export function msToSeconds(ms: number): number {
  return ms / 1000;
}

export function secondsToMs(s: number): number {
  return Math.round(s * 1000);
}

export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}
