import Link from "next/link";
import { pyMeta } from "@/lib/data";

export const metadata = {
  title: "About — Trivial",
  description: "How pursuit racing works and how to use Trivial.",
};

export default function AboutPage() {
  return (
    <div className="instrument-bg mx-auto min-h-dvh max-w-screen px-4 pb-16 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-md">

        <header className="mb-6">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="-ml-2 flex h-11 items-center gap-1 rounded-lg px-2 font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted active:text-ink"
            >
              &#8249; Back
            </Link>
            <span className="font-mono text-[10px] tabular-nums text-muted">
              {pyMeta.source} v{pyMeta.version}
            </span>
          </div>
          <div className="mt-2">
            <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-[0.32em] text-ink">
              Trivial
            </h1>
            <p className="mt-1.5 font-display text-[11px] font-medium uppercase tracking-[0.28em] text-signal">
              Pursuit race start timer
            </p>
          </div>
          <div className="mt-3">
            <div className="flag-strip" />
          </div>
        </header>

        <Section title="Pursuit racing">
          <p>
            Slower boats start first, faster boats chase — all converging at the finish gun.
            No time correction: whoever leads at the gun wins.
          </p>
          <div className="my-4 rounded-xl border border-line bg-panel px-4 py-3">
            <p className="font-display text-[11px] uppercase tracking-[0.2em] text-muted">
              Start delay
            </p>
            <p className="mt-2 font-mono text-sm text-ink">
              duration &times; (1 &minus; class&nbsp;PY &divide; slowest&nbsp;PY)
            </p>
          </div>
          <p>
            Higher PY = slower. The slowest boat (highest PY) starts at T=0; the fastest
            (scratch) starts last. Trivial uses {pyMeta.source} numbers updated{" "}
            <span className="font-mono tabular-nums text-ink">{pyMeta.lastUpdated}</span>.
          </p>
        </Section>

        <Section title="Setup">
          <ol className="space-y-2.5">
            <Step n={1} label="Duration">
              How long the slowest boat sails. 60&nbsp;min is typical.
            </Step>
            <Step n={2} label="Start sequence">
              <strong className="font-semibold text-ink">5-4-1</strong> or{" "}
              <strong className="font-semibold text-ink">3-2-1</strong> — minutes before each
              class&apos;s start that warning, prep, and go signals fire.
            </Step>
            <Step n={3} label="Fleet">
              Tap <em className="text-ink">Edit fleet</em> and search for classes by name.
              Tap a row to add it. Star (&#9733;) a class to pre-select it next session.
            </Step>
            <Step n={4} label="Custom classes">
              Tap <em className="text-ink">Add custom class</em> at the top of the fleet
              picker to enter a local or modified PY.
            </Step>
          </ol>
        </Section>

        <Section title="Running the race">
          <ol className="space-y-2.5">
            <Step n={1} label="Start Race">
              Tap the button and confirm. A 10-second count-in begins.
            </Step>
            <Step n={2} label="Signal each class">
              The timer counts down to each start and calls the class name 30 seconds ahead.
              Give the signal when the countdown hits zero.
            </Step>
            <Step n={3} label="Finish gun">
              All boats sail until the duration expires. First across the line wins.
            </Step>
          </ol>
        </Section>

        <Section title="Late entrants">
          <p>
            Tap <em className="text-ink">Fleet</em> on the timer screen and add the class.
            Trivial slots it in against the locked race frame — existing starts don&apos;t
            reshuffle. If its start time has passed, a{" "}
            <strong className="font-semibold text-started">START NOW</strong> alert fires.
          </p>
        </Section>

        <Section title="Tips">
          <ul className="space-y-2">
            <Tip>Mute audio during briefings; re-enable before starting.</Tip>
            <Tip>Classes with identical PY share a single gun — check the schedule beforehand.</Tip>
            <Tip>Trivial works offline. Add it to your home screen for quick water access.</Tip>
          </ul>
        </Section>

        <Section title="Open source">
          <p>
            Trivial is made by{" "}
            <a
              href="https://github.com/therealJonSnow"
              className="text-ink underline underline-offset-2"
            >
              Jonathan Snow
            </a>{" "}
            and released under the{" "}
            <a
              href="https://www.gnu.org/licenses/gpl-3.0.html"
              className="text-ink underline underline-offset-2"
            >
              GPL-3.0
            </a>{" "}
            licence. You are free to use, modify, and distribute it under the same terms.
          </p>
          <a
            href="https://github.com/therealJonSnow/trivial"
            className="mt-3 flex items-center gap-2 font-mono text-xs text-signal underline-offset-2 active:text-ink"
          >
            <span>github.com/therealJonSnow/trivial</span>
            <span aria-hidden>&#8250;</span>
          </a>
        </Section>

        <footer className="mt-2 border-t border-line pt-6 text-center font-mono text-[10px] tabular-nums text-muted">
          {pyMeta.source} v{pyMeta.version} &middot; {pyMeta.lastUpdated}
        </footer>

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-signal">
        {title}
      </h2>
      <div className="text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

function Step({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-signal font-mono text-[11px] font-bold text-ground">
        {n}
      </span>
      <span>
        <strong className="font-semibold text-ink">{label} — </strong>
        {children}
      </span>
    </li>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-0.5 shrink-0 text-signal">&#9670;</span>
      <span>{children}</span>
    </li>
  );
}
