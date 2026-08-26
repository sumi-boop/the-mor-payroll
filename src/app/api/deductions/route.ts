import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/auth/apiAuth";
import { DeductionInputSchema } from "@/lib/validation/deduction";
import { recordAuditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const targetMonth = searchParams.get("targetMonth");
  if (!targetMonth) {
    return NextResponse.json({ error: "targetMonth は必須です" }, { status: 400 });
  }

  const deductions = await prisma.monthlyDeduction.findMany({
    where: { targetMonth },
  });

  return NextResponse.json({ deductions });
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = DeductionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力内容に誤りがあります", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const deduction = await prisma.monthlyDeduction.upsert({
    where: {
      employeeId_targetMonth: {
        employeeId: data.employeeId,
        targetMonth: data.targetMonth,
      },
    },
    create: {
      employeeId: data.employeeId,
      targetMonth: data.targetMonth,
      healthInsurance: data.healthInsurance,
      careInsurance: data.careInsurance,
      pensionInsurance: data.pensionInsurance,
      employmentInsurance: data.employmentInsurance,
      incomeTax: data.incomeTax,
      residentTax: data.residentTax,
      otherDeduction: data.otherDeduction,
      otherDeductionLabel: data.otherDeductionLabel ?? null,
      remarks: data.remarks ?? null,
      residentTaxConfirmed: data.residentTaxConfirmed,
      socialInsuranceConfirmed: data.socialInsuranceConfirmed,
      incomeTaxConfirmed: data.incomeTaxConfirmed,
    },
    update: {
      healthInsurance: data.healthInsurance,
      careInsurance: data.careInsurance,
      pensionInsurance: data.pensionInsurance,
      employmentInsurance: data.employmentInsurance,
      incomeTax: data.incomeTax,
      residentTax: data.residentTax,
      otherDeduction: data.otherDeduction,
      otherDeductionLabel: data.otherDeductionLabel ?? null,
      remarks: data.remarks ?? null,
      residentTaxConfirmed: data.residentTaxConfirmed,
      socialInsuranceConfirmed: data.socialInsuranceConfirmed,
      incomeTaxConfirmed: data.incomeTaxConfirmed,
    },
  });

  await recordAuditLog({
    userId: auth.session.userId,
    action: "deduction_update",
    targetType: "MonthlyDeduction",
    targetId: deduction.id,
    detail: `targetMonth=${data.targetMonth}`,
  });

  return NextResponse.json({ deduction });
}
