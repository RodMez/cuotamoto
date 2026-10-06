import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    pool: "forks",
    testTimeout: 30000,
    env: {
      DATABASE_URL: "file:./data/test.db",
      ADMIN_PASSWORD: "test-password-12345",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
