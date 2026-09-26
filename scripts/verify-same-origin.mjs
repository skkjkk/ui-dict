// scripts/verify-same-origin.mjs —— 三态同源的字节级回归验证（产品核心承诺）：
//
//   复制出去的代码 = iframe 渲染的 srcdoc = /demos/<slug>.html 直链文件
//
// 用真浏览器（内置 CDP 渲染器）逐词条打开详情页，取 SSR 内联的 #code 文本与 #live 的
// srcdoc，与构建产物 demos.js、静态直链文件四方对比。任何一环经过 HTML 转义往返后
// 丢字节（引号/实体/截断）都会在这里炸出来。
//
//   node scripts/verify-same-origin.mjs [baseURL]      # 默认 http://localhost:4332
import { TERMS } from "../src/generated/site-data.js";
import demos from "../src/generated/demos.js";
import { launchChrome } from "../src/lib/browser.mjs";

const BASE = process.argv[2] ?? "http://localhost:4332";

const chrome = await launchChrome();
const page = await chrome.newPage();
const results = [];
try {
  for (const t of TERMS) {
    const url = `${BASE}/term/${t.slug}/`;
    await page.c.send("Page.navigate", { url }, page.sessionId);
    // 轮询等岛挂载（冷启动 tab 的模块执行可能晚于固定等待；srcdoc 有值即岛已跑完）
    let srcdocLen = 0;
    for (let i = 0; i < 40 && !srcdocLen; i++) {
      await new Promise((r) => setTimeout(r, 250));
      srcdocLen = await page.eval(`document.getElementById("live")?.srcdoc.length ?? 0`).catch(() => 0);
    }
    const got = await page.eval(`(() => ({
      code: document.getElementById("code")?.textContent ?? null,
      srcdoc: document.getElementById("live")?.srcdoc ?? null,
    }))()`).catch(() => null);
    const direct = await fetch(`${BASE}/demos/${t.slug}.html`).then((r) => r.text()).catch(() => null);

    const want = demos[t.slug];
    const checks = {
      "SSR#code===源码": got?.code != null && got.code === want,
      "srcdoc===源码": got?.srcdoc != null && got.srcdoc === want,
      "直链===源码": direct != null && direct === want,
    };
    const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    results.push(`${failed.length === 0 ? "✓" : "✗"} ${t.no} ${t.nameZh}${failed.length ? "  缺:" + failed.join(",") : ""}`);
  }
} finally {
  await chrome.close();
}
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${TERMS.length - bad}/${TERMS.length} 词条三态逐字节同源`);
process.exit(bad ? 1 : 0);
