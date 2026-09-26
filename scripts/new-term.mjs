// scripts/new-term.mjs —— 词条工厂的一键脚手架：
//
//   node scripts/new-term.mjs <category> <id>            # 从模板复制 + 占位替换
//   node scripts/new-term.mjs <category> <id> --no      C-07
//   node scripts/new-term.mjs motion magnetic-follow --no M-09
//
// 作用：AI/人新增词条不再需要记忆目录约定、编号规则、params 标记写法——
// 脚本生成合法骨架 → 填内容 → pnpm qa → pnpm build 即入库（工厂闭环 30 秒起步）。
// 分类与编号一致性、schema 合法性由 qa-demofiles + validate.mjs 把关（同一道闸）。
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TERMS = path.join(ROOT, "terms");
const TEMPLATE_DIR = path.join(TERMS, "_template");

const PREFIX = { component: "C", motion: "M", interaction: "I", layout: "L", style: "S" };

const [cat, id, noFlag, noValue] = process.argv.slice(2);if (!cat || !id) {
  console.error("用法：node scripts/new-term.mjs <category> <id> [--no C-07]\n  category: component | motion | interaction | layout | style");
  process.exit(1);
}
if (!PREFIX[cat]) {
  console.error(`✗ 未知分类 "${cat}"。可选：${Object.keys(PREFIX).join(" / ")}`);
  process.exit(1);
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
  console.error(`✗ id 必须是 kebab-case（如 magnetic-follow），得到："${id}"`);
  process.exit(1);
}

const dir = path.join(TERMS, cat, id);
if (process.argv.some((a) => a === "--help" || a === "-h")) process.exit(0);
try {
  await fs.access(dir);
  console.error(`✗ 目录已存在：terms/${cat}/${id}（换个 id，或直接在里面改）`);
  process.exit(1);
} catch { /* 不存在，继续 */ }

// 编号：--no 显式指定；否则自动取该分类现有最大号 +1
let no = noValue;
if (noFlag !== "--no") no = undefined;
if (!no) {
  const used = [];
  try {
    for (const d of await fs.readdir(path.join(TERMS, cat), { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      try {
        const entry = JSON.parse(await fs.readFile(path.join(TERMS, cat, d.name, "entry.json"), "utf8"));
        const m = /^([CMILS])-(\d{2})$/.exec(entry.no ?? "");
        if (m && m[1] === PREFIX[cat]) used.push(parseInt(m[2], 10));
      } catch { /* 读不到 entry 的目录不参与编号 */ }
    }
  } catch { /* 分类目录尚不存在 */ }
  no = `${PREFIX[cat]}-${String(Math.max(0, ...used) + 1).padStart(2, "0")}`;
}
if (!new RegExp(`^${PREFIX[cat]}-\\d{2}$`).test(no)) {
  console.error(`✗ 编号 ${no} 与分类 ${cat}（前缀 ${PREFIX[cat]}-）不一致`);
  process.exit(1);
}

const titleZh = "词条中文名";
await fs.mkdir(dir, { recursive: true });

const entryT = await fs.readFile(path.join(TEMPLATE_DIR, "entry.template.json"), "utf8");
const entry = entryT
  .replace(/模板词条（new-term 脚本会替换成目录名）/g, id)
  .replace(/"no":\s*"C-XX"/, `"no": "${no}"`)
  .replace(/"category":\s*"component"/, `"category": "${cat}"`)
  .replace(/2026-09-25/g, new Date().toISOString().slice(0, 10));
await fs.writeFile(path.join(dir, "entry.json"), entry, "utf8");

await fs.writeFile(
  path.join(dir, "demo.html"),
  (await fs.readFile(path.join(TEMPLATE_DIR, "demo.template.html"), "utf8")).replace(/ui-dict C-XX/g, `ui-dict ${no}`),
  "utf8",
);

console.log(`✓ 词条骨架已生成：terms/${cat}/${id}/`);
console.log(`  编号 ${no}（自动分配；要指定用 --no M-09）`);
console.log(`下一步：`);
console.log(`  1. 填 terms/${cat}/${id}/entry.json（字段标准见 NEW_ENTRY.md 第 2 节）`);
console.log(`  2. 改 terms/${cat}/${id}/demo.html 的效果区（<title> 保持 "· ui-dict ${no}" 尾缀）`);
console.log(`  3. pnpm qa  →  pnpm dev 预览  →  提交入库`);
