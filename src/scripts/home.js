// src/scripts/home.js —— 首页岛：活缩略图挂载 + 描述反查搜索。
import MiniSearch from "minisearch";
import { TERMS, DEMOS } from "@/generated/site-data.js";
import { lazyMountIframes, previewSrcdoc } from "./frame.js";

// ---------- 活 demo 卡片：进视口才挂 iframe（srcdoc = demoCode 本体，尊重减少动效偏好） ----------
lazyMountIframes(".wall iframe[data-demo]", (f) => previewSrcdoc(DEMOS[f.dataset.demo] ?? ""));

// ---------- 搜索反查 ----------
// MiniSearch 统一索引。分词：拉丁按词；CJK 产出「单字 + 二字组」。
// 查询侧 CJK 只用二字组（滤掉单字噪音），命中 gram 越多分越高：
//   "鼠标吸过去" → 鼠标/吸过/过去 三组，命中别名"鼠标靠近就被吸过去"全部 → 高分。
const isCJK = (ch) => ch >= "\u4e00" && ch <= "\u9fff";

function tokenizeDoc(text) {
  const toks = [];
  let latin = "", cjk = "";
  const flushLatin = () => { if (latin) { toks.push(latin); latin = ""; } };
  const flushCjk = () => {
    if (!cjk) return;
    for (let i = 0; i < cjk.length; i++) {
      toks.push(cjk[i]);
      if (i + 1 < cjk.length) toks.push(cjk.slice(i, i + 2));
    }
    cjk = "";
  };
  for (const ch of String(text).toLowerCase()) {
    if (isCJK(ch)) { flushLatin(); cjk += ch; }
    else if (/[a-z0-9-]/.test(ch)) { flushCjk(); latin += ch; }
    else { flushLatin(); flushCjk(); }
  }
  flushLatin(); flushCjk();
  return toks;
}

function queryTokens(text) {
  const all = tokenizeDoc(text);
  // 查询里的 CJK 只保留二字组（单字太噪）；若无二字组（单字查询）则保留单字兜底
  const bigrams = all.filter((t) => t.length === 2 && isCJK(t[0]));
  const latin = all.filter((t) => !isCJK(t[0]));
  const singleCJK = all.filter((t) => t.length === 1 && isCJK(t[0]));
  return [...latin, ...(bigrams.length ? bigrams : singleCJK)];
}

const ms = new MiniSearch({
  fields: ["nameZh", "nameEn", "aliases", "definition", "scenarios"],
  storeFields: ["id"],
  tokenize: tokenizeDoc,
});
ms.addAll(TERMS.map((t) => ({
  id: t.slug,
  nameZh: t.nameZh, nameEn: t.nameEn,
  aliases: t.aliases.join(" "),
  definition: t.definition,
  scenarios: t.scenarios.join(" "),
})));

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
  const query = q.value.trim();
  if (!query) { applyView(); return; }
  const scores = new Map();
  const tokens = queryTokens(query);
  // 逐 token OR 检索，按累计命中分排序（多命中别名/定义的词条自然靠前）
  for (const tk of tokens) {
    let hits = [];
    try { hits = ms.search(tk, { combineWith: "OR", prefix: true }); } catch { hits = []; }
    for (const h of hits) scores.set(h.id, (scores.get(h.id) ?? 0) + h.score);
  }
  // 子串兜底（整句口语描述，MiniSearch 切词漏网时用原串直接包含匹配）
  if (!scores.size) {
    const n = query.toLowerCase().replace(/\s+/g, "");
    for (const t of TERMS) {
      const hay = (t.nameZh + t.nameEn + t.aliases.join("") + t.definition + t.scenarios.join("")).toLowerCase().replace(/\s+/g, "");
      if (hay.includes(n)) scores.set(t.slug, 1);
    }
  }
  let shown = 0;
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const order = new Map(ranked.map((id, i) => [id, i]));
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
