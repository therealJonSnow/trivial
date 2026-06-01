import rawData from "../../data/py_data_2026.json";
import type { BoatClass, Category, CustomBoatClass, PyData, PyMeta } from "./types";

// The JSON is bundled at build time (offline-safe, no runtime fetch).
const data = rawData as PyData;

export const pyMeta: PyMeta = data.meta;

export const categories: Category[] = ["dinghy", "multihull", "experimental"];

/** All classes, flattened and tagged with their category. */
export const allClasses: BoatClass[] = categories.flatMap((category) =>
  data.classes[category].map((c) => ({ ...c, category })),
);

const byId = new Map<number, BoatClass>(allClasses.map((c) => [c.id, c]));

/** Look up classes by id, preserving the requested order, skipping unknown ids. */
export function classesByIds(ids: number[]): BoatClass[] {
  return ids.map((id) => byId.get(id)).filter((c): c is BoatClass => c !== undefined);
}

/** Adapt a user-defined custom class to the full BoatClass shape expected by the rest of the app. */
export function customToBoatClass(c: CustomBoatClass): BoatClass {
  return {
    id: c.id,
    name: c.name,
    py: c.py,
    crew: 1,
    rig: "U",
    spinnaker: false,
    change: 0,
    notes: "",
    category: "dinghy",
  };
}

/**
 * Look up classes by id from both the RYA list and user-defined custom classes,
 * preserving requested order and silently dropping any unresolvable ids.
 */
export function resolveClasses(ids: number[], customClasses: CustomBoatClass[]): BoatClass[] {
  const customById = new Map(customClasses.map((c) => [c.id, customToBoatClass(c)]));
  return ids
    .map((id) => byId.get(id) ?? customById.get(id))
    .filter((c): c is BoatClass => c !== undefined);
}

/** Case-insensitive name search across all classes. */
export function searchClasses(query: string): BoatClass[] {
  const q = query.trim().toLowerCase();
  if (q === "") return allClasses;
  return allClasses.filter((c) => c.name.toLowerCase().includes(q));
}
