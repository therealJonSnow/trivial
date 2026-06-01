"use client";

import type { StartSequence } from "@/lib/timer";

interface StartConfirmProps {
  sequence: StartSequence;
  /** Confirmed — unlock audio and arm the race. */
  onConfirm: () => void;
  onCancel: () => void;
}

/** First signal of the sequence — the count-in's target. */
const FIRST_SIGNAL: Record<StartSequence, string> = {
  "5-4-1": "5:00",
  "3-2-1": "3:00",
};

/**
 * Full-screen confirm gate before a race starts. Reusing the takeover visual
 * language, it gives the officer a deliberate "ready the horn/flag" beat — and
 * its button tap is the user gesture that unlocks audio for the whole race.
 */
export function StartConfirm({ sequence, onConfirm, onCancel }: StartConfirmProps) {
  return (
    <div className="animate-pop-in fixed inset-0 z-50 flex flex-col items-center justify-center bg-ground px-6 text-center">
      <div className="text-sm font-bold uppercase tracking-[0.4em] text-imminent">
        Start sequence?
      </div>
      <p className="mt-4 max-w-xs text-lg text-ink">
        This begins a 10-second count-in to the first signal{" "}
        <span className="font-mono font-bold tabular-nums text-imminent">
          ({FIRST_SIGNAL[sequence]})
        </span>
        .
      </p>
      <p className="mt-2 max-w-xs text-sm text-muted">
        Ready the horn and flag — beeps will count you in.
      </p>
      <button
        type="button"
        onClick={onConfirm}
        className="mt-10 h-16 w-full max-w-xs rounded-2xl bg-imminent text-xl font-bold uppercase tracking-wider text-ground active:opacity-90"
      >
        Start sequence
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="mt-3 h-12 px-8 text-sm font-semibold uppercase tracking-wider text-muted"
      >
        Cancel
      </button>
    </div>
  );
}
