/**
 * 給与計算のロジック(控除合計・差引支給額・警告判定)
 * DBやNext.jsに依存しない純粋関数として実装し、テストしやすくする。
 */

export type DeductionInput = {
  healthInsurance: number;
  careInsurance: number;
  pensionInsurance: number;
  employmentInsurance: number;
  incomeTax: number;
  residentTax: number;
  otherDeduction: number;
};

export function calcTotalDeduction(d: DeductionInput): number {
  return (
    d.healthInsurance +
    d.careInsurance +
    d.pensionInsurance +
    d.employmentInsurance +
    d.incomeTax +
    d.residentTax +
    d.otherDeduction
  );
}

export function calcNetPayment(totalPayment: number, totalDeduction: number): number {
  return totalPayment - totalDeduction;
}

export type PayrollWarningInput = {
  employeeExists: boolean;
  employeeStatus?: string;
  socialInsuranceEnrolled: boolean;
  employmentInsuranceEnrolled: boolean;
  healthInsurance: number;
  careInsurance: number;
  pensionInsurance: number;
  employmentInsurance: number;
  incomeTax: number;
  residentTax: number;
  otherDeduction: number;
  residentTaxConfirmed: boolean;
  socialInsuranceConfirmed: boolean;
  incomeTaxConfirmed: boolean;
  totalPayment: number;
  amountMismatch: boolean;
  amountMismatchAck: boolean;
  isDuplicateInCsv: boolean;
  alreadyExistsForMonth: boolean;
};

export type PayrollWarning = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export function evaluateWarnings(input: PayrollWarningInput): PayrollWarning[] {
  const warnings: PayrollWarning[] = [];

  if (!input.employeeExists) {
    warnings.push({
      code: "employee_not_registered",
      message: "従業員マスタ未登録です",
      severity: "error",
    });
  }

  if (!input.residentTaxConfirmed) {
    warnings.push({
      code: "resident_tax_unconfirmed",
      message: "住民税が未確認です",
      severity: "warning",
    });
  }

  if (input.socialInsuranceEnrolled) {
    if (input.healthInsurance <= 0 || input.pensionInsurance <= 0) {
      warnings.push({
        code: "social_insurance_missing",
        message: "社会保険加入者ですが保険料が未入力です",
        severity: "error",
      });
    }
    if (!input.socialInsuranceConfirmed) {
      warnings.push({
        code: "social_insurance_unconfirmed",
        message: "社会保険料が未確認です",
        severity: "warning",
      });
    }
  }

  if (input.employmentInsuranceEnrolled && input.employmentInsurance <= 0) {
    warnings.push({
      code: "employment_insurance_missing",
      message: "雇用保険加入者ですが雇用保険料が未入力です",
      severity: "error",
    });
  }

  if (!input.incomeTaxConfirmed) {
    warnings.push({
      code: "income_tax_unconfirmed",
      message: "所得税が未確認です",
      severity: "warning",
    });
  }

  const totalDeduction = calcTotalDeduction({
    healthInsurance: input.healthInsurance,
    careInsurance: input.careInsurance,
    pensionInsurance: input.pensionInsurance,
    employmentInsurance: input.employmentInsurance,
    incomeTax: input.incomeTax,
    residentTax: input.residentTax,
    otherDeduction: input.otherDeduction,
  });

  if (totalDeduction < 0) {
    warnings.push({
      code: "negative_deduction",
      message: "控除額がマイナスです",
      severity: "error",
    });
  }

  if (totalDeduction > input.totalPayment) {
    warnings.push({
      code: "deduction_exceeds_payment",
      message: "控除合計が総支給額を超えています",
      severity: "error",
    });
  }

  if (input.alreadyExistsForMonth) {
    warnings.push({
      code: "duplicate_month_record",
      message: "同じ対象年月の給与がすでに登録されています",
      severity: "error",
    });
  }

  if (input.isDuplicateInCsv) {
    warnings.push({
      code: "duplicate_name_in_csv",
      message: "CSV内で氏名が重複しています",
      severity: "error",
    });
  }

  if (input.amountMismatch && !input.amountMismatchAck) {
    warnings.push({
      code: "amount_mismatch_unacknowledged",
      message: "CSVの支給合計が内訳と一致しません(未確認)",
      severity: "error",
    });
  } else if (input.amountMismatch && input.amountMismatchAck) {
    warnings.push({
      code: "amount_mismatch_acknowledged",
      message: "CSVの支給合計が内訳と一致しませんが、管理者確認済みです",
      severity: "warning",
    });
  }

  return warnings;
}

export function hasBlockingErrors(warnings: PayrollWarning[]): boolean {
  return warnings.some((w) => w.severity === "error");
}

/** 対象年月(YYYY-MM)から、住民税を計算する6月-翌年5月の12ヶ月分の配列を作る */
export function residentTaxMonthRange(startYear: number): string[] {
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const monthIndex = 5 + i; // 6月=index5
    const year = startYear + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    months.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return months;
}
