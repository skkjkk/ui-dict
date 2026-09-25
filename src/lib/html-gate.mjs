// src/lib/html-gate.mjs
// 「单文件铁律」静态闸 —— 从 scripts/qa-demofiles.mjs 抽取为共享模块，
// 供生产 demo 出厂自检与回放测试（scripts/replay-test.mjs）同一把尺子复检生成代码。
// 正则与语义与原 QA 脚本逐字一致，两处永远同标准。

export const FORBIDDEN = [
  { re: /<link[^>]+href=["']https?:/i, why: "外链 CSS（应零网络请求）" },
  { re: /<script[^>]+src=["']https?:/i, why: "外链 JS 库（应零依赖）" },
  { re: /@import\s+url\((['"]?)https?:/i, why: "CSS @import 外链字体/样式" },
  { re: /\bfetch\s*\(\s*["']https?:/i, why: "运行时网络请求" },
  { re: /\bimport\s+.*from\s+["'](?!data:)/i, why: "ESM import（demo 须自包含）" },
];

/**
 * 对一段 demo HTML 跑单文件铁律。
 * @param {string} html 完整文档源码
 * @param {{ requireDoctype?: boolean }} opts requireDoctype=false 时
 *        把「缺 DOCTYPE 但文档以 <html 开头」降级为警告（模型常省略 DOCTYPE；
 *        生产词条仍由 qa-demofiles 硬卡源文件）。
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function gateHtml(html, { requireDoctype = true } = {}) {
  const errors = [];
  const warnings = [];
  const trimmed = html.trimStart();
  if (!/^<!doctype html>/i.test(trimmed)) {
    if (requireDoctype) {
      errors.push("缺少 <!DOCTYPE html>（会落 quirks mode）");
    } else if (/^<html[\s>]/i.test(trimmed)) {
      warnings.push("缺 <!DOCTYPE html>（渲染已按标准模式强制，未落 quirks）");
    } else {
      errors.push("缺少 <!DOCTYPE html> 且非完整 HTML 文档");
    }
  }
  for (const f of FORBIDDEN) {
    if (f.re.test(html)) errors.push(`违反单文件铁律 —— ${f.why}`);
  }
  if (/<(script|link)[^>]+src=["'](?!data:)[^"']*\/(cdn|unpkg|jsdelivr|cdnjs)/i.test(html))
    errors.push("疑似外链 CDN 资源");
  return { errors, warnings };
}
