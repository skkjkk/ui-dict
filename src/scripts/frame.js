// src/scripts/frame.js —— 浏览器岛运行时：iframe 挂载 / srcdoc 写入 / 复制 / 动效偏好。
// 核心承诺：iframe.srcdoc === 复制出去的 demoCode === 下载的文件，三者逐字节同源。
// 分层：本文件只做 DOM 运行时；预览补丁注册表在 src/lib/previews.mjs（Node 侧也用），
// 预览 HTML 组装在 src/lib/preview-html.mjs（截图管线与 iframe 预览共用一份补丁）。
import { buildPreviewHtml, MOTION_INJECT } from "@/lib/preview-html.mjs";

/** 懒挂载：元素进视口才写 srcdoc，省掉首屏几十个 iframe 的开销。 */
export function lazyMountIframes(select, getHtml) {
  const nodes = Array.from(document.querySelectorAll(select));
  if (!("IntersectionObserver" in window)) {
    nodes.forEach((f) => (f.srcdoc = getHtml(f)));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const f = e.target;
      if (!f.srcdoc) f.srcdoc = getHtml(f);
      io.unobserve(f);
    }
  }, { rootMargin: "200px" });
  nodes.forEach((f) => io.observe(f));
}

// ---------- 通用挂载内核（live 视口挂载与 hover 挂载共用） ----------
// 职责：fetch demo → 组装预览 HTML → 写入 iframe。网络/缓存与「何时挂」解耦：
// · live（lazyRecycleIframes）：IntersectionObserver 裁决进出场，进场挂、离场 3s 回收；
// · hover（hoverMountIframes）：pointerenter 挂、pointerleave 回收——交互触发类词条
//   的效果要用户参与，不该为「扫一眼列表」付出 iframe 常驻成本。
// 两者的 getHtml 都走 demoCache（home.js 注入），同一 demo 反复挂载只拉取一次。

/** 悬停挂载：静态截图打底的卡片，pointerenter 才挂真身 iframe，离场即收。
 *  与 lazyRecycle 相比：无 IntersectionObserver 需求、无错峰队列（悬停是用户主动、
 *  天然低频且分散），pointerleave 立即回收（无需 3s 缓冲——用户已明确离开）。
 *  async 竞态防护同 lazyRecycle：决议时 frame 仍需要内容才写。 */
export function hoverMountIframes(select, getHtml) {
  const nodes = Array.from(document.querySelectorAll(select));
  const timers = new WeakMap();
  const apply = (f, html) => {
    if (!f.isConnected) return;
    if (f.srcdoc && f.srcdoc !== "about:blank") return;
    f.srcdoc = html;
  };
  for (const f of nodes) {
    f.addEventListener("pointerenter", () => {
      clearTimeout(timers.get(f));
      if (!f.srcdoc || f.srcdoc === "about:blank") {
        const html = getHtml(f);
        html instanceof Promise ? html.then((h) => apply(f, h)) : (f.srcdoc = html);
      }
    });
    f.addEventListener("pointerleave", () => {
      if (f.srcdoc) timers.set(f, setTimeout(() => { f.srcdoc = "about:blank"; }, 800));
    });
  }
}

/**
 * 懒挂载 + 内存回收 + 错峰：进视口挂 srcdoc，离视口 3s 后卸载（写 about:blank 占位）。
 * 长列表滚动时，离开视口的活 demo 不再常驻内存，文档里几十个 iframe 只保留视野附近的。
 * 挂载走 requestAnimationFrame 队列，每帧至多一个——首屏滚一屏不会把几十个 iframe
 * 突发挂载挤进同一帧（审计观测到的 >400ms 长任务正是这个来源）。
 * getHtml 允许返回 Promise（demo 代码体撤出 bundle 后，首页按直链异步取回 HTML）；
 * Promise 决议时若 frame 已离场/被卸载（srcdoc 已被置 about:blank 或已脱节点）则丢弃，
 * 重新进场会由 IntersectionObserver 再次入队。竞态防护：只有"仍需要内容"时才写入。
 * 卸载/注入都是展示层的：demoCode 源串由 getHtml 随取随还，重新进视口即重挂，字节同源不受影响。
 */
