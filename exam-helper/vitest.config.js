import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 默认 node 环境；需要 DOM 的用例在文件顶部用
    // @vitest-environment jsdom 注释切换
    environment: "node",
    include: ["__tests__/**/*.test.js"],
  },
});
