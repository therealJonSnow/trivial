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
        "panel-2": "#131b24", // second-level raised surface (chips, sticky bars)
        line: "#1c252f", // hairlines / borders
        ink: "#f2f6fa", // primary high-contrast text
        muted: "#7c8a99", // dim / upcoming-later
        // instrument status semantics
        imminent: "#ffb000", // amber — starting / imminent / the active gun
        started: "#3ddc84", // green — started / done
        next: "#ffffff", // the very next start (max bright)
        danger: "#ff5247", // destructive confirm fill
        // maritime accent — interactive chrome & selection (kept distinct from the
        // race-critical amber so "selected" never reads as "starting").
        signal: "#27d3e0", // chart-plotter cyan
      },
      fontFamily: {
        // squared signage display for headings / labels / buttons
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        // tabular technical numerals; system stack as offline fallback
        mono: [
          "var(--font-mono)",
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