export function lazyRecycleIframes(select, getHtml, { rootMargin = "200px", unloadDelay = 3000 } = {}) {
  const nodes = Array.from(document.querySelectorAll(select));
  const apply = (f, html) => {
    // 异步到达时状态可能已变：只有仍在场、且当前占位为空/卸载态时才写
    if (!f.isConnected) return;
    if (f.srcdoc && f.srcdoc !== "about:blank") return;
    f.srcdoc = html;
  };
  if (!("IntersectionObserver" in window)) {
    nodes.forEach((f) => {
      const html = getHtml(f);
      html instanceof Promise ? html.then((h) => apply(f, h)) : (f.srcdoc = html);
    });
    return;
  }
  const timers = new WeakMap();
  const queue = [];
  let draining = false;
  const drain = () => {
    const f = queue.shift();
    if (!f) { draining = false; return; }
    if (f.isConnected && (!f.srcdoc || f.srcdoc === "about:blank")) {
      const html = getHtml(f);
      html instanceof Promise ? html.then((h) => apply(f, h)) : (f.srcdoc = html);
    }
    requestAnimationFrame(drain);
  };
  const enqueue = (f) => {
    if (!queue.includes(f)) queue.push(f);
    if (!draining) { draining = true; requestAnimationFrame(drain); }
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const f = e.target;
      if (e.isIntersecting) {
        clearTimeout(timers.get(f));
        timers.delete(f);
        if (!f.srcdoc || f.srcdoc === "about:blank") enqueue(f);
      } else if (f.srcdoc) {
        clearTimeout(timers.get(f));
        timers.set(f, setTimeout(() => { f.srcdoc = "about:blank"; }, unloadDelay));
      }
    }
  }, { rootMargin });
  nodes.forEach((f) => io.observe(f));

  // 兜底扫描：content-visibility:auto 的分节在「跳过→激活」转变时，IO 可能拿不到
  // 回调（瞬时跳转/键盘 End/锚点直达都会踩：跳过分节里的元素没有盒子，IO 报 rect=0）。
  // 滚动后 rAF 合并地扫一遍"还没挂 srcdoc 的 iframe"，落在视口+rootMargin 内就补挂——
  // 信号冗余换确定性，IO 依然是卸载回收的唯一裁判。
  let sweep = false;
  const inRange = (f) => {
    const r = f.getBoundingClientRect();
    const m = parseInt(rootMargin, 10) || 0;
    return r.top < innerHeight + m && r.bottom > -m && r.width > 0;
  };
  const sweepMissed = () => {
    sweep = false;
    for (const f of nodes) {
      if (!f.isConnected || f.srcdoc) continue;
      if (inRange(f)) enqueue(f);
    }
  };
  addEventListener("scroll", () => {
    if (!sweep) { sweep = true; requestAnimationFrame(sweepMissed); }
  }, { passive: true });
}

/** srcdoc 写入去重：同串不重写（重写 = iframe 整树重建 = 白白丢一次滚动/状态）。 */
export function setSrcdocOnce(frame, html) {
  if (frame && frame.srcdoc !== html) frame.srcdoc = html;
}

/** 复制到剪贴板 + 按钮瞬时反馈。 */
export function copyText(btn, text) {
  const done = () => {
    const old = btn.textContent;
    btn.textContent = "✓ 已复制";
    btn.disabled = true;
    setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 1200);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallback(text, done));
  } else fallback(text, done);
}

function fallback(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); done(); } catch { /* ignore */ }
  document.body.removeChild(ta);
}

/** 独立页打开 = 与「粘进空白文件双击」严格等价（Blob URL）。 */
export function openStandalone(html) {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---------- 全站"减少动效"偏好（README 版式蓝图第 5 段承诺） ----------
// 两层生效：① 外壳 html.reduce-motion 类（卡片过渡等）；② 注入进 iframe srcdoc 的覆盖样式，
// 让 demo 内部动画也静止。注入只作用于"渲染时"的字符串，复制/下载仍拿原始 demoCode——
// 覆盖的是纯展示层，不改变 demo 行为逻辑，a11y 优先于极端逐字节洁癖。
const MOTION_KEY = "uidict:reduce-motion";

function injectIntoLocal(html, style) {
  return html.includes("</head>") ? html.replace("</head>", style + "</head>") : style + html;
}

export function prefersReduced() {
  try {
    if (localStorage.getItem(MOTION_KEY) === "1") return true;
  } catch { /* 隐私模式忽略 */ }
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 详情页 Live Demo：完整可滚（尊重减少动效偏好）。 */
export function liveSrcdoc(html) {
  if (!html) return html;
  return prefersReduced() ? injectIntoLocal(html, MOTION_INJECT) : html;
}

/** 索引卡预览：隐藏演示说明文字、裁掉滚动，预览高度全给组件本体（文字描述在详情页）。
 *  组装逻辑抽到 preview-html.mjs 与截图管线共享；此处叠加运行时 reduce-motion 偏好。 */
export function previewSrcdoc(html) {
  if (!html) return html;
  const cropped = buildPreviewHtml(html);
  return prefersReduced() ? injectIntoLocal(cropped, MOTION_INJECT) : cropped;
}

/** 切换偏好：写 localStorage + 挂/摘外壳类 + 广播，供各页重挂 iframe。 */
export function toggleReducedMotion() {
  const next = !prefersReduced();
  try { localStorage.setItem(MOTION_KEY, next ? "1" : "0"); } catch { /* ignore */ }
  document.documentElement.classList.toggle("reduce-motion", next);
  window.dispatchEvent(new CustomEvent("ui-dict:motion", { detail: { reduced: next } }));
  return next;
}

/** 早期同步应用外壳类（在首帧前调用，避免闪烁）。 */
export function initMotionClass() {
  document.documentElement.classList.toggle("reduce-motion", prefersReduced());
}
