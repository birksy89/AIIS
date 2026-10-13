import type { Investigation } from "./state";
import { currentClassification, observedLabel, rankedHypotheses, timeline } from "./state";

export type WaveLogEntry = {
  waveNumber: number;
  trigger: string;
  clock: string;
  waveNote: string;
  toolCalls: number;
  rejectedClaims: number;
};

function hhmm(iso: string | null) {
  return iso ? iso.slice(11, 16) : "--:--";
}

function refs(ids: string[]) {
  return ids.length ? ids.map((id) => `\`${id}\``).join(", ") : "none";
}

export function toMarkdown(state: Investigation, waveLog: WaveLogEntry[] = []): string {
  const out: string[] = [];
  out.push(`# Investigation: ${state.title}`, "");
  out.push(
    `_As of ${hhmm(state.clock)} UTC ${state.clock?.slice(0, 10) ?? ""}, after Wave ${state.waveNumber}._`,
    "",
  );

  out.push("## Summary", "");
  out.push(
    state.summary
      ? `${state.summary.text} (${refs(state.summary.citations)})`
      : "_No summary yet._",
    "",
  );
  if (state.summary) out.push(`**Impact:** ${state.summary.impact}`, "");

  out.push("## Stakeholder update", "");
  out.push(
    state.stakeholderUpdate
      ? `> ${state.stakeholderUpdate.text.replaceAll("\n", "\n> ")}`
      : "_None yet._",
    "",
  );

  out.push("## Hypotheses", "");
  for (const h of rankedHypotheses(state)) {
    const trajectory = h.history
      .map((r) => `W${r.waveNumber} ${r.status}/${r.confidence}`)
      .join(" → ");
    out.push(`### ${h.title}`);
    out.push(
      `- **Status:** ${h.status} · **Confidence:** ${h.confidence} · **Kind:** ${h.kind} · \`${h.id}\``,
    );
    out.push(`- **Trajectory:** ${trajectory}`);
    out.push(`- **Rationale:** ${h.rationale}`);
    out.push(`- **Supporting:** ${refs(h.supporting)}`);
    out.push(`- **Contradicting:** ${refs(h.contradicting)}`);
    out.push(`- **What would change this:** ${h.whatWouldChange}`, "");
  }

  out.push("## Next actions", "");
  const order = { now: 0, next: 1, later: 2 };
  for (const a of state.nextActions.toSorted((x, y) => order[x.priority] - order[y.priority])) {
    out.push(
      `- **[${a.priority}]** ${a.action} — _${a.owner}_. ${a.rationale} (${refs(a.citations)})`,
    );
  }
  out.push("");

  out.push("## Open questions", "");
  for (const q of state.openQuestions) {
    out.push(
      q.status === "open"
        ? `- ${q.question}`
        : `- ~~${q.question}~~ Resolved in Wave ${q.resolvedInWave}: ${q.answer} (${refs(q.citations)})`,
    );
  }
  out.push("");

  out.push(
    "## Timeline of Signals",
    "",
    "| Time | Evidence | Why it matters |",
    "| --- | --- | --- |",
  );
  for (const t of timeline(state)) {
    out.push(`| ${hhmm(t.at)} | \`${t.evidenceId}\` ${t.title} | ${t.reason} |`);
  }
  out.push("");

  out.push("## Noise", "");
  for (const item of Object.values(state.evidence)) {
    const current = currentClassification(state, item.id);
    if (current?.classification !== "noise") continue;
    const history = state.classifications[item.id];
    const changed =
      history.length > 1
        ? ` (reclassified from ${history.at(-2)?.classification} in Wave ${current.waveNumber})`
        : "";
    out.push(`- \`${item.id}\` ${item.title}: ${current.reason}${changed}`);
  }
  out.push("");

  if (state.flags.length) {
    out.push("## Verifier flags", "");
    for (const flag of state.flags) out.push(`- Wave ${flag.waveNumber}: ${flag.message}`);
    out.push("");
  }

  if (waveLog.length) {
    out.push("## How the Investigation evolved", "");
    for (const entry of waveLog) {
      out.push(
        `- **Wave ${entry.waveNumber}** (${entry.trigger}, ${hhmm(entry.clock)}; ${entry.toolCalls} tool calls${entry.rejectedClaims ? `, ${entry.rejectedClaims} claims rejected` : ""}): ${entry.waveNote}`,
      );
    }
    out.push("");
  }

  out.push(
    "## Evidence cited",
    "",
    "| Id | Source | Observed | Title |",
    "| --- | --- | --- | --- |",
  );
  for (const item of Object.values(state.evidence).toSorted(
    (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt),
  )) {
    out.push(
      `| \`${item.id}\` | ${item.source} (${item.origin}) | ${observedLabel(item, state.clock)} | ${item.title.replaceAll("|", "/")} |`,
    );
  }
  out.push("");
  return out.join("\n");
}
