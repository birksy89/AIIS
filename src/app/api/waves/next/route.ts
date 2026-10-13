import { inBackground } from "@/server/background";
import { deliverNextScriptedWave, scriptedProgress } from "@/server/investigation-service";

export const maxDuration = 300;

export async function POST() {
  const progress = await scriptedProgress();
  if (progress.delivered >= progress.total) {
    return Response.json(
      { accepted: false, reason: "All scripted Waves delivered" },
      { status: 409 },
    );
  }
  inBackground("waves/next", deliverNextScriptedWave);
  return Response.json({ accepted: true }, { status: 202 });
}
