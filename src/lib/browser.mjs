// src/lib/browser.mjs
// 零依赖 CDP 渲染器 —— 回放测试的「真浏览器验收」层。
// 只用 Node 24 内置 fetch + global WebSocket + child_process，不引 playwright/puppeteer。
// 浏览器发现顺序：UIDICT_CHROME 环境变量 → ms-playwright 缓存（取最新）→ 系统 Chrome/Edge。
//
// 渲染契约：
//  · HTML 写临时文件后 file:/// 导航 —— 与「粘进空白文件双击打开」严格等价；
//  · 渲染副本缺 DOCTYPE 时补一个（只影响渲染，不改被闸检查的源字符串 —— 闸与渲染互不污染）；
//  · 控制台 error / 未捕获异常 / 网络失败请求全程收集，作为生成代码的运行时缺陷证据。

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME_CANDIDATES = [
  process.env.UIDICT_CHROME,
  ...(() => {
    try {
      const root = path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright");
      return readdirSync(root)
        .filter((d) => /^chromium-\d+$/.test(d))
        .sort((a, b) => parseInt(b.split("-")[1]) - parseInt(a.split("-")[1]))
        .map((d) => path.join(root, d, "chrome-win64", "chrome.exe"));
    } catch {
      return [];
    }
  })(),
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

export function findChrome() {
  for (const c of CHROME_CANDIDATES) if (existsSync(c)) return c;
  throw new Error(
    "找不到可用的 Chrome/Edge。安装任一：`npx playwright install chromium` 或系统 Chrome；" +
      "或设 UIDICT_CHROME=<chrome.exe 路径>"
  );
}

function freePort() {
  return new Promise((res, rej) => {
    const srv = net.createServer();
    srv.on("error", rej);
    srv.listen(0, "127.0.0.1", () => {
      const p = srv.address().port;
      srv.close(() => res(p));
    });
  });
}

/** 启动一个受控 headless Chrome（独立 user-data-dir + 空闲端口），返回 CDP 客户端。 */
export async function launchChrome() {
  const exe = findChrome();
  const udd = path.join(os.tmpdir(), `uidict-cdp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const port = await freePort();
  const child = spawn(
    exe,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${udd}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-gpu",
      "--hide-scrollbars",
      "--allow-file-access-from-files",
      "about:blank",
    ],
    { stdio: "ignore", detached: false }
  );
  const base = `http://127.0.0.1:${port}`;
  const t0 = Date.now();
  let ready = false;
  while (Date.now() - t0 < 20000) {
    try {
      const v = await (await fetch(`${base}/json/version`, { signal: AbortSignal.timeout(2000) })).json();
      if (v.webSocketDebuggerUrl) { ready = true; break; }
    } catch {
      /* 等启动 */
    }
    await sleep(300);
  }
  if (!ready) {
    try { child.kill("SIGKILL"); } catch { /* ignore */ }
    throw new Error("Chrome CDP 端点 20s 内未就绪：" + exe);
  }
  const client = new CdpClient(base, child, udd);
  await client.connect();
  return client;
}

class CdpClient {
  constructor(base, child, udd) {
    this.base = base;
    this.child = child;
    this.udd = udd;
    this.ws = null;
    this.id = 0;
    this.pend = new Map();
    this.listeners = new Map(); // method -> Set<fn>
  }
  async connect() {
    const v = await (await fetch(`${this.base}/json/version`)).json();
    this.ws = new WebSocket(v.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = () => rej(new Error("CDP WebSocket 连接失败"));
    });
    this.ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.id && this.pend.has(m.id)) {
        const { res, rej } = this.pend.get(m.id);
        this.pend.delete(m.id);
        m.error ? rej(new Error(`${m.method ?? "?"} → ${m.error.message} (${m.error.code})`)) : res(m.result);
        return;
      }
      if (m.method) {
        for (const fn of this.listeners.get(m.method) ?? []) {
          try { fn(m.params ?? {}, m.sessionId); } catch { /* 监听器异常不拖垮会话 */ }
        }
      }
    };
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((res, rej) => this.pend.set(id, { res, rej }));
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method).add(fn);
  }
  off(method, fn) {
    this.listeners.get(method)?.delete(fn);
  }
  async newPage() {
    const { targetId } = await this.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await this.send("Target.attachToTarget", { targetId, flatten: true });
    return new Page(this, targetId, sessionId, this.udd);
  }
  async close() {
    try { this.ws?.close(); } catch { /* ignore */ }
    try { this.child.kill(); } catch { /* ignore */ }
    try {
      const { rm } = await import("node:fs/promises");
      await rm(this.udd, { recursive: true, force: true, maxRetries: 2 });
    } catch { /* ignore */ }
  }
}

