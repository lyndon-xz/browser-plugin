import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // 就近共置：每个功能域在域根有一个 __tests__（src/* 各域、scripts 也是一个域）
    include: ["src/**/__tests__/**/*.test.js", "scripts/__tests__/**/*.test.js"],
  },
});
