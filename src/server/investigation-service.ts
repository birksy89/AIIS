import type { EvidenceItem } from "@/investigation/state";
import { mastra } from "@/mastra";
import { waves } from "@/scenario";

import { publish } from "./events";
import { loadState, resetInvestigation, scriptedWavesDelivered } from "./investigation-store";

export type InFlightWave = { trigger: string; clock: string; items: EvidenceItem[] };

const globalForQueue = globalThis as unknown as {
  waveQueue?: Promise<unknown>;
  busy?: boolean;
  inFlight?: InFlightWave | null;
};

/** Waves are applied strictly one at a time: each one builds on the previous revision. */
function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const previous = globalForQueue.waveQueue ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      globalForQueue.busy = true;
      publish({ type: "busy", busy: true });
      try {
        return await work();
      } finally {
        globalForQueue.busy = false;
        publish({ type: "busy", busy: false });
      }
    });
  globalForQueue.waveQueue = next;
  return next;
}

export function isBusy() {
  return Boolean(globalForQueue.busy);
}

/** The Wave being investigated right now, so the UI can show its Evidence before the revision lands. */
export function inFlightWave(): InFlightWave | null {
  return globalForQueue.inFlight ?? null;
}

async function runWave(trigger: string, clock: string, items: EvidenceItem[]) {
  globalForQueue.inFlight = { trigger, clock, items };
  publish({ type: "wave-started", trigger });
  try {
    const run = await mastra.getWorkflow("processWave").createRun();
    const result = await run.start({ inputData: { trigger, clock, items } });
    if (result.status !== "success") {
      const reason = result.status === "failed" ? result.error?.message : result.status;
      throw new Error(`Wave workflow did not complete: ${reason}`);
    }
    publish({ type: "revision", waveNumber: result.result.waveNumber });
    return result.result;
  } finally {
    globalForQueue.inFlight = null;
  }
}

export async function scriptedProgress() {
  const delivered = await scriptedWavesDelivered();
  return { delivered, total: waves.length };
}

export function deliverNextScriptedWave() {
  return enqueue(async () => {
    const delivered = await scriptedWavesDelivered();
    const wave = waves[delivered];
    if (!wave) return null;
    const items: EvidenceItem[] = wave.evidence.map((record) => ({
      ...record,
      waveNumber: 0,
      origin: "pushed",
    }));
    return runWave(`scripted:${wave.number}`, wave.at, items);
  });
}

export function addAdHocEvidence(input: {
  text: string;
  title: string | null;
  origin: "pasted" | "responder";
}) {
  return enqueue(async () => {
    const state = await loadState();
    const clock = state.clock ?? waves[0].at;
    const count = Object.values(state.evidence).filter((e) => e.origin === input.origin).length;
    const id = `${input.origin === "pasted" ? "pasted" : "note"}-${count + 1}`;
    const item: EvidenceItem = {
      id,
      source: input.origin,
      title:
        input.title ??
        (input.origin === "pasted"
          ? "Pasted evidence"
          : `Responder Note: ${firstLine(input.text)}`),
      body: input.text,
      service: null,
      observedAt: clock,
      waveNumber: 0,
      origin: input.origin,
    };
    const result = await runWave(input.origin, clock, [item]);
    return { ...result, evidenceId: id };
  });
}

export function reset() {
  return enqueue(async () => {
    await resetInvestigation();
    publish({ type: "revision", waveNumber: 0 });
  });
}

function firstLine(text: string) {
  const line = text.trim().split("\n")[0];
  return line.length > 60 ? `${line.slice(0, 57)}…` : line;
}
