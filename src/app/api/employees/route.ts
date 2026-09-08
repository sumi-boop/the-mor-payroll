import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/auth/apiAuth";
import { normalizeName } from "@/lib/name";
import { EmployeeInputSchema } from "@/lib/validation/employee";
import { recordAuditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");

  const employees = await prisma.employee.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { kana: { contains: q } },
              { employeeNumber: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ employees });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = EmployeeInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力内容に誤りがあります", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const employee = await prisma.employee.create({
    data: {
      name: data.name,
      nameNormalized: normalizeName(data.name),
      kana: data.kana ?? null,
      employeeNumber: data.employeeNumber || null,
      postalCode: data.postalCode ?? null,
      address: data.address ?? null,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      hireDate: data.hireDate ? new Date(data.hireDate) : null,
      resignDate: data.resignDate ? new Date(data.resignDate) : null,
      status: data.status,
      payType: data.payType,
      socialInsurance: data.socialInsurance,
      careInsurance: data.careInsurance,
      employmentInsurance: data.employmentInsurance,
      standardMonthlyRemuneration: data.standardMonthlyRemuneration ?? null,
      dependentFormSubmitted: data.dependentFormSubmitted,
      dependentCount: data.dependentCount,
      taxWithholdingType: data.taxWithholdingType,
      bankInfo: data.bankInfo ?? null,
      remarks: data.remarks ?? null,
    },
  });

  await recordAuditLog({
    userId: auth.session.userId,
    action: "employee_create",
    targetType: "Employee",
    targetId: employee.id,
  });

  return NextResponse.json({ employee }, { status: 201 });
}
