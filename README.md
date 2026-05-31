# Trivial

**Make pursuit trivial.** A lightweight, offline-first pursuit race start timer for UK
sailing clubs, using the RYA Portsmouth Yardstick (PY) handicap system.

A race officer can set up and run a pursuit start sequence in under a minute, on a phone,
in wind and rain — no login, no backend, works fully offline.

See [`trivial-spec.md`](./trivial-spec.md) for the full product specification and the
Stage 1 decision record (§10).

---

## User guide (for the race officer)

### Set up a race — under a minute

1. **Open the app.** Your last race (classes, duration, start sequence) is restored. On
   first use the fleet starts empty.
2. **Pick your fleet.** Tap classes to add or remove them; search by name. Tap the ★ on any
   class to save it as a favourite — favourites appear first and are pre-selected next time.
   There's no limit on how many classes you select.
3. **Set the race duration** with the +/− stepper (minutes). This is the scratch boat's
   sailing time and it sets how far apart the starts are.
4. **Choose the start sequence:** **5-4-1** (5-minute) or **3-2-1** (3-minute).
5. **Check the schedule preview.** Each class shows its PY and start time as `+m:ss` from
   the first gun. The **slowest boat starts first** (`+0:00`); the **fastest (scratch)
   starts last** and chases the fleet down.
6. Tap **Start Race**.

### Run the race

- **Start sequence.** Tapping Start begins the countdown immediately. The big number counts
  down to the first gun and milestone badges light at 5 / 4 / 1 (or 3 / 2 / 1) minutes —
  sound your signals as usual.
- **First gun.** At zero the screen flashes **GO** — sound the horn once; the slowest class
  is away.
- **Each class start.** The display counts down to the next class, turns **amber in the
  final 10 seconds**, then flashes **GO** — one horn per class. Classes that share a PY
  start together on a single GO.
- **Master clock.** The top bar shows elapsed race time and time to finish (finish =
  scratch start + duration).

### Controls

- **Pause = postponement (AP).** Freezes the clock; on **Resume**, every start still to come
  — and the finish — shifts later by however long you were paused. Classes that have already
  started are unaffected.
- **Reset** *(press and hold)* — re-arms to the start of the sequence, paused and ready to
  go again with the same fleet, e.g. after a general recall.
- **Stop** *(press and hold)* — ends the session and returns to setup.
- Reset and Stop require a deliberate **press-and-hold** so they can't be triggered by
  accident in the cold or wet.

### Race-day tips

- Keep the timer screen open — it holds the screen awake (Wake Lock) so it won't sleep
  mid-sequence.
- Load the app once on wifi before going afloat; it then works **fully offline**.
- **Add it to your home screen** for a full-screen, app-like experience.
- The class list is locked once a race is running — tap **Stop** first if you need to change
  it.

---

## Stack

- **Next.js** (App Router, `output: 'export'` static export) — deploy to Vercel
- **TypeScript** throughout (no `any`), **Tailwind CSS** (dark "instrument" theme)
- **Zustand** (+ `persist`) for state, **Serwist** for the offline PWA
- **Vitest** for the calc/timer engine

## How the timer works

- **Start-sequence phase** counts to the first gun using the chosen standard countdown —
  **5-4-1** (signals at 5:00 / 4:00 / 1:00 / GO) or **3-2-1** (3:00 / 2:00 / 1:00 / GO).
  The sequence *is* the lead-in; tapping Start begins it immediately.
- **Race phase** shows a plain countdown to each class's start; a brief GO flash cues the
  officer to sound the horn once per class.
- The clock is **wall-clock anchored** (`Date.now()` against stored anchors), so it
  survives backgrounding and throttling. Pause is a **postponement** that shifts all
  remaining starts later.
- Classes sharing a PY are **grouped into one start**. Finish = scratch start + duration.

Offset formula (spec §2.2): `offset = duration × (1 − PY_scratch / PY_class)`.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # calc + timer engine unit tests
npm run build      # static export to ./out (Serwist SW bundled)
npm run lint
```

## Licence

GPL-3.0-or-later. PY data © RYA Portsmouth Yardstick Scheme (2026 list, v4).
