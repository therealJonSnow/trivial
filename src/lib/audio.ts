/**
 * Race audio — oscillator-generated count-in beeps and horn blasts.
 *
 * No asset files: tones are synthesised via the Web Audio API so the PWA works
 * fully offline. Must be unlocked from a user gesture (`unlockAudio`, called on
 * the Start-sequence confirm tap) or iOS/Safari will refuse to play.
 */

type Ctx = AudioContext;

let ctx: Ctx | null = null;
/** Looping silent media element — flips iOS to the "playback" session so the
 *  hardware silent switch doesn't mute our Web Audio output (see unlockAudio). */
let silentEl: HTMLAudioElement | null = null;

/** A ~0.5s mono silent WAV as an object URL, built lazily in the browser. */
function silentWavUrl(): string {
  const sampleRate = 8000;
  const samples = sampleRate / 2; // 0.5s
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, samples * 2, true);
  // samples left zero-filled = silence
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

/**
 * Unlock audio playback. Call from a user gesture (the Start-sequence button).
 * Creates/resumes the AudioContext and starts a looping silent media element so
 * beeps remain audible even with the iOS ring/silent switch engaged.
 */
export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  try {
    const AC: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!ctx && AC) ctx = new AC();
    if (ctx?.state === "suspended") void ctx.resume();

    if (!silentEl) {
      silentEl = new Audio(silentWavUrl());
      silentEl.loop = true;
      silentEl.preload = "auto";
    }
    void silentEl.play().catch(() => {});
  } catch {
    /* audio unavailable — visuals still convey the sequence */
  }
}

/** Play a single tone with click-free attack/release. No-op if not unlocked. */
function tone(freqHz: number, durationMs: number, peak = 0.32): void {
  if (!ctx || ctx.state !== "running") return;
  const t0 = ctx.currentTime;
  const dur = durationMs / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = freqHz;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.008);
  gain.gain.setValueAtTime(peak, t0 + Math.max(0.008, dur - 0.03));
  gain.gain.linearRampToValueAtTime(0, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Short count-in pip (one of the final five seconds before a horn). */
export function playCountBeep(): void {
  tone(880, 120);
}

/** Long horn blast at a gun (sequence signal or boat start). */
export function playHorn(): void {
  tone(440, 800);
}
