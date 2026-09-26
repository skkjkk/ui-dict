// src/lib/previews.mjs —— 索引卡预览的「展示层补丁」注册表（构建期/浏览器双端共享）。
//
// 分层规则：demo.html 是**产品载荷**，永远不改；这里登记的 CSS 只在「索引卡缩略图」这一
// 展示位注入，属于站点外壳。改预览观感 = 改这个文件，不碰 terms/。
//
// 为什么抽出来（高内聚低耦合）：
//  · frame.js 是浏览器岛运行时（iframe 挂载/复制/动效开关），不该背「每加一个词条补一条
//    CSS」这类内容性配置；抽到 lib/ 后 Node 侧 QA 也能复用同一份注册表做体检。
//  · 键 = 词条编号（C-05…），与 terms/<category>/<id>/ 解耦——词条挪目录不用改这里。
//
// 写法约束：只允许「藏演示脚手架 / 调演示排布」，禁止碰 demo 的交互逻辑；
// 独立打开与复制出去的代码依旧是完整 demo（三态同源不受影响）。

export const PREVIEW_FIXES = {
  // C-05 抽屉：压暗主内容区的教学文案（.card）属说明文字，预览里隐藏
  "C-05": ".card{display:none!important}",
  // C-07 手风琴：demo 脚本本来就默认展开第一条、可点折叠（setExpanded(item, i===0)）。
  // 这里只藏演示工具条（单开模式开关 + 联系支持链接），展开/折叠交还 demo 自己的逻辑——
  // 之前注入 grid-template-rows:1fr!important 把 0fr↔1fr 切换压死导致无法折叠，已撤
  "C-07": [
    ".bar{display:none!important}",
    ".acc{min-width:360px!important}",
  ].join(""),
  // C-08 气泡卡片：demo 为三段翻转教学布了三个锚点（常规/右缘/页脚）+ 46vh 滚动垫。
  // 预览里只留第一个锚点居中——"一个锚点 + 点开的浮层"就是 Popover 的完整语义
  "C-08": [
    ".edge-row,.spacer,.bottom-row{display:none!important}",
  ].join(""),
  // C-09 分段控件：预览里固定中等宽（272px，与轨道原生比例一致）并居中；
  // 面板 min-height 取三视图里最高的网格视图，三个选项切换时大小不变
  "C-09": [
    ".seg{width:272px!important;max-width:none!important}",
    ".panel{width:272px!important;max-width:none!important;min-height:150px!important}",
  ].join(""),
  // C-11 上下文菜单：数据行已在 demo 源里补足，预览不再撑高，保持自然高度
  "C-11": "",
};

/** 从 demo <title>（形如 "… · ui-dict C-07"）里取词条号；取不到返回空串。 */
export function entryIdOf(html) {
  const m = String(html).match(/<title>[^<]*·\s*ui-dict\s*([A-Z]-\d+)/);
  return m ? m[1] : "";
}

/** 查某段 demo 的预览补丁（无注册返回空串）。 */
export function previewFixOf(html) {
  const id = entryIdOf(html);
  return (id && PREVIEW_FIXES[id]) || "";
}
