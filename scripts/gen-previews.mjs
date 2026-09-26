// scripts/gen-previews.mjs —— 首页静态截图管线（真浏览器 CDP，复用 browser.mjs）。
//
//   node scripts/gen-previews.mjs [--force] [--only <slug>,<slug>…]
//
// 产物：public/shots/<slug>.webp + public/shots/manifest.json（slug → 内容 hash）。
// 首页卡片「截图打底」的图片来自这里；gen（pnpm gen）会增量调用（hash 未变不重截）。
//
// 截图与 iframe 预览「所见即所得」的关键：渲染用 buildPreviewHtml（src/lib/preview-html.mjs）
// 组装——与 frame.js previewSrcdoc 完全同一份补丁（PREVIEW_INJECT + PREVIEW_FIXES），
// 只是不叠 reduce-motion（缩略图要展示的恰恰是动效定格帧）。
//
// 激活态：交互类词条（tooltip/抽屉/命令面板…）初始态往往只有个触发钮，截图会「看不见主体」。
// 复用 Page.activate()（找隐藏浮层 → 点触发钮 / 兜底 Ctrl+K）把浮层拍开再截。
// motion 类词条另等一个动画周期（shotSettleMs），让定格帧落在「有内容」的相位上。

import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { launchChrome } from "../src/lib/browser.mjs";
import { loadTerms } from "../src/lib/terms.mjs";
import { buildPreviewHtml } from "../src/lib/preview-html.mjs";
import { previewModeOf } from "../src/lib/preview-modes.mjs";
// loadTerms 依赖 src/generated/demos.js（sync-demofiles 产物）——先跑 pnpm gen 再来。

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "shots");

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const onlyIdx = args.indexOf("--only");
const ONLY = onlyIdx >= 0 && args[onlyIdx + 1] ? args[onlyIdx + 1].split(",").map((s) => s.trim()).filter(Boolean) : null;

// 卡片预览槽的物理尺寸：540×280 逻辑 × 2 倍密度（540 是 wall 网格 minmax 下限的典型列宽）
const SHOT_W = 540;
const SHOT_H = 280;
const SHOT_SCALE = 2;

const terms = await loadTerms();
const targets = ONLY ? terms.filter((t) => ONLY.includes(t.slug)) : terms;
if (!targets.length) {
  console.error("没有匹配的词条");
  process.exit(1);
}

// ---------- 增量：manifest 记录 slug → 源 hash（demo + 补丁注册表 + 管线版本） ----------
const PIPELINE_VERSION = "2"; // 截图组装逻辑变化时 +1 强制全量重截
const manifestPath = path.join(OUT, "manifest.json");
let manifest = {};
try { manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")); } catch { /* 首跑 */ }

const hashOf = (t, demo) =>
  createHash("sha256")
    .update(PIPELINE_VERSION + "\0" + demo + "\0" + previewModeOf(t))
    .digest("hex")
    .slice(0, 16);

const previewHtmlOf = (t) => buildPreviewHtml(t.demoCode);

const pending = [];
for (const t of targets) {
  const h = hashOf(t, t.demoCode);
  const existing = manifest[t.slug];
  const fileOk = await fs.stat(path.join(OUT, `${t.slug}.webp`)).then(() => true, () => false);
  if (!FORCE && existing === h && fileOk) continue;
  pending.push({ t, h });
}

if (!pending.length) {
  console.log(`✓ gen-previews: ${targets.length} 条全部命中缓存（manifest 未变），0 张重截`);
  process.exit(0);
}

console.log(`· gen-previews: ${pending.length}/${targets.length} 张待截（增量 manifest 命中 ${targets.length - pending.length}）`);
await fs.mkdir(OUT, { recursive: true });
const browser = await launchChrome();
const page = await browser.newPage();

let ok = 0;
const fails = [];
for (const { t, h } of pending) {
  const html = previewHtmlOf(t);
  const mode = previewModeOf(t);
  try {
    const r = await page.render(html, {
      width: SHOT_W, height: SHOT_H, scale: SHOT_SCALE,
      settleMs: mode === "live" ? 2200 : 1600, // 动效类多等一拍，定格帧落在有内容相位
    });
    if (r.runtime.length || r.console.length) {
      fails.push(`${t.slug}: 渲染报错 ${JSON.stringify(r.runtime.concat(r.console)).slice(0, 140)}`);
    }
    // 激活态：hover/交互类词条把隐藏浮层拍开（tooltip/抽屉/命令面板点了才有主体）；
    // live（动效）类不激活——定格帧本身就是「效果在动」的样本
    if (mode === "hover") await page.activate();
    const buf = await page.screenshot({ full: false, format: "webp", quality: 82 });
    await fs.writeFile(path.join(OUT, `${t.slug}.webp`), buf);
    manifest[t.slug] = h;
    ok++;
  } catch (e) {
    fails.push(`${t.slug}: ${e.message}`);
  }
}

await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
await browser.close();

console.log(`✓ gen-previews: ${ok}/${pending.length} 张截图 → public/shots/（webp q82 ${SHOT_W * SHOT_SCALE}×${SHOT_H * SHOT_SCALE}）`);
if (fails.length) {
  console.error("⚠ 失败/警告：");
  for (const f of fails) console.error("  - " + f);
  process.exitCode = 1;
}
