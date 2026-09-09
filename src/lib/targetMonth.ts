// 対象年月をアプリ全体(月別控除設定・給与計算確認・振込先一覧)で共有するための
// 共通ロジック。クライアントコンポーネントからも読み込めるよう、
// このファイルには "next/headers" など サーバー専用のAPIを含めない。
// Cookieを読む側(サーバー専用)は targetMonth.server.ts に分けている。

export const TARGET_MONTH_COOKIE = "mor_target_month";

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 選んだ対象年月をCookieに記憶する(クライアント側専用)。
 * 例えば月別控除設定で2026-08を選んだ後に給与計算確認画面を開くと、
 * このCookieのおかげで同じ2026-08が初期表示される。
 * これにより「画面ごとに対象年月がズレていて、確認したはずの項目が
 * 未確認のままに見える」という事故を防ぐ。
 */
export function rememberTargetMonth(month: string) {
  if (typeof document === "undefined") return;
  const maxAgeSeconds = 60 * 60 * 24 * 180; // 180日
  document.cookie = `${TARGET_MONTH_COOKIE}=${month}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}
