import { describe, expect, it, vi } from "vitest";

const addAdHocEvidence = vi.hoisted(() => vi.fn());

vi.mock("@/server/investigation-service", () => ({
  addAdHocEvidence,
}));

import { InvestigationRun } from "../run-context";
import { recordResponderNoteTool } from "./record-responder-note";

describe("recordResponderNote", () => {
  it("records a rejected note without an unhandled rejection", async () => {
    addAdHocEvidence.mockRejectedValueOnce(new Error("database unavailable"));
    const run = new InvestigationRun("2026-10-13T10:07:00Z", 2);
    const unhandled: unknown[] = [];
    const onUnhandled = (error: unknown) => unhandled.push(error);
    process.on("unhandledRejection", onUnhandled);

    try {
      const execute = recordResponderNoteTool.execute;
      if (!execute) throw new Error("recordResponderNote has no execute function");
      const result = await execute(
        { title: "Paused the job", note: "reporting-worker is paused" },
        { requestContext: run.toRequestContext() } as Parameters<typeof execute>[1],
      );

      expect(result).toMatchObject({ queued: true });
      expect(addAdHocEvidence).toHaveBeenCalledWith({
        text: "reporting-worker is paused",
        title: "Responder Note: Paused the job",
        origin: "responder",
      });
      await vi.waitFor(() => {
        expect(run.trace.some((event) => event.kind === "error")).toBe(true);
      });
      expect(run.trace).toEqual([
        expect.objectContaining({
          kind: "stage",
          name: "recordResponderNote",
          detail: "Queued Responder Note: Paused the job",
        }),
        expect.objectContaining({
          kind: "error",
          name: "recordResponderNote",
          detail: "Responder Note failed (Paused the job): database unavailable",
        }),
      ]);
      await new Promise((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});
