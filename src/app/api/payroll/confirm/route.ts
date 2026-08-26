import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/auth/apiAuth";
import { calcTotalDeduction, calcNetPayment, evaluateWarnings, hasBlockingErrors } from "@/lib/payroll/calc";
import { recordAuditLog } from "@/lib/audit";

/**
 * 給与明細を確定する。
 * ブロッキングエラー(未登録従業員・保険料未入力・控除超過など)がある明細は確定できない。
 * 確定時点のデータをスナップショットとして保存する。
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const recordIds: string[] = body?.recordIds ?? [];
  if (!Array.isArray(recordIds) || recordIds.length === 0) {
    return NextResponse.json({ error: "recordIds は必須です" }, { status: 400 });
  }

  const results: { recordId: string; status: "confirmed" | "blocked" | "already_confirmed"; warnings?: string[] }[] = [];

  for (const recordId of recordIds) {
    const record = await prisma.payrollRecord.findUnique({
      where: { id: recordId },
      include: { employee: true },
    });
    if (!record) continue;

    if (record.isConfirmed) {
      results.push({ recordId, status: "already_confirmed" });
      continue;
    }

    const deduction = await prisma.monthlyDeduction.findUnique({
      where: { employeeId_targetMonth: { employeeId: record.employeeId, targetMonth: record.targetMonth } },
    });

    const effective = {
      healthInsurance: deduction?.healthInsurance ?? 0,
      careInsurance: deduction?.careInsurance ?? 0,
      pensionInsurance: deduction?.pensionInsurance ?? 0,
      employmentInsurance: deduction?.employmentInsurance ?? 0,
      incomeTax: deduction?.incomeTax ?? 0,
      residentTax: deduction?.residentTax ?? 0,
      otherDeduction: deduction?.otherDeduction ?? 0,
      otherDeductionLabel: deduction?.otherDeductionLabel ?? null,
    };

    const warnings = evaluateWarnings({
      employeeExists: true,
      employeeStatus: record.employee.status,
      socialInsuranceEnrolled: record.employee.socialInsurance,
      employmentInsuranceEnrolled: record.employee.employmentInsurance,
      ...effective,
      residentTaxConfirmed: deduction?.residentTaxConfirmed ?? false,
      socialInsuranceConfirmed: deduction?.socialInsuranceConfirmed ?? false,
      incomeTaxConfirmed: deduction?.incomeTaxConfirmed ?? false,
      totalPayment: record.totalPayment,
      amountMismatch: record.amountMismatch,
      amountMismatchAck: record.amountMismatchAck,
      isDuplicateInCsv: false,
      alreadyExistsForMonth: false,
    });

    if (hasBlockingErrors(warnings)) {
      results.push({ recordId, status: "blocked", warnings: warnings.map((w) => w.message) });
      continue;
    }

    const totalDeduction = calcTotalDeduction(effective);
    const netPayment = calcNetPayment(record.totalPayment, totalDeduction);

    const updated = await prisma.payrollRecord.update({
      where: { id: recordId },
      data: {
        ...effective,
        totalDeduction,
        netPayment,
        isConfirmed: true,
        confirmedAt: new Date(),
        confirmedById: auth.session.userId,
      },
    });

    await prisma.payrollSnapshot.create({
      data: {
        payrollRecordId: updated.id,
        targetMonth: updated.targetMonth,
        employeeId: updated.employeeId,
        snapshotJson: JSON.stringify(updated),
        reason: "confirm",
        createdById: auth.session.userId,
      },
    });

    await recordAuditLog({
      userId: auth.session.userId,
      action: "payroll_confirm",
      targetType: "PayrollRecord",
      targetId: updated.id,
      detail: `targetMonth=${updated.targetMonth}`,
    });

    results.push({ recordId, status: "confirmed" });
  }

  return NextResponse.json({ results });
}
