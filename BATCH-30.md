# 批次规格 · 20 → 30 条（v0.3 扩产）

> 本文件是本批次 10 条新词条的**唯一权威规格**。写手按此写，审校按此验。
> 上位规范：`NEW_ENTRY.md`（工厂规范）+ `README.md`（schema）+ `src/lib/validate.mjs`（代码契约，最终仲裁）。
> ⚠️ `NEW_ENTRY.md` 有两处已与实现漂移，**以代码为准**：
> - 写的是 `entry.js` → 实际是 **`entry.json`**
> - 写的是 `params: [{ name, def }]` → 实际是 **`params: [{ key, label, def, min, max, step, hint }]`**

## 0. 硬约束（机器会卡，违反即构建失败）

| # | 约束 | 依据 |
|---|---|---|
| 1 | 文件落 `terms/<category>/<id>/{entry.json, demo.html}`，目录名 = `entry.id` | `terms.mjs` |
| 2 | `no` 必须匹配 `^[CMILS]-\d{2}$` 且前缀与 category 一致 | `validate.mjs` superRefine |
| 3 | `id` 必须 kebab-case：`^[a-z0-9]+(?:-[a-z0-9]+)*$` | `validate.mjs` |
| 4 | `aliases` ≥ 3 条，且 **≥3 条是"感觉描述"**（"糊了一层玻璃"式），不是同义词堆砌 | `NEW_ENTRY.md` §2 |
| 5 | `definition` ≥ 20 字，须含**与最近邻词的辨析一句**，禁循环定义 | schema + §2 |
| 6 | `promptTemplate.core` ≥ 20 字；`constraints` ≥1；`verify` ≥1 | `PromptCard` |
| 7 | `contributors` ≥ 1 条，格式 `{generator, reviewer, date}` | schema |
| 8 | `refs` 必须是**合法 URL**（`z.string().url()`），且**真实存在** | schema |
| 9 | **禁写 `verifiedWith`** —— 该字段由 `pnpm replay` 回放测试回填，人工不得臆造 | 项目铁律 #3 |
| 10 | demo.html 必须 `<!DOCTYPE html>` 开头 | `html-gate.mjs` |
| 11 | demo.html **零外部引用**：禁 `https?` 的 link/script、禁 CDN、禁 `fetch('http…')`、禁 `import … from` | `html-gate.mjs` |
| 12 | entry 声明了 `params` → demo 必须含 `/* ui-dict:params:start */` … `:end */` 块，`const PARAMS = {…}` 一行合法 JSON，**键与 entry 一一对应** | `params.mjs` + `qa-demofiles` |
| 13 | demo 含动效 → 必须含 `prefers-reduced-motion` 降级 | `qa-demofiles` 警告级 |
| 14 | 动效/交互类 `core` 必须给**四要素**：触发条件 + 运动模型（**给数值**：曲线/弹簧参数）+ 时长量级 + 结束态 | 铁律 #4 |
| 15 | `pitfalls` 写成**张鑫旭式因果句**（"X 与 Y 并存是为了兼容 Z，Safari 在…有坑"），禁"注意性能"式空泛 checklist | §2 |
| 16 | `scenarios` 具体到产品名（"携程酒店筛选抽屉"），不写"适合移动端" | §2 |

## 1. 编号与分类分配

现有 20 条：C-01…C-07 · I-01…I-02 · L-01…L-04 · M-01…M-04 · S-01…S-03。
本批新增 10 条，**编号严格如下，不得改动**（编号即站点排序与 Prev/Next 导航依据）：

