import Papa from "papaparse";
import {
  parseHoursMinutes,
  parseIntCount,
  parseYenAmount,
  looksLikeFormulaInjection,
} from "./parseValue";
import { normalizeName } from "@/lib/name";

export const EXPECTED_HEADERS = [
  "氏名",
  "出勤日数",
  "労働時間",
  "残業時間",
  "深夜労働時間",
  "時給",
  "基本給",
  "残業手当",
  "深夜手当",
  "通勤手当",
  "手当・その他",
  "合計",
] as const;

export type ParsedCsvRow = {
  rowNumber: number; // 1始まり(ヘッダーを除く実データ行番号)
  rawName: string;
  normalizedName: string;
  workDays: number | null;
  workMinutes: number | null;
  overtimeMinutes: number | null;
  nightMinutes: number | null;
  hourlyWage: number | null;
  baseSalary: number | null;
  overtimeAllowance: number | null;
  nightAllowance: number | null;
  commuteAllowance: number | null;
  otherAllowance: number | null;
  totalAllowanceCsv: number | null;
  computedTotal: number | null;
  amountMismatch: boolean;
  amountMismatchDiff: number;
  errors: string[];
  isDuplicateName: boolean;
};

export type CsvParseResult = {
  headerValid: boolean;
  headerErrors: string[];
  headers: string[];
  rows: ParsedCsvRow[];
  totalRowCount: number;
  errorRowCount: number;
  duplicateNameCount: number;
};

export function parseCsvText(text: string): CsvParseResult {
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: "greedy",
  });

  const rawRows = parsed.data;
  const headerErrors: string[] = [];

  if (rawRows.length === 0) {
    return {
      headerValid: false,
      headerErrors: ["CSVにデータが含まれていません"],
      headers: [],
      rows: [],
      totalRowCount: 0,
      errorRowCount: 0,
      duplicateNameCount: 0,
    };
  }

  const headers = (rawRows[0] ?? []).map((h) => (h ?? "").trim());
  let headerValid = true;

  if (headers.length < EXPECTED_HEADERS.length) {
    headerValid = false;
    headerErrors.push(
      `列数が不足しています(必要: ${EXPECTED_HEADERS.length}列、実際: ${headers.length}列)`
    );
  }

  EXPECTED_HEADERS.forEach((expected, i) => {
    const actual = headers[i];
    if (actual !== expected) {
      headerValid = false;
      headerErrors.push(
        `${i + 1}列目のヘッダーが不正です(期待: "${expected}", 実際: "${
          actual ?? "(なし)"
        }")`
      );
    }
  });

  const dataRows = rawRows.slice(1).filter((r) => r.some((c) => (c ?? "").trim() !== ""));

  const rows: ParsedCsvRow[] = dataRows.map((cols, idx) => {
    const rowNumber = idx + 1;
    const errors: string[] = [];

    const rawName = (cols[0] ?? "").trim();
    const normalizedName = normalizeName(rawName);

    if (rawName === "") {
      errors.push("氏名が空です");
    } else if (looksLikeFormulaInjection(rawName)) {
      errors.push("氏名に不正な文字列(数式の可能性)が含まれています");
    }

    const workDaysR = parseIntCount(cols[1] ?? "");
    const workMinutesR = parseHoursMinutes(cols[2] ?? "");
    const overtimeMinutesR = parseHoursMinutes(cols[3] ?? "");
    const nightMinutesR = parseHoursMinutes(cols[4] ?? "");
    const hourlyWageR = parseYenAmount(cols[5] ?? "");
    const baseSalaryR = parseYenAmount(cols[6] ?? "");
    const overtimeAllowanceR = parseYenAmount(cols[7] ?? "");
    const nightAllowanceR = parseYenAmount(cols[8] ?? "");
    const commuteAllowanceR = parseYenAmount(cols[9] ?? "");
    const otherAllowanceR = parseYenAmount(cols[10] ?? "");
    const totalAllowanceCsvR = parseYenAmount(cols[11] ?? "");

    for (const [label, r] of [
      ["出勤日数", workDaysR],
      ["労働時間", workMinutesR],
      ["残業時間", overtimeMinutesR],
      ["深夜労働時間", nightMinutesR],
      ["時給", hourlyWageR],
      ["基本給", baseSalaryR],
      ["残業手当", overtimeAllowanceR],
      ["深夜手当", nightAllowanceR],
      ["通勤手当", commuteAllowanceR],
      ["手当・その他", otherAllowanceR],
      ["合計", totalAllowanceCsvR],
    ] as const) {
      if (!r.ok) errors.push(`${label}: ${r.error}`);
    }

    const baseSalary = baseSalaryR.ok ? baseSalaryR.value : null;
    const overtimeAllowance = overtimeAllowanceR.ok ? overtimeAllowanceR.value : null;
    const nightAllowance = nightAllowanceR.ok ? nightAllowanceR.value : null;
    const commuteAllowance = commuteAllowanceR.ok ? commuteAllowanceR.value : null;
    const otherAllowance = otherAllowanceR.ok ? otherAllowanceR.value : null;
    const totalAllowanceCsv = totalAllowanceCsvR.ok ? totalAllowanceCsvR.value : null;

    let computedTotal: number | null = null;
    let amountMismatch = false;
    let amountMismatchDiff = 0;

    if (
      baseSalary !== null &&
      overtimeAllowance !== null &&
      nightAllowance !== null &&
      commuteAllowance !== null &&
      otherAllowance !== null
    ) {
      computedTotal =
        baseSalary + overtimeAllowance + nightAllowance + commuteAllowance + otherAllowance;
      if (totalAllowanceCsv !== null) {
        amountMismatchDiff = totalAllowanceCsv - computedTotal;
        amountMismatch = Math.abs(amountMismatchDiff) >= 1;
      }
    }

    return {
      rowNumber,
      rawName,
      normalizedName,
      workDays: workDaysR.ok ? workDaysR.value : null,
      workMinutes: workMinutesR.ok ? workMinutesR.value : null,
      overtimeMinutes: overtimeMinutesR.ok ? overtimeMinutesR.value : null,
      nightMinutes: nightMinutesR.ok ? nightMinutesR.value : null,
      hourlyWage: hourlyWageR.ok ? hourlyWageR.value : null,
      baseSalary,
      overtimeAllowance,
      nightAllowance,
      commuteAllowance,
      otherAllowance,
      totalAllowanceCsv,
      computedTotal,
      amountMismatch,
      amountMismatchDiff,
      errors,
      isDuplicateName: false,
    };
  });

  // 重複氏名検出(正規化した氏名で比較)
  const nameCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.normalizedName) continue;
    nameCounts.set(row.normalizedName, (nameCounts.get(row.normalizedName) ?? 0) + 1);
  }
  let duplicateNameCount = 0;
  for (const row of rows) {
    if (row.normalizedName && (nameCounts.get(row.normalizedName) ?? 0) > 1) {
      row.isDuplicateName = true;
    }
  }
  duplicateNameCount = [...nameCounts.values()].filter((c) => c > 1).length;

  const errorRowCount = rows.filter((r) => r.errors.length > 0).length;

  return {
    headerValid,
    headerErrors,
    headers,
    rows,
    totalRowCount: rows.length,
    errorRowCount,
    duplicateNameCount,
  };
}
