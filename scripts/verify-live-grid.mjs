// scripts/verify-live-grid.mjs —— 断言详情页第六段「左列预览与右列同高」
// 遍历全部词条 × 多个视口宽度，检查 左列底边 == 右列底边（1px 容差），并单独验「展开全码」。
import { TERMS } from "../src/generated/site-data.js";
import { chromium } from "./pw.mjs";

const BASE = "http://localhost:4332";
const WIDTHS = [1280, 1440, 1600, 1920];
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewportSize: { width: 1600, height: 1000 } });

const rows = [];
let fails = 0;

for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 1000 });
  for (const t of TERMS) {
    await page.goto(`${BASE}/term/${t.slug}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(160);
    const m = await page.evaluate(() => {
      const grid = document.querySelector(".live-grid");
      const [left, right] = grid ? grid.children : [];
      const lb = left?.getBoundingClientRect(), rb = right?.getBoundingClientRect();
      const ib = document.getElementById("live")?.getBoundingClientRect();
      const pb = left?.querySelector(".demo-panel")?.getBoundingClientRect();
      return {
        leftBottom: Math.round(lb?.bottom ?? 0),
        rightBottom: Math.round(rb?.bottom ?? 0),
        iframeH: Math.round(ib?.height ?? 0),
        panelH: Math.round(pb?.height ?? 0),
      };
    });
    const diff = Math.abs(m.leftBottom - m.rightBottom);
    const ok = diff <= 1 && m.iframeH >= 420;
    if (!ok) { fails++; rows.push(`✗ ${w}px ${t.no} ${t.slug} 底边差=${diff}px iframe=${m.iframeH}px panel=${m.panelH}`); }
    else rows.push(`✓ ${w}px ${t.no} ${t.slug} 同高 ${m.panelH}px (iframe ${m.iframeH}px)`);
  }
}
console.log(rows.join("\n"));
console.log(`\n${WIDTHS.length * TERMS.length - fails}/${WIDTHS.length * TERMS.length} 通过`);

// 「展开全码」例外路径：左列变 sticky 固定高，不该被撑成巨幕
await page.setViewportSize({ width: 1600, height: 1000 });
await page.goto(`${BASE}/term/context-menu/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(300);
const before = await page.evaluate(() => Math.round(document.querySelector(".demo-panel").getBoundingClientRect().height));
await page.click("[data-code-toggle]");
await page.waitForTimeout(400);
const after = await page.evaluate(() => {
  const grid = document.querySelector(".live-grid");
  const panel = document.querySelector(".demo-panel");
  return { expanded: grid.classList.contains("code-expanded"), h: Math.round(panel.getBoundingClientRect().height), pos: getComputedStyle(panel.parentElement).position };
});
console.log(`\n展开全码：面板 ${before}px → ${after.h}px（code-expanded=${after.expanded}, sticky=${after.pos}）`);
if (!after.expanded || after.h > before + 40) { fails++; console.log("✗ 展开后左侧被撑成巨幕"); }
else console.log("✓ 展开后左侧保持固定高度");

await browser.close();
process.exit(fails ? 1 : 0);
