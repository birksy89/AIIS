import type { Agent } from "@mastra/core/agent";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { applyDelta, ingestEvidence } from "@/investigation/apply-delta";
import { deltaSchema, emptyDelta, type Delta } from "@/investigation/delta";
import type { EvidenceItem, Investigation } from "@/investigation/state";
import { verifyDelta, type Issue } from "@/investigation/verify";
import type { TraceEvent } from "@/server/events";
import { loadState, persistRevision } from "@/server/investigation-store";

import { repairPrompt, wavePrompt } from "../prompts";
import { InvestigationRun } from "../run-context";
import { SUBMIT_UPDATE_TOOL } from "../tools/submit-update";

const MAX_TOOL_STEPS = 10;

const json = <T>() => z.any() as unknown as z.ZodType<T>;

const waveInput = z.object({
  trigger: z.string(),
  clock: z.string(),
  items: json<EvidenceItem[]>(),
});

const carried = z.object({
  trigger: z.string(),
  state: json<Investigation>(),
  newIds: z.array(z.string()),
  retrieved: json<Record<string, EvidenceItem>>(),
  trace: json<TraceEvent[]>(),
});

const ingest = createStep({
  id: "ingest",
  description: "Normalise the Wave and attach its Evidence to the Investigation (code)",
  inputSchema: waveInput,
  outputSchema: carried,
  execute: async ({ inputData }) => {
    const prior = await loadState();
    const waveNumber = prior.waveNumber + 1;
    const run = new InvestigationRun(inputData.clock, waveNumber);
    const items = inputData.items
      .map((item) => ({ ...item, waveNumber }))
      .toSorted((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
    const state = ingestEvidence(prior, items, { waveNumber, clock: inputData.clock });
    run.record({
      kind: "stage",
      name: "ingest",
      detail: `Wave ${waveNumber} (${inputData.trigger}): ${items.length} new Evidence at ${inputData.clock.slice(11, 16)}`,
    });
    return {
      trigger: inputData.trigger,
      state,
      newIds: items.map((item) => item.id),
      retrieved: {},
      trace: run.trace,
    };
  },
});

async function runInvestigator(
  agent: Agent,
  run: InvestigationRun,
  prompt: string,
): Promise<Delta> {
  run.submitted = null;
  const result = await agent.generate(prompt, {
    maxSteps: MAX_TOOL_STEPS + 2,
    stopWhen: () => run.submitted !== null,
    prepareStep: ({ stepNumber }) =>
      stepNumber >= MAX_TOOL_STEPS
        ? { toolChoice: { type: "tool" as const, toolName: SUBMIT_UPDATE_TOOL } }
        : undefined,
    requestContext: run.toRequestContext(),
  });
  if (!run.submitted) {
    throw new Error(
      `No update submitted (finishReason=${result.finishReason}, steps=${result.steps?.length ?? "?"})`,
    );
  }
  return deltaSchema.parse(run.submitted);
}

const investigate = createStep({
  id: "investigate",
  description: "Investigator agent uses tools and proposes a typed delta (model)",
  inputSchema: carried,
  outputSchema: carried.extend({ delta: json<Delta>(), failed: z.boolean() }),
  execute: async ({ inputData, mastra }) => {
    const { state } = inputData;
    const run = new InvestigationRun(state.clock, state.waveNumber);
    const agent = mastra.getAgentById("investigator");
    const prompt = wavePrompt(
      state,
      inputData.newIds.map((id) => state.evidence[id]),
    );

    run.record({ kind: "stage", name: "investigate", detail: "Investigator started" });
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now();
      try {
        const delta = await runInvestigator(agent, run, prompt);
        run.record({
          kind: "stage",
          name: "investigate",
          detail: `Delta proposed: ${countOps(delta)}`,
          durationMs: Date.now() - started,
        });
        return {
          ...inputData,
          retrieved: run.retrieved,
          trace: [...inputData.trace, ...run.trace],
          delta,
          failed: false,
        };
      } catch (error) {
        run.record({
          kind: "error",
          name: "investigate",
          detail: `Attempt ${attempt} failed: ${message(error)}`,
          durationMs: Date.now() - started,
        });
      }
    }
    return {
      ...inputData,
      retrieved: run.retrieved,
      trace: [...inputData.trace, ...run.trace],
      delta: emptyDelta(
        "Investigator unavailable for this Wave; Evidence was recorded but not analysed.",
      ),
      failed: true,
    };
  },
});

const verify = createStep({
  id: "verify",
  description:
    "Check every citation exists and was visible; one repair pass, then drop and flag (code + model)",
  inputSchema: carried.extend({ delta: json<Delta>(), failed: z.boolean() }),
  outputSchema: carried.extend({ verified: json<Delta>(), issues: json<Issue[]>() }),
  execute: async ({ inputData, mastra }) => {
    const { state, newIds } = inputData;
    const run = new InvestigationRun(state.clock, state.waveNumber);
    Object.assign(run.retrieved, inputData.retrieved);

    let result = verifyDelta(inputData.delta, {
      state,
      retrieved: run.retrieved,
      newEvidenceIds: newIds,
    });
    run.record({
      kind: result.issues.length ? "issue" : "stage",
      name: "verify",
      detail: result.issues.length
        ? `${result.issues.length} issue(s): ${result.issues.map((i) => `${i.ref} ${i.problem}`).join("; ")}`
        : "All citations grounded",
    });

    if (result.issues.length && !inputData.failed) {
      const started = Date.now();
      try {
        const agent = mastra.getAgentById("investigator");
        const prompt = `${wavePrompt(
          state,
          newIds.map((id) => state.evidence[id]),
        )}\n\n${repairPrompt(inputData.delta, result.issues)}`;
        const repaired = await runInvestigator(agent, run, prompt);
        result = verifyDelta(repaired, { state, retrieved: run.retrieved, newEvidenceIds: newIds });
        run.record({
          kind: result.issues.length ? "issue" : "stage",
          name: "repair",
          detail: result.issues.length
            ? `Still ${result.issues.length} issue(s) after repair; dropping and flagging them`
            : "Repair pass grounded every claim",
          durationMs: Date.now() - started,
        });
      } catch (error) {
        run.record({ kind: "error", name: "repair", detail: `Repair failed: ${message(error)}` });
      }
    }

    return {
      ...inputData,
      retrieved: run.retrieved,
      trace: [...inputData.trace, ...run.trace],
      verified: result.verified,
      issues: result.issues,
    };
  },
});

const apply = createStep({
  id: "apply",
  description: "Apply the verified delta and store a revision (code)",
  inputSchema: carried.extend({ verified: json<Delta>(), issues: json<Issue[]>() }),
  outputSchema: z.object({ waveNumber: z.number(), issues: z.number() }),
  execute: async ({ inputData }) => {
    const { state, verified, issues, retrieved } = inputData;
    const run = new InvestigationRun(state.clock, state.waveNumber);
    const applied = applyDelta(state, verified, { retrieved });
    const next: Investigation = {
      ...applied,
      flags: [
        ...applied.flags,
        ...issues.map((issue) => ({
          waveNumber: state.waveNumber,
          message: `${issue.op} ${issue.ref}: ${issue.problem}`,
        })),
      ],
    };
    run.record({ kind: "stage", name: "apply", detail: `Revision ${state.waveNumber} stored` });
    await persistRevision({
      trigger: inputData.trigger,
      state: next,
      delta: verified,
      rejectedClaims: issues,
      trace: [...inputData.trace, ...run.trace],
    });
    return { waveNumber: state.waveNumber, issues: issues.length };
  },
});

export const processWave = createWorkflow({
  id: "process-wave",
  inputSchema: waveInput,
  outputSchema: z.object({ waveNumber: z.number(), issues: z.number() }),
})
  .then(ingest)
  .then(investigate)
  .then(verify)
  .then(apply)
  .commit();

function countOps(delta: Delta) {
  const parts = [
    [delta.classifyEvidence.length, "classifications"],
    [delta.openHypothesis.length, "new hypotheses"],
    [delta.reviseHypothesis.length, "revisions"],
    [delta.addOpenQuestion.length, "questions"],
    [delta.resolveOpenQuestion.length, "answers"],
    [delta.addNextAction.length, "actions"],
  ] as const;
  return (
    parts
      .filter(([count]) => count > 0)
      .map(([count, label]) => `${count} ${label}`)
      .join(", ") || "no changes"
  );
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
