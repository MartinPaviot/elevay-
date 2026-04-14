import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // @vitejs/plugin-react handles .tsx transforms — next's tsconfig
  // has `jsx: preserve`, which vite's default esbuild can't parse.
  plugins: [react()],
  test: {
    // Default environment stays node for speed. Tests that need a DOM
    // (hooks, components) opt in with a `@vitest-environment happy-dom`
    // comment on the first line.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: true,
    coverage: {
      provider: "v8",
      include: ["src/app/api/**/*.ts", "src/lib/**/*.ts", "src/hooks/**/*.ts", "src/components/**/*.tsx"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.d.ts"],
      reporter: ["text", "text-summary"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