| 编号 | 分类 | id | 中文名 | 英文名 | 写手 |
|---|---|---|---|---|---|
| C-08 | component | `popover` | 气泡卡片 | Popover | W1 |
| C-09 | component | `segmented-control` | 分段控件 | Segmented Control | W1 |
| C-10 | component | `otp-input` | 分格验证码输入 | OTP Input | W2 |
| C-11 | component | `context-menu` | 上下文菜单 | Context Menu | W2 |
| I-03 | interaction | `drag-reorder` | 拖拽排序 | Drag to Reorder | W3 |
| I-04 | interaction | `swipe-actions` | 滑动行操作 | Swipe Actions | W3 |
| L-05 | layout | `z-stack-cards` | 滚动叠卡 | Z-Stack Cards | W4 |
| L-06 | layout | `breakout-column` | 破格长文栏 | Breakout Column | W4 |
| M-05 | motion | `view-transition` | 共享元素过渡 | Shared Element Transition | W5 |
| M-06 | motion | `stagger` | 错峰入场 | Stagger | W5 |

终局分布：组件 11 · 交互 4 · 布局 6 · 动效 6 · 风格 3 = **30 条**。

> **为什么本批没有风格类**：风格类 3 条（毛玻璃/新粗野/新拟态）已构成"质感三件套"，
> 再添风格条目的边际价值低于补齐组件/交互/布局的空位——后三类是"AI 生成前端时最容易
> 说不出名字"的重灾区，也正是本站差异化半区。风格类留给下一批（候选：瑞士国际主义、极光渐变）。

## 2. 逐条规格

### W1-a · C-08 `popover` 气泡卡片

- **定位**：承接 C-04 Tooltip 的定义缺口。Tooltip 词条已写明"要放链接请改用 Popover"，本条把这个"另一侧"补齐——**词典内部的交叉引用必须闭合**。
- **与 tooltip 的辨析（写进 definition）**：Tooltip 是**只读**的补充说明、不接收焦点、不含交互内容；Popover 是**可交互**的浮层容器，内部可含按钮/输入/链接，必须可键盘进入、Esc 退出、点外关闭。
- **anatomy**：锚点元素 Anchor / 浮层容器 Content / 箭头 Arrow（可选）/ 关闭方式（点外 + Esc）/ 定位策略（翻转与钳位）。
- **demo 必须做到**：
  - 点按钮开合；Esc 关闭；点浮层外关闭；**点浮层内不关闭**（这是与"点外关闭"最容易写错的一处）。
  - 浮层内含**真实可交互内容**（如一个开关 + 一个链接），证明它和 Tooltip 不是一回事。
  - 定位：优先下方，下方空间不足则**翻转**到上方；水平方向**钳位**在视口内。
  - `role="dialog"`（非模态）+ `aria-expanded` 挂在触发按钮上；关闭后焦点归还触发按钮。
  - 触屏（`hover:none`）也能用——**点击**触发，不能只靠 hover。
- **params（3 个）**：`GAP`（锚点间距 px）、`OFFSET_X`（水平偏移 px）、`DUR`（进出场时长 ms）。
- **refs**：Radix Popover 文档、WAI-ARIA APG Dialog (Modal) 模式页。
- **易混**：`tooltip`、`dialog`、`dropdown`。

### W1-b · C-09 `segmented-control` 分段控件

- **定位**：iOS/Material 的系统级控件，Web 上常被误写成"一排 tab"。核心工程难点是**共享滑块（indicator）跟手位移**——这是它值得进词典的理由。
- **辨析**：与 Tabs 的区别——Tabs 切换**内容区**、可有多个、可滚动；Segmented Control 是**同层级视图的互斥切换**、2–5 段、等宽、无内容区语义。与 Radio Group 的区别——后者是表单取值，前者是视图切换。
- **anatomy**：容器 Track / 分段 Segment / 滑块 Indicator / 选中态。
- **demo 必须做到**：
  - 2–5 段，等宽；点击切换；**滑块用 transform 平滑位移到目标段**（不要用 left/width 逐帧改，会重排）。
  - 键盘：左右方向键在段间移动并选中，`role="tablist"`/`role="tab"` + `aria-selected`，roving tabindex（只当前段 tabindex=0）。
  - 选中段下方切换一块内容，证明它是"视图切换"。
  - 滑块位移要有数值规格：`cubic-bezier(.2,.8,.2,1)` + 220ms 之类，写进 core。
