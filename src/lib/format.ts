/** Time formatting helpers. All timing arithmetic stays in ms; only display rounds. */

const MS_PER_SEC = 1000;
const SEC_PER_MIN = 60;

/**
 * Format a fixed duration as `m:ss` (minutes unpadded, seconds padded).
 * Rounds to the nearest whole second — matches the spec's worked example
 * (1,496,481 ms → "24:56"). Negative inputs clamp to 0.
 */
export function formatMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / MS_PER_SEC));
  const m = Math.floor(totalSec / SEC_PER_MIN);
  const s = totalSec % SEC_PER_MIN;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Format a live countdown as `m:ss`. Uses ceil so the display reads "0:01"
 * through the final second and flips to "0:00" exactly at the event.
 * Negative inputs clamp to 0.
 *
 * Prefer `formatRaceStopwatch` with the snapped timer helpers in `timer.ts`
 * so every on-screen readout shares one stopwatch grid.
 */
export function formatCountdown(ms: number): string {
  return formatCountdownSecs(Math.max(0, Math.ceil(ms / MS_PER_SEC)));
}

/** Canonical formatter for every race-timer readout (elapsed, countdowns, fin). */
export const formatRaceStopwatch = formatMmSs;

/** Format a whole-second countdown — use with `secsToHorn` so every card shares one tick. */
export function formatCountdownSecs(totalSec: number): string {
  const sec = Math.max(0, totalSec);
  const m = Math.floor(sec / SEC_PER_MIN);
  const s = sec % SEC_PER_MIN;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Format an absolute wall-clock time as `HH:MM:SS` (24-hour). */
export function formatClock(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/** Ordinal label for start order: 1 → "1st", 2 → "2nd"… */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
