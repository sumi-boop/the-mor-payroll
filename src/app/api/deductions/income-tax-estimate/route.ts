import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/auth/apiAuth";
import { estimateIncomeTax } from "@/lib/payroll/incomeTax";

/**
 * 対象の従業員・対象年月について、所得税(源泉徴収税額)の概算を計算して返す。
 * 課税対象額は、その月に取り込み済みのCSV(給与明細レコード)の支給額(通勤手当を除く)から
 * リクエストで渡された社会保険料等(月別控除設定の未保存分を含む)を差し引いて求める。
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const employeeId: string | undefined = body?.employeeId;
  const targetMonth: string | undefined = body?.targetMonth;
  const healthInsurance = Number(body?.healthInsurance) || 0;
  const careInsurance = Number(body?.careInsurance) || 0;
  const pensionInsurance = Number(body?.pensionInsurance) || 0;
  const employmentInsurance = Number(body?.employmentInsurance) || 0;

  if (!employeeId || !targetMonth) {
    return NextResponse.json(
      { error: "employeeId と targetMonth は必須です" },
      { status: 400 }
    );
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    return NextResponse.json({ error: "従業員が見つかりません" }, { status: 404 });
  }

  const payrollRecord = await prisma.payrollRecord.findUnique({
    where: { employeeId_targetMonth: { employeeId, targetMonth } },
  });

  if (!payrollRecord) {
    return NextResponse.json({
      found: false,
      message:
        "この対象年月のCSV(給与明細レコード)がまだ取り込まれていないため、自動計算できません。先にCSV取込を行ってください。",
    });
  }

  const grossTaxablePayment =
    payrollRecord.baseSalary +
    payrollRecord.overtimeAllowance +
    payrollRecord.nightAllowance +
    payrollRecord.otherAllowance; // 通勤手当は非課税として除外

  const socialInsuranceTotal =
    healthInsurance + careInsurance + pensionInsurance + employmentInsurance;

  const result = estimateIncomeTax({
    grossTaxablePayment,
    socialInsuranceTotal,
    taxWithholdingType: employee.taxWithholdingType === "otsu" ? "otsu" : "kou",
    dependentFormSubmitted: employee.dependentFormSubmitted,
    dependentCount: employee.dependentCount,
  });

  return NextResponse.json({
    found: true,
    ...result,
    grossTaxablePayment,
    socialInsuranceTotal,
  });
}
