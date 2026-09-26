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
   *  @param {object} [opts] width/height 逻辑视口；settleMs 稳定等待；scale 设备像素比
   *    （2 = 视网膜密度截图——截图管线用，540 逻辑宽截图 1080 物理像素，卡片里不糊）。
   *  @returns {Promise<{console:string[],runtime:string[],failed:string[],title:string}>} */
  async render(html, { width = 900, height = 650, settleMs = 2500, scale = 1 } = {}) {
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
    await this.#send("Emulation.setDeviceMetricsOverride", {
      width, height, deviceScaleFactor: scale, mobile: false,
    });

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
  /** 截图（Buffer）。full=true 时捕获整页（滚动驱动类 demo 的证据在折叠线以下）；
   *  format=webp+quality=82 是截图管线的默认（比 png 小 60-70%，照片级内容几乎无损）；
   *  clip 可指定视口内区域（预览截图只要首屏 540×280 逻辑区域，不截整页）。 */
  async screenshot({ full = true, format = "png", quality, clip } = {}) {
    const params = { format, captureBeyondViewport: full };
    if (format === "webp" || format === "jpeg") params.quality = quality ?? 82;
    if (clip) params.clip = { x: 0, y: 0, width: clip.width, height: clip.height, scale: clip.scale ?? 1 };
    const r = await this.#send("Page.captureScreenshot", params);
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
  /** 真实点击：move → down → up。 */
  async click(x, y) {
    await this.mouse("mouseMoved", x, y);
    await this.mouse("mousePressed", x, y);
    await this.mouse("mouseReleased", x, y);
  }
  /** 交互激活：仅当页面存在「隐藏的浮层/面板」（dialog/sheet/drawer/palette/tooltip…）时，
   *  先点最可能的触发钮、再兜底发 Ctrl+K，把它打开。返回 {opened, via, label}；
   *  无隐藏浮层则返回 null（多数 demo 初始态即代表态，不瞎点）。
   *  目的：命令面板/抽屉/弹层这类「点开才见」的词条，静态截图必须拍到展开态，否则视觉判读会误杀。 */
  async activate() {
    const find = () => this.eval(`(() => {
      const sel = '[role=dialog],[aria-modal=true],.sheet,.drawer,.palette,.modal,.overlay,.popover,.tooltip,.toast,.snackbar,.cmdk,.panel,.menu';
      const hidden = [...document.querySelectorAll(sel)].filter((el) => {
        const s = getComputedStyle(el); const r = el.getBoundingClientRect();
        return s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0 || r.width < 2 || r.height < 2 || r.top >= innerHeight || r.bottom <= 0;
      });
      if (!hidden.length) return { none: true };
      const kw = /打开|显示|唤起|触发|点开|查看|命令|面板|抽屉|弹|提示|气泡|消息条|试试|open|show|trigger|command|palette|drawer|sheet|tooltip|toast/i;
      const cands = [...document.querySelectorAll('button,[role=button],a,[tabindex]')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
      const trig = cands.find((el) => kw.test((el.innerText || el.getAttribute('aria-label') || el.className || ''))) || cands[0];
      if (!trig) return { none: false, noTrig: true, hidden: hidden.length };
      const r = trig.getBoundingClientRect();
      return { none: false, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), label: (trig.innerText || '').trim().slice(0, 24), hidden: hidden.length };
    })()`).catch(() => null);

    const before = await find();
    if (!before || before.none) return null;
    const settle = async () => { await new Promise((r) => setTimeout(r, 450)); return (await find())?.none ?? false; };

    // 路径 1：点触发钮
    let via = null;
    if (!before.noTrig) {
      await this.click(before.x, before.y);
      if (await settle()) via = "click";
    }
    // 路径 2：兜底 Ctrl+K（命令面板常见快捷键）
    if (!via) {
      for (const [key, code, mods] of [["Control","ControlKey"],["k","KeyK"]]) {
        await this.#send("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers: key === "k" ? 2 : 0, windowsVirtualKeyCode: key === "k" ? 75 : 17 });
        await this.#send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: key === "k" ? 75 : 17 });
      }
      if (await settle()) via = "ctrl+k";
    }
    return { opened: !!via, via, label: before.label, hiddenOverlays: before.hidden };
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