- **params（3 个）**：`DUR`（滑块位移时长 ms）、`RADIUS`（圆角 px）、`PAD`（容器内边距 px）。
- **refs**：Material 3 Segmented Buttons、Apple HIG Segmented Controls。
- **易混**：`tabs`、`toggle-group`、`radio-group`。

### W2-a · C-10 `otp-input` 分格验证码输入

- **定位**：登录/支付链路的高频件，坑极真实（粘贴分发、退格回跳、`inputmode`、短信自动填充）。设计词典普遍不收录它，是空位。
- **anatomy**：格子 Cell / 光标 Caret / 分隔符 Separator / 粘贴分发逻辑 / 自动提交。
- **demo 必须做到**：
  - 6 格；**粘贴 `123456` 自动分发到 6 格**（`paste` 事件取 `clipboardData`，过滤非数字）。
  - **退格**：当前格有值→清空；当前格空→回跳到前一格并清空（这两条规则要分开实现）。
  - 输入即自动前进；填满触发完成态（demo 里显示"验证通过"）。
  - 键盘：左右方向键移动、Home/End 跳首尾。
  - 每格 `<input inputmode="numeric" autocomplete="one-time-code" maxlength="1">`；**禁 `type="number"`**（前导零会被吞）。
  - 无障碍：整体一个 `aria-label`，或用 `role="group"` + 每格 `aria-label="第 N 位"`。
- **params（3 个）**：`CELL`（格子尺寸 px）、`GAP`（格子间距 px）、`RADIUS`（圆角 px）。
- **refs**：web.dev 的 OTP 输入实践、MDN `autocomplete` 属性页。
- **易混**：`pin-input`、`input`、`verification-code`。

### W2-b · C-11 `context-menu` 上下文菜单

- **定位**：右键/长按唤出的菜单。难点是**视口边界翻转**与**子菜单延迟开合**——两处都是真实工程坑。
- **辨析**：与 Dropdown 的区别——Dropdown 挂在**触发按钮**上、位置由锚点决定；Context Menu 挂在**指针坐标**上、位置由指针决定、且必须自行处理右边缘/下边缘翻转。与 Command Palette 的区别——后者是键盘驱动的全局检索，前者是上下文相关的动作清单。
- **anatomy**：菜单容器 / 菜单项 / 分隔线 / 危险项 / 子菜单（submenu）/ 快捷键提示。
- **demo 必须做到**：
  - 在演示区**右键**唤出；位置跟随指针；**贴近右/下边缘时自动翻转**，不溢出视口。
  - Esc 关闭；点外部关闭；**菜单打开时在演示区内 `preventDefault` 掉浏览器默认右键菜单**——作用域**仅限演示区**，不得全局劫持（全局禁用会让"检查元素"失效，且 demo 只该管自己的区域）。
  - 键盘：上下方向键移动高亮、Enter 触发、Esc 关闭并归还焦点。
  - 含**危险项**（红色）与**分隔线**，至少一项带快捷键提示（如 `⌘C`）。
  - 子菜单可选：hover 300ms 延迟开合、离开宽限——若做，须写进 core 规格。
- **params（3 个）**：`WIDTH`（菜单宽 px）、`ITEM_H`（菜单项高 px）、`DUR`（进场时长 ms）。
- **refs**：WAI-ARIA APG Menu Button 模式、MDN `contextmenu` 事件。
- **易混**：`dropdown`、`command-palette`、`popover`。

### W3-a · I-03 `drag-reorder` 拖拽排序

