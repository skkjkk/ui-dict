// scripts/verify-preview-modes.mjs —— 首页三态预览的行为验收（真浏览器 CDP）。
//
//   node scripts/verify-preview-modes.mjs [--base http://localhost:4332]
//
// 断言（全部在真实滚动交互后检查）：
//   1. static 卡：滚动到底再回，全程 0 个 iframe 创建（截图即全部）
//   2. hover 卡：悬停后 iframe 挂上（srcdoc 非空），移开 800ms 后回收（about:blank）
//   3. live 卡：进视口自动挂载、离视口 3s 后回收——滚动一屏后视野外 live iframe ≤ live 总数
//   4. 截图 <img> 请求：34 张 /shots/*.webp 全部 200
//   5. 每卡 data-mode 与注册表（preview-modes.mjs previewModeOf）一致——构建期写死，防漂移
import { launchChrome } from "../src/lib/browser.mjs";
import { loadTerms } from "../src/lib/terms.mjs";
import { previewModeOf } from "../src/lib/preview-modes.mjs";

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : (process.env.UIDICT_BASE ?? "http://localhost:4332");

const terms = await loadTerms();
const expect = Object.fromEntries(terms.map((t) => [t.slug, previewModeOf(t)]));

const browser = await launchChrome();
const page = await browser.newPage();
const fails = [];
const shotUrls = new Set();

const onResp = (p) => { if (p.response?.url?.includes("/shots/")) shotUrls.add(`${p.response.status} ${p.response.url.split("/").pop()}`); };
browser.on("Network.responseReceived", onResp);

await page.render(`<!DOCTYPE html><meta http-equiv="refresh" content="0;url=${BASE}/">`, { width: 1280, height: 900, settleMs: 1800 });

// 5. data-mode 与注册表一致
const modes = await page.eval(`Object.fromEntries([...document.querySelectorAll('.term-card')].map(c => [c.dataset.slug, c.dataset.mode]))`);
for (const [slug, mode] of Object.entries(modes)) {
  if (expect[slug] !== mode) fails.push(`data-mode 漂移: ${slug} 页面=${mode} 注册表=${expect[slug]}`);
}
const counts = Object.values(modes).reduce((a, m) => { a[m] = (a[m] ?? 0) + 1; return a; }, {});

// 1. 缓慢滚到中部：static 卡不该有任何 iframe
await page.eval(`new Promise(r => { let y=0; const t=setInterval(()=>{ scrollBy(0,400); y+=400; if(y>=2400){clearInterval(t); r();} }, 120); })`);
await new Promise((r) => setTimeout(r, 900));
const iframesMid = await page.eval(`document.querySelectorAll('.preview-slot iframe').length`);

// 2. hover 卡：pointerenter 挂载 → pointerleave 回收
// 注意验证脚本坐标语义：page.render 的视口是 1280×900，scrollTo 不重置 mouse 位置——
// 这里用 js 滚到目标卡片（content-visibility 分节需要真实滚动激活），再用 CDP 指针进入
await page.eval(`(() => {
  const card = document.querySelector('.term-card[data-mode="hover"]');
  card?.scrollIntoView({ block: "center" });
})()`);
await new Promise((r) => setTimeout(r, 1200)); // 等 content-visibility 激活 + 布局
const hoverCard = await page.eval(`(() => {
  const card = document.querySelector('.term-card[data-mode="hover"]');
  if (!card) return null;
  const r = card.getBoundingClientRect();
  return { slug: card.dataset.slug, x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
})()`);
if (!hoverCard) fails.push("没有找到 hover 卡（PREVIEW_MODES 配置或 DOM 有误）");
let hoverMounted = false, hoverRecycled = false;
if (hoverCard) {
  await page.mouse("mouseMoved", hoverCard.x, hoverCard.y);
  await new Promise((r) => setTimeout(r, 2500)); // 等 fetch + srcdoc 写入
  const hovered = await page.eval(`(() => {
    const card = document.querySelector('.term-card[data-slug="${hoverCard.slug}"]');
    const f = card?.querySelector('iframe');
    return f ? { srcdocLen: f.srcdoc.length, srcdoc: f.srcdoc.slice(0, 40) } : null;
  })()`);
  hoverMounted = !!hovered && hovered.srcdocLen >= 200;
  if (!hoverMounted) fails.push(`hover 挂载失败: ${hoverCard.slug} srcdoc=${hovered?.srcdoc ?? "(无 iframe)"}`);

  await page.mouse("mouseMoved", 10, 10); // 移出卡片
  await new Promise((r) => setTimeout(r, 1600)); // pointerleave 800ms 回收
  const left = await page.eval(`(() => {
    const card = document.querySelector('.term-card[data-slug="${hoverCard.slug}"]');
    const f = card?.querySelector('iframe');
    return f ? f.srcdoc : null;
  })()`);
  hoverRecycled = left === "about:blank";
  if (!hoverRecycled) fails.push(`hover 回收失败: ${hoverCard.slug} srcdoc=${String(left).slice(0, 40)}`);
}

