// src/lib/terms.mjs
// 构建期词条加载 —— 单一数据源。
// 词条目录结构：terms/<category>/<id>/{ entry.json, demo.html }
//   entry.json  = 结构化元数据（schema 直接校验，不用 YAML 避免歧义）
//   demo.html   = 零依赖单文件，sync 脚本逐字节注入为 demoCode（保证 复制=渲染=下载 同源）
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import path from "node:path";
import { validateTerm } from "./validate.mjs";
import demos from "../generated/demos.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TERMS = path.join(ROOT, "terms");
const CATS = ["component", "motion", "interaction", "layout", "style"];

async function readDirIf(p) {
  try {
    return await fs.readdir(p, { withFileTypes: true });
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

export const CATEGORY_LABELS = {
  component: "组件",
  motion: "动效",
  interaction: "交互",
  layout: "布局",
  style: "风格",
};

export async function loadTerms() {
  const terms = [];
  for (const catDir of await readDirIf(TERMS)) {
    if (!catDir.isDirectory() || !CATS.includes(catDir.name)) continue;
    for (const idDir of await readDirIf(path.join(TERMS, catDir.name))) {
      if (!idDir.isDirectory()) continue;
      const dir = path.join(TERMS, catDir.name, idDir.name);
      const where = `${catDir.name}/${idDir.name}`;
      const entry = JSON.parse(await fs.readFile(path.join(dir, "entry.json"), "utf8"));
      entry.category ??= catDir.name;
      entry.demoCode = demos[idDir.name] ?? "";
      if (!entry.demoCode) {
        throw new Error(`词条 ${where} 无对应 demo.html（demoCode 为空，违反三态同源）`);
      }
      const clean = validateTerm(entry, where);
      // zod 会剥离 schema 未声明的键（demoCode 不校验内容，由 QA 脚本负责单文件铁律），
      // 因此校验后把 demoCode / slug 重新挂回。
      terms.push({ ...clean, demoCode: entry.demoCode, slug: idDir.name });
    }
  }
  terms.sort((a, b) => a.no.localeCompare(b.no, "en", { numeric: true }));
  return terms;
}

/** 兼容旧入口：拼装逻辑已迁至 prompt.mjs（Node/浏览器共用）。 */
export { assemblePrompt, termMarkdown } from "./prompt.mjs";
