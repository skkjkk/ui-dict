// scripts/gen-client-data.mjs
// 数据管线第三步：loadTerms（含 zod 校验）→ 产出浏览器可用的纯数据模块。
// 客户端岛（搜索/滑杆/iframe）import 这个模块，而不是在页面里手嵌 JSON
// —— demoCode 含 </script>，嵌进内联 script 标签会截断文档，模块文件则安全。
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadTerms, assemblePrompt, CATEGORY_LABELS } from "../src/lib/terms.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src", "generated");

const terms = await loadTerms();

// 防 </script> 截断（若将来被内联）+ 保留结构
const esc = (s) => JSON.stringify(s).replace(/<\/script>/gi, "<\\/script>");

const clientTerms = terms.map((t) => ({
  id: t.id, slug: t.slug, no: t.no, category: t.category,
  catLabel: CATEGORY_LABELS[t.category],
  nameZh: t.nameZh, nameEn: t.nameEn,
  aliases: t.aliases ?? [],
  definition: t.definition,
  whenNotToUse: t.whenNotToUse ?? [],
  confusedWith: t.confusedWith ?? [],
  anatomy: t.anatomy ?? [],
  params: t.params ?? [],
  scenarios: t.scenarios ?? [],
  pitfalls: t.pitfalls ?? [],
  related: t.related ?? [],
  refs: t.refs ?? [],
  verifiedWith: t.verifiedWith ?? "",
  contributors: t.contributors ?? [],
  promptText: assemblePrompt(t),          // 默认参数拼装（SSR 展示基准）
  promptTemplate: t.promptTemplate,        // 浏览器岛滑杆变化时重拼装（与展示永远同源）
}));

const demos = Object.fromEntries(terms.map((t) => [t.slug, t.demoCode]));

const out =
  "// 由 scripts/gen-client-data.mjs 生成，勿手改。改数据请编辑 terms/ 后跑 pnpm gen。\n" +
  `export const TERMS = ${esc(clientTerms)};\n` +
  `export const DEMOS = ${esc(demos)};\n` +
  `export const CATEGORY_LABELS = ${esc(CATEGORY_LABELS)};\n`;

await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(path.join(OUT, "site-data.js"), out);
console.log(`✓ gen-client-data: ${terms.length} 条词条 → src/generated/site-data.js`);
