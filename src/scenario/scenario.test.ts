import { describe, expect, it } from "vitest";

import { scenarioCorpus, waves } from "./index";

describe("scenario dataset", () => {
  it("never pushes Evidence observed after its Wave arrives", () => {
    for (const wave of waves) {
      for (const item of wave.evidence) {
        expect(Date.parse(item.observedAt), item.id).toBeLessThanOrEqual(Date.parse(wave.at));
      }
    }
  });

  it("has Waves in time order", () => {
    const times = waves.map((wave) => Date.parse(wave.at));
    expect(times).toEqual(times.toSorted((a, b) => a - b));
  });

  it("uses unique Evidence ids across pushed and tool-backed records", () => {
    const ids = [...scenarioCorpus().keys()];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
