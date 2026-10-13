import { RequestContext } from "@mastra/core/request-context";

import type { Delta } from "@/investigation/delta";
import type { EvidenceItem } from "@/investigation/state";
import { scenarioCorpus } from "@/scenario";
import { publish, type TraceEvent } from "@/server/events";

const RUN_KEY = "investigation-run";

/** Per-run working memory shared by the tools: the replay clock and what was retrieved. */
export class InvestigationRun {
  readonly retrieved: Record<string, EvidenceItem> = {};
  readonly trace: TraceEvent[] = [];
  submitted: Delta | null = null;
  private readonly corpus = scenarioCorpus();

  constructor(
    readonly clock: string | null,
    readonly waveNumber: number,
  ) {}

  remember(ids: string[]) {
    for (const id of ids) {
      const record = this.corpus.get(id);
      if (record && !this.retrieved[id]) {
        this.retrieved[id] = { ...record, waveNumber: this.waveNumber, origin: "retrieved" };
      }
    }
  }

  submit(delta: Delta) {
    this.submitted = delta;
  }

  record(event: Omit<TraceEvent, "at" | "waveNumber">) {
    const full: TraceEvent = {
      ...event,
      at: new Date().toISOString(),
      waveNumber: this.waveNumber,
    };
    this.trace.push(full);
    publish({ type: "trace", event: full });
  }

  toRequestContext(): RequestContext {
    const context = new RequestContext();
    context.set(RUN_KEY, this);
    return context;
  }
}

export function runFrom(context: RequestContext | undefined): InvestigationRun {
  const run = context?.get(RUN_KEY);
  if (!(run instanceof InvestigationRun)) {
    throw new Error("Tool called outside an investigation run");
  }
  return run;
}
