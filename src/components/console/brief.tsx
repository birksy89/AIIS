"use client";

import { AlertTriangle, Check, CircleHelp, Copy, ListChecks, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  rankedHypotheses,
  timeline,
  type Hypothesis,
  type Investigation,
  type NextAction,
} from "@/investigation/state";
import { cn } from "@/lib/utils";
import type { RevisionSummary } from "@/server/investigation-store";

import { CitationList } from "./citations";
import { CONFIDENCE_LEVEL, CONFIDENCE_STYLE, hhmm, STATUS_STYLE } from "./format";

export function Brief({
  state,
  revisions,
}: {
  state: Investigation;
  revisions: RevisionSummary[];
}) {
  const latest = revisions.at(-1);

  if (state.waveNumber === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <Sparkles className="size-8 text-muted-foreground" />
        <h2 className="text-lg font-semibold">No Investigation yet</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Press <span className="font-medium text-foreground">Next wave</span> to replay the
          incident. Each Wave delivers new Evidence; the investigator queries logs, metrics,
          deploys, the service catalogue and past incidents, then updates this brief.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {latest?.waveNote && (
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sm">
            <p className="mb-1 text-xs font-medium text-sky-300">
              What changed in Wave {latest.waveNumber} (
              {latest.trigger.replace("scripted:", "scripted ")}, {hhmm(latest.clock)})
            </p>
            <p className="leading-relaxed">{latest.waveNote}</p>
          </div>
        )}

        <Section title="Summary">
          {state.summary ? (
            <div className="space-y-2">
              <p className="leading-relaxed">{state.summary.text}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Impact: </span>
                {state.summary.impact}
              </p>
              <CitationList ids={state.summary.citations} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No summary yet.</p>
          )}
        </Section>

        <Section title="Hypotheses" hint="Ranked by status, then confidence">
          <div className="space-y-3">
            {rankedHypotheses(state).map((hypothesis) => (
              <HypothesisCard key={hypothesis.id} hypothesis={hypothesis} />
            ))}
          </div>
        </Section>

        <Section title="Next actions" icon={<ListChecks className="size-4" />}>
          <NextActions actions={state.nextActions} />
        </Section>

        <Section title="Open questions" icon={<CircleHelp className="size-4" />}>
          <ul className="space-y-2">
            {state.openQuestions.length === 0 && (
              <li className="text-sm text-muted-foreground">None.</li>
            )}
            {state.openQuestions
              .toSorted((a, b) => Number(a.status === "resolved") - Number(b.status === "resolved"))
              .map((question) => (
                <li key={question.id} className="text-sm leading-relaxed">
                  {question.status === "open" ? (
                    <span>{question.question}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      <span className="line-through">{question.question}</span>{" "}
                      <span className="text-emerald-300">
                        Answered in Wave {question.resolvedInWave}:
                      </span>{" "}
                      {question.answer} <CitationList ids={question.citations} />
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </Section>

        <Section title="Timeline of Signals">
          <ol className="relative space-y-3 border-l border-border pl-4">
            {timeline(state).map((entry) => (
              <li key={entry.evidenceId} className="relative">
                <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-amber-400" />
                <p className="text-sm">
                  <span className="mr-2 font-mono text-xs text-muted-foreground">
                    {hhmm(entry.at)}
                  </span>
                  {entry.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.reason} <CitationList ids={[entry.evidenceId]} />
                </p>
              </li>
            ))}
          </ol>
        </Section>

        <StakeholderUpdate state={state} />

        {state.flags.length > 0 && (
          <Section
            title="Verifier flags"
            icon={<AlertTriangle className="size-4 text-amber-400" />}
          >
            <p className="mb-2 text-xs text-muted-foreground">
              Claims the investigator made that could not be grounded in seen Evidence. They were
              dropped from the brief.
            </p>
            <ul className="space-y-1 font-mono text-xs text-muted-foreground">
              {state.flags.map((flag, index) => (
                <li key={index}>
                  W{flag.waveNumber} · {flag.message}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </ScrollArea>
  );
}

function Section({
  title,
  hint,
  icon,
  children,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {icon}
          {title}
        </h3>
        {hint && <span className="text-[11px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function HypothesisCard({ hypothesis }: { hypothesis: Hypothesis }) {
  const refuted = hypothesis.status === "refuted";
  return (
    <article className={cn("rounded-lg border bg-card/50 p-4", refuted && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={cn("border capitalize", STATUS_STYLE[hypothesis.status])}>
          {hypothesis.status}
        </Badge>
        <Badge variant="outline" className="capitalize text-muted-foreground">
          {hypothesis.kind}
        </Badge>
        <Trajectory hypothesis={hypothesis} />
      </div>
      <h4
        className={cn(
          "mt-2 leading-snug font-medium",
          refuted && "line-through decoration-muted-foreground",
        )}
      >
        {hypothesis.title}
      </h4>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{hypothesis.rationale}</p>
      <dl className="mt-3 grid gap-1.5 text-xs">
        <div className="flex flex-wrap items-baseline gap-2">
          <dt className="w-24 shrink-0 text-emerald-300">Supporting</dt>
          <dd className="min-w-0 flex-1">
            <CitationList ids={hypothesis.supporting} tone="support" />
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline gap-2">
          <dt className="w-24 shrink-0 text-rose-300">Contradicting</dt>
          <dd className="min-w-0 flex-1">
            <CitationList ids={hypothesis.contradicting} tone="contradict" />
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline gap-2">
          <dt className="w-24 shrink-0 text-muted-foreground">Would change if</dt>
          <dd className="min-w-0 flex-1 text-muted-foreground">{hypothesis.whatWouldChange}</dd>
        </div>
      </dl>
    </article>
  );
}

function Trajectory({ hypothesis }: { hypothesis: Hypothesis }) {
  return (
    <div className="ml-auto flex items-center gap-2" title="Confidence by Wave">
      <span className="text-[11px] text-muted-foreground capitalize">{hypothesis.confidence}</span>
      <div className="flex items-end gap-1">
        {hypothesis.history.map((revision) => (
          <div key={revision.waveNumber} className="flex flex-col items-center gap-0.5">
            <div
              className={cn(
                "w-2.5 rounded-sm",
                revision.status === "refuted"
                  ? "bg-rose-500/70"
                  : CONFIDENCE_STYLE[revision.confidence],
              )}
              style={{ height: `${CONFIDENCE_LEVEL[revision.confidence] * 5}px` }}
            />
            <span className="font-mono text-[9px] text-muted-foreground">
              W{revision.waveNumber}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PRIORITY_STYLE: Record<NextAction["priority"], string> = {
  now: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  next: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  later: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

function NextActions({ actions }: { actions: NextAction[] }) {
  const order = { now: 0, next: 1, later: 2 };
  const sorted = actions.toSorted((a, b) => order[a.priority] - order[b.priority]);
  if (sorted.length === 0) return <p className="text-sm text-muted-foreground">None yet.</p>;
  return (
    <ul className="space-y-2">
      {sorted.map((action) => (
        <li key={action.id} className="rounded-lg border bg-card/50 p-3">
          <div className="flex items-start gap-2">
            <Badge className={cn("mt-0.5 border uppercase", PRIORITY_STYLE[action.priority])}>
              {action.priority}
            </Badge>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm leading-snug font-medium">{action.action}</p>
              <p className="text-xs text-muted-foreground">
                Owner <span className="text-foreground/80">{action.owner}</span> ·{" "}
                {action.rationale}
              </p>
              <CitationList ids={action.citations} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function StakeholderUpdate({ state }: { state: Investigation }) {
  const [copied, setCopied] = useState(false);
  if (!state.stakeholderUpdate) return null;
  const update = state.stakeholderUpdate;
  return (
    <Section title="Stakeholder update">
      <div className="rounded-lg border bg-card/50 p-4">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{update.text}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <CitationList ids={update.citations} />
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(update.text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
    </Section>
  );
}
