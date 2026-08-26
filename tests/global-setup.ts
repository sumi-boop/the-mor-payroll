/**
 * vitest globalSetup: テスト専用のSQLiteデータベース(prisma/test.db)を
 * 毎回まっさらな状態から作り直し、スキーマを反映する。
 * 開発用DB(prisma/dev.db)には一切触れない。
 */
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const testDbPath = path.join(process.cwd(), "prisma", "test.db");

export default async function setup() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const p = testDbPath + suffix;
    if (fs.existsSync(p)) fs.rmSync(p);
  }

  execSync("npx prisma db push --accept-data-loss --skip-generate", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
    stdio: "inherit",
    timeout: 90000,
  });
}
