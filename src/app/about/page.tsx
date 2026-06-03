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

        <Section title="What this app does">
          <p>
            In a pursuit race the slower boats start first and the faster boats start later,
            so the whole fleet should arrive at the finish together. Whoever is in front when
            the finish gun sounds wins — there is no handicap sum to work out afterwards.
          </p>
          <p className="mt-2">
            Trivial works out each class&apos;s start time for you and counts down to every gun.
            Your job is simple: <strong className="font-semibold text-ink">make your usual
            sound signal each time the screen flashes orange.</strong>
          </p>
        </Section>

        <Section title="Before the race — setup">
          <ol className="space-y-3">
            <Step n={1} label="Set the race length">
              On the <em className="text-ink">Race duration</em> card, leave it on{" "}
              <strong className="font-semibold text-ink">Fixed</strong> and use{" "}
              <strong className="font-semibold text-ink">&minus;</strong> /{" "}
              <strong className="font-semibold text-ink">+</strong> to set the minutes
              (60&nbsp;is typical). If unsure, leave it as it is.
            </Step>
            <Step n={2} label="Choose your classes">
              Tap <em className="text-ink">Edit fleet</em>, type a class name, and tap it to
              add it. Tap the star (&#9733;) next to a class to have it ready next time.
            </Step>
            <Step n={3} label="Check the start order">
              The list shows the order boats will start —{" "}
              <strong className="font-semibold text-ink">slowest first</strong>. The line
              underneath shows the time the race should finish if you start now.
            </Step>
            <Step n={4} label="Test the sound">
              Turn your phone&apos;s volume up and tap{" "}
              <strong className="font-semibold text-ink">🔊 Test horn</strong>. If you hear a
              horn, you are ready. <strong className="font-semibold text-ink">Do this every
              time</strong> — it also switches off the phone&apos;s silent mode for the race.
            </Step>
          </ol>
        </Section>

        <Section title="Running the race">
          <ol className="space-y-3">
            <Step n={1} label="Start">
              Tap the big <strong className="font-semibold text-ink">Start Race</strong>{" "}
              button and tap to confirm. A short &ldquo;Get ready&rdquo; countdown begins.
            </Step>
            <Step n={2} label="Watch and listen">
              Prop the phone where you can see and hear it. The big number counts down to the
              next gun and tells you which class is next. The last few seconds beep.
            </Step>
            <Step n={3} label="Signal each start">
              At every start the whole screen flashes{" "}
              <strong className="font-semibold text-imminent">orange</strong>, sounds a horn,
              and shows the class name. <strong className="font-semibold text-ink">Make your
              start signal then.</strong> Trivial moves straight on to the next class.
            </Step>
            <Step n={4} label="Finish">
              When the time is up the screen flashes orange again and sounds the{" "}
              <strong className="font-semibold text-ink">finish horn</strong>. Make the finish
              signal. Time to wrap up! Note the boats positions on the water and you have your finish order.
            </Step>
          </ol>
        </Section>

        <Section title="If you need to stop or fix something">
          <ul className="space-y-2">
            <Tip>
              <strong className="font-semibold text-ink">Pause / Resume</strong> — tap{" "}
              <em className="text-ink">Pause</em> to hold the countdown (a postponement), then{" "}
              <em className="text-ink">Resume</em> to carry on where you left off.
            </Tip>
            <Tip>
              <strong className="font-semibold text-ink">Start over</strong> — press and hold{" "}
              <em className="text-ink">Reset</em> to run the same fleet again, or hold{" "}
              <em className="text-ink">Stop</em> to end and go back to setup.
            </Tip>
            <Tip>
              <strong className="font-semibold text-ink">Quiet the phone</strong> — the speaker
              button (top-left) silences Trivial&apos;s beeps.
            </Tip>
          </ul>
        </Section>

        <Section title="A boat turns up late">
          <p>
            Tap <em className="text-ink">+ Class</em> on the timer screen and add it. Trivial
            fits it into the running race without disturbing the other starts. If its start
            time has already gone by, you&apos;ll see a{" "}
            <strong className="font-semibold text-started">START NOW</strong> alert.
          </p>
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
