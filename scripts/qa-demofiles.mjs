// scripts/qa-demofiles.mjs
// 出厂自检（静态部分）：
//  1. 单文件铁律：demo.html 禁止外部 http(s) 引用、禁止 import/require、禁止 node_modules 依赖
//  2. 必须含 <!DOCTYPE html>（POC 实测 template 剥离会落 quirks mode，这里直接卡源文件）
//  3. 若 entry.json 声明了 params，demo 必须含合法 /* ui-dict:params */ 块且键一一对应
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getParams } from "../src/lib/params.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TERMS = path.join(ROOT, "terms");

const FORBIDDEN = [
  { re: /<link[^>]+href=["']https?:/i, why: "外链 CSS（应零网络请求）" },
  { re: /<script[^>]+src=["']https?:/i, why: "外链 JS 库（应零依赖）" },
  { re: /@import\s+url\((['"]?)https?:/i, why: "CSS @import 外链字体/样式" },
  { re: /\bfetch\s*\(\s*["']https?:/i, why: "运行时网络请求" },
  { re: /\bimport\s+.*from\s+["'](?!data:)/i, why: "ESM import（demo 须自包含）" },
];

const WARNINGS = [];
const ERRORS = [];

async function dirs(p) {
  try {
    return (await fs.readdir(p, { withFileTypes: true })).filter((d) => d.isDirectory());
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

    if (!/^<!doctype html>/i.test(demo.trimStart()))
      ERRORS.push(`${tag}: demo.html 缺少 <!DOCTYPE html>（会落 quirks mode）`);
    for (const f of FORBIDDEN) {
      if (f.re.test(demo)) ERRORS.push(`${tag}: 违反单文件铁律 —— ${f.why}`);
    }
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
