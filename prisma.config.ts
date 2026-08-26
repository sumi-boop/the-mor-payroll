import path from "node:path";
import "dotenv/config";
import { defineConfig } from "@prisma/config";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";

export default defineConfig({
  experimental: {
    adapter: true,
  },
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  engine: "js",
  adapter: async () => {
    return new PrismaBetterSQLite3({
      url: process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./prisma/dev.db",
    });
  },
});
