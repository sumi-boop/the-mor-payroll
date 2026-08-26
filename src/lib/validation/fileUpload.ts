export const MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = [".csv"];
const ALLOWED_MIME_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/csv",
  "text/plain",
  "text/x-csv",
  "application/x-csv",
  "text/comma-separated-values",
  "", // 一部ブラウザ/OSはCSVに空のMIMEタイプを付与する
];

export function validateCsvFile(file: {
  name: string;
  size: number;
  type: string;
}): { ok: true } | { ok: false; error: string } {
  const lowerName = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return { ok: false, error: "拡張子が .csv のファイルを選択してください" };
  }
  if (file.size <= 0) {
    return { ok: false, error: "ファイルが空です" };
  }
  if (file.size > MAX_CSV_SIZE_BYTES) {
    return {
      ok: false,
      error: `ファイルサイズが上限(${Math.floor(MAX_CSV_SIZE_BYTES / 1024 / 1024)}MB)を超えています`,
    };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: `対応していないファイル形式です(${file.type})` };
  }
  return { ok: true };
}
