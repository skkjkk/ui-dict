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

// 逐词条的预览修正 CSS：键 = <title> 里的词条号（C-01…），值 = 只在卡片预览生效的补丁样式。
// 只藏/摆"演示脚手架"，不碰 demo 的交互逻辑——独立打开/复制代码依旧是完整 demo。
const PREVIEW_FIXES = {
  // C-05 抽屉：压暗主内容区的教学文案（.card）属说明文字，预览里隐藏
  "C-05": ".card{display:none!important}",
  // C-07 手风琴：demo 脚本本来就默认展开第一条、可点折叠（setExpanded(item, i===0)）。
  // 这里只藏演示工具条（单开模式开关 + 联系支持链接），展开/折叠交还 demo 自己的逻辑——
  // 之前注入 grid-template-rows:1fr!important 把 0fr↔1fr 切换压死导致无法折叠，已撤
  "C-07": [
    ".bar{display:none!important}",
    ".acc{min-width:360px!important}",
  ].join(""),
  // C-08 气泡卡片：demo 为三段翻转教学布了三个锚点（常规/右缘/页脚）+ 46vh 滚动垫。
  // 预览里只留第一个锚点居中——"一个锚点 + 点开的浮层"就是 Popover 的完整语义
  "C-08": [
    ".edge-row,.spacer,.bottom-row{display:none!important}",
  ].join(""),
  // C-09 分段控件：预览里固定中等宽（272px，与轨道原生比例一致）并居中；
  // 面板 min-height 取三视图里最高的网格视图，三个选项切换时大小不变
  "C-09": [
    ".seg{width:272px!important;max-width:none!important}",
    ".panel{width:272px!important;max-width:none!important;min-height:150px!important}",
  ].join(""),
  // C-11 上下文菜单：数据行已在 demo 源里补足，预览不再撑高，保持自然高度
  "C-11": "",
};

// 从 demo <title>（形如 "… · ui-dict C-07"）里取词条号；取不到返回空串
function entryIdOf(html) {
  const m = html.match(/<title>[^<]*·\s*ui-dict\s*([A-Z]-\d+)/);
  return m ? m[1] : "";
}

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
  const id = entryIdOf(html);
  const fix = (id && PREVIEW_FIXES[id]) || "";
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
