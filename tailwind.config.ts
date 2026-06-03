import type { Config } from "tailwindcss";

/**
 * Trivial — "maritime instrument" theme.
 * High-contrast numerals, instrument colour semantics. Concrete colour values
 * live as CSS variables in globals.css so the palette can swap between the dark
 * (near-black, default) and light themes; the names + semantics are unchanged.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "var(--color-ground)", // page background
        panel: "var(--color-panel)", // raised surface
        "panel-2": "var(--color-panel-2)", // second-level raised surface (chips, sticky bars)
        line: "var(--color-line)", // hairlines / borders
        ink: "var(--color-ink)", // primary high-contrast text
        muted: "var(--color-muted)", // dim / upcoming-later
        // instrument status semantics
        imminent: "var(--color-imminent)", // amber — starting / imminent / the active gun
        started: "var(--color-started)", // green — started / done
        next: "var(--color-next)", // the very next start (max emphasis)
        danger: "var(--color-danger)", // destructive confirm fill
        // maritime accent — interactive chrome & selection (kept distinct from the
        // race-critical amber so "selected" never reads as "starting").
        signal: "var(--color-signal)", // chart-plotter cyan
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
