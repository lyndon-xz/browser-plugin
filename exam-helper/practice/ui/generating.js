/** 组卷 loading 遮罩 */

let overlay = null;

function ensureOverlay() {
  if (overlay?.isConnected) {
    return overlay;
  }
  overlay = document.createElement("div");
  overlay.id = "gen-overlay";
  overlay.className = "gen-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="gen-card">
      <div class="gen-spinner" aria-hidden="true"></div>
      <p class="gen-title">正在 AI 组卷…</p>
      <p class="gen-desc" id="gen-desc">DeepSeek 根据手册规约推理出题</p>
      <div class="gen-track"><div class="gen-fill" id="gen-fill"></div></div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

export function showGenerating(show) {
  const el = ensureOverlay();
  el.hidden = !show;
  document.body.classList.toggle("is-generating", show);
}

export function updateGeneratingProgress(done, total) {
  ensureOverlay();
  const desc = document.getElementById("gen-desc");
  const fill = document.getElementById("gen-fill");
  const safeTotal = Math.max(1, total);
  const pct = Math.min(100, Math.round((done / safeTotal) * 100));
  if (desc) {
    desc.textContent = `已生成 ${Math.min(done, total)} / ${total} 题`;
  }
  if (fill) {
    fill.style.width = `${pct}%`;
  }
}

export function updateGeneratingStatus(message) {
  ensureOverlay();
  const title = overlay?.querySelector(".gen-title");
  const desc = document.getElementById("gen-desc");
  if (title && message) {
    title.textContent = message;
  }
  if (desc && message) {
    desc.textContent = "优先抽取尚未考过的手册片段";
  }
}

export function resetGeneratingStatus() {
  ensureOverlay();
  const title = overlay?.querySelector(".gen-title");
  if (title) {
    title.textContent = "正在 AI 组卷…";
  }
}
