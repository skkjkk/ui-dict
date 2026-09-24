// src/scripts/frame.js —— 浏览器端共用的 iframe / 参数逻辑（纯 DOM，无框架）。
// 核心承诺：iframe.srcdoc === 复制出去的 demoCode === 下载的文件，三者逐字节同源。
import { setParams } from "@/lib/params.mjs";

/** 懒挂载：元素进视口才写 srcdoc，省掉首屏几十个 iframe 的开销。 */
export function lazyMountIframes(select, getHtml) {
  const nodes = Array.from(document.querySelectorAll(select));
  if (!("IntersectionObserver" in window)) {
    nodes.forEach((f) => (f.srcdoc = getHtml(f)));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const f = e.target;
      if (!f.srcdoc) f.srcdoc = getHtml(f);
      io.unobserve(f);
    }
  }, { rootMargin: "200px" });
  nodes.forEach((f) => io.observe(f));
}

/** 把参数块当前值改写进 demo，返回新 HTML（用于实时重渲染 + 代码块同步）。 */
export function demoWithParams(baseHtml, params, overrides) {
  return setParams(baseHtml, pick(params, overrides));
}

function pick(declared, overrides) {
  const out = {};
  for (const p of declared) if (p.key in overrides) out[p.key] = overrides[p.key];
  return out;
}

/** 复制到剪贴板 + 按钮瞬时反馈。 */
export function copyText(btn, text) {
  const done = () => {
    const old = btn.textContent;
    btn.textContent = "✓ 已复制";
    btn.disabled = true;
    setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 1200);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallback(text, done));
  } else fallback(text, done);
}

function fallback(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); done(); } catch { /* ignore */ }
  document.body.removeChild(ta);
}

/** 独立页打开 = 与「粘进空白文件双击」严格等价（Blob URL）。 */
export function openStandalone(html) {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
