# Trivial — Product Specification
### *Make pursuit trivial.*

**Version:** 3.2
**Last updated:** 2026-06-01
**Author:** Solo developer / Claude Code agent sessions

> **v3.2 changelog** — Allow **adding classes mid-race** (latecomers). The timing frame
> (scratch + first gun) is locked at race start so additions never reshuffle existing starts;
> an addition either slots into the queue or, if its start has passed, raises a **START NOW**
> alert. Introduces an in-race **Fleet** screen (timer ⇄ fleet navigation). Flagged **[v3.2]**.
> See §2.8. Also adds **§11 Implementation Status** (build state, file map, what's verified vs
> pending) so a fresh session has full context.
>
> **v3.1 changelog** — Replaced the configurable "warning length" with a **start-sequence
> toggle (5-4-1 / 3-2-1)**: the selected standard dinghy-racing sequence is itself the
> lead-in to the first gun, and tapping Start begins it immediately. Flagged **[v3.1]**.
>
> **v3.0 changelog** — Folded in the decisions from the Stage 1 design interview. Material
> changes from v2.0 are flagged inline with **[v3]**. The biggest shifts: a lead-in
> sequence before the first gun, a rolling master clock with a defined finish,
> postponement-style pause, no class-list edits while running, grouped identical-PY starts,
> and removal of the 20-class cap. See §10 for the full decision record.

---

## 1. Overview

**Trivial** is a lightweight, open-source web application for UK sailing clubs to run pursuit races using the RYA Portsmouth Yardstick (PY) handicap system.

It exists to replace pen-and-paper start sheets with a fast, reliable, phone-friendly countdown tool that a race officer can operate single-handedly under race conditions.

### Core promise
A race officer can set up and run a pursuit race start sequence in under one minute, on their phone, without training, in wind and rain.

### Primary user
**The race officer (RO)** — on the day, on the water, likely using a personal phone. They are not a developer. They may be cold, distracted, and time-pressured. Every design and interaction decision is made with this person in mind.

---

## 2. Core Concepts

### 2.1 Pursuit Race Logic

- Boats start at staggered times calculated from their PY handicap
- Slower boats (higher PY) start earlier; faster boats (lower PY) start later
- All boats theoretically finish at the same time
- Starts are **class-based** — individual boats within a class start together
- A **scratch boat** (lowest PY in the selected fleet) starts last, at offset 00:00

### 2.2 Start Offset Formula

The start time offset for each class is calculated as:

```
offset (minutes) = raceDuration × (1 − PY_scratch / PY_class)
```

