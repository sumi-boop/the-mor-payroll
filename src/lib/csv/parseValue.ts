/**
 * CSV由来の値を安全に解釈するためのユーティリティ群。
 * - 金額: 整数円のみ許可(カンマ区切り可)。数式インジェクション対策として
 *   先頭が =, +, -, @, タブ, CR の場合は「数式の可能性がある文字列」として拒否する。
 * - 時間: "時:分" 形式 (例 146:57) を分単位の整数へ変換。
 */

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

/** 数式インジェクションの可能性がある文字列かどうかを判定する */
export function looksLikeFormulaInjection(raw: string): boolean {
  return FORMULA_PREFIX_RE.test(raw.trim());
}

/**
 * 表計算ソフトで数式として解釈されないよう先頭に ' を付与する。
 * (このアプリ自体はCSVを再出力しないが、将来のエクスポート機能や
 *  値をそのまま外部へコピーする場面に備えた防御的処理として用意する)
 */
export function sanitizeForSpreadsheet(raw: string): string {
  if (looksLikeFormulaInjection(raw)) {
    return `'${raw}`;
  }
  return raw;
}

/** 整数円の金額としてパースする。カンマ・空白は許容。 */
export function parseYenAmount(raw: string): ParseResult<number> {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") {
    return { ok: false, error: "金額が空です" };
  }
  if (looksLikeFormulaInjection(trimmed)) {
    return { ok: false, error: "不正な文字列(数式の可能性)が含まれています" };
  }
  const cleaned = trimmed.replace(/,/g, "");
  if (!/^-?\d+$/.test(cleaned)) {
    return { ok: false, error: `金額として解釈できません: "${raw}"` };
  }
  const value = Number.parseInt(cleaned, 10);
  if (!Number.isSafeInteger(value)) {
    return { ok: false, error: `金額の範囲が不正です: "${raw}"` };
  }
  return { ok: true, value };
}

/** 整数(日数など)としてパースする。 */
export function parseIntCount(raw: string): ParseResult<number> {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") {
    return { ok: false, error: "数値が空です" };
  }
  if (looksLikeFormulaInjection(trimmed)) {
    return { ok: false, error: "不正な文字列(数式の可能性)が含まれています" };
  }
  if (!/^-?\d+$/.test(trimmed)) {
    return { ok: false, error: `数値として解釈できません: "${raw}"` };
  }
  return { ok: true, value: Number.parseInt(trimmed, 10) };
}

/** "時:分" 形式 (例: 146:57, 6:03) を分単位の整数に変換する。 */
export function parseHoursMinutes(raw: string): ParseResult<number> {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") {
    return { ok: false, error: "時間が空です" };
  }
  if (looksLikeFormulaInjection(trimmed)) {
    return { ok: false, error: "不正な文字列(数式の可能性)が含まれています" };
  }
  const match = /^(-?\d+):([0-5]?\d)$/.exec(trimmed);
  if (!match) {
    return {
      ok: false,
      error: `時間の形式が不正です(「時:分」形式で入力してください): "${raw}"`,
    };
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const sign = hours < 0 ? -1 : 1;
  return { ok: true, value: sign * (Math.abs(hours) * 60 + minutes) };
}

/** 分単位の整数を "時:分" 表記へ戻す(画面表示用) */
export function formatMinutesAsHM(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? "-" : "";
  const abs = Math.abs(totalMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${String(m).padStart(2, "0")}`;
}
