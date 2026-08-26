import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/shims/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    testTimeout: 30000,
    hookTimeout: 90000,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
