import type { EvidenceRecord } from "@/scenario/types";

export type Confidence = "low" | "medium" | "high";
export type HypothesisStatus = "open" | "supported" | "refuted";
export type HypothesisKind = "cause" | "impact" | "contributing";
export type Classification = "signal" | "noise";
export type EvidenceOrigin = "pushed" | "retrieved" | "pasted" | "responder";

export type EvidenceItem = EvidenceRecord & {
  waveNumber: number;
  origin: EvidenceOrigin;
};

export type ClassificationEntry = {
  classification: Classification;
  reason: string;
  waveNumber: number;
};

export type HypothesisRevision = {
  waveNumber: number;
  status: HypothesisStatus;
  confidence: Confidence;
  rationale: string;
};

export type Hypothesis = {
  id: string;
  title: string;
  kind: HypothesisKind;
  status: HypothesisStatus;
  confidence: Confidence;
  rationale: string;
  whatWouldChange: string;
  supporting: string[];
  contradicting: string[];
  openedInWave: number;
  history: HypothesisRevision[];
};

export type OpenQuestion = {
  id: string;
  question: string;
  citations: string[];
  status: "open" | "resolved";
  answer: string | null;
  openedInWave: number;
  resolvedInWave: number | null;
};

export type NextAction = {
  id: string;
  action: string;
  owner: string;
  priority: "now" | "next" | "later";
  rationale: string;
  citations: string[];
  addedInWave: number;
};

export type CitedText = { text: string; citations: string[] };

export type Summary = { text: string; impact: string; citations: string[] };

export type Flag = { waveNumber: number; message: string };

export type Investigation = {
  id: string;
  title: string;
  clock: string | null;
  waveNumber: number;
  summary: Summary | null;
  evidence: Record<string, EvidenceItem>;
  classifications: Record<string, ClassificationEntry[]>;
  hypotheses: Hypothesis[];
  openQuestions: OpenQuestion[];
  nextActions: NextAction[];
  stakeholderUpdate: CitedText | null;
  flags: Flag[];
};

export type TimelineEntry = {
  at: string;
  evidenceId: string;
  title: string;
  source: EvidenceItem["source"];
  reason: string;
};

export function emptyInvestigation(id: string, title: string): Investigation {
  return {
    id,
    title,
    clock: null,
    waveNumber: 0,
    summary: null,
    evidence: {},
    classifications: {},
    hypotheses: [],
    openQuestions: [],
    nextActions: [],
    stakeholderUpdate: null,
    flags: [],
  };
}

export function currentClassification(
  state: Investigation,
  evidenceId: string,
): ClassificationEntry | null {
  const history = state.classifications[evidenceId];
  return history?.at(-1) ?? null;
}

const REFERENCE_SOURCES = new Set<EvidenceItem["source"]>(["runbook", "incident", "service"]);

/** Runbooks, prior incidents and catalogue entries: their timestamp is not an incident event. */
export function isReference(item: EvidenceItem): boolean {
  return REFERENCE_SOURCES.has(item.source);
}

export function observedLabel(item: EvidenceItem, clock: string | null): string {
  if (isReference(item)) return "reference";
  const time = item.observedAt.slice(11, 16);
  return clock && item.observedAt.slice(0, 10) !== clock.slice(0, 10)
    ? `${item.observedAt.slice(0, 10)} ${time}`
    : time;
}

export function timeline(state: Investigation): TimelineEntry[] {
  return Object.values(state.evidence)
    .flatMap((item) => {
      const current = currentClassification(state, item.id);
      if (current?.classification !== "signal") return [];
      // A metric series spans the whole window, so it has no single point on the timeline.
      if (isReference(item) || item.source === "metric") return [];
      return [
        {
          at: item.observedAt,
          evidenceId: item.id,
          title: item.title,
          source: item.source,
          reason: current.reason,
        },
      ];
    })
    .toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

const CONFIDENCE_RANK: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };
const STATUS_RANK: Record<HypothesisStatus, number> = { supported: 3, open: 2, refuted: 0 };

export function rankedHypotheses(state: Investigation): Hypothesis[] {
  return state.hypotheses.toSorted(
    (a, b) =>
      STATUS_RANK[b.status] - STATUS_RANK[a.status] ||
      CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence],
  );
}
