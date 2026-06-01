/** Domain types for Trivial. */

export type Rig = "S" | "U";

export type Category = "dinghy" | "multihull" | "experimental";

/** A user-defined boat class stored locally. Only name and PY are captured. */
export interface CustomBoatClass {
  /** Always a negative integer — prevents collisions with RYA IDs. */
  id: number;
  name: string;
  py: number;
}

/** A boat class exactly as stored in the PY dataset (no derived fields). */
export interface RawBoatClass {
  id: number;
  name: string;
  crew: number;
  rig: Rig;
  spinnaker: boolean;
  py: number;
  change: number;
  notes: string;
}

/** A boat class enriched with its category, used throughout the app. */
export interface BoatClass extends RawBoatClass {
  category: Category;
}

export interface PyMeta {
  source: string;
  version: string;
  lastUpdated: string;
  description: string;
}

export interface PyData {
  meta: PyMeta;
  classes: Record<Category, RawBoatClass[]>;
}

/**
 * One start in the computed schedule. `classes` holds more than one entry only
 * when classes share an identical PY (and therefore start simultaneously).
 */
export interface ScheduledStart {
  /** 1-based start order, earliest first. */
  order: number;
  /** All classes firing at this start (grouped on identical PY). */
  classes: BoatClass[];
  /** Shared PY of the grouped classes. */
  py: number;
  /**
   * Time after the first gun at which this start fires, in ms:
   *   startFromFirstGunMs = duration × (1 − PY_class / PY_slowest)
   * The slowest boat (first gun) is 0; the scratch (fastest) boat is the largest.
   * Negative for a class added mid-race slower than the locked fleet — its start
   * has already passed (START NOW).
   */
  startFromFirstGunMs: number;
  /** True if this is the scratch (lowest PY) start — starts last, sails least. */
  isScratch: boolean;
}

export interface Schedule {
  starts: ScheduledStart[];
  /** Lowest selected PY — the scratch boat (label; starts last). */
  scratchPy: number;
  /** Highest selected PY — the slowest boat and timing anchor (first gun, T=0). */
  slowestPy: number;
  /** Configured total race window, in ms (first gun → finish). */
  durationMs: number;
  /**
   * Finish relative to the first gun. Equals `durationMs`: the slowest boat sails
   * the full window and every boat sailing to its PY finishes together here.
   */
  finishFromFirstGunMs: number;
}

/**
 * The locked timing reference, snapshotted at race start. Classes added mid-race
 * are timed against this frame so existing starts never reshuffle (the slowest
 * boat / first gun and the race window stay fixed for the life of the race).
 */
export interface ScheduleFrame {
  /** Highest PY at race start — the locked first-gun anchor. */
  slowestPy: number;
  /** Total race window at race start, in ms. */
  durationMs: number;
}
