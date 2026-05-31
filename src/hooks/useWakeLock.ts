import { useEffect, useRef } from "react";

/**
 * Holds a screen Wake Lock while `active`. Re-acquires on return to foreground
 * (the browser drops the lock when the tab is hidden). Silent no-op where the
 * API is unavailable — never throws, never crashes (spec §3 graceful fallback).
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let cancelled = false;

    const request = async (): Promise<void> => {
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          sentinelRef.current = null;
        });
      } catch {
        /* permission denied / not allowed — fall back silently */
      }
    };

    const onVisibility = (): void => {
      if (document.visibilityState === "visible" && sentinelRef.current === null) {
        void request();
      }
    };

    void request();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel) void sentinel.release();
    };
  }, [active]);
}
