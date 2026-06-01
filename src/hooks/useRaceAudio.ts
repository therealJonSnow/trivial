import { useEffect, useRef } from "react";
import { playCountBeep, playHorn } from "@/lib/audio";

/**
 * Drives the race's audible cues off the derived timer view.
 *
 * - `msToNextHorn`: a short pip on each of the final five whole seconds before
 *   any horn (sequence signal or boat start).
 * - `takeoverKey`: a long horn on the rising edge of each gun's takeover.
 *
 * Cues fire on threshold-crossings within the render tick (which already runs
 * each animation frame). Each pip/horn is keyed so it sounds exactly once;
 * pausing freezes the inputs, so nothing fires while postponed. Known limit: a
 * backgrounded tab throttles rAF and may bunch or skip cues — acceptable since
 * the wake lock keeps the officer's screen on.
 */
export function useRaceAudio(
  msToNextHorn: number | null,
  takeoverKey: string | null,
  muted: boolean,
): void {
  // 5..1 in the final five seconds, else null.
  const countSec =
    msToNextHorn !== null && msToNextHorn > 0 && msToNextHorn <= 5_000
      ? Math.ceil(msToNextHorn / 1000)
      : null;

  const lastCountSec = useRef<number | null>(null);
  const lastHorn = useRef<string | null>(null);

  useEffect(() => {
    if (countSec !== lastCountSec.current) {
      if (countSec !== null && !muted) playCountBeep();
      lastCountSec.current = countSec;
    }
  }, [countSec, muted]);

  useEffect(() => {
    if (takeoverKey !== lastHorn.current) {
      if (takeoverKey !== null && !muted) playHorn();
      lastHorn.current = takeoverKey;
    }
  }, [takeoverKey, muted]);
}
