import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    pool: "forks",
    // SQLite en un solo archivo (./data/test.db): archivos en serie para que
    // no se pisen entre sí (writes concurrentes = SQLITE_BUSY y el beforeAll
    // de ledger.test.ts hace deletes globales).
    fileParallelism: false,
    testTimeout: 30000,
    // Los *.component.test.tsx usan `// @vitest-environment jsdom` en la
    // primera línea; el resto sigue en node. (environmentMatchGlobs no existe
    // en vitest 5: el entorno por globs se define vía projects/workspaces.)
    setupFiles: ["./tests/setup.ts"],
    env: {
      DATABASE_URL: "file:./data/test.db",
      ADMIN_PASSWORD: "test-password-12345",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.test.{ts,tsx}", "**/node_modules/**"],
      // Ratchet inicial (2026-10): líneas ~54%. Solo rige con --coverage.
      thresholds: {
        lines: 55,
        statements: 55,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
    },
  },
});
