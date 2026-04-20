import { ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/session/session.service";

export async function GET() {
  const user = await getCurrentUser();
  return ok(user);
}

