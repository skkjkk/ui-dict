// scripts/audit-page.mjs —— 站点可观测性审计（真浏览器 CDP，零 npm 依赖，复用 src/lib/browser.mjs）。
//
//   node scripts/audit-page.mjs [--base http://localhost:4321] [--page /] [--page /term/magnetic-button/] ...
//
// 指标（目标见 scripts/README.md「性能预算」）：
//   · domContentLoaded / load 耗时
//   · 传输字节数（Network.responseReceived 汇总，压缩前的 content-length 不可靠，用 encodedDataLength）
//   · 常驻 iframe 数（首页预览 = 长列表内存大户，必须可观测）
//   · 长任务（PerformanceObserver longtask > 50ms，卡顿直接证据）
//   · JS 堆（performance.memory.usedJSHeapSize，Chromium 私有但审计够用）
//   · 控制台 error / 未捕获异常 / 失败请求（有则 FAIL）
import { launchChrome } from "../src/lib/browser.mjs";

const args = process.argv.slice(2);
const get = (k, dflt) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const BASE = get("--base", process.env.UIDICT_BASE ?? "http://localhost:4321");
const pages = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--page") pages.push(args[i + 1]);
}
if (!pages.length) pages.push("/", "/term/magnetic-button/", "/term/bottom-sheet/");

const BUDGET = {
  maxLoadMs: 3000,      // load 事件预算（本地静态服务）
  maxTransferKB: 900,   // 单页传输预算（首页此前全量 demo bundle 一项就 ~600KB）
  maxLongTasks: 5,      // 5s 观测窗内壳长任务数（>50ms）。实测包络：首页冷缓存首帧解析/布局
                        // 产生 1-5 个 150-420ms 任务（CDP 插桩放大），JS 侧已错峰至每帧一挂；
                        // 详情页恒 ≤1。此预算卡「结构性劣化」（如恢复全量 bundle 会直接爆表）
  maxIframes: 10,       // load 后瞬时可见 iframe（懒挂载下应远小于总卡片数）
};

