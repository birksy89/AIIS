import { isVisible } from "@/scenario/time";

import type { Delta } from "./delta";
import type { EvidenceItem, Investigation } from "./state";

export type VerifyContext = {
  state: Investigation;
  retrieved: Record<string, EvidenceItem>;
  newEvidenceIds: string[];
};

export type Issue = { op: string; ref: string; problem: string };

export type VerifyResult = { verified: Delta; issues: Issue[] };

/**
 * A claim may only cite Evidence that is already on the Investigation or was returned
 * by a tool during this run, and that was observable at the current replay clock.
 */
export function verifyDelta(delta: Delta, ctx: VerifyContext): VerifyResult {
  const issues: Issue[] = [];
  const { state } = ctx;

  const citeable = (id: string) => {
    const item = state.evidence[id] ?? ctx.retrieved[id];
    return Boolean(item && isVisible(item.observedAt, state.clock));
  };

  const keepCitations = (op: string, ref: string, ids: string[]) =>
    ids.filter((id) => {
      if (citeable(id)) return true;
      issues.push({ op, ref, problem: `cites ${id}, which was not seen in this investigation` });
      return false;
    });

  const classifyEvidence = delta.classifyEvidence.filter((entry) => {
    if (citeable(entry.evidenceId)) return true;
    issues.push({
      op: "classifyEvidence",
      ref: entry.evidenceId,
      problem: "unknown or not-yet-visible Evidence",
    });
    return false;
  });

  const existingHypotheses = new Set(state.hypotheses.map((h) => h.id));
  const openHypothesis: Delta["openHypothesis"] = [];
  const reviseHypothesis: Delta["reviseHypothesis"] = [];

  for (const opened of delta.openHypothesis) {
    const supporting = keepCitations("openHypothesis", opened.id, opened.supporting);
    const contradicting = keepCitations("openHypothesis", opened.id, opened.contradicting);
    if (existingHypotheses.has(opened.id)) {
      reviseHypothesis.push({
        id: opened.id,
        status: opened.status,
        confidence: opened.confidence,
        rationale: opened.rationale,
        whatWouldChange: opened.whatWouldChange,
        addSupporting: supporting,
        addContradicting: contradicting,
      });
      continue;
    }
    if (supporting.length + contradicting.length === 0) {
      issues.push({
        op: "openHypothesis",
        ref: opened.id,
        problem: "dropped: no valid Evidence cited",
      });
      continue;
    }
    const checkedStatus = checkStatus(opened.id, opened.status, supporting, contradicting, issues);
    openHypothesis.push({ ...opened, status: checkedStatus, supporting, contradicting });
  }

  const knownHypotheses = new Set([...existingHypotheses, ...openHypothesis.map((h) => h.id)]);
  for (const revised of delta.reviseHypothesis) {
    if (!knownHypotheses.has(revised.id)) {
      issues.push({ op: "reviseHypothesis", ref: revised.id, problem: "no such Hypothesis" });
      continue;
    }
    const addSupporting = keepCitations("reviseHypothesis", revised.id, revised.addSupporting);
    const addContradicting = keepCitations(
      "reviseHypothesis",
      revised.id,
      revised.addContradicting,
    );
    const prior = state.hypotheses.find((h) => h.id === revised.id);
    const allSupporting = [...(prior?.supporting ?? []), ...addSupporting];
    const allContradicting = [...(prior?.contradicting ?? []), ...addContradicting];
    const checkedStatus = checkStatus(
      revised.id,
      revised.status,
      allSupporting,
      allContradicting,
      issues,
    );
    reviseHypothesis.push({ ...revised, status: checkedStatus, addSupporting, addContradicting });
  }

  const addOpenQuestion = delta.addOpenQuestion.map((question) => ({
    ...question,
    citations: keepCitations("addOpenQuestion", question.id, question.citations),
  }));

  const openQuestionIds = new Set([
    ...state.openQuestions.filter((q) => q.status === "open").map((q) => q.id),
    ...addOpenQuestion.map((q) => q.id),
  ]);
  const resolveOpenQuestion = delta.resolveOpenQuestion.flatMap((resolved) => {
    if (!openQuestionIds.has(resolved.id)) {
      issues.push({
        op: "resolveOpenQuestion",
        ref: resolved.id,
        problem: "no such open question",
      });
      return [];
    }
    const kept = keepCitations("resolveOpenQuestion", resolved.id, resolved.citations);
    if (kept.length === 0) {
      issues.push({
        op: "resolveOpenQuestion",
        ref: resolved.id,
        problem: "dropped: an answer must cite Evidence",
      });
      return [];
    }
    return [{ ...resolved, citations: kept }];
  });

  const addNextAction = delta.addNextAction.flatMap((action) => {
    const kept = keepCitations("addNextAction", action.id, action.citations);
    if (kept.length === 0) {
      issues.push({
        op: "addNextAction",
        ref: action.id,
        problem: "dropped: an action must cite the Evidence that motivates it",
      });
      return [];
    }
    return [{ ...action, citations: kept }];
  });

  const setSummary = keepCitedBlock("setSummary", delta.setSummary, keepCitations, issues);
  const setStakeholderUpdate = keepCitedBlock(
    "setStakeholderUpdate",
    delta.setStakeholderUpdate,
    keepCitations,
    issues,
  );

  const classifiedNow = new Set(classifyEvidence.map((c) => c.evidenceId));
  for (const id of ctx.newEvidenceIds) {
    if (!classifiedNow.has(id) && !state.classifications[id]) {
      issues.push({ op: "classifyEvidence", ref: id, problem: "new Evidence was not classified" });
    }
  }

  return {
    verified: {
      waveNote: delta.waveNote,
      classifyEvidence,
      openHypothesis,
      reviseHypothesis,
      addOpenQuestion,
      resolveOpenQuestion,
      addNextAction,
      setSummary,
      setStakeholderUpdate,
    },
    issues,
  };
}

function checkStatus(
  id: string,
  status: "open" | "supported" | "refuted",
  supporting: string[],
  contradicting: string[],
  issues: Issue[],
) {
  if (status === "supported" && supporting.length === 0) {
    issues.push({
      op: "hypothesisStatus",
      ref: id,
      problem: "marked supported without supporting Evidence; kept as open",
    });
    return "open" as const;
  }
  if (status === "refuted" && contradicting.length === 0) {
    issues.push({
      op: "hypothesisStatus",
      ref: id,
      problem: "marked refuted without contradicting Evidence; kept as open",
    });
    return "open" as const;
  }
  return status;
}

function keepCitedBlock<T extends { citations: string[] }>(
  op: string,
  block: T | null,
  keepCitations: (op: string, ref: string, ids: string[]) => string[],
  issues: Issue[],
): T | null {
  if (!block) return null;
  const kept = keepCitations(op, op, block.citations);
  if (kept.length === 0) {
    issues.push({ op, ref: op, problem: "dropped: must cite at least one Evidence item" });
    return null;
  }
  return { ...block, citations: kept };
}
