import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/auth/apiAuth";
import { validateCsvFile } from "@/lib/validation/fileUpload";
import { decodeCsvBuffer } from "@/lib/csv/encoding";
import { parseCsvText } from "@/lib/csv/parseCsv";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "フォームの送信内容が不正です" }, { status: 400 });
  }

  const file = formData.get("file");
  const targetMonth = String(formData.get("targetMonth") ?? "");
  const payDate = String(formData.get("payDate") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
    return NextResponse.json({ error: "対象年月を入力してください" }, { status: 400 });
  }
  if (!payDate) {
    return NextResponse.json({ error: "支給日を入力してください" }, { status: 400 });
  }

  const fileCheck = validateCsvFile({ name: file.name, size: file.size, type: file.type });
  if (!fileCheck.ok) {
    return NextResponse.json({ error: fileCheck.error }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { text, encoding } = decodeCsvBuffer(buffer);
  const parsed = parseCsvText(text);

  if (!parsed.headerValid) {
    return NextResponse.json({
      headerValid: false,
      headerErrors: parsed.headerErrors,
      encoding,
      rows: [],
    });
  }

  const employees = await prisma.employee.findMany({
    select: { id: true, name: true, nameNormalized: true, status: true },
  });

  const existingRecords = await prisma.payrollRecord.findMany({
    where: { targetMonth },
    select: { employeeId: true },
  });
  const existingEmployeeIds = new Set(existingRecords.map((r) => r.employeeId));

  const rows = parsed.rows.map((row) => {
    const candidates = employees.filter((e) => e.nameNormalized === row.normalizedName);
    const suggestedEmployeeId = candidates.length === 1 ? candidates[0].id : null;
    return {
      ...row,
      candidates: candidates.map((c) => ({ id: c.id, name: c.name, status: c.status })),
      suggestedEmployeeId,
      alreadyExistsForMonth: suggestedEmployeeId
        ? existingEmployeeIds.has(suggestedEmployeeId)
        : false,
    };
  });

  return NextResponse.json({
    headerValid: true,
    headerErrors: [],
    encoding,
    fileName: file.name,
    fileSize: file.size,
    targetMonth,
    payDate,
    totalRowCount: parsed.totalRowCount,
    errorRowCount: parsed.errorRowCount,
    duplicateNameCount: parsed.duplicateNameCount,
    rows,
  });
}
