import { execFileSync } from "node:child_process";
import { existsSync, globSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dist = resolve(pluginRoot, "dist");

const build = () => execFileSync("node", ["scripts/build.js"], { cwd: pluginRoot });

const inDist = (pattern) => globSync(pattern, { cwd: dist });

function manifestPaths() {
  const manifest = JSON.parse(readFileSync(resolve(dist, "manifest.json"), "utf-8"));
  return [
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    ...Object.values(manifest.icons ?? {}),
    ...(manifest.content_scripts ?? []).flatMap((script) => script.js ?? []),
    ...(manifest.web_accessible_resources ?? []).flatMap((entry) => entry.resources ?? []),
  ].filter(Boolean);
}

describe("build", () => {
  beforeAll(() => {
    build();
  });

  it("produces a folder Chrome will accept", () => {
    // Chrome：Filenames starting with "_" are reserved for use by the system
    expect(inDist("**/_*")).toEqual([]);
  });

  it("leaves tests and fixtures out of the extension", () => {
    expect(inDist("**/*.test.js")).toEqual([]);
    expect(inDist("**/fixtures/**")).toEqual([]);
  });

  it("ships every file the manifest points at", () => {
    const missing = manifestPaths()
      .filter((path) => !path.includes("*"))
      .filter((path) => !existsSync(resolve(dist, path)));
    const emptyGlobs = manifestPaths()
      .filter((path) => path.includes("*"))
      .filter((pattern) => inDist(pattern).length === 0);

    expect(missing).toEqual([]);
    expect(emptyGlobs).toEqual([]);
  });

  it("starts from a clean slate, so deleted sources do not linger", () => {
    const stale = resolve(dist, "stale-from-previous-build.js");
    writeFileSync(stale, "// left over");

    build();

    expect(existsSync(stale)).toBe(false);
  });
});
