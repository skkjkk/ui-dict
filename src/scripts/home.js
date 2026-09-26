// src/scripts/home.js —— 首页岛：三态预览挂载 + 描述反查搜索（DOM 薄层）。
// 搜索切词/排序/兜底在 src/lib/search.mjs；iframe 挂载与内存回收在 frame.js；
// 预览三态注册表（live/hover/static）在 src/lib/previews.mjs。
import { TERMS } from "@/generated/site-data.js";
import { DEMO_URLS } from "@/generated/demo-urls.js";
import { createSearchIndex } from "@/lib/search.mjs";
import { lazyRecycleIframes, hoverMountIframes, previewSrcdoc } from "./frame.js";

// ---------- demo 拉取（三态共用一个缓存） ----------
// DEMO_URLS 是 /demos/<slug>.html 直链地址簿（demo 代码体已撤出 bundle）；
// 挂载时同源 fetch 取回 HTML 本体再交 previewSrcdoc 加工——路径字符串直接当 HTML
// 塞进 srcdoc 会渲染出一行路径文字（3b20e27 引入的回归）。
const demoCache = new Map(); // slug → Promise<html>：同一 demo 多卡/反复回收只拉一次
function fetchDemo(slug) {
  if (!demoCache.has(slug)) {
    const url = DEMO_URLS[slug];
    demoCache.set(slug, url ? fetch(url).then((r) => (r.ok ? r.text() : "")) : Promise.resolve(""));
  }
  return demoCache.get(slug);
}

// ---------- 三态预览：卡片 data-mode（index.astro 构建期写死）分流 ----------
//   live   视口常活 iframe（动效类：效果 = 一直在动）
//   hover  截图打底 + 悬停挂 iframe（交互类：效果要用户参与，截图拍的是激活态）
//   static 纯截图，零 iframe（布局/风格类：效果是一幅画）
// 挂载目标：.preview-slot（截图叠层容器）；iframe 由本模块创建——
//   构建期只产出截图 <img>，浏览器运行时按需造 <iframe> 塞进 slot，
//   每张卡的 DOM 开销在「未触发」时就是一张图。
const previewHtml = (f) => fetchDemo(f.dataset.demo).then(previewSrcdoc);

function mountLiveIframes() {
  // live：视口内常活（IntersectionObserver + 离场 3s 回收 + 每帧一挂错峰——全部在 frame.js）
  const liveFrames = [];
  for (const slot of document.querySelectorAll(".preview-slot")) {
    const card = slot.closest(".term-card");
    if (card?.dataset.mode !== "live") continue;
    const f = document.createElement("iframe");
    f.dataset.demo = slot.dataset.previewSlot;
    f.sandbox = "allow-scripts";
    f.scrolling = "no";
    f.title = "实时预览";
    slot.appendChild(f);
    liveFrames.push(f);
  }
  if (liveFrames.length) lazyRecycleIframes(".preview-slot iframe[data-demo]", previewHtml);
}

function mountHoverIframes() {
  // hover：截图打底，pointerenter 才挂 iframe、pointerleave 收回（frame.js hoverMountIframes）
  const hoverFrames = [];
  for (const slot of document.querySelectorAll(".preview-slot")) {
    const card = slot.closest(".term-card");
    if (card?.dataset.mode !== "hover") continue;
    const f = document.createElement("iframe");
    f.dataset.demo = slot.dataset.previewSlot;
    f.sandbox = "allow-scripts";
    f.scrolling = "no";
    f.title = "悬停激活实时预览";
    f.setAttribute("data-hover-mounted", "");
    slot.appendChild(f);
    hoverFrames.push(f);
  }
  if (hoverFrames.length) hoverMountIframes(".preview-slot iframe[data-hover-mounted]", previewHtml);
}

mountLiveIframes();
mountHoverIframes();

// ---------- 搜索反查（逻辑在 lib/search.mjs，这里只做 DOM 应用） ----------
const { search } = createSearchIndex(TERMS);

const q = document.getElementById("q");
const noResult = document.getElementById("no-result");
const cards = Array.from(document.querySelectorAll(".wall .term-card"));
const sections = Array.from(document.querySelectorAll(".cat-section"));

// ---------- 分类筛选：点左侧导航，只显示对应分类 ----------
let activeCat = "all";
const sideItems = Array.from(document.querySelectorAll("[data-cat-filter]"));
// ---------- v0.3 原生路径筛选：「0 JS 原生件」与分类互斥的单开关 ----------
let activeNp = "";
const npItems = Array.from(document.querySelectorAll("[data-np-filter]"));

sideItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    activeCat = btn.dataset.catFilter;
    activeNp = "";
    sideItems.forEach((b) => b.classList.toggle("active", b === btn));
    npItems.forEach((b) => b.classList.remove("active"));
    applyView();
  });
});
npItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    activeNp = activeNp === btn.dataset.npFilter ? "" : btn.dataset.npFilter;
    npItems.forEach((b) => b.classList.toggle("active", !!activeNp && b === btn));
    sideItems.forEach((b) => b.classList.toggle("active", !activeNp && b.dataset.catFilter === activeCat));
    if (!activeNp) activeCat = "all";
    applyView();
  });
});

// 统一视图：分类筛选 × 搜索结果 的交集
function applyView() {
  const query = q?.value.trim() ?? "";
  if (!query) {
    // 纯分类模式
    cards.forEach((c) => {
      const npOk = !activeNp || c.dataset.np === activeNp;
      c.style.display = npOk && (activeCat === "all" || c.dataset.cat === activeCat) ? "" : "none";
      c.style.order = "";
    });
    sections.forEach((sec) => {
      sec.style.display = activeCat === "all" || sec.dataset.cat === activeCat ? "" : "none";
    });
    noResult?.classList.add("hidden");
    return;
  }
  run(); // 搜索模式：run() 内部叠加分类条件
}

let timer = null;
q?.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(applyView, 120); });

function run() {
  const ranked = search(q.value);
  const order = new Map(ranked.map((id, i) => [id, i]));
  let shown = 0;
  for (const c of cards) {
    const hitCat = activeCat === "all" || c.dataset.cat === activeCat;
    const hitNp = !activeNp || c.dataset.np === activeNp;
    const hit = hitCat && hitNp && order.has(c.dataset.slug);
    c.style.display = hit ? "" : "none";
    if (hit) { c.style.order = String(100 + order.get(c.dataset.slug)); shown++; }
  }
  // 分节布局：某节全部卡片被隐藏时，连节标题一起收起，避免空节
  sections.forEach((sec) => {
    const any = [...sec.querySelectorAll(".term-card")].some((c) => c.style.display !== "none");
    sec.style.display = any ? "" : "none";
  });
  noResult.classList.toggle("hidden", shown > 0);
}
