import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { runFrom } from "../run-context";

export const recordResponderNoteTool = createTool({
  id: "recordResponderNote",
  description:
    "Record a fact the responder stated (an action taken, an observation, a confirmed or rejected Hypothesis) as a Responder Note. This becomes Evidence and triggers a new Wave of investigation. Do not use it for questions.",
  inputSchema: z.object({
    title: z.string().describe("Short label, e.g. 'Paused reporting-worker schedule at 10:31'"),
    note: z.string().describe("The responder's statement, in their words where possible"),
  }),
  execute: async ({ title, note }, context) => {
    const run = runFrom(context?.requestContext);
    const { addAdHocEvidence } = await import("@/server/investigation-service");
    void addAdHocEvidence({
      text: note,
      title: `Responder Note: ${title}`,
      origin: "responder",
    }).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      run.record({
        kind: "error",
        name: "recordResponderNote",
        detail: `Responder Note failed (${title}): ${detail}`,
      });
    });
    run.record({
      kind: "stage",
      name: "recordResponderNote",
      detail: `Queued Responder Note: ${title}`,
    });
    return {
      queued: true,
      message: "Recorded as a Responder Note; the investigator will process it as a new Wave.",
    };
  },
});
