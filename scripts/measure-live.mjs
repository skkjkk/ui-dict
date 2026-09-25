// scripts/measure-live.mjs —— 量详情页第六段（Live Demo 双列）的真实几何
// 用法：node scripts/measure-live.mjs [slug] [viewportWidth]
const { chromium } = await import("./pw.mjs");

const slug = process.argv[2] || "otp-input";
const width = Number(process.argv[3] || 1600);
const url = `http://localhost:4332/term/${slug}/`;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewportSize: { width, height: 1000 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(900);

const data = await page.evaluate(() => {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom + scrollY) };
  };
  const grid = document.querySelector(".live-grid");
  const [left, right] = grid ? grid.children : [];
  return {
    grid: box(grid),
    left: box(left),
    right: box(right),
    iframe: box(document.getElementById("live")),
    leftTitle: box(left?.querySelector(".eyebrow")),
    panel: box(left?.querySelector(".demo-panel")),
    meta: box(document.querySelector("[data-demo-meta]")),
    params: box(document.getElementById("params")),
    codeScroll: box(document.querySelector(".code-scroll")),
    codeMeta: box(document.querySelector(".code-meta")),
    iframeInlineHeight: document.getElementById("live")?.style.height,
    article: box(document.querySelector("article")),
  };
});
console.log(JSON.stringify({ slug, width, ...data }, null, 2));
await browser.close();