- **定位**：列表拖拽重排。核心是 **FLIP 让位动画**——其他项"滑开让位"而不是瞬间跳位，这是它与"拖放"（drop）的分野。
- **辨析**：与 Drag & Drop（文件拖放）的区别——拖放关心**落到哪个容器**（投递语义），拖拽排序关心**在序列里插到第几位**（顺序语义），后者必须有让位动画与位置占位。与 Swipe Actions 的区别——后者是**单行水平手势**揭示动作，不改变顺序。
- **anatomy**：被拖项 / 幽灵占位 Ghost / 让位位移 / 落位吸附 / 拖拽把手。
- **demo 必须做到**：
  - 5–6 行列表，按住把手（或整行）拖动；拖动项**抬升**（阴影 + 轻微放大 + `cursor: grabbing`）。
  - **其他行用 transform 平滑让位**（FLIP：记录首末位置，用 transform 反向补偿再过渡到 0），不要用 `top/height` 逐帧改。
  - 落位：按中心点判定插入位，松手吸附到目标行位置。
  - 键盘替代方案：上下方向键移动项（a11y 必备，写进 core）。
  - 用 Pointer Events + `setPointerCapture`；`touch-action: none` 防滚动抢手势。
  - 数值规格：让位动画 180–220ms + `cubic-bezier(.2,.8,.2,1)`；抬升 scale 1.02、阴影 `0 12px 28px rgba(0,0,0,.18)`。
- **params（3 个）**：`ROW_H`（行高 px）、`DUR`（让位时长 ms）、`LIFT`（抬升缩放，如 1.02）。
- **refs**：MDN `setPointerCapture`、dnd-kit 文档（作为生态参照）。
- **易混**：`drag-and-drop`、`swipe-actions`、`sortable-list`。

### W3-b · I-04 `swipe-actions` 滑动行操作

- **定位**：iOS Mail / Gmail 的左滑删除右滑归档。手势跟手 + 吸附 + 二次确认，四要素最完整的交互之一。
- **辨析**：与 Pull-to-Refresh 的区别——后者是**垂直**手势刷新数据、有加载态；前者是**水平**手势揭示行级动作、不加载数据。与 Drag to Reorder 的区别——见上条。
- **anatomy**：行容器 / 操作层 Actions / 滑动位移 / 阻尼 / 吸附阈值 / 全滑触发。
- **demo 必须做到**：
  - 列表 4–5 行；**左滑**揭示"删除"（红），**右滑**揭示"归档"（蓝）。
  - 跟手位移；超过**半程**才允许松手吸附到完全展开位，未过半回弹归零（阈值给数值）。
  - 滑动中**位移方向钳制**：左滑到底后继续拉用阻尼（rubber-band 0.5 之类）。
  - 全滑（超过 ~70%）直接触发动作；部分展开后再点按钮也能触发。
  - **同时只能有一行处于展开态**（打开新的自动收起旧的）——这是最常漏的一条。
  - 触屏与鼠标都能用（鼠标按住左右拖）。
- **params（3 个）**：`THRESHOLD`（吸附阈值，占行宽比例）、`DAMP`（越界阻尼）、`DUR`（回弹时长 ms）。
- **refs**：Apple HIG Gestures、MDN Pointer Events。
- **易混**：`pull-to-refresh`、`drag-reorder`、`action-sheet`。

### W4-a · L-05 `z-stack-cards` 滚动叠卡

- **定位**：滚动时卡片逐张"盖上去"堆叠（Apple 产品页 / Linear / Stripe 常见）。布局类但强依赖滚动驱动。
- **辨析**：与 Sticky Section（L-04）的区别——后者是**分区标题**粘住、内容滚动穿过；前者是**整张卡片**在滚动中依次钉住并被后一张覆盖，形成 Z 轴堆叠错觉。与 Scrollytelling（L-02）的区别——后者是叙事章节驱动图文变化，前者只是纯视觉堆叠、不承载叙事。
- **anatomy**：卡片 Card / 粘性堆叠位 `position: sticky` / 层叠偏移（每张 top 递增）/ 缩放与透明度衰减 / 收尾。
- **demo 必须做到**：
  - 5 张卡片；每张 `position: sticky` 且 `top` 逐张递增（如 `top: 0, 24px, 48px…`），形成"露出一条边"的堆叠。
  - 后面的卡片**覆盖**前面的；被覆盖的卡片可加 `scale` 衰减与轻微降透明度，强化 Z 轴。
  - **纯 CSS 可实现优先**（`position: sticky` + 递增 top），JS 只做可选增强。
  - 滚动容器高度要够（否则粘不住），demo 页面须有足够滚动距离。
  - `prefers-reduced-motion` 下退化：去掉 scale/opacity 变化，只留 sticky。
