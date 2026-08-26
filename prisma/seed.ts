/**
 * 初期管理者ユーザーを作成するシードスクリプト。
 * 実行: npm run db:seed
 *
 * 環境変数 ADMIN_LOGIN_ID / ADMIN_PASSWORD が指定されていればそれを使用し、
 * 指定がなければ既定値(admin / ChangeMe123!)を使用する。
 * 本番運用前に必ずパスワードを変更すること。
 */
import "dotenv/config";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

function resolveDbUrl(): string {
  const raw = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const withoutScheme = raw.replace(/^file:/, "");
  if (path.isAbsolute(withoutScheme)) return withoutScheme;
  return path.join(process.cwd(), withoutScheme);
}

async function main() {
  const adapter = new PrismaBetterSQLite3({ url: resolveDbUrl() });
  const prisma = new PrismaClient({ adapter });

  const loginId = process.env.ADMIN_LOGIN_ID ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const name = process.env.ADMIN_NAME ?? "管理者";

  const existing = await prisma.user.findUnique({ where: { loginId } });
  if (existing) {
    console.log(`ユーザー "${loginId}" は既に存在します。スキップします。`);
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      loginId,
      name,
      passwordHash,
      role: "admin",
    },
  });

  console.log("========================================");
  console.log("初期管理者ユーザーを作成しました。");
  console.log(`  ログインID: ${loginId}`);
  console.log(`  パスワード: ${password}`);
  console.log("  ログイン後、必ずパスワードを変更してください。");
  console.log("========================================");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
