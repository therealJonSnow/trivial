import { useEffect, useRef } from "react";
import { playCountBeep, playHorn } from "@/lib/audio";
import { syncedCountInSec } from "@/lib/timer";

/**
 * Drives the race's audible cues off the derived timer view.
 *
 * - `msToNextHorn`: a short pip when the readout shows 5, 4, 3, 2, or 1 before
 *   the next horn (sequence signal or boat start).
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
  // 5..1 on the same whole seconds the readout shows — not a raw ≤5000 ms window.
  const countSec = msToNextHorn !== null ? syncedCountInSec(msToNextHorn) : null;

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
