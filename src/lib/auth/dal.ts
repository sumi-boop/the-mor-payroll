import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionFromCookies, type SessionPayload } from "./session";

/**
 * セッションを検証する。未ログインの場合は /login へリダイレクトする。
 * React の cache() で1回のレンダリング内でのCookie読み取りを重複させない。
 */
export const verifySession = cache(async (): Promise<SessionPayload> => {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login");
  }
  return session;
});

/**
 * リダイレクトせずにセッションの有無だけを確認する(APIルート等で利用)
 */
export const getOptionalSession = cache(async (): Promise<SessionPayload | null> => {
  return getSessionFromCookies();
});
