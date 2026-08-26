import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/audit";

const LoginSchema = z.object({
  loginId: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です" }, { status: 400 });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ログインIDとパスワードを入力してください" },
      { status: 400 }
    );
  }

  const { loginId, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { loginId } });

  // ユーザーが存在しない場合もタイミング攻撃対策のため同様の処理時間になるよう検証を行う
  const dummyHash = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8xO5cLqf5f7L1M9G1o8QwvXK1nS3vG";
  const ok = await verifyPassword(password, user?.passwordHash ?? dummyHash);

  if (!user || !ok || !user.isActive) {
    await recordAuditLog({
      action: "login_failed",
      detail: `loginId=${loginId}`,
    });
    return NextResponse.json(
      { error: "ログインIDまたはパスワードが正しくありません" },
      { status: 401 }
    );
  }

  await createSession({
    userId: user.id,
    loginId: user.loginId,
    name: user.name,
    role: user.role,
  });

  await recordAuditLog({
    userId: user.id,
    action: "login",
  });

  return NextResponse.json({ ok: true });
}
