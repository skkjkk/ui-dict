// src/scripts/entry.js —— 详情页岛：srcdoc 挂载 + 滑杆（代码/prompt 实时同步）+ 复制。
import { DEMOS, TERMS } from "@/generated/site-data.js";
import { setParams } from "@/lib/params.mjs";
import { assemblePrompt, termMarkdown } from "@/lib/prompt.mjs";
import { copyText, openStandalone, motionAwareSrcdoc } from "./frame.js";

// slug 直接取自 URL（/term/<slug>/），不依赖 body 上的属性
const slug = (location.pathname.match(/\/term\/([^/]+)/) || [])[1];
if (!slug) throw new Error("entry.js: URL 非 /term/<slug>/ 格式");
const t = TERMS.find((x) => x.slug === slug);
if (!t) throw new Error(`entry.js: 未找到词条 ${slug}`);

const base = DEMOS[slug];
const live = document.getElementById("live");
const codeEl = document.getElementById("code");
const promptEl = document.getElementById("prompt");
const sliders = Array.from(document.querySelectorAll("[data-param]"));
const outputs = new Map(sliders.map((s) => [s.dataset.param, document.querySelector(`[data-out="${s.dataset.param}"]`)]));

const overrides = () =>
  Object.fromEntries(sliders.map((s) => [s.dataset.param, Number(s.value)]));

let currentHtml = base;
function refresh() {
  const ov = overrides();
  for (const [k, el] of outputs) if (el) el.textContent = String(ov[k]);
  currentHtml = setParams(base, ov);
  live.srcdoc = motionAwareSrcdoc(currentHtml);             // 渲染层尊重“减少动效”
  codeEl.textContent = currentHtml;                         // 展示 = 复制 = 下载，三态同源（原始源码）
  promptEl.textContent = assemblePrompt(t, ov);             // prompt 随参数实时重拼装
}
live.srcdoc = motionAwareSrcdoc(base);
codeEl.textContent = base;
if (sliders.length) sliders.forEach((s) => s.addEventListener("input", refresh));
document.querySelector("[data-replay]")?.addEventListener("click", refresh);
// 页脚“减少动效”切换时，重挂 live demo 以即时生效
addEventListener("ui-dict:motion", refresh);

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
