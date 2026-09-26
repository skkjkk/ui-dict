// scripts/verify-marquee.mjs —— 拖拽跑马灯 M-08 真机行为验证
import { chromium } from "./pw.mjs";

const BASE = "http://localhost:4332";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewportSize: { width: 1100, height: 700 } });
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log(`${ok ? "✓" : "✗"} ${msg}`); };

// 与 demo 同法测量一份序列宽（前 4 项 + 3 个间距）——回绕范围就是它，做 modulo 断言必须精确
const probe = () => page.evaluate(() => {
  const track = document.getElementById("track");
  const root = document.getElementById("marquee");
  const m = new DOMMatrixReadOnly(getComputedStyle(track).transform);
  const kids = Array.from(track.children);
  const first = kids.slice(0, 4);
  const gap = parseFloat(getComputedStyle(track).columnGap || 0) || 0;
  const setWidth = first.reduce((s, el) => s + el.getBoundingClientRect().width, 0) + gap * 3;
  return {
    x: m.m41,
    items: kids.length,
    originals: kids.filter((k) => k.dataset.copy === "original").length,
    dups: kids.filter((k) => k.dataset.copy === "duplicate").length,
    dupAria: kids.filter((k) => k.dataset.copy === "duplicate").every((k) => k.getAttribute("aria-hidden") === "true"),
    trackW: track.getBoundingClientRect().width,
    rootW: root.clientWidth,
    setWidth,
    range: setWidth * 1.02,
    docW: document.documentElement.scrollWidth,
  };
});
// 把位移差折算进 (−range/2, range/2]：回绕会让同一段位移表现为「大正数」或「大负数」
const norm = (d, range) => ((((d + range / 2) % range) + range) % range) - range / 2;
// 键盘步长是容器宽的 35%，可能超过 range 的一半 —— 此时 modulo 表示本身有歧义
// （+448 与 −441 在回绕空间里无法区分），必须拿预期值挑最近的那个候选
const nearestTo = (d, range, expect) => {
  let best = d;
  for (let k = -2; k <= 2; k++) {
    const c = d + k * range;
    if (Math.abs(c - expect) < Math.abs(best - expect)) best = c;
  }
  return best;
};

