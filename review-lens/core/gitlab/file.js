function splitLines(text) {
  const lines = text.split(/\r?\n/);
  // 文件通常以换行结尾，split 会多出一个空串，它不是真实的一行
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

/**
 * 取某个 sha 下的文件，直接给出按行切好的数组。
 * 用 sha 而不是分支名：读评审要的是「评论那一刻」与「当前 head」这两个确定版本。
 */
export async function loadFile(client, fileRef) {
  const { project, path, sha } = fileRef;

  const encoded = encodeURIComponent(path);
  const text = await client.getText(
    `/projects/${project}/repository/files/${encoded}/raw?ref=${sha}`,
  );
  return splitLines(text);
}
