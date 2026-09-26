// src/lib/preview-modes.mjs —— 首页预览三态注册表（live / hover / static）。
// 与 previews.mjs（预览补丁）同一套键空间（词条编号），但职责分开：
// previews.mjs 管「卡片里藏什么/摆哪」（CSS 补丁），这里管「卡片要不要活、怎么活」。
//
// 背景：全 iframe 懒挂载方案里，滚动时每个进视口的卡片都要 fetch demo + 起 iframe 文档
// （一卡一进程配额，观测到 150-420ms 级长任务），33 卡的长列表滚动就是持续的挂载卡顿。
// 三态把开销按「词条类型需要什么」重新分配：
//
//   live   视口内常活 iframe——动效类词条的效果就是「一直在动」，静态截图无法表达；
//          保持 lazyRecycle 策略（进视口挂、离视口 3s 回收）。
//   hover  静态截图打底 + 悬停才挂 iframe——交互触发类词条（tooltip/抽屉/命令面板）
//          的效果要用户参与才发生；截图拍「激活态」一眼看懂，悬停即上手玩。
//   static 纯静态截图，零 iframe——布局/风格类词条的效果是一幅画，截图 0 开销表达 100%。
//
// 未登记的词条走分类默认：motion → live；interaction/component → hover；layout/style → static。
// 改某条的模式 = 在 PREVIEW_MODES 里加一行，不碰其他层。
import { previewFixOf } from "./previews.mjs";

export const PREVIEW_MODES = {
  // 例外登记（覆盖分类默认）。键 = 词条编号。
  // 例："C-07": "live",
  // motion 分类里「静止截图也能讲清楚」的词条可降为 hover/static（当前无——动效类都该活）。
  // interaction 分类里「持续自动演示」的词条可升为 live：
  "I-02": "live", // swipe-actions：空态卡片自动循环演示滑动删除，无需悬停
};

/** 分类默认预览态。motion = 视口常活；interaction = 悬停激活；component/layout/style = 静态截图。 */
export const DEFAULT_PREVIEW_MODE = {
  motion: "live",
  interaction: "hover",
  component: "hover",
  layout: "static",
  style: "static",
};

const MODES = new Set(["live", "hover", "static"]);

/** 查某词条的预览态（无登记/登记非法时回退分类默认）。
 *  @param {{no?:string, category?:string}} t 词条元数据（entry.json 的 no + category） */
export function previewModeOf({ no, category } = {}) {
  const custom = no && PREVIEW_MODES[no];
  if (custom && MODES.has(custom)) return custom;
  return DEFAULT_PREVIEW_MODE[category] ?? "static";
}

// gen-previews.mjs 需要按编号查预览补丁（与 iframe 预览同一份），这里透传
export { previewFixOf };