// ---- 1. 结构：副本拼接 + aria ----
await page.goto(`${BASE}/demos/draggable-marquee.html`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
const s0 = await probe();
const s1 = await (async () => { await page.waitForTimeout(900); return probe(); })();

check(s0.items === 12 && s0.originals === 4 && s0.dups === 8, `副本拼接：${s0.items} 项 = 4 原始 + 8 副本`);
check(s0.dupAria, "副本均标 aria-hidden（读屏不重复念图）");
check(s0.docW <= s0.rootW + 1, `页面无横向溢出（文档宽 ${s0.docW} ≤ 容器 ${s0.rootW}）`);
check(s0.trackW >= s0.rootW + s0.setWidth, `轨道宽 ${Math.round(s0.trackW)} ≥ 视口 ${s0.rootW} + 一份序列 ${Math.round(s0.setWidth)}（回绕不露白）`);

// ---- 2. 自动滚动 + 回绕钳制 ----
check(s1.x < s0.x, `自动向左滚动：x ${s0.x.toFixed(0)} → ${s1.x.toFixed(0)}`);
const sweep = await page.evaluate(() => new Promise((res) => {
  const track = document.getElementById("track"), xs = [];
  let n = 0;
  const t = setInterval(() => {
    xs.push(new DOMMatrixReadOnly(getComputedStyle(track).transform).m41);
    if (++n >= 60) { clearInterval(t); res({ min: Math.min(...xs), max: Math.max(...xs) }); }
  }, 25);
}));
check(sweep.max <= 0.5 && sweep.min >= -s0.range - 1,
  `位移钳制在 [${sweep.min.toFixed(0)}, ${sweep.max.toFixed(0)}]（回绕范围 ${(-s0.range).toFixed(0)}~0，无漂移）`);

// ---- 3. 拖拽接管 + 跟手 ----
// 拖拽用「同一 range 内的净位移」判定，避免恰好跨越回绕点导致数值假象
const box = await page.locator("#marquee").boundingBox();
const cy = box.y + box.height / 2;
check(box.width <= s0.rootW + 1, `#marquee 宽度 ${Math.round(box.width)}px 与视口一致（拖拽坐标落在屏内）`);

await page.mouse.move(box.x + box.width - 120, cy);
await page.mouse.down();
const d0 = await probe();
await page.mouse.move(box.x + box.width - 420, cy, { steps: 12 });
const d1 = await probe();
const dragDelta = norm(d1.x - d0.x, d0.range);
check(dragDelta < -200, `拖拽跟手：向左拖 300px → 位移 ${dragDelta.toFixed(0)}px`);
const cursor = await page.evaluate(() => getComputedStyle(document.getElementById("marquee")).cursor);
check(cursor === "grabbing", `拖拽中光标 = ${cursor}`);

// ---- 4. 松手甩动：继续滑行 → 衰减 → 回到匀速自走 ----
await page.mouse.up();
const samples = [];
for (let i = 0; i < 14; i++) { samples.push((await probe()).x); await page.waitForTimeout(200); }
const steps = [];
for (let i = 1; i < samples.length; i++) steps.push(Math.abs(norm(samples[i] - samples[i - 1], s0.range)));
const early = steps.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
const late = steps.slice(-3).reduce((a, b) => a + b, 0) / 3;
check(steps[0] > 0 && early > late * 1.5, `甩动后逐步衰减：前期均步 ${early.toFixed(1)}px → 后期均步 ${late.toFixed(1)}px`);
check(late < 40, `衰减到停后回到匀速自走（后期均步 ${late.toFixed(1)}px/0.2s ≪ 甩动初速）`);

// ---- 5. 指针捕获：拖出容器仍不断连 ----
await page.mouse.move(box.x + box.width - 200, cy);
await page.mouse.down();
const c0 = await probe();
await page.mouse.move(box.x + box.width - 320, cy - 420, { steps: 8 });
await page.mouse.move(box.x + box.width - 460, cy - 460, { steps: 8 });
const c1 = await probe();
const outDelta = norm(c1.x - c0.x, c0.range);
check(outDelta < -150, `指针拖出容器仍收到事件（净位移 ${outDelta.toFixed(0)}px，未断连）`);
await page.mouse.up();

// ---- 6. 键盘拨动（用 modulo 归一，且左右可互逆）----
await page.locator("#marquee").focus();
const k0 = await probe();
await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(50);
const k1 = await probe();
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(50);
const k2 = await probe();
const expect = k0.rootW * 0.35;
const leftDelta = nearestTo(k1.x - k0.x, k0.range, expect);
const rightDelta = nearestTo(k2.x - k1.x, k0.range, -expect);
check(Math.abs(leftDelta - expect) < 40, `ArrowLeft 拨动 ${leftDelta.toFixed(0)}px ≈ 35% 容器宽 ${expect.toFixed(0)}px`);
check(Math.abs(rightDelta + expect) < 40, `ArrowRight 反向拨动 ${rightDelta.toFixed(0)}px（与左键互逆）`);
const netDrift = nearestTo(k2.x - k0.x, k0.range, 0);
check(Math.abs(netDrift) < 60, `左右各一次后回到原位（净漂移 ${netDrift.toFixed(0)}px）`);

// ---- 7. reduced-motion：停自走 + 还原生滚动 + 隐藏副本 ----
await page.emulateMedia({ reducedMotion: "reduce" });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(500);
const r0 = await page.evaluate(() => {
  const root = document.getElementById("marquee"), track = document.getElementById("track");
  return {
    cls: root.classList.contains("is-reduced"),
    overflowX: getComputedStyle(root).overflowX,
    transform: getComputedStyle(track).transform,
    dupsVisible: Array.from(track.children).filter((k) => k.dataset.copy === "duplicate" && getComputedStyle(k).display !== "none").length,
  };
});
await page.waitForTimeout(900);
const r1 = await page.evaluate(() => getComputedStyle(document.getElementById("track")).transform);
check(r0.cls && r0.overflowX === "auto", `reduced-motion：挂 is-reduced + overflow-x=${r0.overflowX}（交还原生滚动）`);
check(r0.dupsVisible === 0, "reduced-motion：副本已隐藏（0 个可见）");
check(r1 === r0.transform, `reduced-motion：不再自走（transform 稳定于 ${r0.transform}）`);

await browser.close();
console.log(fails ? `\n${fails} 项失败` : "\n全部通过");
process.exit(fails ? 1 : 0);