Where:
- `raceDuration` = total race length in minutes (the scratch boat's sailing time — see §2.4)
- `PY_scratch` = PY number of the fastest (scratch) boat in the fleet
- `PY_class` = PY number of the class being calculated

**Worked example:**

> Race duration: 60 minutes
> Scratch boat: RS800 (PY 797)
> Mirror (PY 1364)
>
> offset = 60 × (1 − 797 / 1364)
> offset = 60 × 0.4157
> offset = **24.94 minutes = 24:56**
>
> The Mirror starts 24 minutes and 56 seconds before the RS800.

**Implementation rules:**
- The scratch boat is always auto-detected as the selected class with the lowest PY number
- Offsets are computed in **milliseconds** internally, displayed as mm:ss
- The scratch boat always has an offset of 00:00
- Start order is sorted descending by offset (largest offset = earliest start = first)
- Display rounding: the canonical worked example (1496.4s) renders as **24:56**; rounding
  is to the nearest whole second for display, while all timing arithmetic stays in ms

### 2.3 The Timer Model **[v3]**

The race runs on a single **wall-clock-anchored** master timeline. There are two phases:

**Start-sequence phase** — begins the instant the RO taps **Start Race** (no separate
configurable "warning"; the sequence *is* the lead-in). **[v3.1]**
- The RO picks one of the two standard dinghy-racing start sequences via a toggle on setup:
  - **5-4-1** — 5-minute lead-in, signals at **5:00 / 4:00 / 1:00 / GO**
  - **3-2-1** — 3-minute lead-in, signals at **3:00 / 2:00 / 1:00 / GO**
- The countdown runs to the **first gun** (the earliest / slowest class), with the selected
  sequence's milestones emphasised. This phase — and only this phase — shows milestones.

**Race phase** — begins at the first gun (master-time `T = 0`).
- The primary display is a **plain visual countdown to the next class's start**.
- At each class start it flashes **GO** briefly (so the RO sounds the horn **once** per
  class), then retargets the next class. If the next gun is nearer than the flash hold,
  it retargets immediately — a GO flash must never hide an imminent next start.
- There is **no** 5-4-1 milestone treatment after the first gun.

**Reference frame:**
- First gun is at master-time `T = 0`.
- A class with offset `O` starts at `maxOffset − O` after the first gun.
- The scratch boat (offset 0) starts at `T = maxOffset`.

### 2.4 Master Clock & Finish **[v3]**

- A **master race clock** shows elapsed time since the first gun, displayed as a small,
  persistent secondary readout (the next-start countdown always dominates).
- **Finish = scratch start + raceDuration**, i.e. `maxOffset + raceDuration` after the
  first gun. Stage 1 shows the finish as a clock readout and a finish state; it does **not**
  record results.

### 2.5 Pause = Postponement **[v3]**

Pause models a real-world **postponement (AP)**, not a freeze of physical reality:
- The clock freezes.
- On resume, **all not-yet-fired starts and the finish shift later** by the paused duration.
- Already-fired starts are unaffected (they cannot un-happen).

### 2.6 Times Displayed **[v3]**

- The big primary number is always the **countdown to the next gun** (mm:ss).
- Each schedule row shows the **absolute wall-clock time** of its start (e.g. `11:24:56`),
  computed from the Start tap, once a race is started — so the RO can cross-check a watch.
- The schedule's relative time column shows each class's start as `+mm:ss` from the first
  gun (ascending), **not** the behind-scratch offset — see the Start Schedule feature for why.

### 2.7 Identical PY **[v3]**

Classes that share an identical PY have an identical offset and start simultaneously. They
are **collapsed into a single start entry / single GO**, listing all class names on one row.
(The 2026 dataset contains 9 such groups, including one three-way tie and ties that cross
categories, so this is a real, tested case — not an edge case.)

### 2.8 Mid-race Additions **[v3.2]**

A class **can be added after the race has started** — a latecomer turning up to join in.
This reverses v3's "no edits while running" rule, but safely: the timing reference frame
(scratch boat + first gun) is **locked at race start**, so adding a class never reshuffles
the boats already on the schedule.

When a class is added mid-race, its start is computed in the locked frame and falls into one
of two cases:
- **Still upcoming** — its start time hasn't passed: it simply slots into the queue at the
  right position. (A latecomer *faster* than the scratch gets a start *after* the scratch —
  it starts last and chases — rather than becoming a new scratch.)
- **Already passed** — its start time is in the past: the app raises a **START NOW** alert
  telling the RO to send that boat across immediately. It is then shown as already started.

Removal mid-race is allowed only for classes that **haven't started yet**; started classes
are locked. Full free editing remains available before Start. Duration and start sequence are
fixed once running.

### 2.9 Key Assumptions

- One fleet per race (multi-fleet is out of scope)
- Class-based starts only (not individual boat handicaps)
- Fixed race duration and start sequence, set before the race
- No manual override of individual start times (Stage 1)
- **No upper limit on selected classes** **[v3]** — the design must scale to the full list;
  minimum 1 to start

---

## 3. Technical Stack **[v3]**

### Frontend
- **Framework:** Next.js (App Router) with **static export** (`output: 'export'`).
  Chosen over a lighter Vite stack to keep a clean runway to Stage 3 auth/Supabase (drop
  the export flag and add server routes later).
- **Deployment:** primary target **Vercel** (root-served, no basePath). Also deployable to
  Netlify or GitHub Pages (the latter would require basePath/SW-scope config).
- **Styling:** Tailwind CSS
- **Language:** TypeScript throughout — **no `any`**
- **State:** Zustand with `persist` middleware

### Data
- **Stage 1:** Static JSON committed to the repo at **`/data/py_data_2026.json`**,
  **imported at build time** (bundled into the JS — inherently offline, no runtime fetch)
- **Stage 3+:** Supabase (optional, future)

### Offline / PWA
- Progressive Web App via **Serwist** (`@serwist/next`)
- Full offline capability after first load
- Precache: app shell + bundled PY data

### Browser APIs
- **Wake Lock API** — prevents screen sleep during the timer (Stage 1, mandatory);
  re-acquired on `visibilitychange`, released on stop/background, silent fallback if absent
- **LocalStorage** — persists favourites and last race config (Stage 1), namespaced keys
- **Web Audio API** — audible alerts (Stage 2; Stage 1 milestones are **visual only**)

### Tooling
- **npm**, ESLint (strict, no-`any`), Prettier, **Vitest** (calc-engine unit tests)
- **Licence:** GPL-3.0

---

## 4. PY Data

### Source
RYA Portsmouth Yardstick Scheme — Portsmouth Number List 2026
Version 4, last updated 22 April 2026

### File
`/data/py_data_2026.json`. **The agent must not invent, approximate, or fetch PY data.**
Use only the supplied file.

### Schema

```json
{
  "meta": {
    "source": "RYA Portsmouth Yardstick Scheme",
    "version": "4",
    "lastUpdated": "2026-04-22",
    "description": "RYA Portsmouth Number (PY) List 2026."
  },
  "classes": {
    "dinghy": [
      {
        "id": 310,
        "name": "RS800",
        "crew": 2,
        "rig": "S",
        "spinnaker": true,
        "py": 797,
        "change": -2,
        "notes": ""
      }
    ],
    "multihull": [],
    "experimental": []
  }
}
```

### Field reference

| Field | Type | Description |
|---|---|---|
| `id` | number | RYA Class ID |
| `name` | string | Display name |
| `crew` | number | Number of crew |
| `rig` | `"S" \| "U"` | S = stayed, U = unstayed |
| `spinnaker` | boolean | Spinnaker equipped |
| `py` | number | Portsmouth Yardstick number |
| `change` | number | Year-on-year change |
| `notes` | string | RYA notes, empty string if none |

**Dataset facts (2026):** 107 classes (87 dinghy, 8 multihull, 12 experimental); PY range
680–1629; 9 duplicate-PY groups; 24 classes carry notes.

### Annual updates
PY data is updated annually by the developer (`meta.version` / `meta.lastUpdated` updated
alongside). No UI for this in Stage 1.

---

## 5. Product Stages

---

## 🟢 Stage 1 — MVP

### Goal
A fully functional pursuit race calculator and live countdown timer. No backend. No login.
Works offline. Operable in under one minute.

### Acceptance criteria
- [ ] RO can select classes, set duration, and reach the timer screen in under 5 taps
- [ ] Start offsets are calculated correctly per §2.2 (unit-tested, incl. the 24:56 example)
- [ ] Start sequence (5-4-1 or 3-2-1, toggle) counts to the first gun with its milestone emphasis
- [ ] Race phase shows the next-start countdown + a small master race clock without manual scrolling
- [ ] Identical-PY classes are grouped into a single start
- [ ] Pause (postponement), Resume, Reset (re-arm to sequence start, paused), and Stop all function
- [ ] A class can be added mid-race: still-upcoming → into the queue; already-passed → START NOW alert (§2.8)
- [ ] Destructive controls (Reset, Stop) require a press-and-hold confirmation
- [ ] App works fully offline after first load
- [ ] Screen does not sleep during an active timer session (Wake Lock)
- [ ] Favourites persist across sessions via LocalStorage
- [ ] Last race config (duration + start sequence + selected classes) is restored on next visit

---

### Feature: Favourites
- RO can mark any class as a favourite from the class browser
- Favourites are shown first and pre-selected on the setup screen
- Stored in LocalStorage — no account required
- **No cap on selected classes** **[v3]**

---

### Feature: Race Setup

**Screen flow:**
1. App opens → shows last race config (or empty state on first use)
2. RO adjusts selected classes (favourites listed first, pre-selected)
3. RO confirms/adjusts race **duration** and **start sequence** (5-4-1 / 3-2-1) (pre-filled from last session)
4. RO taps **Start Race** → timer screen

**Class selection:**
- Primary view: favourites list (tick/untick)
- Secondary view: full PY list, searchable, grouped by category (dinghy / multihull / experimental)
- Selected classes shown with PY number
- Scratch boat (lowest PY) auto-detected and labelled
- The start schedule (times) updates in real time as classes are added/removed

**Inputs** **[v3]** — large +/− steppers, no keyboard:
- **Race duration** — minutes, default 60 (first use), pre-filled from LocalStorage
- **Start sequence** — segmented toggle between **5-4-1** and **3-2-1** (default 5-4-1).
  Determines the lead-in length (5 or 3 min) and the milestone signals. There is no
  separate "warning minutes" control. **[v3.1]**

**Editability:** the class list is editable freely **before** Start. **While running** the RO
can still **add** a class (latecomer) and **remove** not-yet-started classes via the in-race
Fleet screen; started classes are locked. Additions are timed in the locked frame (§2.8) and
either slot into the queue or raise a START NOW alert. **[v3.2]**

---

### Feature: Start Schedule

Shown on the setup screen and as a reference panel on the timer screen.

| Column | Content |
|---|---|
| Start order | 1st, 2nd, 3rd… |
| Class name(s) | e.g. Mirror (grouped if tied PY) |
| PY | e.g. 1364 |
| Start (from first gun) | e.g. `+0:00` for the first/slowest class, `+24:56` for the scratch **[v3]** |
| Start clock time | e.g. 11:24:56 (after Start) **[v3]** |
| Status | Upcoming / Starting / Started |

- Sorted by start order (earliest first); the slowest class starts first at `+0:00`, the
  scratch boat starts **last** at the largest time so faster boats chase the fleet down.
- **Display the time as elapsed-from-first-gun (`+mm:ss`, ascending), not the
  behind-scratch offset.** [v3] The §2.2 offset is the *computation*; showing it directly in
  the schedule inverts the apparent order (the first boat would show the biggest number),
  which reads as "slowest starts last" and is wrong. `startFromFirstGun = maxOffset − offset`.

---

### Feature: Live Timer

**Primary display (dominates screen):**
- Large countdown to the next class start (mm:ss)
- Class name(s) of the next start
- **GO** flash/highlight when a class is starting (full-screen amber takeover)
- Imminent cue: the countdown turns **amber in the final 10s** before each gun
- Start-sequence phase only: the selected sequence's milestone emphasis (5/4/1 or 3/2/1)

**Secondary displays:**
- Small persistent **master race clock** (elapsed + time-to-finish) **[v3]**
- Scrollable upcoming queue (next 2–4), auto-scrolls as starts pass — no manual scrolling
- **+ Boat** button opens the in-race **Fleet** screen (§2.8) to add a latecomer / remove a
  not-yet-started class, then returns to the timer **[v3.2]**

**Controls:**
- **Pause / Resume** — postponement model (§2.5); the only prominent control, large
- **Reset** — re-arm to the start of the sequence, paused; press-and-hold to confirm **[v3]**
- **Stop** — end session, return to setup; press-and-hold to confirm **[v3]**

**Control design rules:**
- Pause/Resume is the only prominent control — large, easily tappable
- Reset and Stop are visually de-emphasised and require a **press-and-hold (~1.5s)** confirm
- One-handed operable

**Wake Lock:**
- Requested on entering the timer screen; re-acquired on return to foreground
- Released on stop or background
- Silent graceful fallback if unavailable

---

### Non-Functional Requirements

| Requirement | Detail |
|---|---|
| Mobile-first | 375px+ viewport; responsive to desktop |
| Touch targets | Minimum 44×44px |
| High contrast | Dark instrument theme, huge high-contrast numerals; readable in direct sunlight |
| Colour semantics | amber = imminent/starting, green = started, white = the very next start, dim = later; colour-blind-safe pairing |
| Performance | First load < 3s on 4G; instant after caching |
| Offline | Full functionality after first load |
| Interactions | Setup to timer in < 5 taps |
| Wake Lock | Screen stays on during active timer |
| Accessibility | Sufficient contrast; legible sizes throughout |

---

### Out of Scope — Stage 1
- User accounts / login
- Saving named races
- Custom PY overrides
- PDF export
- Audible alerts
- Multi-fleet races
- Manual start time adjustments
- Results or finish time recording

---

## 🟡 Stage 2 — Enhanced UX + Export

### Goal
Improve real-world usability and add export for clubs that want a printed start sheet.

### Features
**PDF Export** — printable A4 start sheet (classes, PY, start times, duration), client-side.
**Audible Alerts** — countdown beeps before each start (and the 5-4-1-GO warning), toggleable, Web Audio.
**Timer Improvements** — visual flash/pulse on imminent starts, configurable imminent-flash threshold (the basic 10s amber cue already ships in Stage 1).
**URL State Sharing** — encode race config (classes + duration + start sequence) in the URL query string; decode on load; does not override LocalStorage if absent.

**Acceptance criteria:**
- [ ] PDF export produces a readable, printable A4 start sheet
- [ ] Audio alerts fire at correct intervals when enabled
- [ ] Shared URL correctly restores race config on a second device

---

## 🟠 Stage 3 — Light Backend (Supabase)

### Goal
Optional persistence and club-level customisation without breaking the anonymous-first model.

### Features
**Authentication** — magic-link login via Supabase; anonymous usage always supported.
**Saved Races** — save/reload named race setups.
**Club Profiles** — default fleet, preferred duration + start sequence, synced when logged in.
**Custom PY Overrides** — club-level PY adjustments per class, applied in offset calc, shown alongside national PY.

### Data model
```
users        id, email, created_at
clubs        id, name, default_duration, owner_id
club_classes club_id, class_id, py_override
races        id, club_id, user_id, name, duration, start_sequence, class_ids[], created_at
```

---

## 🔵 Stage 4 — Advanced Features
**Multi-device Sync** — shared race session via Supabase Realtime (broadcast channel).
**Race Templates** — predefined class lists for common fleets.
**Results Integration** — record finish times per class, export corrected results.
**Admin Tools** — UI for updating the PY dataset, version history.

---

## 6. Design Direction

### Name & identity
**Trivial** — *Make pursuit trivial.* A knowing nod to Trivial Pursuit. Signals simplicity and confidence.

### Tone
Utilitarian confidence. A tool, not a toy — considered and sharp, not bureaucratic. Maritime instrument, not sailing lifestyle brand.

### UI priorities
1. **Legibility over aesthetics** — sunlight, stress, cold fingers
2. **Hierarchy over completeness** — the next start dominates everything
3. **Speed over flexibility** — sensible defaults beat endless options

---

## 7. Open Questions — Resolved **[v3]**

1. **Manual nudge of individual start times?** — Deferred to a post-Stage-1 enhancement. Not in Stage 1.
2. **Multiple fleets in one race?** — Out of scope (single fleet only).
3. **Fixed 1000 PY scratch as an alternative to auto-detect?** — Not in Stage 1; scratch is always the lowest selected PY.
4. **Identical PY numbers?** — **Resolved:** start simultaneously, grouped into a single start/GO (§2.7).

Remaining open question carried forward:
- Start-sequence audio (horn synthesis) lands in Stage 2; confirm club preferences for the
  default sequence (5-4-1 vs 3-2-1).

---

## 8. Success Criteria

### Stage 1 success
- RO sets up and runs a start sequence in under 1 minute
- No errors or confusion during a real race start sequence
- Works reliably offline
- Screen stays on throughout

### Adoption indicators
- Used regularly by 1–3 clubs within the first season
- Positive unsolicited feedback from race officers on usability under race conditions

---

## 9. Agent Session Notes

This spec is written as a brief for Claude Code agent sessions. Each stage is a separate
session. Do not begin a new stage until the previous stage's acceptance criteria are all met
and reviewed by the developer.

**General rules for all sessions:**
- TypeScript throughout — no `any` types
- All calculations must match §2.2 exactly (unit-tested)
- Mobile-first — test at 375px viewport before desktop
- Wake Lock implementation is mandatory in Stage 1, not optional
- LocalStorage keys namespaced: `trivial.favourites`, `trivial.lastRace`
- Destructive timer actions (Reset, Stop) require a press-and-hold confirmation

---

## 10. Decision Record (Stage 1 interview, 2026-05-31)

| # | Decision |
|---|---|
| 1 | Start-sequence toggle (5-4-1 / 3-2-1) is the lead-in to the first gun; its milestones show only in this phase. Tapping Start begins it immediately; no separate configurable warning. **[v3.1]** |
| 2 | Race phase = plain countdown to next gun; brief GO flash per class; RO sounds horn once |
| 3 | Clock is wall-clock anchored (Date.now() + start timestamp + accumulated pause); offsets in ms |
| 4 | Pause = postponement (shift all remaining starts + finish) |
| 5 | ~~No class-list edits while running~~ → **[v3.2]** Mid-race **add** allowed (latecomers); timed in a locked frame so existing starts never move; already-passed adds raise a START NOW alert; remove allowed only for not-yet-started classes. A dedicated in-race Fleet screen handles this. |
| 6 | Master race clock added; finish = scratch start + duration |
| 7 | Identical PY grouped into one start/GO |
| 8 | No class cap (20 was illustrative); min 1 to start |
| 9 | Stack: Next.js App Router + static export, Vercel, Serwist, Zustand+persist, Vitest, Tailwind |
| 10 | Dark instrument theme, huge high-contrast type; instrument colour semantics |
| 11 | Countdown + absolute wall-clock times per row |
| 12 | Reset re-arms to the start of the sequence, paused |
| 13 | Press-and-hold confirm for destructive controls; large +/− steppers for inputs |
| 14 | npm + ESLint + Prettier; git init + GPL-3.0; data at /data/py_data_2026.json |

> Rows 1 and 5 were revised after the original interview (2026-06-01); see the **[v3.1]** /
> **[v3.2]** tags and §§2.3, 2.8.

---

## 11. Implementation Status (as of 2026-06-01)

**Stage 1 is feature-complete and green** (builds, type-checks, lints, 38 unit tests pass),
**but not yet signed off** — several acceptance criteria need a real-browser/device
verification pass before Stage 1 is "done" per §9.

### Repository

- Git initialised, branch `main`, latest commit `424d6be`. Licence GPL-3.0 (`LICENSE`).
- The app lives at the repo root (Next.js project). PY data at `/data/py_data_2026.json`.

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # 38 unit tests (calc + timer engine, formatters, dataset)
npm run build   # static export to ./out (Serwist service worker bundled)
npm run lint
```

### File map (key files)

```
src/lib/types.ts        Domain types (BoatClass, Schedule, ScheduleFrame, …)
src/lib/data.ts         Loads + flattens the bundled PY JSON; search / lookup
src/lib/schedule.ts     PURE engine: computeOffsetMs, buildSchedule(+frame), frameFromSchedule
src/lib/timer.ts        PURE timer state machine: SEQUENCES, armClock/pause/resume, deriveTimer
src/lib/format.ts       mm:ss / countdown / clock / ordinal formatters
src/lib/*.test.ts       Vitest suites for the four lib modules
src/store/useRaceStore.ts  Zustand: favourites (trivial.favourites) + race config/clock/frame (trivial.lastRace)
src/hooks/useNow.ts        rAF clock tick (render cadence only; time is wall-clock anchored)
src/hooks/useWakeLock.ts   Screen Wake Lock with foreground re-acquire + silent fallback
src/components/SetupScreen.tsx   Pre-race setup (steppers, 5-4-1/3-2-1 toggle, schedule preview, browser)
src/components/RaceShell.tsx     In-race navigation: timer ⇄ fleet
src/components/TimerScreen.tsx   Live timer (countdown, GO flash, master clock, controls, + Boat)
src/components/FleetScreen.tsx   In-race add/remove; START NOW alert for already-passed adds
src/components/ClassBrowser.tsx  Reusable class list (search, favourites, categories, locked state)
src/components/ScheduleList.tsx  Start schedule rows (+mm:ss from first gun, clock time, status)
src/components/{Stepper,HoldButton,StartNowAlert,ServiceWorker}.tsx
src/app/{layout,page,globals.css,sw.ts}   App shell, screen switch, styles, Serwist worker
```

### Architecture notes

- **Pure engine, tested.** All race maths lives in `src/lib` as pure functions with unit
  tests; React only renders derived views. The offset formula and the timer state machine are
  the two highest-risk surfaces and are both covered.
- **Wall-clock anchored.** The clock derives everything from `Date.now()` against stored
  anchors (`startedAtEpoch`, `warningMs`, `accumulatedPauseMs`, `pausedAtEpoch`); it never
  sums interval ticks, so it survives backgrounding/throttling. Pause folds elapsed paused
  time into `accumulatedPauseMs` (postponement).
- **Locked frame.** At Start, the `{scratchPy, maxOffsetMs, durationMs}` frame is snapshotted;
  mid-race additions are timed against it so existing starts never move (§2.8).
- **Persistence.** Only config persists (`trivial.favourites`, `trivial.lastRace` =
  selectedIds + durationMinutes + startSequence). The live clock/frame are **ephemeral** —
  reloading the page mid-race returns to setup (no resume). Acceptable for Stage 1.
- **PWA.** Serwist generates `public/sw.js` at build and precaches the shell; PY data is
  bundled into the JS, so offline needs no runtime fetch. SW registers in production only.

### Acceptance criteria — verification state

**Verified by unit tests + build:** offset formula (24:56 worked example), scratch detection,
earliest-first ordering, finish = scratch+duration, identical-PY grouping (incl. 3-way /
cross-category), both start sequences' milestones, pause/postponement maths, locked-frame
mid-race adds (existing starts unchanged; faster entrant last; slower entrant already-passed).

**Built and runs in dev, but NOT yet verified in a real browser/device (the pending pass):**
- Setup → timer in < 5 taps (measure)
- Full live run-through: sequence → first gun → per-class GO flashes → finish
- Pause/Resume/Reset/Stop and press-and-hold feel
- Mid-race add flow end-to-end (queue insert + START NOW alert timing)
- Favourites + last-race **persistence round-trip** across reload
- **Wake Lock** actually holding the screen on (needs a device)
- **Full offline after first load** (load, kill network, confirm)

### Known follow-ups / polish ideas (not blocking)

- Proper maskable PWA icons (current icons are rendered from `public/icon.svg`).
- `maximumScale:1 / userScalable:false` aids the instrument feel but is an a11y trade-off.
- Optional: persist the live clock so a mid-race reload resumes (epoch-anchored, would be easy).