export class Page {
  constructor(client, targetId, sessionId, udd) {
    this.c = client;
    this.targetId = targetId;
    this.sessionId = sessionId;
    this.udd = udd;
  }
  #send(method, params) {
    return this.c.send(method, params ?? {}, this.sessionId);
  }
  /** 渲染一段 HTML 源码（临时文件 + file:/// 导航，等价于双击打开 demo.html）。
   *  @returns {Promise<{console:string[],runtime:string[],failed:string[],title:string}>} */
  async render(html, { width = 900, height = 650, settleMs = 2500 } = {}) {
    const errors = { console: [], runtime: [], failed: [] };
    const onExcep = (p) => errors.runtime.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "(exception)");
    const onReqFail = (p) => { if (!p.cancelled) errors.failed.push(`${p.type ?? "?"} ${p.request?.url ?? p.url ?? "?"} — ${p.errorText ?? "?"}`); };
    const onLog = (p) => { if (p.entry?.level === "error" && p.entry.source !== "network") errors.console.push(p.entry.text ?? "(log error)"); };
    this.c.on("Log.entryAdded", onLog);
    this.c.on("Runtime.exceptionThrown", onExcep);
    this.c.on("Network.loadingFailed", onReqFail);
    await this.#send("Runtime.enable");
    await this.#send("Log.enable");
    await this.#send("Network.enable");
    await this.#send("Page.enable");

    // 渲染副本：缺 DOCTYPE 时补一个（仅影响渲染，不改被闸检查的源字符串）
    const renderHtml = /^\s*<!doctype html>/i.test(html) ? html : "<!DOCTYPE html>\n" + html;
    const { writeFileSync, rmSync } = await import("node:fs");
    const tmp = path.join(this.udd, `render-${Date.now()}.html`);
    writeFileSync(tmp, renderHtml, "utf8");
    const url = "file:///" + tmp.replace(/\\/g, "/");

    const loaded = new Promise((res) => {
      const h = (_p, sid) => { if (sid === this.sessionId) { this.c.off("Page.loadEventFired", h); res(); } };
      this.c.on("Page.loadEventFired", h);
    });
    await this.#send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await this.#send("Page.navigate", { url });
    await Promise.race([loaded, sleep(6000)]);
    await sleep(settleMs); // 等动效/异步行为稳定
    const title = await this.#send("Runtime.evaluate", { expression: "document.title", returnByValue: true })
      .then((r) => String(r.result?.value ?? ""))
      .catch(() => "");
    try { rmSync(tmp, { force: true }); } catch { /* ignore */ }
    this.c.off("Log.entryAdded", onLog);
    this.c.off("Runtime.exceptionThrown", onExcep);
    this.c.off("Network.loadingFailed", onReqFail);
    return { ...errors, title };
  }
  /** 截图（PNG Buffer）。full=true 时捕获整页（滚动驱动类 demo 的证据在折叠线以下）。 */
  async screenshot({ full = true } = {}) {
    const r = await this.#send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full });
    return Buffer.from(r.data, "base64");
  }
  /** 页内求值（returnByValue + awaitPromise）。 */
  async eval(expression) {
    const r = await this.#send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text ?? "eval 异常");
    return r.result?.value;
  }
  /** 真实指针事件（Input.dispatchMouseEvent，走命中测试，非合成捷径）。 */
  async mouse(type, x, y) {
    await this.#send("Input.dispatchMouseEvent", {
      type, x, y,
      button: type === "mouseMoved" ? "none" : "left",
      clickCount: type === "mouseMoved" ? 0 : 1,
    });
  }
  /** 真实按键事件。 */
  async key(key, code) {
    const vk = code === "Escape" ? 27 : code === "Enter" ? 13 : 0;
    await this.#send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk });
    await this.#send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk });
  }
  async close() {
    await this.c.send("Target.closeTarget", { targetId: this.targetId }).catch(() => {});
  }
}
