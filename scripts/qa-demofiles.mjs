// scripts/qa-demofiles.mjs
// 出厂自检（静态部分）——「同一道闸」闸住所有入库词条：
//  1. 单文件铁律：demo.html 禁止外部 http(s) 引用、禁止 import/require、禁止 node_modules 依赖
//  2. 必须含 <!DOCTYPE html>（POC 实测 template 剥离会落 quirks mode，这里直接卡源文件）
//  3. 若 entry.json 声明了 params，demo 必须含合法 /* ui-dict:params */ 块且键一一对应
//  4. 身份一致性：entry.id == 目录名；category == 所在分类目录；no 前缀 == 分类
//     （AI 批量产词条最常见的三类"目录约定"错误在这里全部拦下）
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getParams } from "../src/lib/params.mjs";
import { gateHtml } from "../src/lib/html-gate.mjs";
import { NO_PREFIX } from "../src/lib/types.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TERMS = path.join(ROOT, "terms");

const WARNINGS = [];
const ERRORS = [];

async function dirs(p) {
  try {
    return (await fs.readdir(p, { withFileTypes: true })).filter((d) => d.isDirectory() && d.name !== "_template");
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

let total = 0;
for (const cat of await dirs(TERMS)) {
  for (const id of await dirs(path.join(TERMS, cat.name))) {
    const dir = path.join(TERMS, cat.name, id.name);
    const tag = `${cat.name}/${id.name}`;
    total++;

    let entry;
    try {
      entry = JSON.parse(await fs.readFile(path.join(dir, "entry.json"), "utf8"));
    } catch (e) {
      ERRORS.push(`${tag}: entry.json 缺失或 JSON 非法 — ${e.message}`);
      continue;
    }
    if (!entry.id) ERRORS.push(`${tag}: entry.json 缺少 id`);
    else if (entry.id !== id.name) ERRORS.push(`${tag}: entry.id(${entry.id}) 与目录名(${id.name}) 不一致`);
    if (!entry.category) ERRORS.push(`${tag}: entry.json 缺少 category`);
    else if (entry.category !== cat.name)
      ERRORS.push(`${tag}: category(${entry.category}) 与所在目录(${cat.name}) 不一致`);
    if (typeof entry.no === "string" && NO_PREFIX[cat.name] && !entry.no.startsWith(NO_PREFIX[cat.name] + "-"))
      ERRORS.push(`${tag}: 编号(${entry.no}) 前缀与分类(${cat.name} → ${NO_PREFIX[cat.name]}-xx) 不一致`);

    // 草稿检测：new-term 骨架未填就提交时给出显眼提醒（不阻断，内容判断仍归人工审校）
    if (entry.nameZh === "词条中文名" || entry.reviewer === "TODO-审校人" ||
        (Array.isArray(entry.contributors) && entry.contributors.some((c) => c.reviewer === "TODO-审校人")))
      WARNINGS.push(`${tag}: 疑似未填的 new-term 骨架（nameZh/审校人还是占位符），发布前请完成内容与审校`);

    let demo;
    try {
      demo = await fs.readFile(path.join(dir, "demo.html"), "utf8");
    } catch {
      ERRORS.push(`${tag}: 缺少 demo.html`);
      continue;
    }

    // 单文件铁律 + DOCTYPE 检查统一走共享闸（src/lib/html-gate.mjs，与回放测试同一把尺子）
    for (const err of gateHtml(demo).errors) ERRORS.push(`${tag}: ${err}`);
    const declared = Array.isArray(entry.params) ? entry.params : [];
    const blockParams = declared.length > 0 ? getParams(demo) : null;
    if (declared.length > 0 && !blockParams)
      ERRORS.push(`${tag}: entry 声明了 params，但 demo.html 缺少合法 /* ui-dict:params */ 块`);
    if (blockParams) {
      for (const p of declared) {
        if (!(p.key in blockParams))
          ERRORS.push(`${tag}: params 声明 ${p.key}，但 demo 参数块缺该键`);
      }
    }
    if (/prefers-reduced-motion/.test(demo) === false && /animation|requestAnimationFrame/.test(demo)) {
      WARNINGS.push(`${tag}: 有动效但未提供 prefers-reduced-motion 降级`);
    }
  }
}

console.log(`QA · 扫描 ${total} 条词条`);
if (WARNINGS.length) {
  console.log("\n⚠ 警告：");
  for (const w of WARNINGS) console.log("  - " + w);
}
if (ERRORS.length) {
  console.error("\n✗ 错误（阻断构建）：");
  for (const e of ERRORS) console.error("  - " + e);
  process.exit(1);
}
console.log("✓ 静态自检通过");
