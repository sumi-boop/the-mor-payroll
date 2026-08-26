import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/auth/apiAuth";
import { calcTotalDeduction, calcNetPayment, evaluateWarnings } from "@/lib/payroll/calc";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const targetMonth = searchParams.get("targetMonth");
  if (!targetMonth) {
    return NextResponse.json({ error: "targetMonth は必須です" }, { status: 400 });
  }

  const records = await prisma.payrollRecord.findMany({
    where: { targetMonth },
    include: { employee: true },
    orderBy: { employee: { name: "asc" } },
  });

  const deductions = await prisma.monthlyDeduction.findMany({ where: { targetMonth } });
  const deductionMap = new Map(deductions.map((d) => [d.employeeId, d]));

  // CSV内の重複氏名は取込時点の情報なので、同月内の同一氏名レコードを簡易的に検出する
  const nameCounts = new Map<string, number>();
  for (const r of records) {
    nameCounts.set(r.employee.nameNormalized, (nameCounts.get(r.employee.nameNormalized) ?? 0) + 1);
  }

  const items = records.map((record) => {
    const deduction = deductionMap.get(record.employeeId);

    const effective = record.isConfirmed
      ? {
          healthInsurance: record.healthInsurance,
          careInsurance: record.careInsurance,
          pensionInsurance: record.pensionInsurance,
          employmentInsurance: record.employmentInsurance,
          incomeTax: record.incomeTax,
          residentTax: record.residentTax,
          otherDeduction: record.otherDeduction,
          otherDeductionLabel: record.otherDeductionLabel,
          residentTaxConfirmed: true,
          socialInsuranceConfirmed: true,
          incomeTaxConfirmed: true,
        }
      : {
          healthInsurance: deduction?.healthInsurance ?? 0,
          careInsurance: deduction?.careInsurance ?? 0,
          pensionInsurance: deduction?.pensionInsurance ?? 0,
          employmentInsurance: deduction?.employmentInsurance ?? 0,
          incomeTax: deduction?.incomeTax ?? 0,
          residentTax: deduction?.residentTax ?? 0,
          otherDeduction: deduction?.otherDeduction ?? 0,
          otherDeductionLabel: deduction?.otherDeductionLabel ?? null,
          residentTaxConfirmed: deduction?.residentTaxConfirmed ?? false,
          socialInsuranceConfirmed: deduction?.socialInsuranceConfirmed ?? false,
          incomeTaxConfirmed: deduction?.incomeTaxConfirmed ?? false,
        };

    const totalDeduction = calcTotalDeduction(effective);
    const netPayment = calcNetPayment(record.totalPayment, totalDeduction);

    const warnings = evaluateWarnings({
      employeeExists: true,
      employeeStatus: record.employee.status,
      socialInsuranceEnrolled: record.employee.socialInsurance,
      employmentInsuranceEnrolled: record.employee.employmentInsurance,
      healthInsurance: effective.healthInsurance,
      careInsurance: effective.careInsurance,
      pensionInsurance: effective.pensionInsurance,
      employmentInsurance: effective.employmentInsurance,
      incomeTax: effective.incomeTax,
      residentTax: effective.residentTax,
      otherDeduction: effective.otherDeduction,
      residentTaxConfirmed: effective.residentTaxConfirmed,
      socialInsuranceConfirmed: effective.socialInsuranceConfirmed,
      incomeTaxConfirmed: effective.incomeTaxConfirmed,
      totalPayment: record.totalPayment,
      amountMismatch: record.amountMismatch,
      amountMismatchAck: record.amountMismatchAck,
      isDuplicateInCsv: (nameCounts.get(record.employee.nameNormalized) ?? 0) > 1,
      alreadyExistsForMonth: false,
    });

    return {
      record,
      effectiveDeduction: effective,
      totalDeduction,
      netPayment,
      warnings,
    };
  });

  return NextResponse.json({ items });
}
