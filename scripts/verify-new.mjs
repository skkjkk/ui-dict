// scripts/verify-new.mjs
// 新增词条的「真机验收」——复用项目自带的零依赖 CDP 渲染器（src/lib/browser.mjs），
// 与回放测试同一套内核、同一套契约（临时文件 + file:/// 导航 ≡ 双击打开 demo.html）。
//
// 每条断言三类：
//   ① 渲染健康：无未捕获异常、无 console error、无失败网络请求（零请求是站点承诺）
//   ② 静态契约：DOCTYPE / 单文件铁律 / 参数块键一致（复用共享闸）
//   ③ 交互断言：逐条针对该词条的「定义核心」写的最小可判定断言
// 截图落 replay-verify/<slug>.png 作为人工判读证据。
//
// 用法：node scripts/verify-new.mjs [slug...]   （不给 slug 则跑内置的 10 条新词条）
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import path from "node:path";
import { launchChrome } from "../src/lib/browser.mjs";
import { gateHtml } from "../src/lib/html-gate.mjs";
import { getParams } from "../src/lib/params.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TERMS = path.join(ROOT, "terms");
const SHOT = path.join(ROOT, "replay-verify");

const DEFAULT = [
  "popover", "segmented-control", "otp-input", "context-menu",
  "drag-reorder", "swipe-actions", "z-stack-cards", "breakout-column",
  "view-transition", "stagger",
];
const slugs = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const targets = slugs.length ? slugs : DEFAULT;

