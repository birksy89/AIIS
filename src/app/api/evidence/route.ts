import { z } from "zod";

import { inBackground } from "@/server/background";
import { addAdHocEvidence } from "@/server/investigation-service";

export const maxDuration = 300;

const body = z.object({
  text: z.string().trim().min(1).max(20_000),
  title: z.string().trim().min(1).max(200).nullable().default(null),
});

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Provide { text, title? }" }, { status: 400 });
  }
  inBackground("evidence", () => addAdHocEvidence({ ...parsed.data, origin: "pasted" }));
  return Response.json({ accepted: true }, { status: 202 });
}
