import rawData from "../../data/py_data_2026.json";
import type { BoatClass, Category, PyData, PyMeta } from "./types";

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

/** Case-insensitive name search across all classes. */
export function searchClasses(query: string): BoatClass[] {
  const q = query.trim().toLowerCase();
  if (q === "") return allClasses;
  return allClasses.filter((c) => c.name.toLowerCase().includes(q));
}
