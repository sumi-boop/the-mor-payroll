import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/auth/apiAuth";
import { buildPayslipData } from "@/lib/pdf/buildPayslipData";
import { renderPayslipPdf, payslipFileName } from "@/lib/pdf/renderPayslip";
import { formatMonth } from "@/lib/format";
import { recordAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const targetMonth: string | undefined = body?.targetMonth;
  if (!targetMonth) {
    return NextResponse.json({ error: "targetMonth は必須です" }, { status: 400 });
  }

  const records = await prisma.payrollRecord.findMany({
    where: { targetMonth, isConfirmed: true },
    include: { employee: true },
    orderBy: { employee: { name: "asc" } },
  });

  if (records.length === 0) {
    return NextResponse.json(
      { error: "確定済みの給与明細がありません。先に確定してください" },
      { status: 409 }
    );
  }

  const zip = new JSZip();
  const usedNames = new Map<string, number>();

  for (const record of records) {
    const data = buildPayslipData(record, record.employee);
    const pdfBuffer = await renderPayslipPdf([data]);
    let fileName = payslipFileName(formatMonth(targetMonth), record.employee.name);
    const count = usedNames.get(fileName) ?? 0;
    if (count > 0) {
      fileName = fileName.replace(/\.pdf$/, `_${count + 1}.pdf`);
    }
    usedNames.set(fileName, count + 1);
    zip.file(fileName, pdfBuffer);

    await prisma.payrollRecord.update({
      where: { id: record.id },
      data: { pdfGeneratedAt: new Date() },
    });
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  await recordAuditLog({
    userId: auth.session.userId,
    action: "zip_generate",
    detail: `targetMonth=${targetMonth} count=${records.length}`,
  });

  const zipFileName = `THE_MOR_給与明細_${formatMonth(targetMonth)}.zip`;

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipFileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
