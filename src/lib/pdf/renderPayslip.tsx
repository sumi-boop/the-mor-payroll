import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { PayslipDocument, type PayslipData } from "./payslipDocument";

export async function renderPayslipPdf(records: PayslipData[]): Promise<Buffer> {
  const buffer = await renderToBuffer(<PayslipDocument records={records} />);
  return buffer;
}

export function payslipFileName(targetMonthLabel: string, employeeName: string): string {
  // ファイル名に使用できない文字を除去する
  const safeName = employeeName.replace(/[\\/:*?"<>|]/g, "");
  return `給与明細_${targetMonthLabel}_${safeName}.pdf`;
}
