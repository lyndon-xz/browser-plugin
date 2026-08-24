import { describe, expect, it } from "vitest";

import { resolveAttachment, splitAttachments } from "../attachment.js";

const site = { origin: "https://git.example.com", projectPath: "group/sub/service" };

describe("splitAttachments", () => {
  it("keeps a body without images as a single piece of text", () => {
    expect(splitAttachments("超时配置 180s，太长了", site)).toEqual([
      { kind: "text", text: "超时配置 180s，太长了" },
    ]);
  });

  it("splits the image out of the surrounding words, in reading order", () => {
    const pieces = splitAttachments("![image](/uploads/abc123/image.png) 改成这种", site);

    expect(pieces).toEqual([
      { kind: "image", alt: "image", url: "https://git.example.com/group/sub/service/uploads/abc123/image.png" },
      { kind: "text", text: " 改成这种" },
    ]);
  });

  it("handles several images in one body", () => {
    const pieces = splitAttachments("前 ![a](/uploads/1/a.png) 中 ![b](/uploads/2/b.png) 后", site);

    expect(pieces.map((piece) => piece.kind)).toEqual(["text", "image", "text", "image", "text"]);
    expect(pieces.at(-1)).toEqual({ kind: "text", text: " 后" });
  });

  /*
   * 留着原文而不是丢掉：读者至少还能看到那里本来有一张图，以及它指向哪里。
   */
  it("leaves an image it will not load as the Markdown it was written as", () => {
    const written = "![tracker](https://elsewhere.example/pixel.png)";

    expect(splitAttachments(written, site)).toEqual([{ kind: "text", text: written }]);
  });

  it("needs no site information to still return the body", () => {
    const written = "![image](/uploads/abc123/image.png)";

    expect(splitAttachments(written, null)).toEqual([{ kind: "text", text: written }]);
  });
});

describe("resolveAttachment", () => {
  it("puts the project path back in front of an upload GitLab wrote relative", () => {
    // note body 里存的是 /uploads/<hash>/<file>，真实地址在项目路径下
    expect(resolveAttachment("/uploads/abc123/image.png", site)).toBe(
      "https://git.example.com/group/sub/service/uploads/abc123/image.png",
    );
  });

  it("accepts an absolute address that is already on the host itself", () => {
    const url = "https://git.example.com/group/sub/service/uploads/abc123/image.png";

    expect(resolveAttachment(url, site)).toBe(url);
  });

  it("refuses anything that would fetch from somewhere else", () => {
    expect(resolveAttachment("https://elsewhere.example/pixel.png", site)).toBe(null);
    expect(resolveAttachment("//elsewhere.example/pixel.png", site)).toBe(null);
  });

  it("refuses schemes that are not a picture at all", () => {
    expect(resolveAttachment("javascript:alert(1)", site)).toBe(null);
    expect(resolveAttachment("data:image/svg+xml,<svg onload=alert(1)>", site)).toBe(null);
  });

  it("refuses a relative path that is not an upload", () => {
    // 只放行 GitLab 的附件目录，其余相对路径不猜
    expect(resolveAttachment("/group/service/-/raw/master/secret.png", site)).toBe(null);
  });
});
