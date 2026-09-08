import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/auth/apiAuth";
import { buildPayslipData } from "@/lib/pdf/buildPayslipData";
import { renderPayslipPdf, payslipFileName } from "@/lib/pdf/renderPayslip";
import { formatMonth } from "@/lib/format";
import { recordAuditLog } from "@/lib/audit";

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/pdf/[recordId]">
) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const { recordId } = await ctx.params;
  const record = await prisma.payrollRecord.findUnique({
    where: { id: recordId },
    include: { employee: true },
  });
  if (!record) {
    return NextResponse.json({ error: "レコードが見つかりません" }, { status: 404 });
  }
  if (!record.isConfirmed) {
    return NextResponse.json(
      { error: "明細が確定されていません。先に給与計算確認画面で確定してください" },
      { status: 409 }
    );
  }

  const data = buildPayslipData(record, record.employee);
  const pdfBuffer = await renderPayslipPdf([data]);

  await prisma.payrollRecord.update({
    where: { id: record.id },
    data: { pdfGeneratedAt: new Date() },
  });

  await recordAuditLog({
    userId: auth.session.userId,
    action: "pdf_generate",
    targetType: "PayrollRecord",
    targetId: record.id,
    detail: `targetMonth=${record.targetMonth}`,
  });

  const fileName = payslipFileName(formatMonth(record.targetMonth), record.employee.name);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
