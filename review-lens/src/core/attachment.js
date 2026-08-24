/*
 * 评审里「改成这种」常常就是一张贴的截图，正文里只留一行 `![image](/uploads/…/image.png)`。
 * 逐字显示这行 Markdown 等于这条回复没有内容，所以要把附件切出来单独渲染（DD-44）。
 *
 * 只放行宿主自己的 /uploads/ 附件：正文是别人可写的内容，自动去取外站资源会把
 * 「谁在什么时候读了这条评论」发给第三方。不放行的照原样留成文本，读者仍看得到它指向哪里。
 */

const IMAGE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

const UPLOAD_PATH = /^\/uploads\//;

export function resolveAttachment(url, site) {
  if (!site?.origin || !site.projectPath) return null;

  // GitLab 在 note body 里写的是项目相对路径，可取的地址在项目路径下
  if (UPLOAD_PATH.test(url)) return `${site.origin}/${site.projectPath}${url}`;

  const prefix = `${site.origin}/`;
  return url.startsWith(prefix) ? url : null;
}

export function splitAttachments(body, site) {
  const text = String(body ?? "");
  const pieces = [];
  let cursor = 0;

  for (const match of text.matchAll(IMAGE)) {
    const [written, alt, url] = match;
    const resolved = resolveAttachment(url, site);
    if (!resolved) continue;

    if (match.index > cursor) pieces.push({ kind: "text", text: text.slice(cursor, match.index) });
    pieces.push({ kind: "image", alt, url: resolved });
    cursor = match.index + written.length;
  }

  if (cursor < text.length || !pieces.length) pieces.push({ kind: "text", text: text.slice(cursor) });
  return pieces;
}