// ---------- 每条词条的交互断言（在页面里求值，返回 {ok, detail}） ----------
const PROBES = {
  // C-08：浮层必须能开、能关，且「点浮层内不关闭」
  "popover": `(async () => {
    const trig = [...document.querySelectorAll('button,[role=button]')]
      .find(b => /open|打开|显示|切换|popover/i.test(b.innerText + (b.getAttribute('aria-label')||'') + b.className));
    if (!trig) return { ok:false, detail:'找不到触发按钮' };
    trig.click(); await new Promise(r=>setTimeout(r,400));
    const layer = [...document.querySelectorAll('[role=dialog],.popover,.pop,[class*=popover]')]
      .find(el => { const s=getComputedStyle(el); const r=el.getBoundingClientRect();
        return s.display!=='none' && s.visibility!=='hidden' && parseFloat(s.opacity)>0.05 && r.width>20 && r.height>20; });
    if (!layer) return { ok:false, detail:'点击后浮层未出现' };
    const aria = trig.getAttribute('aria-expanded');
    // 点浮层内部（取中心）不应关闭
    const r = layer.getBoundingClientRect();
    const inner = document.elementFromPoint(Math.round(r.left+r.width/2), Math.round(r.top+r.height/2));
    if (inner && layer.contains(inner)) inner.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    await new Promise(r2=>setTimeout(r2,350));
    const still = getComputedStyle(layer).visibility!=='hidden' && parseFloat(getComputedStyle(layer).opacity)>0.05;
    return { ok: still, detail: 'aria-expanded='+aria+' 点内部后仍开='+still };
  })()`,

  // C-09：分段控件必须有滑块位移 + 选中态 + 内容区切换
  "segmented-control": `(async () => {
    const tabs = [...document.querySelectorAll('[role=tab]')];
    if (tabs.length < 2) return { ok:false, detail:'role=tab 段数不足：'+tabs.length };
    const ind = document.querySelector('[class*=indicator],[class*=thumb],[class*=slider],.ind');
    if (!ind) return { ok:false, detail:'找不到滑块 indicator' };
    const before = getComputedStyle(ind).transform;
    tabs[1].click(); await new Promise(r=>setTimeout(r,450));
    const after = getComputedStyle(ind).transform;
    const sel = tabs[1].getAttribute('aria-selected');
    return { ok: before!==after && sel==='true', detail:'位移变化='+(before!==after)+' aria-selected='+sel };
  })()`,

  // C-10：粘贴分发 + 退格回跳，两条规则都要成立
  "otp-input": `(async () => {
    const cells = [...document.querySelectorAll('input')].filter(i => i.maxLength===1 || i.getAttribute('maxlength')==='1');
    if (cells.length < 4) return { ok:false, detail:'格子数不足：'+cells.length };
    // 粘贴分发：直接派发 paste 事件
    const dt = new DataTransfer(); dt.setData('text/plain','123456');
    cells[0].focus();
    cells[0].dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));
    await new Promise(r=>setTimeout(r,300));
    const filled = cells.filter(c=>c.value.trim()!=='').length;
    // 退格回跳：清空第 3 格后从第 4 格退格，应回到第 3 格
    cells.forEach(c=>c.value='');
    cells[2].value='5'; cells[3].focus();
    cells[3].dispatchEvent(new KeyboardEvent('keydown',{key:'Backspace',bubbles:true,cancelable:true}));
    await new Promise(r=>setTimeout(r,250));
    const back = document.activeElement === cells[2];
    return { ok: filled>=4 && back, detail:'粘贴填 '+filled+' 格 · 退格回跳='+back };
  })()`,

  // C-11：右键唤出 + 边界翻转 + Esc 关闭
  "context-menu": `(async () => {
    const zone = document.querySelector('[data-ctx],[class*=zone],[class*=area],main,.stage') || document.body;
    const r = zone.getBoundingClientRect();
    const x = Math.round(r.left + r.width - 6), y = Math.round(r.top + r.height - 6); // 贴右下角 → 必须翻转
    const ev = new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:x,clientY:y});
    zone.dispatchEvent(ev);
    await new Promise(r2=>setTimeout(r2,400));
    const menu = [...document.querySelectorAll('[role=menu],.menu,[class*=menu]')]
      .find(el => { const s=getComputedStyle(el); const b=el.getBoundingClientRect();
        return s.display!=='none' && s.visibility!=='hidden' && b.width>60 && b.height>30; });
    if (!menu) return { ok:false, detail:'右键未唤出菜单（defaultPrevented='+ev.defaultPrevented+'）' };
    const b = menu.getBoundingClientRect();
    const inView = b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    await new Promise(r3=>setTimeout(r3,350));
    const closed = getComputedStyle(menu).visibility==='hidden' || getComputedStyle(menu).display==='none' || parseFloat(getComputedStyle(menu).opacity)<0.05;
    return { ok: inView && closed, detail:'边界内='+inView+' Esc关闭='+closed+' rect='+Math.round(b.right)+'x'+Math.round(b.bottom) };
  })()`,

  // I-03：拖拽后顺序真的变了
  "drag-reorder": `(async () => {
    const rows = [...document.querySelectorAll('[data-row],[class*=row],[class*=item],li')]
      .filter(el => { const r=el.getBoundingClientRect(); return r.height>24 && r.width>80; });
    if (rows.length < 3) return { ok:false, detail:'可拖行不足：'+rows.length };
    const list = rows[0].parentElement;
    const firstText = () => [...list.children].map(c=>(c.innerText||'').trim().slice(0,8)).join('|');
    const before = firstText();
    // 真实指针拖拽：按住第 1 行，拖到第 3 行位置
    const a = rows[0].getBoundingClientRect(), b = rows[2].getBoundingClientRect();
    const fire = (type, x, y, extra={}) => rows[0].dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',buttons:type==='pointerup'?0:1,...extra}));
    fire('pointerdown', a.left+30, a.top+a.height/2);
    fire('pointermove', a.left+30, a.top+a.height/2+10);
    fire('pointermove', b.left+30, b.top+b.height/2);
    fire('pointerup', b.left+30, b.top+b.height/2);
    await new Promise(r=>setTimeout(r,600));
    const after = firstText();
    return { ok: before !== after, detail:'顺序变化='+(before!==after)+' ['+before.slice(0,26)+'] → ['+after.slice(0,26)+']' };
  })()`,

  // I-04：左滑揭示动作 + 同时只有一行展开
  "swipe-actions": `(async () => {
    const rows = [...document.querySelectorAll('[data-swipe],[class*=row],[class*=item],li')]
      .filter(el => { const r=el.getBoundingClientRect(); return r.height>30 && r.width>120; });
    if (rows.length < 2) return { ok:false, detail:'可滑行不足：'+rows.length };
    const drag = (el, dx) => {
      const r = el.getBoundingClientRect(), y = r.top + r.height/2, x0 = r.left + r.width - 30;
      const ev = (t,x) => el.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,clientX:x,clientY:y,pointerId:2,pointerType:'touch',buttons:t==='pointerup'?0:1}));
      ev('pointerdown', x0); ev('pointermove', x0-12); ev('pointermove', x0+dx); ev('pointerup', x0+dx);
    };
    drag(rows[0], -Math.round(rows[0].getBoundingClientRect().width*0.75));
    await new Promise(r=>setTimeout(r,450));
    const moved0 = Math.abs(new DOMMatrixReadOnly(getComputedStyle(rows[0]).transform).m41) > 20;
    drag(rows[1], -Math.round(rows[1].getBoundingClientRect().width*0.75));
    await new Promise(r=>setTimeout(r,450));
    const t0 = Math.abs(new DOMMatrixReadOnly(getComputedStyle(rows[0]).transform).m41);
    const moved1 = Math.abs(new DOMMatrixReadOnly(getComputedStyle(rows[1]).transform).m41) > 20;
    return { ok: moved0 && moved1 && t0 < 20, detail:'首行滑动='+moved0+' 次行滑动='+moved1+' 首行已收起(位移'+Math.round(t0)+'px)='+(t0<20) };
  })()`,

  // L-05：卡片真的是 sticky 且逐张 top 递增（堆叠成立的前提）
  "z-stack-cards": `(() => {
    const cards = [...document.querySelectorAll('[class*=card],[data-card],section,article')]
      .filter(el => getComputedStyle(el).position === 'sticky');
    if (cards.length < 3) return { ok:false, detail:'position:sticky 卡片不足：'+cards.length };
    const tops = cards.map(c => parseFloat(getComputedStyle(c).top) || 0);
    const increasing = tops.every((t,i) => i===0 || t >= tops[i-1]);
    return { ok: increasing, detail: cards.length+' 张 sticky，top=['+tops.join(',')+'] 递增='+increasing };
  })()`,

  // L-06：正文栏宽度受控 + 无横向溢出 + 存在破格元素
  "breakout-column": `(() => {
    const overflow = document.documentElement.scrollWidth > innerWidth + 1;
    const measure = [...document.querySelectorAll('[class*=measure],[class*=prose],[class*=body],[class*=column],main,p')]
      .map(el => el.getBoundingClientRect().width).filter(w => w > 200);
    const widest = Math.max(0, ...measure);
    const breakout = [...document.querySelectorAll('[class*=breakout],[class*=bleed],[class*=wide],figure,blockquote,aside')]
      .some(el => el.getBoundingClientRect().width > widest + 8);
    return { ok: !overflow && breakout, detail:'横向溢出='+overflow+' 正文最宽='+Math.round(widest)+'px 有更宽元素='+breakout };
  })()`,

  // M-05：共享元素过渡 —— API 存在 + 过渡真的发生（DOM 切换 + 名字唯一）
  "view-transition": `(async () => {
    const hasApi = typeof document.startViewTransition === 'function';
    const thumbs = [...document.querySelectorAll('[class*=thumb],[class*=card],[class*=grid] > *,li,figure')]
      .filter(el => { const r=el.getBoundingClientRect(); return r.width>40 && r.height>40; });
    if (thumbs.length < 2) return { ok:false, detail:'缩略图不足：'+thumbs.length };
    const names = thumbs.map(t => getComputedStyle(t).viewTransitionName).filter(n => n && n !== 'none');
    const dup = names.length !== new Set(names).size;
    const before = document.body.innerHTML.length;
    thumbs[0].click();
    await new Promise(r=>setTimeout(r,900));
    const after = document.body.innerHTML.length;
    return { ok: hasApi && before !== after && !dup, detail:'API='+hasApi+' DOM切换='+(before!==after)+' 名字唯一='+!dup+' ('+names.length+' 个)' };
  })()`,

  // M-06：错峰 —— 各项 delay 递增，且总时长有封顶
  "stagger": `(() => {
    const items = [...document.querySelectorAll('[class*=item],[class*=card],[class*=cell],li')]
      .filter(el => { const r=el.getBoundingClientRect(); return r.width>30 && r.height>20; });
    if (items.length < 4) return { ok:false, detail:'参与错峰项不足：'+items.length };
    const delays = items.map(el => {
      const s = getComputedStyle(el);
      const d = parseFloat(s.animationDelay) || 0;
      const v = parseFloat(s.getPropertyValue('--i'));
      return { d, v: Number.isNaN(v) ? null : v };
    });
    const hasIdx = delays.some(x => x.v !== null);
    const ds = delays.map(x => x.d);
    const nonzero = new Set(ds.filter(d => d > 0)).size;
    const capped = ds.length > 1 ? Math.max(...ds) <= 3.0 : true;  // 封顶：最长延迟不超过 3s
    return { ok: (hasIdx || nonzero >= 2) && capped, detail:'--i 索引='+hasIdx+' 不同延迟数='+nonzero+' 最大延迟='+Math.max(...ds)+'s 封顶='+capped };
  })()`,
};

