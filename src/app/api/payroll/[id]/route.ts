import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/auth/apiAuth";
import { recordAuditLog } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/payroll/[id]">
) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const remarks: string | null = body?.remarks ?? null;

  const existing = await prisma.payrollRecord.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "レコードが見つかりません" }, { status: 404 });
  }
  if (existing.isConfirmed) {
    return NextResponse.json(
      { error: "確定済みの明細です。修正するには確定解除してください" },
      { status: 409 }
    );
  }

  const record = await prisma.payrollRecord.update({
    where: { id },
    data: { remarks },
  });

  await recordAuditLog({
    userId: auth.session.userId,
    action: "payroll_record_update",
    targetType: "PayrollRecord",
    targetId: record.id,
  });

  return NextResponse.json({ record });
}
