// src/scripts/frame.js —— 浏览器端共用的 iframe / 参数逻辑（纯 DOM，无框架）。
// 核心承诺：iframe.srcdoc === 复制出去的 demoCode === 下载的文件，三者逐字节同源。
import { setParams } from "@/lib/params.mjs";

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

/** 把参数块当前值改写进 demo，返回新 HTML（用于实时重渲染 + 代码块同步）。 */
export function demoWithParams(baseHtml, params, overrides) {
  return setParams(baseHtml, pick(params, overrides));
}

function pick(declared, overrides) {
  const out = {};
  for (const p of declared) if (p.key in overrides) out[p.key] = overrides[p.key];
  return out;
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

// ---------- 全站“减少动效”偏好（README 版式蓝图第 5 段承诺） ----------
// 两层生效：① 外壳 html.reduce-motion 类（卡片过渡等）；② 注入进 iframe srcdoc 的覆盖样式，
// 让 demo 内部动画也静止。注入只作用于“渲染时”的字符串，复制/下载仍拿原始 demoCode——
// 覆盖的是纯展示层，不改变 demo 行为逻辑，a11y 优先于极端逐字节洁癖。
const MOTION_KEY = "uidic…tion";
const INJECT =
  "<style>*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}</style>";

export function prefersReduced() {
  try {
    if (localStorage.getItem(MOTION_KEY) === "1") return true;
  } catch { /* 隐私模式忽略 */ }
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 按当前偏好，把 demoCode 变成“可渲染”字符串（需要时注入静止样式）。 */
export function motionAwareSrcdoc(html) {
  if (!html || !prefersReduced()) return html;
  return html.includes("</head>") ? html.replace("</head>", INJECT + "</head>") : INJECT + html;
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
