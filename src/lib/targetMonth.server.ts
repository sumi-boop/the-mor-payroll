import { cookies } from "next/headers";
import { TARGET_MONTH_COOKIE, currentMonth } from "./targetMonth";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

/**
 * 対象年月の解決ルール(優先順):
 * 1. URLに ?month= が指定されていればそれを使う
 * 2. なければ、直前にどこかの画面で選んだ月をCookieから使う
 * 3. どちらも無ければ、今日の年月を使う
 *
 * ページ(サーバーコンポーネント)からのみ呼び出すこと。
 * クライアントコンポーネントで対象年月を変更したときは、
 * targetMonth.ts の rememberTargetMonth() でCookieを更新する。
 */
export async function resolveTargetMonth(explicitMonth?: string): Promise<string> {
  if (explicitMonth) return explicitMonth;
  const store = await cookies();
  const cookieMonth = store.get(TARGET_MONTH_COOKIE)?.value;
  if (cookieMonth && MONTH_PATTERN.test(cookieMonth)) {
    return cookieMonth;
  }
  return currentMonth();
}
