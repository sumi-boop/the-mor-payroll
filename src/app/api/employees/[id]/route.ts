import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/auth/apiAuth";
import { normalizeName } from "@/lib/name";
import { EmployeeInputSchema } from "@/lib/validation/employee";
import { recordAuditLog } from "@/lib/audit";

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/employees/[id]">
) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const { id } = await ctx.params;
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) {
    return NextResponse.json({ error: "従業員が見つかりません" }, { status: 404 });
  }
  return NextResponse.json({ employee });
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/employees/[id]">
) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = EmployeeInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力内容に誤りがあります", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "従業員が見つかりません" }, { status: 404 });
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      ...(data.name !== undefined
        ? { name: data.name, nameNormalized: normalizeName(data.name) }
        : {}),
      ...(data.kana !== undefined ? { kana: data.kana } : {}),
      ...(data.employeeNumber !== undefined
        ? { employeeNumber: data.employeeNumber || null }
        : {}),
      ...(data.postalCode !== undefined ? { postalCode: data.postalCode } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.birthDate !== undefined
        ? { birthDate: data.birthDate ? new Date(data.birthDate) : null }
        : {}),
      ...(data.hireDate !== undefined
        ? { hireDate: data.hireDate ? new Date(data.hireDate) : null }
        : {}),
      ...(data.resignDate !== undefined
        ? { resignDate: data.resignDate ? new Date(data.resignDate) : null }
        : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.payType !== undefined ? { payType: data.payType } : {}),
      ...(data.socialInsurance !== undefined
        ? { socialInsurance: data.socialInsurance }
        : {}),
      ...(data.careInsurance !== undefined ? { careInsurance: data.careInsurance } : {}),
      ...(data.employmentInsurance !== undefined
        ? { employmentInsurance: data.employmentInsurance }
        : {}),
      ...(data.standardMonthlyRemuneration !== undefined
        ? { standardMonthlyRemuneration: data.standardMonthlyRemuneration }
        : {}),
      ...(data.dependentFormSubmitted !== undefined
        ? { dependentFormSubmitted: data.dependentFormSubmitted }
        : {}),
      ...(data.dependentCount !== undefined ? { dependentCount: data.dependentCount } : {}),
      ...(data.taxWithholdingType !== undefined
        ? { taxWithholdingType: data.taxWithholdingType }
        : {}),
      ...(data.employmentType !== undefined ? { employmentType: data.employmentType } : {}),
      ...(data.standardBaseSalary !== undefined
        ? { standardBaseSalary: data.standardBaseSalary }
        : {}),
      ...(data.standardCommuteAllowance !== undefined
        ? { standardCommuteAllowance: data.standardCommuteAllowance }
        : {}),
      ...(data.standardIncentive !== undefined
        ? { standardIncentive: data.standardIncentive }
        : {}),
      ...(data.bankInfo !== undefined ? { bankInfo: data.bankInfo } : {}),
      ...(data.remarks !== undefined ? { remarks: data.remarks } : {}),
    },
  });

  await recordAuditLog({
    userId: auth.session.userId,
    action: "employee_update",
    targetType: "Employee",
    targetId: employee.id,
  });

  return NextResponse.json({ employee });
}
