// src/scripts/entry.js —— 详情页岛：srcdoc 挂载 + 滑杆（代码/prompt 实时同步）+ 复制。
import { DEMOS, TERMS } from "@/generated/site-data.js";
import { setParams } from "@/lib/params.mjs";
import { assemblePrompt } from "@/lib/prompt.mjs";
import { copyText, openStandalone } from "./frame.js";

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
  live.srcdoc = currentHtml;
  codeEl.textContent = currentHtml;                       // 展示 = 复制 = 渲染，三态同源
  promptEl.textContent = assemblePrompt(t, ov);           // prompt 随参数实时重拼装
}
live.srcdoc = base;
codeEl.textContent = base;
if (sliders.length) sliders.forEach((s) => s.addEventListener("input", refresh));
document.querySelector("[data-replay]")?.addEventListener("click", refresh);

// ---------- 复制 / 独立页 ----------
document.querySelector('[data-copy="prompt"]')?.addEventListener("click", function () {
  copyText(this, assemblePrompt(t, overrides()));
});
document.querySelector('[data-copy="code"]')?.addEventListener("click", function () {
  copyText(this, currentHtml);
});
document.querySelector('[data-copy="card"]')?.addEventListener("click", function () {
  copyText(this, buildCard());
});
document.querySelector("[data-open-demo]")?.addEventListener("click", () => openStandalone(currentHtml));

function buildCard() {
  const L = [];
  L.push(`# ${t.no} · ${t.nameZh} ${t.nameEn}`);
  if (t.aliases.length) L.push(`\n别名：${t.aliases.join(" / ")}`);
  L.push(`\n## 定义\n${t.definition}`);
  if (t.anatomy.length) L.push(`\n## 解剖\n${t.anatomy.map((a) => `- **${a.part}**${a.note ? ` — ${a.note}` : ""}`).join("\n")}`);
  if (t.whenNotToUse.length) L.push(`\n## 何时不要用\n${t.whenNotToUse.map((s) => `- ${s}`).join("\n")}`);
  L.push(`\n## Prompt\n\`\`\`text\n${assemblePrompt(t, overrides())}\n\`\`\``);
  L.push(`\n## 实现（零依赖单文件）\n\`\`\`html\n${currentHtml}\n\`\`\``);
  if (t.pitfalls.length) L.push(`\n## 坑\n${t.pitfalls.map((s) => `- ${s}`).join("\n")}`);
  if (t.scenarios.length) L.push(`\n## 适用场景\n${t.scenarios.map((s) => `- ${s}`).join("\n")}`);
  if (t.refs.length) L.push(`\n## 规范出处\n${t.refs.map((s) => `- ${s}`).join("\n")}`);
  if (t.verifiedWith) L.push(`\n> prompt 验证：${t.verifiedWith} · 代码 MIT`);
  return L.join("\n");
}
