import "server-only";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";

// Resolve the sqlite file path from DATABASE_URL (file:./prisma/dev.db 形式)
function resolveDbUrl(): string {
  const raw = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const withoutScheme = raw.replace(/^file:/, "");
  if (path.isAbsolute(withoutScheme)) return withoutScheme;
  return path.join(/* turbopackIgnore: true */ process.cwd(), withoutScheme);
}

declare global {
  var __prisma: PrismaClient | undefined;
}

function createClient() {
  const adapter = new PrismaBetterSQLite3({ url: resolveDbUrl() });
  return new PrismaClient({ adapter });
}

export const prisma = globalThis.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
