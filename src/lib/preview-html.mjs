// src/lib/preview-html.mjs —— 预览 HTML 组装（构建期截图 / 浏览器 iframe 双端共享）。
//
// 分层规则：demo.html 是产品载荷永不改；这里只做「展示层」组装——
// 索引卡缩略图（截图与 iframe）需要的裁剪/隐藏/居中补丁，统一从这一个模块出。
// 之前这段逻辑长在 frame.js（浏览器岛运行时），截图管线复用时被迫 import 整个
// 带 window 依赖的文件；抽出后 Node 侧 gen-previews.mjs 与浏览器侧 frame.js
// 用同一份补丁，预览截图与 iframe 预览「所见即所得」。
//
// 引用关系：previews.mjs（补丁+模式注册表）→ 本模块（组装）→ frame.js / gen-previews.mjs。

import { previewFixOf } from "./previews.mjs";

// 卡片预览只留「组件本体」：demo 页的一切演示文字（标题/段落/步骤标签/参数读数/状态行）
// 在预览里全部隐藏，预览高度让给组件；操作按钮和触发器保留。
// 文字描述统一由词条详情页承担——demo 里这些文字是给「独立打开」的访客看的，删掉不合适，藏掉刚好。
// 另把常规文档流改为竖直水平居中，让组件在预览窗里端端正正。
export const PREVIEW_INJECT = [
  "<style>",
  "html,body{overflow:hidden!important}",
  // 文字说明全隐藏（标签+id+常见类名三层兜底）；.panel-inner p 是手风琴展开后的正文，豁免
  "h1,h2,p,code,.tip,.hint,.note,.desc,.step,.sub,.status,.readout,#readout,#log{display:none!important}",
  ".panel-inner p{display:block!important}",
  // 预览窗居中：压掉 demo 页自己的 padding，组件群竖直水平双居中
  "html,body{display:flex!important;align-items:center!important;justify-content:center!important}",
  "body>.page,body>main,body>.stage,body>.wrap,body>section{padding:0!important;margin:0!important;max-width:none!important}",
  "</style>",
].join("");

export const MOTION_INJECT =
  "<style>*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}</style>";

function injectInto(html, style) {
  return html.includes("</head>") ? html.replace("</head>", style + "</head>") : style + html;
}

/** 组装「索引卡预览」HTML：PREVIEW_INJECT + 词条专属补丁（PREVIEW_FIXES）。
 *  与 frame.js previewSrcdoc 的区别：不含 reduce-motion 注入（浏览器岛偏好是运行时关注点，
 *  截图管线固定按全动效截图——缩略图要展示的就是动效本身）。
 *  @param {string} html demo 源码
 *  @param {object} [opts] 可选覆盖：injectStyle 追加自定义样式；fix 跳过注册表查表直接指定 */
export function buildPreviewHtml(html, { injectStyle = "", fix } = {}) {
  if (!html) return html;
  const entryFix = fix === undefined ? previewFixOf(html) : fix;
  const style = PREVIEW_INJECT + (entryFix ? `<style>${entryFix}</style>` : "") + (injectStyle ? `<style>${injectStyle}</style>` : "");
  return injectInto(html, style);
}

export { injectInto };
