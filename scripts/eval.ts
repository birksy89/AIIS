import { writeFile } from "node:fs/promises";

import { toMarkdown } from "@/investigation/export";
import { rankedHypotheses, type Hypothesis, type Investigation } from "@/investigation/state";
import { waves } from "@/scenario";
import { deliverNextScriptedWave, reset } from "@/server/investigation-service";
import { listRevisions, loadState } from "@/server/investigation-store";
import { waveLog } from "@/server/wave-log";

const waveLimit = Number(process.argv[2] ?? waves.length);

await reset();
for (let i = 0; i < waveLimit; i++) {
  const started = Date.now();
  const result = await deliverNextScriptedWave();
  const state = await loadState();
  console.log(
    `\nWave ${result?.waveNumber} done in ${Math.round((Date.now() - started) / 1000)}s, ${result?.issues ?? 0} verifier issues`,
  );
  for (const h of rankedHypotheses(state)) {
    console.log(`  ${h.status.padEnd(9)} ${h.confidence.padEnd(6)} ${h.id}: ${h.title}`);
  }
}

const state = await loadState();
const markdown = toMarkdown(state, waveLog(await listRevisions()));

if (waveLimit < waves.length) {
  console.log(`\nPartial run (${waveLimit} waves); skipping assertions.`);
  process.exit(0);
}

await writeFile("docs/sample-output.md", markdown);
console.log("\nWrote docs/sample-output.md");

const checks = assertOutcome(state);
for (const check of checks) console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}`);
process.exit(checks.every((c) => c.ok) ? 0 : 1);

function cites(h: Hypothesis | undefined, pattern: RegExp) {
  return Boolean(h?.supporting.some((id) => pattern.test(id)));
}

function assertOutcome(final: Investigation) {
  const ranked = rankedHypotheses(final);
  const top = ranked[0] as Hypothesis | undefined;
  const deployHypothesis = final.hypotheses.find(
    (h) => /deploy|2\.14|regression|driver/i.test(h.title) && /checkout/i.test(h.title),
  );

  return [
    { name: "top Hypothesis is supported", ok: top?.status === "supported" },
    {
      name: "top Hypothesis is about reporting-worker exhausting orders-db connections",
      ok: Boolean(
        top &&
        /reporting/i.test(top.title) &&
        /(connection|pool|orders-db)/i.test(`${top.title} ${top.rationale}`),
      ),
    },
    {
      name: "top Hypothesis cites reporting-worker or orders-db pool Evidence",
      ok: cites(top, /reporting|ordersdb|orders-db|data-platform/),
    },
    {
      name: "checkout deploy Hypothesis ends refuted or low confidence",
      ok:
        !deployHypothesis ||
        deployHypothesis.status === "refuted" ||
        deployHypothesis.confidence === "low",
    },
    {
      name: "flapping disk alert is classified as Noise",
      ok: final.classifications["alert-logging-disk"]?.at(-1)?.classification === "noise",
    },
    {
      name: "a next action targets the reporting-worker",
      ok: final.nextActions.some((a) => /reporting/i.test(a.action)),
    },
  ];
}
