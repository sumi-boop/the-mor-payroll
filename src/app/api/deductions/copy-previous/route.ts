import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/auth/apiAuth";
import { recordAuditLog } from "@/lib/audit";

function previousMonth(targetMonth: string): string {
  const [y, m] = targetMonth.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 - 1, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * 前月の控除額をコピーする。
 * ただし住民税・社会保険料・所得税は「未確認」状態でコピーし、
 * 管理者が確認してから確定する運用とする(仕様上の要件)。
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const targetMonth: string | undefined = body?.targetMonth;
  if (!targetMonth) {
    return NextResponse.json({ error: "targetMonth は必須です" }, { status: 400 });
  }

  const prevMonth = previousMonth(targetMonth);
  const prevDeductions = await prisma.monthlyDeduction.findMany({
    where: { targetMonth: prevMonth },
  });

  const existingCurrent = await prisma.monthlyDeduction.findMany({
    where: { targetMonth },
  });
  const existingIds = new Set(existingCurrent.map((d) => d.employeeId));

  let copiedCount = 0;
  for (const prev of prevDeductions) {
    if (existingIds.has(prev.employeeId)) continue; // 既に当月データがある場合は上書きしない
    await prisma.monthlyDeduction.create({
      data: {
        employeeId: prev.employeeId,
        targetMonth,
        healthInsurance: prev.healthInsurance,
        careInsurance: prev.careInsurance,
        pensionInsurance: prev.pensionInsurance,
        employmentInsurance: prev.employmentInsurance,
        incomeTax: prev.incomeTax,
        residentTax: prev.residentTax,
        otherDeduction: prev.otherDeduction,
        otherDeductionLabel: prev.otherDeductionLabel,
        remarks: prev.remarks,
        // 確認フラグはコピーせず未確認に戻す(管理者の再確認を必須にする)
        residentTaxConfirmed: false,
        socialInsuranceConfirmed: false,
        incomeTaxConfirmed: false,
      },
    });
    copiedCount++;
  }

  await recordAuditLog({
    userId: auth.session.userId,
    action: "deduction_copy_previous",
    detail: `from=${prevMonth} to=${targetMonth} count=${copiedCount}`,
  });

  return NextResponse.json({ copiedCount, fromMonth: prevMonth });
}
