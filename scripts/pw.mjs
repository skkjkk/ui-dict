// scripts/pw.mjs —— 定位 playwright 并导出 chromium（本地未装则回退到 npx 缓存/全局）
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

async function resolvePlaywright() {
  try {
    return await import("playwright");
  } catch { /* 本地未装，继续找 */ }

  const roots = [
    process.env.PW_PATH,
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "npm-cache", "_npx"),
    process.env.APPDATA && join(process.env.APPDATA, "npm", "node_modules"),
  ].filter(Boolean);

  for (const root of roots) {
    if (root.endsWith("node_modules") || root.includes("playwright")) {
      const idx = root.includes("playwright") ? join(root, "index.mjs") : join(root, "playwright", "index.mjs");
      if (existsSync(idx)) return import(new URL(`file:///${idx.replace(/\\/g, "/")}`).href);
      continue;
    }
    if (!existsSync(root)) continue;
    for (const d of readdirSync(root)) {
      const idx = join(root, d, "node_modules", "playwright", "index.mjs");
      if (existsSync(idx)) return import(new URL(`file:///${idx.replace(/\\/g, "/")}`).href);
    }
  }
  throw new Error("找不到 playwright：请 pnpm add -D playwright 或 npm i -g playwright");
}

export const { chromium } = await resolvePlaywright();
