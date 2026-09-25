// scripts/shot-live.mjs —— 截第六段（Live Demo 双列）局部，做视觉复核
const { chromium } = await import("./pw.mjs");

const slug = process.argv[2] || "otp-input";
const out = process.argv[3] || "shot.png";
const width = Number(process.argv[4] || 1600);

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewportSize: { width, height: 1000 } });
await page.goto(`http://localhost:4332/term/${slug}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.locator(".live-grid").screenshot({ path: out });
console.log("saved", out);
await browser.close();
