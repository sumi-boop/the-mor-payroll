import "server-only";
import { NextResponse } from "next/server";
import { getSessionFromCookies, type SessionPayload } from "./session";

export async function requireApiSession(): Promise<
  { session: SessionPayload } | { error: NextResponse }
> {
  const session = await getSessionFromCookies();
  if (!session) {
    return { error: NextResponse.json({ error: "認証が必要です" }, { status: 401 }) };
  }
  return { session };
}
