# Trivial

**Make pursuit trivial.** A lightweight, offline-first pursuit race start timer for UK
sailing clubs, using the RYA Portsmouth Yardstick (PY) handicap system.

A race officer can set up and run a pursuit start sequence in under a minute, on a phone,
in wind and rain — no login, no backend, works fully offline.

See [`trivial-spec.md`](./trivial-spec.md) for the full product specification and the
Stage 1 decision record (§10).

## Stack

- **Next.js** (App Router, `output: 'export'` static export) — deploy to Vercel
- **TypeScript** throughout (no `any`), **Tailwind CSS** (dark "instrument" theme)
- **Zustand** (+ `persist`) for state, **Serwist** for the offline PWA
- **Vitest** for the calc/timer engine

## How the timer works

- **Warning phase** (configurable, default 5:00) counts to the first gun with
  5:00 / 3:00 / 1:00 / GO milestone emphasis.
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
