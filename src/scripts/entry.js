// src/scripts/entry.js —— 详情页岛：srcdoc 挂载 + 滑杆（代码/prompt 实时同步）+ 复制。
// 数据来源：SSR 内联进本页——demo 源码在 #code（textContent 即逐字节源码），
// 词条元数据在 #term-data（JSON 岛）。岛内零网络请求、零全量词库携带。
import { setParams } from "@/lib/params.mjs";
import { assemblePrompt, termMarkdown } from "@/lib/prompt.mjs";
import { copyText, openStandalone, liveSrcdoc, setSrcdocOnce } from "./frame.js";

// slug 直接取自 URL（/term/<slug>/），不依赖 body 上的属性
const slug = (location.pathname.match(/\/term\/([^/]+)/) || [])[1];
if (!slug) throw new Error("entry.js: URL 非 /term/<slug>/ 格式");
const dataEl = document.getElementById("term-data");
if (!dataEl) throw new Error("entry.js: 页面缺少 #term-data JSON 岛");
const t = JSON.parse(dataEl.textContent);
if (t.slug !== slug) throw new Error(`entry.js: 数据岛词条(${t.slug}) 与 URL(${slug}) 不一致`);

const live = document.getElementById("live");
const codeEl = document.getElementById("code");
const promptEl = document.getElementById("prompt");
const sliders = Array.from(document.querySelectorAll("[data-param]"));
const outputs = new Map(sliders.map((s) => [s.dataset.param, document.querySelector(`[data-out="${s.dataset.param}"]`)]));

// SSR 内联的源码即 base（浏览器解析实体后 textContent 返回原始字符串，逐字节同源）
const base = codeEl.textContent;

const overrides = () =>
  Object.fromEntries(sliders.map((s) => [s.dataset.param, Number(s.value)]));

// 参数缓存：值没变就不重算 setParams / 不重写 srcdoc（replay 与 motion 事件直达这里）
let lastOv = overrides();
let currentHtml = base;

function apply(ov) {
  for (const [k, el] of outputs) if (el) el.textContent = String(ov[k]);
  currentHtml = setParams(base, ov);
  setSrcdocOnce(live, liveSrcdoc(currentHtml));  // 渲染层尊重“减少动效”；同串不重写
  codeEl.textContent = currentHtml;              // 展示 = 复制 = 下载，三态同源（原始源码）
  promptEl.textContent = assemblePrompt(t, ov);  // prompt 随参数实时重拼装
}

// 滑杆 rAF 节流：高频 input 事件合并到每帧一次，参数没变直接跳过（低延迟不空转）
let raf = 0;
function onSliderInput() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    const ov = overrides();
    const changed = Object.keys(ov).some((k) => ov[k] !== lastOv[k]);
    if (!changed) return;
    lastOv = ov;
    apply(ov);
  });
}
sliders.forEach((s) => s.addEventListener("input", onSliderInput));

live.srcdoc = liveSrcdoc(base);
document.querySelector("[data-replay]")?.addEventListener("click", () => {
  lastOv = overrides();
  apply(lastOv); // 手动重播强制刷新（绕过缓存跳过）
});
// 页脚“减少动效”切换时，重挂 live demo 以即时生效
addEventListener("ui-dict:motion", () => apply(lastOv));

// ---------- 代码块展开全码 ----------
// 默认由右列（参数 + 固定 420px 内滚代码块）定义行高，左列预览面板拉伸到同高（纯 CSS 网格 stretch）。
// 点「展开全码」后右列变成上万像素，左列若继续跟随会被撑成巨幕——此时切 .code-expanded：
// 左列改为 sticky 固定高度，滚动查看代码时预览停在视口里。
const codeScroll = document.querySelector(".code-scroll");
const codeToggle = document.querySelector("[data-code-toggle]");
const liveGrid = document.querySelector(".live-grid");
codeToggle?.addEventListener("click", () => {
  const expanded = codeScroll.classList.toggle("expanded");
  liveGrid?.classList.toggle("code-expanded", expanded);
  codeToggle.textContent = expanded ? "收起代码 ↑" : "展开全码 ↓";
  codeToggle.setAttribute("aria-expanded", String(expanded));
});

// ---------- 复制 / 独立页 ----------
document.querySelector('[data-copy="prompt"]')?.addEventListener("click", function () {
  copyText(this, assemblePrompt(t, overrides()));
});
document.querySelector('[data-copy="code"]')?.addEventListener("click", function () {
  copyText(this, currentHtml);
});
document.querySelector('[data-copy="card"]')?.addEventListener("click", function () {
  copyText(this, termMarkdown(t, { overrides: overrides(), demoHtml: currentHtml }));
});
document.querySelector("[data-open-demo]")?.addEventListener("click", () => openStandalone(currentHtml));
