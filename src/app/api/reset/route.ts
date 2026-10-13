import { clearChat } from "@/server/chat";
import { reset } from "@/server/investigation-service";

export async function POST() {
  await reset();
  await clearChat();
  return Response.json({ ok: true });
}