- **params（3 个）**：`STICKY_TOP`（首张 sticky top px）、`STEP`（逐张递增 px）、`SCALE_STEP`（每层缩放衰减，如 0.03）。
- **refs**：MDN `position: sticky`、MDN CSS scroll-driven animations（作为进阶替代路线）。
- **易混**：`sticky-section`、`scrollytelling`、`parallax`。

### W4-b · L-06 `breakout-column` 破格长文栏

- **定位**：长文阅读布局——正文居中窄栏（约 65ch），图片/表格/代码**突破栏宽**到更宽的容器。Tufte CSS / Notion / Medium 的做法。排版词典该有这条。
- **辨析**：与 Bento Grid（L-01）的区别——后者是**容器内**的网格拼贴、以模块为单位；破格栏是**以正文行宽为基准**、让个别元素越界，服务阅读节奏而非模块陈列。与普通 max-width 居中容器的区别——破格栏有**两套宽度**（正文栏 + 破格栏）且可互相嵌套。
- **anatomy**：正文栏 Measure / 破格层 Breakout / 全出血 Full-bleed / 页边注 Sidenote / 行宽基准。
- **demo 必须做到**：
  - 正文栏 `max-width: 65ch` 居中；段落正常。
  - 至少一张图/一个引用块用**破格**（`width: min(1000px, 100vw)` + 负 margin 或 grid 三列法）突破到更宽，**不溢出视口**（`max-width: 100vw` 兜底 + 禁横向滚动条）。
  - 至少一条**页边注**（sidenote）：宽屏时飘到右侧页边，窄屏时降级为脚注或内联——响应式降级必须做。
  - `overflow-x: hidden` 之类要慎用（会掩盖真正的溢出 bug），demo 里用 `max-width` 正解。
  - 字号与行高：正文 17–18px / 行高 1.7 左右；行宽超 75ch 阅读会掉速（可写进 pitfalls）。
- **params（3 个）**：`MEASURE`（正文栏宽 ch）、`BREAKOUT`（破格宽 px）、`FONT`（正文字号 px）。
- **refs**：Tufte CSS、Practical Typography 的 line length 一节。
- **易混**：`bento-grid`、`magazine-layout`、`container`。

### W5-a · M-05 `view-transition` 共享元素过渡

- **定位**：列表缩略图 → 详情大图的"共享元素"形变过渡。2026 年的前沿 API（`document.startViewTransition` + `view-transition-name`），设计词典尚无收录。
- **辨析**：与普通 FLIP/缩放动画的区别——共享元素过渡由**浏览器对两态快照做插值**，元素在 DOM 上被替换而非同一节点被 transform；与 Parallax（M-03）的区别——后者是滚动位置的线性映射，与状态切换无关。
- **demo 必须做到**：
  - 网格缩略图 → 点开变成大图详情视图；缩略图与大图共用 `view-transition-name`（**同名元素在同一时刻必须唯一**，否则过渡静默失败——这是核心坑，写进 pitfalls）。
  - 用 `document.startViewTransition(() => { …DOM 切换… })`；配 `::view-transition-old/new(name)` 自定义时长与曲线。
  - **必须优雅降级**：`if (!document.startViewTransition) { 直接切换 DOM; return; }` —— 不支持时功能不能坏。
  - 关闭返回时反向过渡。
  - `prefers-reduced-motion` 下跳过过渡（`startViewTransition` 仍执行 DOM 切换，只是把动画时长设为 0 / 用 `matchMedia` 判断后直接切换）。
  - 时长数值写进 core：如 320ms + `cubic-bezier(.2,.8,.2,1)`。
