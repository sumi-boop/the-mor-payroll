/**
 * 14. 10人分のPDF一括生成 / 15. 日本語PDFの文字化け確認
 *
 * DBを介さず、react-pdfのレンダリング関数に直接テスト用データを渡して
 * PDFバイナリを生成し、pdftotext(poppler-utils)でテキスト抽出して
 * 日本語が正しく埋め込まれているか(文字化け・U+FFFD置換文字が無いか)を検証する。
 */
import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderPayslipPdf, payslipFileName } from "@/lib/pdf/renderPayslip";
import type { PayslipData } from "@/lib/pdf/payslipDocument";

const EMPLOYEE_NAMES = [
  "山口桃花",
  "田中太郎",
  "佐藤花子",
  "鈴木一郎",
  "高橋美咲",
  "伊藤健太",
  "渡辺さくら",
  "山本翔太",
  "中村愛",
  "小林大輔",
];

function makeRecord(name: string, index: number): PayslipData {
  const baseSalary = 200000 + index * 1000;
  const overtimeAllowance = 2000 + index * 10;
  const nightAllowance = 500;
  const commuteAllowance = 10000;
  const otherAllowance = 0;
  const totalPayment = baseSalary + overtimeAllowance + nightAllowance + commuteAllowance + otherAllowance;
  const healthInsurance = 10000;
  const careInsurance = 0;
  const pensionInsurance = 18000;
  const employmentInsurance = 1200;
  const incomeTax = 5000;
  const residentTax = 8000;
  const otherDeduction = 0;
  const totalDeduction =
    healthInsurance + careInsurance + pensionInsurance + employmentInsurance + incomeTax + residentTax + otherDeduction;

  return {
    companyName: "THE MOR",
    targetMonthLabel: "2026年08月",
    payDateLabel: "2026年8月25日",
    employeeNumber: `E${String(index + 1).padStart(3, "0")}`,
    employeeName: name,
    workDays: 20,
    workMinutes: 160 * 60,
    overtimeMinutes: 60,
    nightMinutes: 0,
    baseSalary,
    overtimeAllowance,
    nightAllowance,
    commuteAllowance,
    otherAllowance,
    totalPayment,
    healthInsurance,
    careInsurance,
    pensionInsurance,
    employmentInsurance,
    incomeTax,
    residentTax,
    otherDeduction,
    otherDeductionLabel: null,
    totalDeduction,
    netPayment: totalPayment - totalDeduction,
    remarks: "備考テスト:全角・半角混在テスト１２３ＡＢＣ",
  };
}

const tmpFiles: string[] = [];

function pdfToText(buffer: Buffer): string {
  const tmpPath = path.join(os.tmpdir(), `payslip-test-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  fs.writeFileSync(tmpPath, buffer);
  tmpFiles.push(tmpPath);
  return execFileSync("pdftotext", ["-layout", tmpPath, "-"], { encoding: "utf-8" });
}

function pdfPageCount(buffer: Buffer): number {
  const tmpPath = path.join(os.tmpdir(), `payslip-test-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  fs.writeFileSync(tmpPath, buffer);
  tmpFiles.push(tmpPath);
  const info = execFileSync("pdfinfo", [tmpPath], { encoding: "utf-8" });
  const match = /^Pages:\s+(\d+)/m.exec(info);
  return match ? Number(match[1]) : 0;
}

afterAll(() => {
  for (const f of tmpFiles) {
    if (fs.existsSync(f)) fs.rmSync(f);
  }
});

describe("PDF生成 - 14. 10人分のPDF一括生成", () => {
  it("10人分のデータから有効なPDFバイナリ(1ドキュメント10ページ)が生成される", async () => {
    const records = EMPLOYEE_NAMES.map((name, i) => makeRecord(name, i));
    const buffer = await renderPayslipPdf(records);

    // PDFのマジックバイト確認
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1000);

    expect(pdfPageCount(buffer)).toBe(10);
  }, 30000);

  it("10人分それぞれについて個別のPDF(1人1ファイル)を生成できる(ZIP出力相当)", async () => {
    const records = EMPLOYEE_NAMES.map((name, i) => makeRecord(name, i));
    for (const record of records) {
      const buffer = await renderPayslipPdf([record]);
      expect(pdfPageCount(buffer)).toBe(1);
      const fileName = payslipFileName(record.targetMonthLabel, record.employeeName);
      expect(fileName).toBe(`給与明細_2026年08月_${record.employeeName}.pdf`);
    }
  }, 60000);
});

describe("PDF生成 - 15. 日本語PDFの文字化け確認", () => {
  it("10人分すべての氏名がPDFテキストとして正しく抽出でき、文字化け(U+FFFD)が含まれない", async () => {
    const records = EMPLOYEE_NAMES.map((name, i) => makeRecord(name, i));
    const buffer = await renderPayslipPdf(records);
    const text = pdfToText(buffer);

    expect(text).not.toContain("�");

    for (const name of EMPLOYEE_NAMES) {
      expect(text).toContain(name);
    }

    // 固定文言(会社名・書類タイトル・項目名)が正しく埋め込まれていること
    expect(text).toContain("THE MOR");
    expect(text).toContain("給与支給明細書");
    expect(text).toContain("基本給");
    expect(text).toContain("差引支給額");
    expect(text).toContain("住民税");
  }, 30000);

  it("全角・半角混在の備考欄テキストも文字化けせず抽出できる", async () => {
    const record = makeRecord("山口桃花", 0);
    const buffer = await renderPayslipPdf([record]);
    const text = pdfToText(buffer);
    expect(text).not.toContain("�");
    expect(text).toContain("全角・半角混在テスト");
  }, 30000);

  it("円マークと3桁カンマ区切りの金額表記が文字化けせず抽出できる", async () => {
    const record = makeRecord("田中太郎", 1);
    const buffer = await renderPayslipPdf([record]);
    const text = pdfToText(buffer);
    // 差引支給額の金額(カンマ区切り+円)が含まれること
    const expectedNet = record.netPayment.toLocaleString("ja-JP");
    expect(text).toContain(`${expectedNet}円`);
  }, 30000);
});
