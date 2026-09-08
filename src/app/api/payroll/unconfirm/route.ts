import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/auth/apiAuth";
import { recordAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const recordId: string | undefined = body?.recordId;
  if (!recordId) {
    return NextResponse.json({ error: "recordId は必須です" }, { status: 400 });
  }

  const record = await prisma.payrollRecord.findUnique({ where: { id: recordId } });
  if (!record) {
    return NextResponse.json({ error: "レコードが見つかりません" }, { status: 404 });
  }

  const updated = await prisma.payrollRecord.update({
    where: { id: recordId },
    data: {
      isConfirmed: false,
      confirmedAt: null,
      confirmedById: null,
    },
  });

  await recordAuditLog({
    userId: auth.session.userId,
    action: "payroll_unconfirm",
    targetType: "PayrollRecord",
    targetId: updated.id,
  });

  return NextResponse.json({ record: updated });
}
