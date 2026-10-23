/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@components": fileURLToPath(
        new URL("./src/components", import.meta.url),
      ),
      "@/lib": fileURLToPath(new URL("./src/lib", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov"],
      include: [
        "src/config/**/*.ts",
        "src/lib/**/*.ts",
        "src/domain/**/*.ts",
        "src/services/**/*.ts",
        "src/features/**/*.ts",
      ],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/index.ts",
        "src/**/*.interface.ts",
        "src/**/*.types.ts",
        "src/features/**/types/**/*.ts",
        "src/**/*.query.ts",
        "src/**/*.mutation.ts",
        "src/**/*.mutations.ts",
        "src/**/mock/**",
      ],
    },
  },
});
