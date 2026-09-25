// scripts/qa-one.mjs
// 单条/指定词条出厂自检 —— 与 qa-demofiles.mjs 同一把尺子（同一 gateHtml + 同一 params 契约），
// 区别只在于「只扫指定 slug」。用途：并行写手在同一工作区各写各的词条时，
// 不必跑全量扫描（会看到别人半成品的报错），只需验自己这几条。
//
//   node scripts/qa-one.mjs popover segmented-control
//
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getParams } from "../src/lib/params.mjs";
import { gateHtml } from "../src/lib/html-gate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TERMS = path.join(ROOT, "terms");

const slugs = process.argv.slice(2).filter((a) => !a.startsWith("-"));
if (slugs.length === 0) {
  console.error("用法：node scripts/qa-one.mjs <slug> [slug...]");
  process.exit(2);
}

const ERRORS = [];
const WARNINGS = [];
let found = 0;

for (const cat of await fs.readdir(TERMS, { withFileTypes: true })) {
  if (!cat.isDirectory()) continue;
  for (const id of await fs.readdir(path.join(TERMS, cat.name), { withFileTypes: true })) {
    if (!id.isDirectory() || !slugs.includes(id.name)) continue;
    found++;
    const dir = path.join(TERMS, cat.name, id.name);
    const tag = `${cat.name}/${id.name}`;

    let entry;
    try {
      entry = JSON.parse(await fs.readFile(path.join(dir, "entry.json"), "utf8"));
    } catch (e) {
      ERRORS.push(`${tag}: entry.json 缺失或 JSON 非法 — ${e.message}`);
      continue;
    }
    if (!entry.id) ERRORS.push(`${tag}: entry.json 缺少 id`);
    else if (entry.id !== id.name) ERRORS.push(`${tag}: entry.id(${entry.id}) 与目录名不一致`);
    if (!entry.category) ERRORS.push(`${tag}: entry.json 缺少 category`);
    else if (entry.category !== cat.name)
      ERRORS.push(`${tag}: category(${entry.category}) 与所在目录(${cat.name}) 不一致`);

    let demo;
    try {
      demo = await fs.readFile(path.join(dir, "demo.html"), "utf8");
    } catch {
      ERRORS.push(`${tag}: 缺少 demo.html`);
      continue;
    }

    for (const err of gateHtml(demo).errors) ERRORS.push(`${tag}: ${err}`);

    const declared = Array.isArray(entry.params) ? entry.params : [];
    const blockParams = declared.length > 0 ? getParams(demo) : null;
    if (declared.length > 0 && !blockParams)
      ERRORS.push(`${tag}: entry 声明了 params，但 demo.html 缺少合法 /* ui-dict:params */ 块`);
    if (blockParams) {
      for (const p of declared) {
        if (!(p.key in blockParams)) ERRORS.push(`${tag}: params 声明 ${p.key}，但 demo 参数块缺该键`);
      }
      for (const k of Object.keys(blockParams)) {
        if (!declared.some((p) => p.key === k))
          WARNINGS.push(`${tag}: demo 参数块多出未声明的键 ${k}（滑杆将无法调整它）`);
      }
    }
    if (/prefers-reduced-motion/.test(demo) === false && /animation|requestAnimationFrame/.test(demo)) {
      WARNINGS.push(`${tag}: 有动效但未提供 prefers-reduced-motion 降级`);
    }
  }
}

console.log(`QA-one · 命中 ${found}/${slugs.length} 条：${slugs.join(", ")}`);
if (found !== slugs.length) ERRORS.push(`有 ${slugs.length - found} 个 slug 在 terms/ 下找不到目录`);
if (WARNINGS.length) {
  console.log("\n⚠ 警告：");
  for (const w of WARNINGS) console.log("  - " + w);
}
if (ERRORS.length) {
  console.error("\n✗ 错误：");
  for (const e of ERRORS) console.error("  - " + e);
  process.exit(1);
}
console.log("✓ 指定词条静态自检通过（schema 校验仍需 pnpm gen 走 zod 闸）");