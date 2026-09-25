// scripts/verify-live-edge.mjs —— 边界条件：窄屏单列 + 展开全码 + 无参数词条
import { chromium } from "./pw.mjs";

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewportSize: { width: 1600, height: 1000 } });
let fails = 0;
const log = (ok, msg) => { if (!ok) fails++; console.log(`${ok ? "✓" : "✗"} ${msg}`); };

// 1) 窄屏单列：面板不得塌陷，iframe 至少 420px
for (const w of [390, 768, 1023]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto("http://localhost:4332/term/otp-input/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
  const m = await page.evaluate(() => {
    const p = document.querySelector(".demo-panel").getBoundingClientRect();
    const i = document.getElementById("live").getBoundingClientRect();
    const g = getComputedStyle(document.querySelector(".live-grid")).gridTemplateColumns;
    return { panel: Math.round(p.height), iframe: Math.round(i.height), cols: g };
  });
  log(m.iframe === 420, `${w}px 单列：面板 ${m.panel}px / iframe ${m.iframe}px（列=${m.cols}）`);
}

// 2) 展开全码：左列 sticky 定高，不再是巨幕
await page.setViewportSize({ width: 1600, height: 1000 });
await page.goto("http://localhost:4332/term/context-menu/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);
const pre = await page.evaluate(() => Math.round(document.querySelector(".demo-panel").getBoundingClientRect().height));
await page.click("[data-code-toggle]");
await page.waitForTimeout(500);
const post = await page.evaluate(() => ({
  cls: document.querySelector(".live-grid").classList.contains("code-expanded"),
  panel: Math.round(document.querySelector(".demo-panel").getBoundingClientRect().height),
  pos: getComputedStyle(document.querySelector(".live-grid > div")).position,
  codeH: Math.round(document.querySelector(".code-scroll").getBoundingClientRect().height),
}));
log(post.cls && post.panel <= pre + 40, `展开全码：面板 ${pre}px→${post.panel}px，position=${post.pos}，代码 ${post.codeH}px`);
// 再收起，必须回到同高
await page.click("[data-code-toggle]");
await page.waitForTimeout(500);
const back = await page.evaluate(() => {
  const [l, r] = document.querySelector(".live-grid").children;
  return { d: Math.abs(Math.round(l.getBoundingClientRect().bottom - r.getBoundingClientRect().bottom)), cls: document.querySelector(".live-grid").classList.contains("code-expanded") };
});
log(!back.cls && back.d <= 1, `收起全码：恢复同高（底边差 ${back.d}px）`);

// 3) 滑杆交互后仍同高（代码/prompt 重渲染不破坏布局）
await page.goto("http://localhost:4332/term/otp-input/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);
const slider = page.locator("[data-param]").first();
await slider.evaluate((el) => { el.value = String(Number(el.max)); el.dispatchEvent(new Event("input", { bubbles: true })); });
await page.waitForTimeout(350);
const after = await page.evaluate(() => {
  const [l, r] = document.querySelector(".live-grid").children;
  return { d: Math.abs(Math.round(l.getBoundingClientRect().bottom - r.getBoundingClientRect().bottom)), out: document.querySelector("[data-out]").textContent };
});
log(after.d <= 1, `滑杆拉满后仍同高（底边差 ${after.d}px，读数 ${after.out}）`);

await browser.close();
console.log(fails ? `\n${fails} 项失败` : "\n边界条件全通过");
process.exit(fails ? 1 : 0);
