// scripts/verify-marquee-page.mjs —— M-08 在详情页里的表现（滑杆联动 + 同高 + 卡片预览）
import { chromium } from "./pw.mjs";

const BASE = "http://localhost:4332";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewportSize: { width: 1600, height: 1000 } });
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log(`${ok ? "✓" : "✗"} ${msg}`); };

// ---- 详情页：三滑杆 + 代码/prompt 同源 + 左右同高 ----
await page.goto(`${BASE}/term/draggable-marquee/`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const sliders = await page.$$eval("[data-param]", (els) => els.map((e) => e.dataset.param));
check(sliders.length === 3, `三个滑杆就位：${sliders.join(", ")}`);

const geo = await page.evaluate(() => {
  const [l, r] = document.querySelector(".live-grid").children;
  return {
    d: Math.abs(Math.round(l.getBoundingClientRect().bottom - r.getBoundingClientRect().bottom)),
    panel: Math.round(document.querySelector(".demo-panel").getBoundingClientRect().height),
    iframe: Math.round(document.getElementById("live").getBoundingClientRect().height),
  };
});
check(geo.d <= 1 && geo.iframe >= 420, `左列与右列同高（底边差 ${geo.d}px，iframe ${geo.iframe}px）`);

// demo 在 iframe 内确实自走。
// 必须先把第六段滚进视口：Chrome 会节流不可见 iframe 的 rAF，离屏时 transform 恒为 none，
// 这不是 demo 的问题，是浏览器省电策略——不滚进视口就测不到动画
await page.evaluate(() => document.querySelector(".live-grid").scrollIntoView({ block: "center" }));
await page.waitForTimeout(900);
const iframe = page.frameLocator("#live");
const x0 = await iframe.locator("#track").evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
await page.waitForTimeout(900);
const x1 = await iframe.locator("#track").evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
check(x1 !== x0, `iframe 内 demo 自走中：x ${x0.toFixed(0)} → ${x1.toFixed(0)}`);

// 拉滑杆 → 代码块与 prompt 同步改写
const codeBefore = await page.locator("#code").textContent();
const promptBefore = await page.locator("#prompt").textContent();
await page.locator('[data-param="SPEED"]').evaluate((el) => {
  el.value = "4"; el.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.locator('[data-param="FRICTION"]').evaluate((el) => {
  el.value = "0.995"; el.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.waitForTimeout(400);
const codeAfter = await page.locator("#code").textContent();
const promptAfter = await page.locator("#prompt").textContent();
check(codeAfter.includes('"SPEED":4') && codeAfter.includes('"FRICTION":0.995'), "代码块随滑杆改写（SPEED/FRICTION 已同步）");
check(codeAfter !== codeBefore && promptAfter !== promptBefore, "prompt 卡同步重拼装");
check(await page.locator('[data-out="SPEED"]').textContent() === "4", "读数 output 同步刷新");

// 复制代码 = 当前渲染的 demoCode（三态同源）
const copied = await page.evaluate(() => document.getElementById("code").textContent);
check(copied.includes('"SPEED":4'), "复制内容 = 展示内容（三态同源）");

// 拉满滑杆后仍同高
const geo2 = await page.evaluate(() => {
  const [l, r] = document.querySelector(".live-grid").children;
  return Math.abs(Math.round(l.getBoundingClientRect().bottom - r.getBoundingClientRect().bottom));
});
check(geo2 <= 1, `滑杆改动后仍同高（底边差 ${geo2}px）`);

// ---- 首页卡片：懒挂载预览 + 出现在动效分区 ----
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);const card = await page.evaluate(() => {
  const a = document.querySelector('a.term-card[data-slug="draggable-marquee"]');
  if (!a) return null;
  const cat = a.closest("section[data-cat]")?.dataset.cat;
  const f = a.querySelector("iframe");
  return { cat, name: a.querySelector(".text-\\[26px\\]")?.textContent.trim(), no: a.querySelector(".num")?.textContent.trim(), hasIframe: !!f, src: (f?.srcdoc || "").length };
});
check(!!card, "首页出现 M-08 词条卡");
check(card?.cat === "motion", `归类在「动效 motion」分区（实际 ${card?.cat}）`);
check(card?.no === "M-08", `编号 ${card?.no}`);
check(card?.hasIframe === true, "卡片带 live 预览 iframe");

// 卡片预览里 demo 应可见。
// 注意：卡片 iframe 是 sandbox="allow-scripts"（无 allow-same-origin），
// 父页拿不到 contentDocument —— 这里只能断言 srcdoc 已挂载 + 截图人工复核（scripts/shot-card.mjs）
await page.locator('a.term-card[data-slug="draggable-marquee"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(1600);
const cardState = await page.evaluate(() => {
  const f = document.querySelector('a.term-card[data-slug="draggable-marquee"] iframe');
  return {
    srcdocLen: (f.srcdoc || "").length,
    hasTrackMarkup: (f.srcdoc || "").includes('id="track"'),
    sandbox: f.getAttribute("sandbox"),
    h: Math.round(f.getBoundingClientRect().height),
  };
});
check(cardState.srcdocLen > 3000 && cardState.hasTrackMarkup, `卡片预览 srcdoc 已挂载（${cardState.srcdocLen} 字节，含 #track）`);
check(cardState.sandbox === "allow-scripts", `卡片 iframe 沙箱 = ${cardState.sandbox}（跨源隔离，父页不可读 DOM）`);

// ---- 回归：全站导出收录 M-08（直接读原始字节，别经 innerText 二次编码）----
const mdBytes = await page.evaluate(async () => (await fetch("/ui-dict.md")).text());
check(mdBytes.includes("M-08") && mdBytes.includes("Draggable Marquee"), "全站导出 /ui-dict.md 收录 M-08");

await browser.close();
console.log(fails ? `\n${fails} 项失败` : "\n全部通过");
process.exit(fails ? 1 : 0);
