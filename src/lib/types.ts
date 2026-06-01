/** Domain types for Trivial. */

export type Rig = "S" | "U";

export type Category = "dinghy" | "multihull" | "experimental";

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
  /** Offset behind the scratch boat, in ms (0 for the scratch start). */
  offsetMs: number;
  /** Time after the first gun at which this start fires, in ms. */
  startFromFirstGunMs: number;
  /** True if this is the scratch (lowest PY) start. */
  isScratch: boolean;
}

export interface Schedule {
  starts: ScheduledStart[];
  /** Lowest selected PY. */
  scratchPy: number;
  /** Largest offset = the first gun's lead over the scratch, in ms. */
  maxOffsetMs: number;
  /** Configured race duration, in ms. */
  durationMs: number;
  /** Finish relative to the first gun: maxOffsetMs + durationMs. */
  finishFromFirstGunMs: number;
}

/**
 * The locked timing reference, snapshotted at race start. Classes added mid-race
 * are timed against this frame so existing starts never reshuffle (the scratch
 * boat and first gun stay fixed for the life of the race).
 */
export interface ScheduleFrame {
  scratchPy: number;
  maxOffsetMs: number;
  durationMs: number;
}
