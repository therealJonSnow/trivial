"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface HoldButtonProps {
  label: string;
  onComplete: () => void;
  holdMs?: number;
  className?: string;
}

/**
 * Press-and-hold confirmation for destructive actions (Reset, Stop).
 * A fill sweeps left→right; releasing early cancels. One-handed, no accidental
 * trigger, no extra target to find (spec §5 control design).
 */
export function HoldButton({
  label,
  onComplete,
  holdMs = 1500,
  className = "",
}: HoldButtonProps) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const doneRef = useRef(false);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setProgress(0);
  }, []);

  const begin = useCallback(() => {
    doneRef.current = false;
    startRef.current = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - startRef.current) / holdMs);
      setProgress(p);
      if (p >= 1) {
        if (!doneRef.current) {
          doneRef.current = true;
          onComplete();
        }
        setProgress(0);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [holdMs, onComplete]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const holding = progress > 0;
  const text = holding ? `Hold to ${label}…` : label;

  return (
    <button
      type="button"
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className={`relative h-12 select-none overflow-hidden rounded-lg border bg-panel text-sm font-semibold uppercase tracking-wider transition-colors ${
        holding ? "border-danger" : "border-line"
      } ${className}`}
      style={{ touchAction: "none" }}
    >
      {/* Solid danger fill sweeps left→right as the hold progresses. The panel
          base above keeps the page (incl. the amber buzzer takeover) from
          showing through the button. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-danger"
        style={{ width: `${progress * 100}%` }}
      />
      {/* Two stacked labels: the muted base reads on the panel; a light copy is
          clipped to the fill so each character flips to readable as the red
          passes over it — correct contrast in both light and dark themes. */}
      <span className="absolute inset-0 flex items-center justify-center text-muted">
        {text}
      </span>
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center text-ground"
        style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }}
      >
        {text}
      </span>
    </button>
  );
}
