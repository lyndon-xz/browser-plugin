/** 覆盖进度的展示文案，两种组卷来源各一份措辞 */

function formatCoverageLabel(input) {
  const { usedCount, total, subject, unit } = input;
  if (!total) {
    return "";
  }
  const pct = Math.round((usedCount / total) * 100);
  return `${subject}已覆盖 ${usedCount}/${total} ${unit}（${pct}%）`;
}

export function formatChunkCoverageLabel(stats) {
  const { usedCount, total } = stats;
  return formatCoverageLabel({ usedCount, total, subject: "手册", unit: "条" });
}

export function formatBankCoverageLabel(stats) {
  const { usedCount, total } = stats;
  return formatCoverageLabel({ usedCount, total, subject: "题库", unit: "题" });
}