- **params（3 个）**：`DUR`（过渡时长 ms）、`EASE_Y`（曲线强度，或给一个简化档位）、`RADIUS`（卡片圆角 px）。
- **refs**：MDN View Transition API、Chrome 的 view transitions 文档。
- **易混**：`flip`、`parallax`、`shared-layout`。

### W5-b · M-06 `stagger` 错峰入场

- **定位**：列表/网格逐项依次入场（每项延迟递增）。Material "Now in Motion" 的核心手法，最常被 AI 生成时写成"整块淡入"的动效。
- **辨析**：与 Shimmer（M-02）的区别——后者是**同一元素**上的循环扫光（loading 态）；stagger 是**多个元素**之间的入场时间差（进入态），播完即止、不循环。与普通 fade-in 的区别——stagger 的规格在**每项延迟增量**上，不在单元素动画上。
- **demo 必须做到**：
  - 9–12 个卡片/列表项，逐项入场（`animation-delay: calc(var(--i) * STEPms)` 或 JS 设置）。
  - **总时长要封顶**：项数多时不能让最后一项等太久——`delay` 用 `min(i * STEP, CAP)` 之类的封顶策略，或限制参与错峰的项数（写进 core，这是真实工程约束）。
  - 入场动画：`opacity 0→1` + `translateY(12px→0)`，曲线 `cubic-bezier(.2,.8,.2,1)`。
  - 提供**重播按钮**（演示用），首次进入视口触发（IntersectionObserver）。
  - `prefers-reduced-motion` 下：全部直接显示，无延迟无位移。
  - 用 CSS 变量 `--i` 传索引，保持零 JS 也能算延迟。
- **params（3 个）**：`STEP`（每项延迟增量 ms）、`DUR`（单顶时长 ms）、`DIST`（位移距离 px）。
- **refs**：Material 3 motion transitions、MDN `animation-delay`。
- **易混**：`shimmer`、`fade-in`、`parallax`。

## 3. 写手分工（目录互不重叠，可并行）

| 写手 | 词条目录（各自独占） |
|---|---|
| W1 | `terms/component/popover/`、`terms/component/segmented-control/` |
| W2 | `terms/component/otp-input/`、`terms/component/context-menu/` |
| W3 | `terms/interaction/drag-reorder/`、`terms/interaction/swipe-actions/` |
| W4 | `terms/layout/z-stack-cards/`、`terms/layout/breakout-column/` |
| W5 | `terms/motion/view-transition/`、`terms/motion/stagger/` |

**禁止**：改 `scripts/`、`src/`、`README.md`、`NEW_ENTRY.md`、其他人的目录。
自检命令（只验自己这两条，不干扰他人）：
```bash
node scripts/qa-one.mjs <slug-a> <slug-b>
```

## 4. demo 质量基线（比"能跑"更高一档）

参考现有 20 条的水准，新条目须达到：

1. **中文因果注释**：关键 CSS/JS 处写"为什么"，不是"是什么"。例：
   `/* 退场时 visibility 延迟翻转——先让 opacity 淡出跑完再消失，否则节点瞬间不可见 */`
2. **页面自带说明文案**：demo 顶部用一两句话告诉读者"这条要演示什么、怎么操作"。
3. **参数块消费点真实**：`PARAMS.X` 必须真的被用（不能声明了不用），并在页面某处（如 readout 行）显示当前参数值。
4. **触屏/键盘/减少动效三降级**：能做的都要做。
5. **视觉克制**：沿用站点色板（背景 `#f6f5f2`、主色 `#141414`、强调 `#0b4f6c`），不引入花哨渐变抢戏。
6. **可自解释**：双击打开就能看懂，不需要读 entry.json。

## 5. 审校四问（人工，写手自答不算）

1. 这名字业界真的这么叫吗？
2. demo 还原 definition 了吗？
3. 这条 prompt 带着它、不带着它，生成结果有肉眼差别吗？
4. 坑是真的坑，还是凑数？