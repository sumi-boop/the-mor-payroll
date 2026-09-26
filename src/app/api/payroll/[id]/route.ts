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

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/payroll/[id]">
) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const { id } = await ctx.params;

  const existing = await prisma.payrollRecord.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "レコードが見つかりません" }, { status: 404 });
  }
  if (existing.isConfirmed) {
    return NextResponse.json(
      { error: "確定済みの明細です。修正するには確定解除してから削除してください" },
      { status: 409 }
    );
  }

  // 確定→確定解除の履歴がある明細には payroll_snapshots が残っている場合があり、
  // 外部キー制約があるため PayrollRecord 単体では削除できない。
  // 監査ログ(recordAuditLog)には削除の事実が別途残るため、スナップショット本体は
  // レコードと合わせて削除する。
  await prisma.$transaction([
    prisma.payrollSnapshot.deleteMany({ where: { payrollRecordId: id } }),
    prisma.payrollRecord.delete({ where: { id } }),
  ]);

  await recordAuditLog({
    userId: auth.session.userId,
    action: "payroll_record_delete",
    targetType: "PayrollRecord",
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}
