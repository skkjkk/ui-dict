// src/scripts/frame.js —— 浏览器岛运行时：iframe 挂载 / srcdoc 写入 / 复制 / 动效偏好。
// 核心承诺：iframe.srcdoc === 复制出去的 demoCode === 下载的文件，三者逐字节同源。
// 分层：本文件只做 DOM 运行时；预览补丁注册表在 src/lib/previews.mjs（Node 侧也用）。
import { previewFixOf } from "@/lib/previews.mjs";

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

/**
 * 懒挂载 + 内存回收 + 错峰：进视口挂 srcdoc，离视口 3s 后卸载（写 about:blank 占位）。
 * 长列表滚动时，离开视口的活 demo 不再常驻内存，文档里几十个 iframe 只保留视野附近的。
 * 挂载走 requestAnimationFrame 队列，每帧至多一个——首屏滚一屏不会把几十个 iframe
 * 突发挂载挤进同一帧（审计观测到的 >400ms 长任务正是这个来源）。
 * 卸载/注入都是展示层的：demoCode 源串由 getHtml 随取随还，重新进视口即重挂，字节同源不受影响。
 */
export function lazyRecycleIframes(select, getHtml, { rootMargin = "200px", unloadDelay = 3000 } = {}) {
  const nodes = Array.from(document.querySelectorAll(select));
  if (!("IntersectionObserver" in window)) {
    nodes.forEach((f) => (f.srcdoc = getHtml(f)));
    return;
  }
  const timers = new WeakMap();
  const queue = [];
  let draining = false;
  const drain = () => {
    const f = queue.shift();
    if (!f) { draining = false; return; }
    if (f.isConnected && (!f.srcdoc || f.srcdoc === "about:blank")) f.srcdoc = getHtml(f);
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
// 卡片预览只留"组件本体"：demo 页的一切演示文字（标题/段落/步骤标签/参数读数/状态行）
// 在预览里全部隐藏，预览高度让给组件；操作按钮和触发器保留。
// 文字描述统一由词条详情页承担——demo 里这些文字是给"独立打开"的访客看的，删掉不合适，藏掉刚好。
// 另把 .page 的常规文档流改为竖直水平居中，让按钮/组件在预览窗里端端正正。
const PREVIEW_INJECT = [
  "<style>",
  "html,body{overflow:hidden!important}",
  // 文字说明全隐藏（标签+id+常见类名三层兜底）；.panel-inner p 是手风琴展开后的正文，豁免
  "h1,h2,p,code,.tip,.hint,.note,.desc,.step,.sub,.status,.readout,#readout,#log{display:none!important}",
  ".panel-inner p{display:block!important}",
  // 预览窗居中：压掉 demo 页自己的 padding，组件群竖直水平双居中
  "html,body{display:flex!important;align-items:center!important;justify-content:center!important}",
  "body>.page,body>main,body>.stage,body>.wrap,body>section{padding:0!important;margin:0!important;max-width:none!important}",
  "</style>",
].join("");
const MOTION_INJECT =
  "<style>*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}</style>";

function injectInto(html, style) {
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
  return prefersReduced() ? injectInto(html, MOTION_INJECT) : html;
}

/** 索引卡预览：隐藏演示说明文字、裁掉滚动，预览高度全给组件本体（文字描述在详情页）。 */
export function previewSrcdoc(html) {
  if (!html) return html;
  const fix = previewFixOf(html);
  const base = PREVIEW_INJECT + (fix ? `<style>${fix}</style>` : "");
  const cropped = injectInto(html, base);
  return prefersReduced() ? injectInto(cropped, MOTION_INJECT) : cropped;
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
