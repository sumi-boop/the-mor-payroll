import { describe, it, expect } from "vitest";
import {
  calcTotalDeduction,
  calcNetPayment,
  evaluateWarnings,
  hasBlockingErrors,
  residentTaxMonthRange,
  type PayrollWarningInput,
} from "./calc";

function baseInput(overrides: Partial<PayrollWarningInput> = {}): PayrollWarningInput {
  return {
    employeeExists: true,
    employeeStatus: "active",
    socialInsuranceEnrolled: false,
    employmentInsuranceEnrolled: false,
    healthInsurance: 0,
    careInsurance: 0,
    pensionInsurance: 0,
    employmentInsurance: 0,
    incomeTax: 5000,
    residentTax: 8000,
    otherDeduction: 0,
    residentTaxConfirmed: true,
    socialInsuranceConfirmed: true,
    incomeTaxConfirmed: true,
    totalPayment: 223636,
    amountMismatch: false,
    amountMismatchAck: false,
    isDuplicateInCsv: false,
    alreadyExistsForMonth: false,
    ...overrides,
  };
}

describe("calcTotalDeduction / calcNetPayment - 12. 差引支給額の計算", () => {
  it("控除項目7種の合計を正しく計算する", () => {
    const total = calcTotalDeduction({
      healthInsurance: 10000,
      careInsurance: 0,
      pensionInsurance: 18000,
      employmentInsurance: 1200,
      incomeTax: 5000,
      residentTax: 8000,
      otherDeduction: 0,
    });
    expect(total).toBe(10000 + 18000 + 1200 + 5000 + 8000);
  });

  it("差引支給額 = 総支給額 - 控除合計 を正しく計算する", () => {
    expect(calcNetPayment(251625, 42200)).toBe(209425);
  });

  it("控除合計が総支給額を上回る場合、差引支給額はマイナスになる", () => {
    expect(calcNetPayment(10000, 15000)).toBe(-5000);
  });
});

describe("evaluateWarnings - 10. 控除額未設定", () => {
  it("社会保険加入者で健康保険料・厚生年金保険料が0円の場合はエラー警告になる", () => {
    const warnings = evaluateWarnings(
      baseInput({
        socialInsuranceEnrolled: true,
        healthInsurance: 0,
        pensionInsurance: 0,
        socialInsuranceConfirmed: true,
      })
    );
    expect(warnings.some((w) => w.code === "social_insurance_missing" && w.severity === "error")).toBe(
      true
    );
    expect(hasBlockingErrors(warnings)).toBe(true);
  });

  it("雇用保険加入者で雇用保険料が0円の場合はエラー警告になる", () => {
    const warnings = evaluateWarnings(
      baseInput({ employmentInsuranceEnrolled: true, employmentInsurance: 0 })
    );
    expect(
      warnings.some((w) => w.code === "employment_insurance_missing" && w.severity === "error")
    ).toBe(true);
  });

  it("住民税が未確認の場合は警告(warning)になるがブロッキングエラーではない", () => {
    const warnings = evaluateWarnings(baseInput({ residentTaxConfirmed: false }));
    expect(warnings.some((w) => w.code === "resident_tax_unconfirmed")).toBe(true);
    expect(hasBlockingErrors(warnings)).toBe(false);
  });

  it("すべての控除が正しく設定・確認済みの場合は警告が発生しない", () => {
    const warnings = evaluateWarnings(baseInput());
    expect(warnings).toEqual([]);
  });
});

describe("evaluateWarnings - 11. 控除額が総支給額を超えるケース", () => {
  it("控除合計が総支給額を超える場合、エラー警告になり確定できない", () => {
    const warnings = evaluateWarnings(
      baseInput({ totalPayment: 10000, incomeTax: 5000, residentTax: 8000 })
    );
    expect(warnings.some((w) => w.code === "deduction_exceeds_payment")).toBe(true);
    expect(hasBlockingErrors(warnings)).toBe(true);
  });
});

describe("evaluateWarnings - その他の警告条件", () => {
  it("従業員マスタ未登録の場合はエラー警告になる", () => {
    const warnings = evaluateWarnings(baseInput({ employeeExists: false }));
    expect(warnings.some((w) => w.code === "employee_not_registered")).toBe(true);
    expect(hasBlockingErrors(warnings)).toBe(true);
  });

  it("同一年月にすでに登録済みの場合はエラー警告になる(同一月の二重登録防止)", () => {
    const warnings = evaluateWarnings(baseInput({ alreadyExistsForMonth: true }));
    expect(warnings.some((w) => w.code === "duplicate_month_record")).toBe(true);
    expect(hasBlockingErrors(warnings)).toBe(true);
  });

  it("CSV内で氏名が重複している場合はエラー警告になる", () => {
    const warnings = evaluateWarnings(baseInput({ isDuplicateInCsv: true }));
    expect(warnings.some((w) => w.code === "duplicate_name_in_csv")).toBe(true);
    expect(hasBlockingErrors(warnings)).toBe(true);
  });

  it("支給額不一致が未確認の場合はエラー警告になる", () => {
    const warnings = evaluateWarnings(baseInput({ amountMismatch: true, amountMismatchAck: false }));
    expect(warnings.some((w) => w.code === "amount_mismatch_unacknowledged")).toBe(true);
    expect(hasBlockingErrors(warnings)).toBe(true);
  });

  it("支給額不一致が管理者確認済みの場合は警告(warning)に格下げされブロックしない", () => {
    const warnings = evaluateWarnings(baseInput({ amountMismatch: true, amountMismatchAck: true }));
    expect(warnings.some((w) => w.code === "amount_mismatch_acknowledged" && w.severity === "warning")).toBe(
      true
    );
    expect(hasBlockingErrors(warnings)).toBe(false);
  });
});

describe("residentTaxMonthRange - 13. 住民税の月別反映", () => {
  it("開始年の6月から翌年5月までの12ヶ月を正しく生成する", () => {
    const months = residentTaxMonthRange(2026);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2026-06");
    expect(months[6]).toBe("2026-12");
    expect(months[7]).toBe("2027-01");
    expect(months[11]).toBe("2027-05");
  });

  it("年またぎの月がゼロパディングされた形式で生成される", () => {
    const months = residentTaxMonthRange(2025);
    for (const m of months) {
      expect(m).toMatch(/^\d{4}-\d{2}$/);
    }
  });
});
