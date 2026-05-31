import type { Config } from "tailwindcss";

/**
 * Trivial — "maritime instrument" theme.
 * Near-black ground, high-contrast numerals, instrument colour semantics.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "#05070a", // near-black background
        panel: "#0e131a", // raised surface
        line: "#1c252f", // hairlines / borders
        ink: "#f2f6fa", // primary high-contrast text
        muted: "#7c8a99", // dim / upcoming-later
        // instrument status semantics
        imminent: "#ffb000", // amber — starting / imminent
        started: "#3ddc84", // green — started / done
        next: "#ffffff", // the very next start (max bright)
        danger: "#ff5247", // destructive confirm fill
      },
      fontFamily: {
        // tabular, instrument-like; system stack keeps the bundle lean and offline-safe
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        // oversized clock readouts
        clock: ["clamp(4rem, 22vw, 9rem)", { lineHeight: "1", letterSpacing: "-0.02em" }],
        "clock-sm": ["clamp(2rem, 9vw, 3.5rem)", { lineHeight: "1" }],
      },
    },
  },
  plugins: [],
};

export default config;
