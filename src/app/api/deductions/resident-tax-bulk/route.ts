import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/auth/apiAuth";
import { ResidentTaxBulkSchema } from "@/lib/validation/deduction";
import { residentTaxMonthRange } from "@/lib/payroll/calc";
import { recordAuditLog } from "@/lib/audit";

/**
 * 特別徴収税額決定通知書に基づく住民税の月割額を
 * 6月〜翌年5月の12ヶ月分まとめて登録する。
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = ResidentTaxBulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力内容に誤りがあります", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { employeeId, startYear, amounts } = parsed.data;
  const months = residentTaxMonthRange(startYear);

  for (let i = 0; i < months.length; i++) {
    const targetMonth = months[i];
    const amount = amounts[i];
    await prisma.monthlyDeduction.upsert({
      where: { employeeId_targetMonth: { employeeId, targetMonth } },
      create: {
        employeeId,
        targetMonth,
        residentTax: amount,
        residentTaxConfirmed: true,
      },
      update: {
        residentTax: amount,
        residentTaxConfirmed: true,
      },
    });
  }

  await recordAuditLog({
    userId: auth.session.userId,
    action: "resident_tax_bulk_update",
    targetType: "Employee",
    targetId: employeeId,
    detail: `startYear=${startYear}`,
  });

  return NextResponse.json({ ok: true, months });
}
