import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/auth/apiAuth";
import { SalariedPayrollInputSchema } from "@/lib/validation/salariedPayroll";
import { recordAuditLog } from "@/lib/audit";

/**
 * 正社員(雇用形態: full_time)向けの給与入力API。
 * アルバイト等のCSV取込とは別に、アプリ内で直接
 * 基本給・通勤手当・インセンティブ・出勤日数を入力できるようにする。
 *
 * 基本給・通勤手当・インセンティブは「固定給」として従業員マスタ
 * (standardBaseSalary / standardCommuteAllowance / standardIncentive)にも
 * 保存し、翌月以降はその値を初期値として表示する。変更があった月に
 * このAPIで保存すると、その値が新しい固定値として以降も引き継がれる。
 */

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const targetMonth = searchParams.get("targetMonth");
  if (!targetMonth) {
    return NextResponse.json({ error: "targetMonth は必須です" }, { status: 400 });
  }

  const employees = await prisma.employee.findMany({
    where: { employmentType: "full_time", status: "active" },
    orderBy: { name: "asc" },
  });

  const records = await prisma.payrollRecord.findMany({
    where: {
      targetMonth,
      employeeId: { in: employees.map((e) => e.id) },
    },
  });
  const recordByEmployee = new Map(records.map((r) => [r.employeeId, r]));

  const items = employees.map((emp) => {
    const record = recordByEmployee.get(emp.id);
    return {
      employeeId: emp.id,
      name: emp.name,
      employeeNumber: emp.employeeNumber,
      recordId: record?.id ?? null,
      isConfirmed: record?.isConfirmed ?? false,
      payDate: record ? record.payDate.toISOString().slice(0, 10) : "",
      workDays: record?.workDays ?? 0,
      baseSalary: record ? record.baseSalary : (emp.standardBaseSalary ?? 0),
      commuteAllowance: record ? record.commuteAllowance : (emp.standardCommuteAllowance ?? 0),
      incentive: record ? record.otherAllowance : (emp.standardIncentive ?? 0),
      totalPayment: record?.totalPayment ?? null,
      remarks: record?.remarks ?? "",
    };
  });

  return NextResponse.json({ items });
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = SalariedPayrollInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力内容に誤りがあります", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
  if (!employee) {
    return NextResponse.json({ error: "従業員が見つかりません" }, { status: 404 });
  }
  if (employee.employmentType !== "full_time") {
    return NextResponse.json(
      { error: "この従業員は正社員(雇用形態: 正社員)として登録されていません" },
      { status: 400 }
    );
  }

  const existing = await prisma.payrollRecord.findUnique({
    where: { employeeId_targetMonth: { employeeId: data.employeeId, targetMonth: data.targetMonth } },
  });
  if (existing?.isConfirmed) {
    return NextResponse.json(
      { error: "この月の給与明細は確定済みのため編集できません。給与計算確認画面で確定解除してください。" },
      { status: 400 }
    );
  }

  const totalPayment = data.baseSalary + data.commuteAllowance + data.incentive;
  const payDate = new Date(data.payDate);

  const commonData = {
    workDays: data.workDays,
    workMinutes: 0,
    overtimeMinutes: 0,
    nightMinutes: 0,
    hourlyWage: 0,
    baseSalary: data.baseSalary,
    overtimeAllowance: 0,
    nightAllowance: 0,
    commuteAllowance: data.commuteAllowance,
    otherAllowance: data.incentive,
    totalAllowanceCsv: totalPayment,
    totalPayment,
    amountMismatch: false,
    amountMismatchAck: false,
    amountMismatchDiff: 0,
    payDate,
    remarks: data.remarks ?? null,
  };

  const record = existing
    ? await prisma.payrollRecord.update({ where: { id: existing.id }, data: commonData })
    : await prisma.payrollRecord.create({
        data: {
          employeeId: data.employeeId,
          targetMonth: data.targetMonth,
          importId: null,
          ...commonData,
        },
      });

  // 基本給・通勤手当・インセンティブは「変更があるまで固定」の運用のため、
  // 保存のたびに従業員マスタの標準値も更新し、翌月以降の初期値に反映する。
  await prisma.employee.update({
    where: { id: data.employeeId },
    data: {
      standardBaseSalary: data.baseSalary,
      standardCommuteAllowance: data.commuteAllowance,
      standardIncentive: data.incentive,
    },
  });

  await recordAuditLog({
    userId: auth.session.userId,
    action: "salaried_payroll_update",
    targetType: "PayrollRecord",
    targetId: record.id,
    detail: `targetMonth=${data.targetMonth}`,
  });

  return NextResponse.json({ record });
}
