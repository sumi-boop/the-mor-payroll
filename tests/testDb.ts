import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";

const testDbPath = path.join(process.cwd(), "prisma", "test.db");

const adapter = new PrismaBetterSQLite3({ url: testDbPath });
export const testPrisma = new PrismaClient({ adapter });

/** 各テスト間でテーブルを空にする(外部キー制約を考慮した削除順) */
export async function resetDb() {
  await testPrisma.payrollSnapshot.deleteMany();
  await testPrisma.payrollRecord.deleteMany();
  await testPrisma.monthlyDeduction.deleteMany();
  await testPrisma.payrollImport.deleteMany();
  await testPrisma.auditLog.deleteMany();
  await testPrisma.employee.deleteMany();
  await testPrisma.user.deleteMany();
}
