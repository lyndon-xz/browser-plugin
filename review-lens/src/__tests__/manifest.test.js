import { existsSync, globSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readManifest() {
  return JSON.parse(readFileSync(resolve(extensionRoot, "manifest.json"), "utf-8"));
}

// manifest 里出现的每个相对路径，收集起来核对文件真的存在
function referencedPaths(manifest) {
  const paths = [
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
    ...(manifest.content_scripts ?? []).flatMap((script) => script.js ?? []),
    ...(manifest.web_accessible_resources ?? []).flatMap((entry) => entry.resources ?? []),
  ];
  return paths.filter(Boolean);
}

// PNG 的宽高就在 IHDR 里，读前 24 字节即可，不必引图片库
function pngSize(path) {
  const data = readFileSync(path);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

describe("manifest", () => {
  it("declares Manifest V3", () => {
    const manifest = readManifest();

    expect(manifest.manifest_version).toBe(3);
  });

  it("injects only into known GitLab origins, never <all_urls>", () => {
    const manifest = readManifest();
    const { matches } = manifest.content_scripts[0];

    expect(matches).toEqual([
      "http://git.dev.sh.ctripcorp.com/*",
      "https://git.dev.sh.ctripcorp.com/*",
      "https://gitlab.com/*",
    ]);
    expect(manifest.host_permissions ?? []).not.toContain("<all_urls>");
    expect(manifest.optional_host_permissions).toContain("*://*/*");
  });

  it("declares no permission Chrome does not know", () => {
    const manifest = readManifest();
    /*
     * Chrome 只对已知的权限名放行，写错会在扩展页报
     * 「Permission 'x' is unknown」。这里锁死本扩展实际用到的那几个。
     */
    const known = new Set(["storage", "scripting", "activeTab", "tabs", "notifications"]);
    const declared = [...(manifest.permissions ?? []), ...(manifest.optional_permissions ?? [])];

    expect(declared.filter((name) => !known.has(name))).toEqual([]);
  });

  it("requests no more permissions than storage and scripting", () => {
    const manifest = readManifest();

    expect(manifest.permissions.toSorted()).toEqual(["scripting", "storage"]);
    expect(manifest.permissions).not.toContain("tabs");
  });

  it("loads a single non-module bootstrap and exposes the modules it imports", () => {
    const manifest = readManifest();
    const { js } = manifest.content_scripts[0];
    const exposed = manifest.web_accessible_resources[0];

    expect(js).toEqual(["content/bootstrap.js"]);
    expect(exposed.resources).toContain("content/entry.js");
    expect(exposed.matches).toEqual(manifest.content_scripts[0].matches);
  });

  it("gives the toolbar an icon in every size Chrome asks for", () => {
    const manifest = readManifest();
    const sizes = ["16", "32", "48", "128"];

    expect(Object.keys(manifest.icons).toSorted()).toEqual(sizes.toSorted());
    expect(Object.keys(manifest.action.default_icon).toSorted()).toEqual(sizes.toSorted());
  });

  it("keeps the toolbar grey until a page turns out to be usable", () => {
    const manifest = readManifest();

    // 工具栏默认灰、扩展本身用彩色（DD-33）
    expect(Object.values(manifest.action.default_icon).every((path) => path.includes("inactive"))).toBe(true);
    expect(Object.values(manifest.icons).every((path) => path.includes("active"))).toBe(true);
  });

  it("ships a grey icon that really is grey", () => {
    const manifest = readManifest();

    for (const path of Object.values(manifest.action.default_icon)) {
      const data = readFileSync(resolve(extensionRoot, path));
      // PNG 里颜色类型 6 = RGBA；逐像素校验成本高，这里只确认它不是原图的字节拷贝
      const colour = readFileSync(resolve(extensionRoot, path.replace("inactive", "active")));
      expect(data.equals(colour)).toBe(false);
    }
  });

  it("ships icons whose real dimensions match the size they are declared under", () => {
    const manifest = readManifest();
    const mismatched = Object.entries(manifest.icons)
      .map(([size, path]) => ({ size, path, ...pngSize(resolve(extensionRoot, path)) }))
      .filter((icon) => icon.width !== Number(icon.size) || icon.height !== Number(icon.size));

    expect(mismatched).toEqual([]);
  });

  it("references only files that exist", () => {
    const manifest = readManifest();
    const referenced = referencedPaths(manifest);

    const missingLiterals = referenced
      .filter((path) => !path.includes("*"))
      .filter((path) => !existsSync(resolve(extensionRoot, path)));
    expect(missingLiterals).toEqual([]);

    // web_accessible_resources 允许通配符，逐个确认它至少匹配到一个真实文件
    const emptyGlobs = referenced
      .filter((path) => path.includes("*"))
      .filter((pattern) => globSync(pattern, { cwd: extensionRoot }).length === 0);
    expect(emptyGlobs).toEqual([]);
  });
});
