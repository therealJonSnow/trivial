# Trivial — Product Specification
### *Make pursuit trivial.*

**Version:** 3.0
**Last updated:** 2026-05-31
**Author:** Solo developer / Claude Code agent sessions

> **v3.0 changelog** — This revision folds in the decisions from the Stage 1 design
> interview. Material changes from v2.0 are flagged inline with **[v3]**. The biggest
> shifts: a configurable warning sequence before the first gun, a rolling master clock
> with a defined finish, postponement-style pause, no class-list edits while running,
> grouped identical-PY starts, and removal of the 20-class cap. See §10 for the full
> decision record.

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

**Warning phase** — begins the instant the RO taps **Start Race**.
- A countdown runs to the **first gun** (the earliest / slowest class).
- Length is **configurable, default 5:00**.
- This phase — and only this phase — shows the standard sailing **5:00 / 3:00 / 1:00 / GO**
  milestone emphasis.

**Race phase** — begins at the first gun (master-time `T = 0`).
- The primary display is a **plain visual countdown to the next class's start**.
- At each class start it flashes **GO** briefly (so the RO sounds the horn **once** per
  class), then retargets the next class. If the next gun is nearer than the flash hold,
  it retargets immediately — a GO flash must never hide an imminent next start.
- There is **no** 5-3-1 milestone treatment after the first gun.

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
- Before Start, the schedule shows relative offsets.

### 2.7 Identical PY **[v3]**

Classes that share an identical PY have an identical offset and start simultaneously. They
are **collapsed into a single start entry / single GO**, listing all class names on one row.
(The 2026 dataset contains 9 such groups, including one three-way tie and ties that cross
categories, so this is a real, tested case — not an edge case.)

### 2.8 Key Assumptions

- One fleet per race (multi-fleet is out of scope)
- Class-based starts only (not individual boat handicaps)
- Fixed race duration set before the race
- **No class-list edits while a sequence is running** **[v3]** — the list is frozen at Start;
  to change it the RO must Stop. (This intentionally overrides v2.0's "editable at any point.")
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
- [ ] Warning phase counts to the first gun with 5:00/3:00/1:00/GO emphasis (configurable length)
- [ ] Race phase shows the next-start countdown + a small master race clock without manual scrolling
- [ ] Identical-PY classes are grouped into a single start
- [ ] Pause (postponement), Resume, Reset (re-arm to warning start, paused), and Stop all function
- [ ] Destructive controls (Reset, Stop) require a press-and-hold confirmation
- [ ] App works fully offline after first load
- [ ] Screen does not sleep during an active timer session (Wake Lock)
- [ ] Favourites persist across sessions via LocalStorage
- [ ] Last race config (duration + warning length + selected classes) is restored on next visit

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
3. RO confirms/adjusts race **duration** and **warning length** (pre-filled from last session)
4. RO taps **Start Race** → timer screen

**Class selection:**
- Primary view: favourites list (tick/untick)
- Secondary view: full PY list, searchable, grouped by category (dinghy / multihull / experimental)
- Selected classes shown with PY number
- Scratch boat (lowest PY) auto-detected and labelled
- Start offsets shown in real time as classes are added/removed

**Inputs** **[v3]** — large +/− steppers, no keyboard:
- **Race duration** — minutes, default 60 (first use), pre-filled from LocalStorage
- **Warning length** — default 5:00, configurable

**Editability:** the class list is editable freely **before** Start. Once running it is
**frozen** until Stop. **[v3]**

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
- **GO** flash/highlight when a class is starting
- Warning phase only: 5:00 / 3:00 / 1:00 / GO milestone emphasis

**Secondary displays:**
- Small persistent **master race clock** (elapsed + time-to-finish) **[v3]**
- Scrollable upcoming queue (next 2–4), auto-scrolls as starts pass — no manual scrolling

**Controls:**
- **Pause / Resume** — postponement model (§2.5); the only prominent control, large
- **Reset** — re-arm to warning start, paused; press-and-hold to confirm **[v3]**
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
- Mid-race class-list edits
- Results or finish time recording

---

## 🟡 Stage 2 — Enhanced UX + Export

### Goal
Improve real-world usability and add export for clubs that want a printed start sheet.

### Features
**PDF Export** — printable A4 start sheet (classes, PY, start times, duration), client-side.
**Audible Alerts** — countdown beeps before each start (and the 5-3-1-GO warning), toggleable, Web Audio.
**Timer Improvements** — visual flash/pulse on imminent starts, configurable warning threshold.
**URL State Sharing** — encode race config (classes + duration + warning) in the URL query string; decode on load; does not override LocalStorage if absent.

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
**Club Profiles** — default fleet, preferred duration/warning, synced when logged in.
**Custom PY Overrides** — club-level PY adjustments per class, applied in offset calc, shown alongside national PY.

### Data model
```
users        id, email, created_at
clubs        id, name, default_duration, owner_id
club_classes club_id, class_id, py_override
races        id, club_id, user_id, name, duration, warning, class_ids[], created_at
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
- Warning-sequence audio (horn synthesis) lands in Stage 2; confirm club preferences for warning length defaults.

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
| 1 | Warning sequence before first gun; configurable, default 5:00; 5/3/1/GO emphasis only in this phase |
| 2 | Race phase = plain countdown to next gun; brief GO flash per class; RO sounds horn once |
| 3 | Clock is wall-clock anchored (Date.now() + start timestamp + accumulated pause); offsets in ms |
| 4 | Pause = postponement (shift all remaining starts + finish) |
| 5 | No class-list edits while running (overrides v2.0) |
| 6 | Master race clock added; finish = scratch start + duration |
| 7 | Identical PY grouped into one start/GO |
| 8 | No class cap (20 was illustrative); min 1 to start |
| 9 | Stack: Next.js App Router + static export, Vercel, Serwist, Zustand+persist, Vitest, Tailwind |
| 10 | Dark instrument theme, huge high-contrast type; instrument colour semantics |
| 11 | Countdown + absolute wall-clock times per row |
| 12 | Reset re-arms to warning start, paused |
| 13 | Press-and-hold confirm for destructive controls; large +/− steppers for inputs |
| 14 | npm + ESLint + Prettier; git init + GPL-3.0; data at /data/py_data_2026.json |
