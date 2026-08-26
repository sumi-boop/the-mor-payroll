/**
 * 氏名の正規化ユーティリティ
 * 前後の空白・全角空白と、氏名中の連続する空白(全角/半角混在)を正規化して
 * 表記ゆれによる不一致を減らす。
 */
export function normalizeName(raw: string): string {
  if (!raw) return "";
  return raw
    .normalize("NFKC") // 全角英数・記号を半角へ寄せる(氏名の漢字/かなは影響を受けない)
    .replace(/[　\s]+/g, " ") // 全角スペースを含む連続空白を単一の半角スペースへ
    .trim();
}

export function namesMatch(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}
