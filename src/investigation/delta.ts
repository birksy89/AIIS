import { z } from "zod";

const citations = z
  .array(z.string())
  .describe("Evidence IDs exactly as they appear in the wave or in tool results");

const confidence = z.enum(["low", "medium", "high"]);
const status = z.enum(["open", "supported", "refuted"]);

export const deltaSchema = z.object({
  waveNote: z
    .string()
    .describe("Two or three sentences for the responder: what this wave changed and why."),
  classifyEvidence: z
    .array(
      z.object({
        evidenceId: z.string(),
        classification: z.enum(["signal", "noise"]),
        reason: z.string().describe("Why this matters, or why it is noise, in one sentence"),
      }),
    )
    .describe(
      "Classify every new wave item, and any retrieved record worth showing on the timeline. Re-classify earlier Evidence when you change your mind.",
    ),
  openHypothesis: z.array(
    z.object({
      id: z.string().describe("Short stable kebab-case id prefixed with h-, e.g. h-db-saturation"),
      title: z.string().describe("One-line explanation of cause, impact or contributing factor"),
      kind: z.enum(["cause", "impact", "contributing"]),
      status,
      confidence,
      rationale: z.string(),
      whatWouldChange: z.string().describe("Evidence that would raise or lower confidence"),
      supporting: citations,
      contradicting: citations,
    }),
  ),
  reviseHypothesis: z.array(
    z.object({
      id: z.string().describe("id of an existing Hypothesis"),
      status,
      confidence,
      rationale: z.string(),
      whatWouldChange: z.string(),
      addSupporting: citations,
      addContradicting: citations,
    }),
  ),
  addOpenQuestion: z.array(
    z.object({
      id: z.string().describe("Short kebab-case id prefixed with q-"),
      question: z.string(),
      citations,
    }),
  ),
  resolveOpenQuestion: z.array(
    z.object({
      id: z.string().describe("id of an existing open question"),
      answer: z.string(),
      citations,
    }),
  ),
  addNextAction: z.array(
    z.object({
      id: z
        .string()
        .describe("Short kebab-case id prefixed with a-; reuse an id to replace an action"),
      action: z.string().describe("Concrete, imperative, safe to execute"),
      owner: z.string().describe("Team or @person from the service catalogue"),
      priority: z.enum(["now", "next", "later"]),
      rationale: z.string(),
      citations,
    }),
  ),
  setSummary: z
    .object({
      text: z.string().describe("Current incident summary, three sentences maximum"),
      impact: z.string().describe("Customer and business impact as currently known"),
      citations,
    })
    .nullable(),
  setStakeholderUpdate: z
    .object({
      text: z
        .string()
        .describe("Plain-language update for non-engineers: status, impact, next update time"),
      citations,
    })
    .nullable(),
});

export type Delta = z.infer<typeof deltaSchema>;

export function emptyDelta(waveNote = ""): Delta {
  return {
    waveNote,
    classifyEvidence: [],
    openHypothesis: [],
    reviseHypothesis: [],
    addOpenQuestion: [],
    resolveOpenQuestion: [],
    addNextAction: [],
    setSummary: null,
    setStakeholderUpdate: null,
  };
}
