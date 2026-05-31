import { useEffect, useState } from "react";

/**
 * Returns `Date.now()`, refreshed on every animation frame while `active`.
 * The clock is wall-clock-anchored elsewhere — this only drives re-render
 * cadence, so dropped frames (backgrounding, throttling) never desync time.
 */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return now;
}