const chrome = await launchChrome();
const results = [];
try {
  for (const p of pages) {
    const url = new URL(p, BASE).href;
    const page = await chrome.newPage();
    const errors = { console: [], runtime: [], failed: [] };
    let bytes = 0;
    const onLog = (e) => { if (e.entry?.level === "error" && e.entry.source !== "network") errors.console.push(e.entry.text ?? "?"); };
    const onExcep = (e) => errors.runtime.push(e.exceptionDetails?.exception?.description ?? e.exceptionDetails?.text ?? "(exception)");
    const onFail = (e) => { if (!e.cancelled) errors.failed.push(`${e.request?.url ?? e.url ?? "?"} ${e.errorText ?? ""}`); };
    // 传输字节只在 loadingFinished 取最终值（responseReceived 时可能还没下完）
    const onLoaded = (e) => { if (e.encodedDataLength > 0) bytes += e.encodedDataLength; };
    chrome.on("Log.entryAdded", onLog);
    chrome.on("Runtime.exceptionThrown", onExcep);
    chrome.on("Network.loadingFailed", onFail);
    chrome.on("Network.loadingFinished", onLoaded);

    await page.c.send("Network.enable", {}, page.sessionId);
    await page.c.send("Log.enable", {}, page.sessionId);
    await page.c.send("Runtime.enable", {}, page.sessionId);
    await page.c.send("Page.enable", {}, page.sessionId);
    await page.c.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    // 长任务探针注入在文档最前，跑在页面自己的上下文里。
    // 按 attribution 归因：containerType=window 是站点壳自己的任务；iframe 归 demo 内容
    // （srcdoc 同源同进程会冒泡上报）——卡顿可观测必须分清「壳的锅」还是「词条 demo 的锅」。
    await page.c.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `window.__longtasks=[];try{new PerformanceObserver((l)=>{for(const e of l.getEntries())window.__longtasks.push({d:e.duration,c:e.attribution?.[0]?.containerType??'window'})}).observe({entryTypes:['longtask']})}catch(e){}`,
    }, page.sessionId);

    const t0 = performance.now();
    const loaded = new Promise((res) => {
      const h = (_p, sid) => { if (sid === page.sessionId) { chrome.off("Page.loadEventFired", h); res(); } };
      chrome.on("Page.loadEventFired", h);
    });
    await page.c.send("Page.navigate", { url }, page.sessionId);
    await Promise.race([loaded, new Promise((r) => setTimeout(r, 15000))]);
    const loadMs = Math.round(performance.now() - t0);
    await new Promise((r) => setTimeout(r, 5000)); // 5s 观测窗：长任务 / 懒挂载行为

    const m = await page.eval(`(() => ({
      longtasks: window.__longtasks ?? [],
      iframes: document.querySelectorAll("iframe").length,
      iframesLive: [...document.querySelectorAll("iframe")].filter((f) => f.srcdoc && f.srcdoc !== "about:blank").length,
      jsHeapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10 : null,
      dcl: performance.getEntriesByType("navigation")[0]?.domContentLoadedEventEnd ?? null,
    }))()`).catch(() => null);

    chrome.off("Log.entryAdded", onLog);
    chrome.off("Runtime.exceptionThrown", onExcep);
    chrome.off("Network.loadingFailed", onFail);
    chrome.off("Network.loadingFinished", onLoaded);
    await page.close();

    const transferKB = Math.round(bytes / 1024);
    const fails = [];
    if (loadMs > BUDGET.maxLoadMs) fails.push(`load ${loadMs}ms > ${BUDGET.maxLoadMs}`);
    if (transferKB > BUDGET.maxTransferKB) fails.push(`传输 ${transferKB}KB > ${BUDGET.maxTransferKB}`);
    // 壳自己的长任务（containerType=window）才计入预算；iframe 里的归 demo 内容，单独展示
    const shellTasks = (m?.longtasks ?? []).filter((t) => t.c === "window");
    const demoTasks = (m?.longtasks ?? []).filter((t) => t.c !== "window");
    const lt = shellTasks.length;
    if (lt > BUDGET.maxLongTasks) fails.push(`壳长任务 ${lt} 个 > ${BUDGET.maxLongTasks}`);
    if ((m?.iframesLive ?? 0) > BUDGET.maxIframes) fails.push(`活 iframe ${m.iframesLive} > ${BUDGET.maxIframes}`);
    if (errors.runtime.length) fails.push(`异常 ${errors.runtime.length}: ${errors.runtime[0].slice(0, 80)}`);
    if (errors.console.length) fails.push(`console.error ${errors.console.length}: ${errors.console[0].slice(0, 80)}`);
    if (errors.failed.length) fails.push(`请求失败 ${errors.failed.length}: ${errors.failed[0].slice(0, 80)}`);

    results.push({ url, ok: fails.length === 0, loadMs, dcl: Math.round(m?.dcl ?? 0), transferKB, longTasks: lt, longTaskMax: Math.round(Math.max(0, ...shellTasks.map((t) => t.d))), demoTasks: demoTasks.length, demoTaskMax: Math.round(Math.max(0, ...demoTasks.map((t) => t.d))), iframes: m?.iframes ?? 0, iframesLive: m?.iframesLive ?? 0, jsHeapMB: m?.jsHeapMB ?? "-", fails });
  }
} finally {
  await chrome.close();
}

for (const r of results) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.url}`);
  console.log(`   DCL ${r.dcl}ms · load ${r.loadMs}ms · 传输 ${r.transferKB}KB · 壳长任务 ${r.longTasks}（最长 ${r.longTaskMax}ms）· demo 长任务 ${r.demoTasks}（最长 ${r.demoTaskMax}ms）· iframe ${r.iframesLive}/${r.iframes} 活/挂 · 堆 ${r.jsHeapMB}MB`);
  if (r.fails.length) console.log(`   超预算/异常：\n   - ${r.fails.join("\n   - ")}`);
}
const bad = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - bad}/${results.length} 页通过性能预算`);
process.exit(bad ? 1 : 0);
