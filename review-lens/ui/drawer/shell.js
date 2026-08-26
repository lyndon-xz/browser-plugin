/*
 * 抽屉外壳：宿主节点与 Shadow DOM、关闭的两种触发（Esc 与点外部）、宽度拖拽、锁宿主页滚动。
 * 这一层只管「抽屉这个容器」的生命周期，不认识评论、代码与卡片。
 */

// 自定义标签名当宿主节点，既好定位又不会撞上 GitLab 自己的类名
const HOST_TAG = "review-lens-drawer";

// 宽度交给用户拖，上下限防止拖到过窄或盖满整页
const MIN_WIDTH = 420;
const MAX_WIDTH = 1400;

/** onDismiss 是「用户想关掉它」，真正的清理由 close() 做，两者不互相调用 */
export function createShell(request) {
  const { styleText, onDismiss } = request;

  let host = null;
  let root = null;
  let hostOverflow = null;
  // 拖拽进行中被关掉（Esc、点外部）时也要解绑，否则监听会继续给已分离的节点写样式并写存储
  let releaseDrag = null;

  function onKeydown(event) {
    if (event.key === "Escape") onDismiss();
  }

  /*
   * 点抽屉以外的位置关闭。用 mousedown 而不是 click：宿主页上不少控件会在 mousedown
   * 阶段就改动 DOM，等到 click 时事件目标可能已不在文档里，判不出内外。
   */
  function onPointerDown(event) {
    if (host && !event.composedPath().includes(host)) onDismiss();
  }

  function mount() {
    host = document.createElement(HOST_TAG);
    root = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = styleText;
    root.append(style);

    document.body.append(host);
    document.addEventListener("keydown", onKeydown);
    document.addEventListener("mousedown", onPointerDown);

    /*
     * 锁住宿主页滚动，原值记在 body 的 data 上而不是闭包里：同时存在两个实例时，
     * 第二个读到的「原值」会是前一个设的 hidden，它一关就把 hidden 写回去，页面滚不动。
     */
    const already = document.body.dataset.reviewLensOverflow;
    hostOverflow = already ?? document.body.style.overflow;
    if (already === undefined)
      document.body.dataset.reviewLensOverflow = hostOverflow;
    document.body.style.overflow = "hidden";
  }

  /*
   * 左边缘拖拽把手。用 document 上的 mousemove/mouseup 而不是把手自身的，
   * 否则指针一旦移出把手就断掉；松手才回调 onCommit，免得拖动过程中反复写存储。
   */
  function attachGrip(panel, options) {
    const { width, onResize, onCommit } = options;

    const gripEl = document.createElement("div");
    gripEl.className = "drawer-grip";
    gripEl.title = "拖动调整宽度";

    gripEl.addEventListener("mousedown", (event) => {
      const startX = event.clientX;
      let current = width;

      const onMove = (move) => {
        // 往左拖变宽：抽屉贴在右边缘
        const next = width + (startX - move.clientX);
        current = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next));
        panel.style.width = `${current}px`;
        onResize(current);
      };
      const stop = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        releaseDrag = null;
      };
      const onUp = () => {
        stop();
        onCommit(current);
      };

      releaseDrag = stop;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      event.preventDefault();
    });

    panel.append(gripEl);
  }

  // 只重建内容，样式节点留着，避免每次渲染重新解析 CSS
  function clearContent() {
    for (const node of [...root.children]) {
      if (node.tagName !== "STYLE") node.remove();
    }
  }

  function close() {
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("mousedown", onPointerDown);
    releaseDrag?.();
    if (hostOverflow !== null) {
      document.body.style.overflow = hostOverflow;
      delete document.body.dataset.reviewLensOverflow;
      hostOverflow = null;
    }
    host?.remove();
    host = null;
    root = null;
  }

  return {
    get root() {
      return root;
    },
    isMounted: () => Boolean(host),
    mount,
    attachGrip,
    clearContent,
    close,
  };
}
