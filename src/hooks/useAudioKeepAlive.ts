import { useEffect } from "react";
import { keepAudioAlive } from "@/lib/audio";

/**
 * Backup against the OS suspending the AudioContext mid-race. While `active`,
 * poke the audio layer back to "running" on a slow interval and on every return
 * to the foreground — so a long race (or a backgrounded tab) never reaches the
 * finish gun with a dead context. Cheap and silent: a no-op until audio is
 * unlocked, and the poke runs regardless of mute so unmuting stays instant.
 */
export function useAudioKeepAlive(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    keepAudioAlive();
    const id = window.setInterval(keepAudioAlive, 10_000);
    const onVisibility = (): void => {
      if (document.visibilityState === "visible") keepAudioAlive();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active]);
}
