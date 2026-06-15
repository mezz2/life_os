import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests target the pure logic in src/lib/* (no DB, no React). Path alias
// mirrors tsconfig so test files can import via "@/...".
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