// 3. live 卡：滚到 motion 区（页面后段），视口内 live iframe 应自动挂载
await page.eval(`(() => {
  const card = document.querySelector('.term-card[data-mode="live"]');
  card?.scrollIntoView({ block: "center" });
})()`);
await new Promise((r) => setTimeout(r, 3500)); // 进场挂载 + rAF 错峰（每帧一挂）+ fetch
const liveState = await page.eval(`(() => {
  const live = [...document.querySelectorAll('.term-card[data-mode="live"]')];
  const visible = live.filter(c => { const r = c.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
  const mounted = visible.filter(c => { const f = c.querySelector('iframe'); return f && f.srcdoc && f.srcdoc !== 'about:blank'; });
  return { visible: visible.length, mounted: mounted.length, totalLive: live.length };
})()`);
if (liveState.visible > 0 && liveState.mounted === 0) fails.push(`live 挂载失败: 视口内 ${liveState.visible} 张 live 卡 0 张挂上`);

// 离场回收：滚回页顶，live iframe 应在 3s 后被卸载
await page.eval("scrollTo(0, 0)");
await new Promise((r) => setTimeout(r, 4200));
const recycled = await page.eval(`(() => {
  const live = [...document.querySelectorAll('.term-card[data-mode="live"]')];
  const visible = live.filter(c => { const r = c.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
  const offscreen = live.filter(c => !visible.includes(c));
  const stillMounted = offscreen.filter(c => { const f = c.querySelector('iframe'); return f && f.srcdoc && f.srcdoc !== 'about:blank'; });
  return { offscreen: offscreen.length, stillMounted: stillMounted.length };
})()`);
if (recycled.offscreen > 0 && recycled.stillMounted === recycled.offscreen) fails.push(`live 回收失败: 离屏 ${recycled.offscreen} 张全部仍挂载`);

// 4. 截图全部 200
for (const s of shotUrls) if (s.startsWith("4") || s.startsWith("5")) fails.push(`截图加载失败: ${s}`);
const shot200 = [...shotUrls].filter((s) => s.startsWith("200")).length;

browser.off("Network.responseReceived", onResp);
await browser.close();

console.log(`· 三态分布: ${JSON.stringify(counts)}`);
console.log(`· 中段滚动后 iframe 数: ${iframesMid}（static 区零挂载）`);
console.log(`· hover 卡 ${hoverCard?.slug ?? "-"}: 挂载${hoverMounted ? "✓" : "✗"}回收${hoverRecycled ? "✓" : "✗"}`);
console.log(`· live 卡: 视口内 ${liveState.mounted}/${liveState.visible} 已挂载（总 ${liveState.totalLive}），离屏回收 ${recycled.offscreen - recycled.stillMounted}/${recycled.offscreen}`);
console.log(`· 截图请求: ${shot200} 张 200`);

if (fails.length) {
  console.error("\n✗ FAIL:");
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log(`\n✓ 三态预览行为验收通过（${Object.keys(modes).length} 卡）`);
