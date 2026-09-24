// scripts/sync-demofiles.mjs
// 构建前同步：把 terms/<category>/<id>/demo.html 逐字节读入 src/generated/demos.json。
// 目的：demoCode 永不经过 HTML/JSX 解析器（POC 实测 <template> 会静默剥离 DOCTYPE/html/body），
// 从而保证「看到的 demo」「复制的代码」「下载的文件」三者严格同源。
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TERMS = path.join(ROOT, "terms");
const OUT = path.join(ROOT, "src", "generated");

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
  }
  return out;
}

const demos = {};
let count = 0;
try {
  for (const cat of await fs.readdir(TERMS, { withFileTypes: true })) {
    if (!cat.isDirectory()) continue;
    for (const id of await fs.readdir(path.join(TERMS, cat.name), { withFileTypes: true })) {
      if (!id.isDirectory()) continue;
      const file = path.join(TERMS, cat.name, id.name, "demo.html");
      try {
        demos[id.name] = await fs.readFile(file, "utf8");
        count++;
      } catch {
        console.warn(`  ⚠ ${cat.name}/${id.name} 缺少 demo.html，跳过`);
      }
    }
  }
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  console.warn("  (terms/ 目录尚未创建，生成空索引)");
}

await fs.mkdir(OUT, { recursive: true });
// 产物为 .js 模块（Node ESM 的 JSON import 需要 with{type:"json"}，Vite 兼容但双端跑易踩坑；
//  生成 export default 一次解决构建期与 CLI 校验脚本两边加载）
await fs.writeFile(
  path.join(OUT, "demos.js"),
  "// 由 scripts/sync-demofiles.mjs 生成，勿手改。词条 demo.html 逐字节内联。\n" +
    "export default " + JSON.stringify(demos) + ";\n"
);
console.log(`✓ sync-demofiles: ${count} 条 demo.html → src/generated/demos.js`);
