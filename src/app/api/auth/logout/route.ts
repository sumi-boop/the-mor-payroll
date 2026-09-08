import { NextResponse } from "next/server";
import { deleteSession, getSessionFromCookies } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/audit";

export async function POST() {
  const session = await getSessionFromCookies();
  await deleteSession();
  if (session) {
    await recordAuditLog({ userId: session.userId, action: "logout" });
  }
  return NextResponse.json({ ok: true });
}
