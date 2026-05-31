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

  return (
    <button
      type="button"
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className={`relative h-12 select-none overflow-hidden rounded-lg border border-line text-sm font-semibold uppercase tracking-wider text-muted ${className}`}
      style={{ touchAction: "none" }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-danger/80"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative">{progress > 0 ? `Hold to ${label}…` : label}</span>
    </button>
  );
}
