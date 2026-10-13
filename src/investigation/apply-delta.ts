import type { Delta } from "./delta";
import type { EvidenceItem, Hypothesis, Investigation } from "./state";

export function ingestEvidence(
  state: Investigation,
  items: EvidenceItem[],
  wave: { waveNumber: number; clock: string },
): Investigation {
  const evidence = { ...state.evidence };
  for (const item of items) evidence[item.id] = item;
  return { ...state, evidence, waveNumber: wave.waveNumber, clock: wave.clock };
}

export function citedIds(delta: Delta): string[] {
  return [
    ...delta.classifyEvidence.map((c) => c.evidenceId),
    ...delta.openHypothesis.flatMap((h) => [...h.supporting, ...h.contradicting]),
    ...delta.reviseHypothesis.flatMap((h) => [...h.addSupporting, ...h.addContradicting]),
    ...delta.addOpenQuestion.flatMap((q) => q.citations),
    ...delta.resolveOpenQuestion.flatMap((q) => q.citations),
    ...delta.addNextAction.flatMap((a) => a.citations),
    ...(delta.setSummary?.citations ?? []),
    ...(delta.setStakeholderUpdate?.citations ?? []),
  ];
}

/**
 * Applies an already-verified delta. Retrieved records that the delta cites are
 * promoted to Evidence on the Investigation, so every citation stays resolvable.
 */
export function applyDelta(
  state: Investigation,
  delta: Delta,
  ctx: { retrieved: Record<string, EvidenceItem> },
): Investigation {
  const wave = state.waveNumber;
  const evidence = { ...state.evidence };
  for (const id of citedIds(delta)) {
    if (!evidence[id] && ctx.retrieved[id])
      evidence[id] = { ...ctx.retrieved[id], waveNumber: wave };
  }

  const classifications = { ...state.classifications };
  for (const entry of delta.classifyEvidence) {
    const history = classifications[entry.evidenceId] ?? [];
    if (history.at(-1)?.classification === entry.classification) continue;
    classifications[entry.evidenceId] = [
      ...history,
      { classification: entry.classification, reason: entry.reason, waveNumber: wave },
    ];
  }

  const hypotheses: Hypothesis[] = state.hypotheses.map((h) => ({ ...h }));
  for (const opened of delta.openHypothesis) {
    hypotheses.push({
      id: opened.id,
      title: opened.title,
      kind: opened.kind,
      status: opened.status,
      confidence: opened.confidence,
      rationale: opened.rationale,
      whatWouldChange: opened.whatWouldChange,
      supporting: unique(opened.supporting),
      contradicting: unique(opened.contradicting),
      openedInWave: wave,
      history: [
        {
          waveNumber: wave,
          status: opened.status,
          confidence: opened.confidence,
          rationale: opened.rationale,
        },
      ],
    });
  }
  for (const revised of delta.reviseHypothesis) {
    const index = hypotheses.findIndex((h) => h.id === revised.id);
    if (index === -1) continue;
    const prior = hypotheses[index];
    hypotheses[index] = {
      ...prior,
      status: revised.status,
      confidence: revised.confidence,
      rationale: revised.rationale,
      whatWouldChange: revised.whatWouldChange,
      supporting: unique([...prior.supporting, ...revised.addSupporting]),
      contradicting: unique([...prior.contradicting, ...revised.addContradicting]),
      history: [
        ...prior.history.filter((entry) => entry.waveNumber !== wave),
        {
          waveNumber: wave,
          status: revised.status,
          confidence: revised.confidence,
          rationale: revised.rationale,
        },
      ],
    };
  }

  const openQuestions = state.openQuestions.map((q) => ({ ...q }));
  for (const added of delta.addOpenQuestion) {
    if (openQuestions.some((q) => q.id === added.id)) continue;
    openQuestions.push({
      ...added,
      status: "open",
      answer: null,
      openedInWave: wave,
      resolvedInWave: null,
    });
  }
  for (const resolved of delta.resolveOpenQuestion) {
    const question = openQuestions.find((q) => q.id === resolved.id);
    if (!question) continue;
    question.status = "resolved";
    question.answer = resolved.answer;
    question.citations = unique([...question.citations, ...resolved.citations]);
    question.resolvedInWave = wave;
  }

  const nextActions = [...state.nextActions];
  for (const action of delta.addNextAction) {
    const entry = { ...action, addedInWave: wave };
    const index = nextActions.findIndex((a) => a.id === action.id);
    if (index === -1) nextActions.push(entry);
    else nextActions[index] = entry;
  }

  return {
    ...state,
    evidence,
    classifications,
    hypotheses,
    openQuestions,
    nextActions,
    summary: delta.setSummary ?? state.summary,
    stakeholderUpdate: delta.setStakeholderUpdate ?? state.stakeholderUpdate,
  };
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}
