import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { deltaSchema } from "@/investigation/delta";

import { runFrom } from "../run-context";

export const SUBMIT_UPDATE_TOOL = "submitInvestigationUpdate";

export const submitUpdateTool = createTool({
  id: SUBMIT_UPDATE_TOOL,
  description:
    "Submit your delta for this Wave. Call exactly once, after investigating, with every change in one call. Calling it ends your turn.",
  inputSchema: deltaSchema,
  outputSchema: z.object({ accepted: z.boolean() }),
  execute: async (delta, context) => {
    const run = runFrom(context?.requestContext);
    run.submit(delta);
    return { accepted: true };
  },
});
