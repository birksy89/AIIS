import type { Delta } from "@/investigation/delta";
import {
  currentClassification,
  type EvidenceItem,
  type Investigation,
} from "@/investigation/state";
import type { Issue } from "@/investigation/verify";

export function hhmm(iso: string | null): string {
  return iso ? iso.slice(11, 16) : "--:--";
}

function citations(ids: string[]) {
  return ids.length ? ids.join(", ") : "none";
}

export function renderInvestigation(state: Investigation): string {
  const lines: string[] = [];
  lines.push(`Summary: ${state.summary ? state.summary.text : "(none yet)"}`);
  if (state.summary) lines.push(`Impact: ${state.summary.impact}`);

  lines.push("", "Hypotheses:");
  if (state.hypotheses.length === 0) lines.push("- (none yet)");
  for (const h of state.hypotheses) {
    lines.push(
      `- ${h.id} [${h.kind}] status=${h.status} confidence=${h.confidence}: ${h.title}`,
      `  rationale: ${h.rationale}`,
      `  supporting: ${citations(h.supporting)} | contradicting: ${citations(h.contradicting)}`,
    );
  }

  lines.push("", "Open questions:");
  const open = state.openQuestions.filter((q) => q.status === "open");
  if (open.length === 0) lines.push("- (none)");
  for (const q of open) lines.push(`- ${q.id}: ${q.question}`);

  lines.push("", "Next actions:");
  if (state.nextActions.length === 0) lines.push("- (none)");
  for (const a of state.nextActions) {
    lines.push(`- ${a.id} [${a.priority}] ${a.action} (owner ${a.owner})`);
  }

  lines.push(
    "",
    "Evidence on the Investigation (id | source | observed | classification | title):",
  );
  const items = Object.values(state.evidence).toSorted(
    (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt),
  );
  for (const item of items) {
    const current = currentClassification(state, item.id);
    lines.push(
      `- ${item.id} | ${item.source} | ${hhmm(item.observedAt)} | ${current ? `${current.classification}: ${current.reason}` : "unclassified"} | ${item.title}`,
    );
  }
  return lines.join("\n");
}

function renderItem(item: EvidenceItem) {
  return `[${item.id}] ${item.source}${item.service ? ` · ${item.service}` : ""} · observed ${hhmm(item.observedAt)}\n${item.title}\n${item.body}`;
}

export function wavePrompt(state: Investigation, newItems: EvidenceItem[]): string {
  return `Replay clock: ${hhmm(state.clock)} UTC on ${state.clock?.slice(0, 10)}. This is Wave ${state.waveNumber} of the Investigation "${state.title}". Tools only return data up to the replay clock.

## Current Investigation (before this Wave)
${renderInvestigation(state)}

## New Evidence in this Wave
${newItems.map(renderItem).join("\n\n")}

## Your task
Investigate with tools as needed, then call submitInvestigationUpdate with the delta for this Wave. You have about 8 rounds of tool calls: call independent tools in parallel, and do not repeat queries whose results are already reflected in the Investigation. Classify every new Evidence item above.`;
}

export function repairPrompt(previous: Delta, issues: Issue[]): string {
  return `The verifier rejected parts of your delta:
${issues.map((issue) => `- ${issue.op} ${issue.ref}: ${issue.problem}`).join("\n")}

Your previous delta:
${JSON.stringify(previous, null, 2)}

Call submitInvestigationUpdate again with the complete corrected delta. Only cite IDs that appear in the prompt or in tool results; call tools again if you need to find the right ID. Drop claims you cannot ground.`;
}
