import { describe, expect, it } from "vitest";

import { applyDelta, ingestEvidence } from "./apply-delta";
import { emptyDelta, type Delta } from "./delta";
import { currentClassification, emptyInvestigation, timeline, type EvidenceItem } from "./state";
import { verifyDelta } from "./verify";

function item(id: string, observedAt: string, overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id,
    source: "alert",
    title: id,
    body: `${id} body`,
    service: null,
    observedAt,
    waveNumber: 1,
    origin: "pushed",
    ...overrides,
  };
}

function waveOne() {
  return ingestEvidence(
    emptyInvestigation("inc", "Checkout failing"),
    [item("alert-a", "2026-10-13T10:01:00Z"), item("alert-disk", "2026-10-13T10:00:00Z")],
    { waveNumber: 1, clock: "2026-10-13T10:02:00Z" },
  );
}

function delta(overrides: Partial<Delta>): Delta {
  return { ...emptyDelta("note"), ...overrides };
}

const openDeploy: Delta["openHypothesis"][number] = {
  id: "h-deploy",
  title: "checkout-api v2.14 deploy regression",
  kind: "cause",
  status: "open",
  confidence: "medium",
  rationale: "Deployed 20 minutes before symptoms",
  whatWouldChange: "Rollback outcome",
  supporting: ["alert-a"],
  contradicting: [],
};

describe("applyDelta", () => {
  it("records reclassification from Signal to Noise with history", () => {
    const first = applyDelta(
      waveOne(),
      delta({
        classifyEvidence: [{ evidenceId: "alert-disk", classification: "signal", reason: "maybe" }],
      }),
      { retrieved: {} },
    );
    const second = applyDelta(
      { ...first, waveNumber: 3 },
      delta({
        classifyEvidence: [
          { evidenceId: "alert-disk", classification: "noise", reason: "known flapper" },
        ],
      }),
      { retrieved: {} },
    );

    expect(currentClassification(second, "alert-disk")?.classification).toBe("noise");
    expect(second.classifications["alert-disk"].map((c) => c.waveNumber)).toEqual([1, 3]);
  });

  it("keeps a confidence trajectory across waves and accumulates evidence", () => {
    const opened = applyDelta(waveOne(), delta({ openHypothesis: [openDeploy] }), {
      retrieved: {},
    });
    const later = ingestEvidence(opened, [item("chat-rollback", "2026-10-13T10:24:00Z")], {
      waveNumber: 5,
      clock: "2026-10-13T10:25:00Z",
    });
    const revised = applyDelta(
      later,
      delta({
        reviseHypothesis: [
          {
            id: "h-deploy",
            status: "refuted",
            confidence: "low",
            rationale: "Rollback did not help",
            whatWouldChange: "nothing",
            addSupporting: [],
            addContradicting: ["chat-rollback"],
          },
        ],
      }),
      { retrieved: {} },
    );

    const hypothesis = revised.hypotheses[0];
    expect(hypothesis.status).toBe("refuted");
    expect(hypothesis.history.map((h) => [h.waveNumber, h.confidence])).toEqual([
      [1, "medium"],
      [5, "low"],
    ]);
    expect(hypothesis.contradicting).toEqual(["chat-rollback"]);
  });

  it("promotes cited tool records to Evidence so citations stay resolvable", () => {
    const log = item("log-ordersdb-04", "2026-10-13T10:01:00Z", {
      source: "log",
      origin: "retrieved",
    });
    const next = applyDelta(
      waveOne(),
      delta({ openHypothesis: [{ ...openDeploy, id: "h-db", supporting: ["log-ordersdb-04"] }] }),
      { retrieved: { "log-ordersdb-04": log } },
    );

    expect(next.evidence["log-ordersdb-04"]?.origin).toBe("retrieved");
  });

  it("builds the timeline from current Signals in time order", () => {
    const next = applyDelta(
      waveOne(),
      delta({
        classifyEvidence: [
          { evidenceId: "alert-a", classification: "signal", reason: "customer facing" },
          { evidenceId: "alert-disk", classification: "noise", reason: "flapper" },
        ],
      }),
      { retrieved: {} },
    );

    expect(timeline(next).map((t) => t.evidenceId)).toEqual(["alert-a"]);
  });
});

describe("verifyDelta", () => {
  it("strips citations that were never seen and drops claims left uncited", () => {
    const { verified, issues } = verifyDelta(
      delta({
        openHypothesis: [{ ...openDeploy, supporting: ["log-made-up"] }],
        addNextAction: [
          {
            id: "a-rollback",
            action: "Roll back",
            owner: "@dan",
            priority: "now",
            rationale: "deploy",
            citations: ["alert-a", "log-made-up"],
          },
        ],
      }),
      { state: waveOne(), retrieved: {}, newEvidenceIds: [] },
    );

    expect(verified.openHypothesis).toEqual([]);
    expect(verified.addNextAction[0].citations).toEqual(["alert-a"]);
    expect(issues.map((i) => i.problem)).toContain("dropped: no valid Evidence cited");
  });

  it("rejects Evidence observed after the replay clock", () => {
    const future = item("log-future", "2026-10-13T10:30:00Z", { origin: "retrieved" });
    const { verified, issues } = verifyDelta(
      delta({
        classifyEvidence: [{ evidenceId: "log-future", classification: "signal", reason: "x" }],
      }),
      { state: waveOne(), retrieved: { "log-future": future }, newEvidenceIds: [] },
    );

    expect(verified.classifyEvidence).toEqual([]);
    expect(issues[0].problem).toBe("unknown or not-yet-visible Evidence");
  });

  it("does not let a Hypothesis be supported without supporting Evidence", () => {
    const { verified } = verifyDelta(
      delta({
        openHypothesis: [
          { ...openDeploy, status: "supported", supporting: [], contradicting: ["alert-a"] },
        ],
      }),
      { state: waveOne(), retrieved: {}, newEvidenceIds: [] },
    );

    expect(verified.openHypothesis[0].status).toBe("open");
  });

  it("flags new wave Evidence that was left unclassified", () => {
    const { issues } = verifyDelta(
      delta({
        classifyEvidence: [{ evidenceId: "alert-a", classification: "signal", reason: "x" }],
      }),
      { state: waveOne(), retrieved: {}, newEvidenceIds: ["alert-a", "alert-disk"] },
    );

    expect(issues).toEqual([
      { op: "classifyEvidence", ref: "alert-disk", problem: "new Evidence was not classified" },
    ]);
  });

  it("turns a re-opened Hypothesis into a revision instead of a duplicate", () => {
    const state = applyDelta(waveOne(), delta({ openHypothesis: [openDeploy] }), {
      retrieved: {},
    });
    const { verified } = verifyDelta(delta({ openHypothesis: [{ ...openDeploy }] }), {
      state,
      retrieved: {},
      newEvidenceIds: [],
    });

    expect(verified.openHypothesis).toEqual([]);
    expect(verified.reviseHypothesis.map((h) => h.id)).toEqual(["h-deploy"]);
  });
});
