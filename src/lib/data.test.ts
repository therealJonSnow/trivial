import { describe, it, expect } from "vitest";
import { allClasses, classesByIds, searchClasses, pyMeta } from "./data";

describe("PY dataset", () => {
  it("loads the 2026 v4 dataset", () => {
    expect(pyMeta.version).toBe("4");
    expect(pyMeta.lastUpdated).toBe("2026-04-22");
  });

  it("flattens to 107 classes tagged with category", () => {
    expect(allClasses).toHaveLength(107);
    expect(allClasses.every((c) => c.category !== undefined)).toBe(true);
  });

  it("contains the RS800 scratch reference at PY 797", () => {
    const rs800 = allClasses.find((c) => c.name === "RS800");
    expect(rs800?.py).toBe(797);
  });

  it("looks up classes by id in order, skipping unknown ids", () => {
    const ids = allClasses.slice(0, 3).map((c) => c.id);
    expect(classesByIds([...ids, 999999]).map((c) => c.id)).toEqual(ids);
  });

  it("searches by name case-insensitively", () => {
    expect(searchClasses("mirror").length).toBeGreaterThan(0);
    expect(searchClasses("MIRROR").length).toBe(searchClasses("mirror").length);
    expect(searchClasses("").length).toBe(allClasses.length);
  });
});
