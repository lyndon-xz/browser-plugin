/*
 * src/ → dist/：只做一件事，把该交给 Chrome 的文件挑出来。
 * 不引 bundler、不转译——Chrome 会把被加载目录整棵树收进扩展，而它拒绝 `_` 开头的名字
 * （第三方包普遍自带 __tests__/__mocks__），所以测试与依赖必须留在产物之外。
 */
import { cpSync, existsSync, rmSync, watch } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(pluginRoot, "src");
const output = resolve(pluginRoot, "dist");

const isTestArtifact = (path) => {
  const name = path.split("/").at(-1);
  return name === "__tests__" || name.endsWith(".test.js");
};

function build() {
  // 先清空：源文件删掉后，产物里不该还留着它
  if (existsSync(output)) rmSync(output, { recursive: true });
  cpSync(source, output, { recursive: true, filter: (from) => !isTestArtifact(from) });
}

build();
console.log(`built ${source} → ${output}`);

if (process.argv.includes("--watch")) {
  let queued = null;
  watch(source, { recursive: true }, () => {
    // 一次保存会触发多个事件，收敛成一次构建
    clearTimeout(queued);
    queued = setTimeout(() => {
      build();
      console.log(`rebuilt ${new Date().toLocaleTimeString()}`);
    }, 80);
  });
  console.log("watching src/ — 改完在扩展页点「重新加载」即可");
}
