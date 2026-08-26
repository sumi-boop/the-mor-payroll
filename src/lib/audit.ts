import "server-only";
import { prisma } from "./db";

/**
 * 監査ログを記録する。
 * 個人情報(住所・給与金額など)は detail に含めないこと。
 */
export async function recordAuditLog(params: {
  userId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
  ipAddress?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      detail: params.detail,
      ipAddress: params.ipAddress ?? undefined,
    },
  });
}
