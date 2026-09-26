// src/scripts/home.js —— 首页岛：活缩略图挂载 + 描述反查搜索（DOM 薄层）。
// 搜索切词/排序/兜底在 src/lib/search.mjs；iframe 挂载与内存回收在 frame.js。
import { TERMS } from "@/generated/site-data.js";
import { DEMO_URLS } from "@/generated/demo-urls.js";
import { createSearchIndex } from "@/lib/search.mjs";
import { lazyRecycleIframes, previewSrcdoc } from "./frame.js";

// ---------- 活 demo 卡片：进视口挂 iframe，离视口 3s 卸载（内存回收） ----------
lazyRecycleIframes(".wall iframe[data-demo]", (f) => previewSrcdoc(DEMO_URLS[f.dataset.demo] ?? ""));

// ---------- 搜索反查（逻辑在 lib/search.mjs，这里只做 DOM 应用） ----------
const { search } = createSearchIndex(TERMS);

const q = document.getElementById("q");
const noResult = document.getElementById("no-result");
const cards = Array.from(document.querySelectorAll(".wall .term-card"));
const sections = Array.from(document.querySelectorAll(".cat-section"));

// ---------- 分类筛选：点左侧导航，只显示对应分类 ----------
let activeCat = "all";
const sideItems = Array.from(document.querySelectorAll("[data-cat-filter]"));

sideItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    activeCat = btn.dataset.catFilter;
    sideItems.forEach((b) => b.classList.toggle("active", b === btn));
    applyView();
  });
});

// 统一视图：分类筛选 × 搜索结果 的交集
function applyView() {
  const query = q?.value.trim() ?? "";
  if (!query) {
    // 纯分类模式
    cards.forEach((c) => {
      c.style.display = activeCat === "all" || c.dataset.cat === activeCat ? "" : "none";
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
    const hit = hitCat && order.has(c.dataset.slug);
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