async function findTerm(slug) {
  for (const cat of await fs.readdir(TERMS, { withFileTypes: true })) {
    if (!cat.isDirectory()) continue;
    const p = path.join(TERMS, cat.name, slug);
    try {
      const entry = JSON.parse(await fs.readFile(path.join(p, "entry.json"), "utf8"));
      const demo = await fs.readFile(path.join(p, "demo.html"), "utf8");
      return { cat: cat.name, dir: p, entry, demo };
    } catch { /* 继续 */ }
  }
  return null;
}

await fs.mkdir(SHOT, { recursive: true });
const chrome = await launchChrome();
const page = await chrome.newPage();
const rows = [];

for (const slug of targets) {
  const found = await findTerm(slug);
  if (!found) { rows.push({ slug, ok: false, why: "目录/文件缺失" }); continue; }
  const { cat, entry, demo } = found;

  // ② 静态契约
  const gate = gateHtml(demo);
  const declared = Array.isArray(entry.params) ? entry.params : [];
  const block = declared.length ? getParams(demo) : null;
  const paramOk = declared.length === 0 || (block && declared.every(p => p.key in block));
  if (gate.errors.length || !paramOk) {
    rows.push({ slug, ok: false, why: "静态契约: " + [...gate.errors, ...(paramOk ? [] : ["params 键不一致"])].join("; ") });
    continue;
  }

  // ① 渲染健康
  const r = await page.render(demo, { width: 1100, height: 800, settleMs: 2200 });
  const healthy = r.runtime.length === 0 && r.console.length === 0 && r.failed.length === 0;

  // ③ 交互断言
  let probe = { ok: false, detail: "无探针" };
  if (PROBES[slug]) {
    try {
      const out = await page.eval(PROBES[slug]);
      probe = out && typeof out === "object" ? out : { ok: false, detail: String(out) };
    } catch (e) {
      probe = { ok: false, detail: "探针异常: " + e.message.slice(0, 120) };
    }
  }

  const shot = await page.screenshot({ full: true }).catch(() => null);
  if (shot) await fs.writeFile(path.join(SHOT, slug + ".png"), shot);

  rows.push({
    slug, cat, no: entry.no, nameZh: entry.nameZh,
    ok: healthy && probe.ok,
    why: [
      healthy ? null : `渲染缺陷(异常${r.runtime.length}/console${r.console.length}/请求失败${r.failed.length})`,
      probe.ok ? null : `断言未过: ${probe.detail}`,
    ].filter(Boolean).join(" · ") || "全过",
    detail: probe.detail,
  });
}

await page.close();
await chrome.close();

console.log("\n=== 新增词条真机验收 ===");
for (const x of rows) {
  console.log(`${x.ok ? "✓" : "✗"} ${x.no ?? "??"} ${String(x.nameZh ?? x.slug).padEnd(8)} ${x.ok ? x.detail : x.why}`);
}
const bad = rows.filter(x => !x.ok).length;
console.log(`\n${rows.length - bad}/${rows.length} 条通过 · 截图 → replay-verify/`);
process.exit(bad ? 1 : 0);