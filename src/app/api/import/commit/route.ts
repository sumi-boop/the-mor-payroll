import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/auth/apiAuth";
import { normalizeName } from "@/lib/name";
import { recordAuditLog } from "@/lib/audit";

const RowSchema = z.object({
  rowNumber: z.number(),
  rawName: z.string(),
  normalizedName: z.string(),
  workDays: z.number().nullable(),
  workMinutes: z.number().nullable(),
  overtimeMinutes: z.number().nullable(),
  nightMinutes: z.number().nullable(),
  hourlyWage: z.number().nullable(),
  baseSalary: z.number().nullable(),
  overtimeAllowance: z.number().nullable(),
  nightAllowance: z.number().nullable(),
  commuteAllowance: z.number().nullable(),
  otherAllowance: z.number().nullable(),
  totalAllowanceCsv: z.number().nullable(),
  computedTotal: z.number().nullable(),
  amountMismatch: z.boolean(),
  amountMismatchDiff: z.number(),
  errors: z.array(z.string()),
  isDuplicateName: z.boolean(),
  resolution: z.object({
    type: z.enum(["existing", "new", "skip"]),
    employeeId: z.string().optional(),
  }),
  amountMismatchAck: z.boolean().default(false),
});

const CommitSchema = z.object({
  targetMonth: z.string().regex(/^\d{4}-\d{2}$/),
  payDate: z.string().min(1),
  fileName: z.string(),
  fileSize: z.number(),
  encoding: z.string(),
  rows: z.array(RowSchema),
});

export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = CommitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力内容に誤りがあります", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // 取込対象外(skip)以外の行に、必須項目エラーが残っていないか再検証(防御的)
  for (const row of data.rows) {
    if (row.resolution.type === "skip") continue;
    if (row.errors.length > 0) {
      return NextResponse.json(
        { error: `${row.rowNumber}行目にエラーが残っています: ${row.errors.join(", ")}` },
        { status: 400 }
      );
    }
    if (row.amountMismatch && !row.amountMismatchAck) {
      return NextResponse.json(
        { error: `${row.rowNumber}行目の支給額不一致が未確認です` },
        { status: 400 }
      );
    }
    if (row.isDuplicateName && row.resolution.type !== "existing") {
      return NextResponse.json(
        {
          error: `${row.rowNumber}行目: CSV内で氏名が重複しています。既存従業員への紐付け、または取込対象外を選択してください`,
        },
        { status: 400 }
      );
    }
  }

  const importRecord = await prisma.payrollImport.create({
    data: {
      targetMonth: data.targetMonth,
      payDate: new Date(data.payDate),
      fileName: data.fileName,
      fileSize: data.fileSize,
      encoding: data.encoding,
      rowCount: data.rows.length,
      importedById: auth.session.userId,
      rawCsvJson: JSON.stringify(data.rows),
    },
  });

  const results: {
    rowNumber: number;
    status: "created" | "updated" | "skipped" | "conflict_confirmed";
    employeeId?: string;
  }[] = [];

  for (const row of data.rows) {
    if (row.resolution.type === "skip") {
      results.push({ rowNumber: row.rowNumber, status: "skipped" });
      continue;
    }

    let employeeId = row.resolution.employeeId;

    if (row.resolution.type === "new") {
      const created = await prisma.employee.create({
        data: {
          name: row.rawName,
          nameNormalized: normalizeName(row.rawName),
          status: "active",
        },
      });
      employeeId = created.id;
    }

    if (!employeeId) {
      results.push({ rowNumber: row.rowNumber, status: "skipped" });
      continue;
    }

    const existing = await prisma.payrollRecord.findUnique({
      where: { employeeId_targetMonth: { employeeId, targetMonth: data.targetMonth } },
    });

    if (existing?.isConfirmed) {
      results.push({ rowNumber: row.rowNumber, status: "conflict_confirmed", employeeId });
      continue;
    }

    const baseSalary = row.baseSalary ?? 0;
    const overtimeAllowance = row.overtimeAllowance ?? 0;
    const nightAllowance = row.nightAllowance ?? 0;
    const commuteAllowance = row.commuteAllowance ?? 0;
    const otherAllowance = row.otherAllowance ?? 0;
    const totalPayment = baseSalary + overtimeAllowance + nightAllowance + commuteAllowance + otherAllowance;

    const commonData = {
      importId: importRecord.id,
      workDays: row.workDays ?? 0,
      workMinutes: row.workMinutes ?? 0,
      overtimeMinutes: row.overtimeMinutes ?? 0,
      nightMinutes: row.nightMinutes ?? 0,
      hourlyWage: row.hourlyWage ?? 0,
      baseSalary,
      overtimeAllowance,
      nightAllowance,
      commuteAllowance,
      otherAllowance,
      totalAllowanceCsv: row.totalAllowanceCsv ?? 0,
      totalPayment,
      amountMismatch: row.amountMismatch,
      amountMismatchAck: row.amountMismatchAck,
      amountMismatchDiff: row.amountMismatchDiff,
      payDate: new Date(data.payDate),
    };

    if (existing) {
      await prisma.payrollRecord.update({
        where: { id: existing.id },
        data: commonData,
      });
      results.push({ rowNumber: row.rowNumber, status: "updated", employeeId });
    } else {
      await prisma.payrollRecord.create({
        data: {
          employeeId,
          targetMonth: data.targetMonth,
          ...commonData,
        },
      });
      results.push({ rowNumber: row.rowNumber, status: "created", employeeId });
    }
  }

  await recordAuditLog({
    userId: auth.session.userId,
    action: "csv_import",
    targetType: "PayrollImport",
    targetId: importRecord.id,
    detail: `targetMonth=${data.targetMonth} rows=${data.rows.length}`,
  });

  return NextResponse.json({ importId: importRecord.id, results });
}
