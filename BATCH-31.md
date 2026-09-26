# 批次规格 · 34 → 42 条（组件扩产第 1 批 · 调研线 05 落地）

> 本文件是本批 8 条新词条的**唯一权威规格**。写手按此写，审校按此验。
> 上位规范：`NEW_ENTRY.md`（工厂规范）+ `README.md`（schema）+ `src/lib/types.mjs`（schema 权威，v0.3）+ `src/lib/validate.mjs`（代码契约，最终仲裁）。
> 素材来源：`research/05-component-catalog.md`（裁决与批次表）+ `research/raw/05a~05c`（证据与流派）。
> ⚠️ 与 NEW_ENTRY.md 漂移处照旧以代码为准：数据文件是 **`entry.json`**；params 形状是 `{key,label,def,min,max,step,hint}`。

## 0. 本批新增：schema v0.3 三字段（每条必填）

调研线 05 的招牌叙事——**"HTML 现在就能原生做，不用装库"**——由三个新字段承载（均 optional，但本批 8 条**全部必填**）：

| 字段 | 值域 | 怎么填 |
|---|---|---|
| `nativePath` | `css-only` 🟢 纯 HTML/CSS·0 交互 JS ｜ `lite-js` 🔵 少量原生 JS（≤30 行） ｜ `styled-js` 🟠 定位/状态 JS 必要（≤150 行） ｜ `no-native` ⚪ 无原生对应 | 按 demo 实际形态评：交互逻辑 JS（不含 ≤15 行参数样板、不含 `ui-dict:params` 消费点）总行数决定档位 |
| `implSchool` | 六流派枚举（见 types.mjs）：`css-state` 状态机CSS ｜ `semantic-native` 语义原生 ｜ `platform-overlay` 新平台弹层 ｜ `passive-observer` 被动监听 ｜ `active-compute` 主动计算 ｜ `capability-api` 能力型API | 填该组件**在业界并存**的流派数组（≥2），词条叙事 = 谱系；demo 走的流派必须含在内 |
| `jsLines` | 整数 0–500 | **承诺 demo 交互 JS 行数上限**（`0` = 纯 CSS 成立）。PromptCard 拼装时自动写入【技术约束】"≤N 行"承诺 |

流派与证据细节在 raw 档案：六流派分组见 `research/raw/05c-zero-dep-css-components.md` §实现类型谱系；支持面数据见 05 主报告 §五（dialog 96.78% > popover 92.51% > details[name] 91.11% > commandfor 84.72% > anchor ◐85.9% > base-select 71.56%【Chromium 先跑】）。

## 1. 编号与映射（骨架已用 `pnpm new-term` 生成，编号不得改动）

站点编号按投产顺序连续分配（不留空洞）；括号内为调研档案预占号，供溯源。

| 编号 | id | 中文名 | 英文名 | 调研号 | 写手 |
|---|---|---|---|---|---|
| C-13 | `dialog` | 模态对话框 | Modal Dialog | 05/C-13 | A1 |
| C-14 | `dropdown` | 下拉菜单 | Dropdown Menu | 05/C-15 | A1 |
| C-15 | `select` | 下拉选择器 | Select | 05/C-16 | A2 |
| C-16 | `tabs` | 标签页 | Tabs | 05/C-28 | A2 |
| C-17 | `switch` | 开关 | Switch / Toggle | 05/C-24 | A3 |
| C-18 | `tag-input` | 标签输入框 | Tag Input | 05/C-21 | A3 |
| C-19 | `file-upload` | 文件上传 / 拖放区 | File Upload / Dropzone | 05/C-22 | A4 |
| C-20 | `chat-bubble` | 对话气泡 / 消息流 | Chat Bubble / Message Flow | 05/C-42 | A4 |

终局分布：组件 20 · 交互 4 · 布局 6 · 动效 9 · 风格 3 = **42 条**。

**为什么这批全是组件类**：调研 TL;DR 第 10 条——业务/表单向组件被所有词汇站集体低估（Mobbin 实测 file-upload/tag-input/cascader slug 全 404；index.how 188 词零覆盖），恰是"按描述反查"需求最密的区域；且第 1 批 7 条 + 时间窗插队 1 条（C-20 AI 词族空窗以月计）全部满足"广度满分 × 零依赖绿区 × 三线命中"。

## 2. 硬约束（继承 BATCH-30 §0，此处不重复；追加三条）

| # | 追加约束 | 依据 |
|---|---|---|
| 17 | `nativePath`/`implSchool`/`jsLines` 三字段必填；`jsLines` 与 demo 实际形态一致（审校数一遍） | 本批 §0 |
| 18 | 用新平台能力（anchor()/base-select/commandfor/scroll-driven）的 demo，**必须 `@supports` 包裹 + 写明降级路径**，且降级后的行为仍在验收清单里可观察 | 05c 反模式 7/9/10 |
| 19 | 词条 definition 或 pitfalls 必须交代"调研号列出的实现流派里 demo 选了哪派、为什么"——谱系感是本批词条的灵魂 | 05 §六 做法 6 |

其余 16 条见 `BATCH-30.md` §0（全部继续生效：禁 verifiedWith 手填、params 块、铁律四要素、张鑫旭式因果坑、场景具体到产品……）。

## 3. 逐条规格

### A1-a · C-13 `dialog` 模态对话框

- **定位**：浮层三兄弟（C-01 bottom-sheet / C-05 drawer / 本条）的"居中打断"一极；本站最高价值的"平台拐点"词条——`<dialog>` 一个元素白送 top-layer/遮罩/Esc/焦点陷阱/inert 五件 JS 库痛点。
- **辨析（写进 definition）**：与 Popover——Dialog 模态压暗逼决定，Popover 非模态不打断（互设 confusedWith）；与 Bottom Sheet——同一平台能力的两种皮肤，选择轴 = 打断度 × 移动端心智。
- **demo 必须做到**：
  - `<dialog>` + `showModal()`；`::backdrop` 遮罩；Esc 原生关闭（不写 preventDefault）；点遮罩关闭（`closedby="any"` 用 `@supports`/特性探测，**回落 = click 坐标落 dialog 矩形外判定**，两路径都要能跑）。
  - 表单场景：确认删除弹窗，`<form method="dialog">` 让"取消/确定"0 JS 关闭并触发 `close` 事件（JS 读 `returnValue` 更新页面状态文字）。
  - `commandfor`/`command="show-modal"` 声明式打开**作为增强彩蛋**写在页面注释里（支持面 84.7%，触发按钮仍用 JS click 兜底——别让截图落在"按钮点不开"上）。
  - 打开时背景内容不可 Tab 到达（showModal 白送，验收清单里让人验）；关闭后焦点归还触发按钮（原生行为，写明）。
  - 滚动锁：showModal 自带；pitfalls 写"手工 div 派要自己 lock scroll + inert，这正是平台化的价值"。
- **流派**：`implSchool: ["semantic-native","css-state","active-compute"]`——`:target` 历史栈污染旧 CSS 派与 checkbox hack 派写进 definition 的"流派交代"句，标注反模式；demo 走语义原生派。`nativePath: "lite-js"`（开关本体 0~2 行，returnValue 处理约 10 行），`jsLines: 15`。
- **params（3 个）**：`RADIUS`（弹窗圆角 px）、`SCRIM`（遮罩浓度 0–0.8）、`DUR`（进出场时长 ms，@starting-style 入场动画用，不支持时直开——@supports 交代）。
- **refs**：MDN `<dialog>`、WAI-ARIA APG Dialog (Modal) 模式。
- **别名素材**（口语 ≥3）："挡住页面的弹窗""必须点确定的框""点外面能不能关的那种遮罩窗"……

### A1-b · C-14 `dropdown` 下拉菜单

- **定位**：谱系标本——四代做法叠在同一组件上（hover hack → checkbox hack → details → popover+anchor），definition 用一句话扫完这条演进线是本批招牌写法。
- **辨析**："下拉框 vs 下拉菜单"是中文最高频混淆对：Dropdown = 一组**动作**（点击即执行），Select = 选**一个值**（有回显）。四兄弟辨析网：`select`（C-15）、`context-menu`（C-11，指针坐标 vs 锚点）、`cascader`（未入库，chip 灰显即可）。
- **demo 必须做到**：
  - `popover="auto"` + `popovertarget` 按钮：**开关 0 JS**（top-layer 免裁剪、点外关闭、Esc、焦点管理全白送）；菜单项 `role="menu"`/`menuitem`（注意：popover 原生不带 menu 语义，aria 是 JS 补的部分——pitfalls 交代）。
  - 定位：`anchor-name`/`anchor()` + `position-try-fallbacks: flip-block`（下方不足翻上方），整段包 `@supports (anchor-name: --a)`；**降级路径** = 无 anchor 支持时 JS `getBoundingClientRect` 摆放（≤30 行样板，写在 demo 里，@supports not 分支才加载）。
  - 键盘：上下方向键在 menuitem 间移动、Enter 触发、Esc 关闭归还焦点（这部分是 demo 仅有的 JS 逻辑，计入 jsLines）。
  - 菜单含：普通项 ×2 + 分隔线 + 危险项（红色），选中项把动作名回显到页面（证明"点了会执行"）。
  - hover 即开（`:hover` 派）在触屏上是坏形态：constraints 里禁"只靠 hover 触发"。
- **流派**：`implSchool: ["platform-overlay","css-state","semantic-native"]`；`nativePath: "lite-js"`（开关 0 JS、键盘导航少量 JS），`jsLines: 40`。
- **params（3 个）**：`WIDTH`（菜单宽 px）、`ITEM_H`（项高 px）、`GAP`（锚点间距 px）。
- **refs**：MDN Popover API、WAI-ARIA APG Menu Button。
- **别名**："点开的一列小菜单""齿轮旁边那个""更多操作冒号三个点"……

### A2-a · C-15 `select` 下拉选择器

- **定位**："原生还是自绘"经典争论题，词条立场 = 把决策树讲清楚。demo 让两个 select **并排同页**（左：原生 `<select>` + `accent-color`；右：`appearance: base-select` 可定制版，`::picker` 上色、`selectedcontent` 回显带 emoji 的选项），@supports 包住可定制版，不支持时两列等价 = 降级即对照实验。
- **辨析**：与 Dropdown（动作 vs 取值）、与 Combobox（严格选择 vs 可自由输入，combobox 未入库灰显）。
- **demo 必须做到**：
  - 原生派：`<select>` 最小成本重绘（`accent-color` + 自绘箭头 `background-image` data-URI 或 CSS 三角，禁外链）。
  - base-select 派：`@supports (appearance: base-select)` 内 `appearance: base-select`；`::picker(select)` 设背景/圆角/阴影；option 里塞 `<span>` 富选项（emoji + 副标题）；`:open` 状态给触发器变形。**Chromium 先跑（71.56%）的事实写进页内说明行**，让双击打开的用户知道自己在哪条轨道。
  - 表单取值语义：`<label>` 关联、选中值回显到页面（change 事件 1 行 JS，或 `:has()` 展示——选后者可保住 css-only）。
  - iOS 滚轮弹层不受控是原生派的头号坑：pitfalls 写"各 UA 弹层形态（桌面浮层/iOS 滚轮/Android 全屏）你都不许依赖"。
  - `disabled`/`optgroup` 分组在 demo 里出现一次（谱系完整性）。
- **流派**：`implSchool: ["semantic-native","active-compute"]`（active-compute 指自绘 `role=listbox + aria-activedescendant` 路线，definition 交代、demo 不实现它——浮层库路线，jsLines 超预算）；`nativePath: "css-only"`，`jsLines: 0`。
- **params（3 个）**：`RADIUS`（圆角 px）、`PAD`（触发器内边距 px）、`H`（触发器高 px）。
- **refs**：MDN `<select>` / Customizable select 文档、Open UI Select-Combobox explainer。
- **别名**："点一下选一行的框""表单里的下拉""带箭头那个选项条"……

### A2-b · C-16 `tabs` 标签页

- **定位**：五线冲突裁决样本（05 §五-1）：CSS 流派白送可行性，但 **CSS-only 缺 aria 选中态是已证反模式**——demo 走 ARIA 正装派，把"为什么 0 JS 版不够"写成词条卖点。
- **辨析**：Tabs vs Segmented Control（C-09）三角辨析核心一极——Tab = 页面区导航可深链、分段 = 即时切视图；vs Toggle Group（可多选可全不选）。confusedWith 必须含 `segmented-control`。
- **demo 必须做到**：
  - `role=tablist` + `role=tab` + `aria-selected` + `aria-controls`，panel `role=tabpanel` + `hidden`；**roving tabindex**（仅选中 tab tabindex=0）；左右方向键切换、Home/End 跳首尾。
  - 选中下划线**滑动指示器**：CSS 变量 `--x/--w` 由 JS 测量 tab 位置写入（transform 位移，禁 left/width 逐帧）。
  - 3–4 个 tab，panel 内容有肉眼差别（文字+小图形），切tab 时 panel 直接替换（懒挂载话术写进 core，不必真做异步）。
  - definition/pitfalls 交代流派①：radio+`:checked~` 的 0 JS 版——"能切内容但读屏不知道选中态、tabindex 不可控"（05c 反模式）；`:target` 版历史栈坑同段带过。
  - `prefers-reduced-motion` 下指示器瞬移。
- **流派**：`implSchool: ["css-state","semantic-native","active-compute"]`；`nativePath: "lite-js"`，`jsLines: 30`。
- **params（3 个）**：`INK`（指示器粗细 px）、`GAP`（tab 间距 px）、`DUR`（滑动时长 ms）。
- **refs**：WAI-ARIA APG Tabs 模式、MDN `role=tablist`。
- **别名**："横排页签""切内容的那排按钮""浏览器上面那一排"……

### A3-a · C-17 `switch` 开关

- **定位**：零依赖绿区之王——`appearance:none` + `::before` 重绘 checkbox，0 行 JS；Uiverse 260+ 存量件证明社区共鸣。行为辨析有 APG 规范背书：**开关 = 即时生效，复选框 = 提交生效**（进 whenToUse 主句）。
- **辨析**：与 Checkbox——形态像但语义轴是"生效时机"；与 Checkbox 三态 indeterminate 是隐藏知识点（pitfalls）。
- **demo 必须做到**：
  - `<input type=checkbox role=switch>`——checked 状态由原生 checkbox 白送（含键盘空格、表单提交、读屏播报），**这是本站"0 JS 全功能"自证的最干净标本**，页内说明行点破它。
  - 纯 CSS 重绘：track + thumb，`:checked` 位移 `translateX`，`:focus-visible` 环；`transition 180ms cubic-bezier(.2,.8,.2,1)`。
  - 禁用态 `:disabled` 样式 + `prefers-reduced-motion` 瞬切。
  - 开关即时生效的行为演示：旁边一行状态文字用 **`:has()` 纯 CSS** 切换（"通知已开启/已关闭"），保住 jsLines 0。
  - 触屏最小点击区（44px 热区，iOS appearance:none 尺寸强改写 pitfalls）。
- **流派**：`implSchool: ["css-state","semantic-native"]`；`nativePath: "css-only"`，`jsLines: 0`。
- **params（3 个）**：`W`（轨道宽 px）、`D`（旋钮直径 px）、`DUR`（切换时长 ms）。
- **refs**：WAI-ARIA APG Switch 角色、MDN `role=switch`。
- **别名**："啪嗒拨过去的小开关""on/off 滑块""设置页右边那一排圆钮"……

### A3-b · C-18 `tag-input` 标签输入框

- **定位**：Mobbin/UI-Patterns/component.gallery 三站全缺 + 口语描述极生动（"打了字回车就变成一个小标签的框"）= 反查招牌词。
- **辨析**：与 Select（自由输入多值 vs 预置单值）、与 Combobox（有无建议列表，灰显）；与 C-10 otp-input 同为"输入框家族"但方向相反（多值累加 vs 定长分发）。
- **demo 必须做到**：
  - 真 `<input>` + `keydown`：Enter/逗号 → 取 trim 值渲染成胶囊 chip（事件委托在容器上，禁逐 chip 绑监听）；**空 input 按 Backspace 删末位**（经典细节规格）；重复值拒绝并抖动提示（1 行 CSS 动画）。
  - chip 删除 ×：容器 click 委托判定 `data-x`；删除后焦点回 input。
  - 输入框与 chips 同处一个视觉容器（`flex-wrap` 流式排布，input 自动撑余宽）——形态还原"AntD 那个框"。
  - 容器 `role="group"` + `aria-label`；chip 带 `aria-label="删除 {tag}"` 的可聚焦删除钮（键盘可达，别用纯 ::after 画 ×）。
  - 已选值回显区（把数组 join 出来，证明"这就是表单会提交的东西"；`<input type=hidden>` 话术进 core）。
  - 流派交代：contenteditable 派（胶囊内嵌 span、光标管理是坑）与 `<select multiple>` 伪装派写进 pitfalls/definition，demo 走真 input 派。
- **流派**：`implSchool: ["capability-api","active-compute","css-state"]`（contenteditable 派 = capability-api，select-multiple 伪装 = css-state 的降级应用）；`nativePath: "lite-js"`，`jsLines: 40`。
- **params（3 个）**：`MAX`（标签数上限）、`RADIUS`（胶囊圆角 px，999 试出药丸 vs 方角）、`GAP`（胶囊间距 px）。
- **refs**：MDN `keydown`/`input` 事件、AntD Tag 组件页（形态信源）。
- **别名**："输一个加一个带小叉的框""回车变胶囊""打标签那个输入"……

### A4-a · C-19 `file-upload` 文件上传 / 拖放区

- **定位**："看起来复杂其实原生可做"最佳教学案例；05e 实测 Mobbin `file-upload` slug 404。
- **辨析**：与 input[type=file] 原生按钮（选文件 vs 拖放区两种形态同词条解剖）；上传本身没有网络请求 demo（FileReader 本地预览在铁律内，**"demo 不真上传"写进 core**，防 AI 生成时 fetch 外部接口破铁律）。
- **demo 必须做到**：
  - 隐藏 `<input type=file multiple accept="image/*">` + label 代理触发（0 JS 可用底座）；虚线框 dropzone。
  - 拖放：`dragenter/dragleave` **计数法**（dragCounter++/--，归零才移出态——子元素 enter/leave 风暴的经典坑必须在 pitfalls 展开）；`drop` 取 `e.dataTransfer.files`；`dragover` preventDefault。
  - 预览：`FileReader.readAsDataURL` → `<img>` 缩略图网格（本地、无网络，铁律内）；文件名回显 chip 列表（含大小 KB 化）。
  - 整页粘贴 `paste` 事件收图（DataTransfer 同源，加分项，写进 core 的"三通道收文件"）。
  - 拖入高亮态（dashed → solid + 背景变色，数值时长）；非图片文件的兜底显示（type 判定，回退文件图标+名）。
  - a11y：dropzone 本体可键盘聚焦（button 化 label 或 tabindex + Enter 触发 input.click()）。
- **流派**：`implSchool: ["capability-api","active-compute"]`；`nativePath: "styled-js"`，`jsLines: 70`。
- **params（3 个）**：`DW`（拖放区高 px）、`THUMB`（缩略图尺寸 px）、`BORDER`（虚线粗细 px）。
- **refs**：MDN `FileReader` / `drag and drop` 指南、Can I Use File API。
- **别名**："把图片拖进去那块虚线框""选文件那个按钮""拖进来就能预览上传的地方"……

### A4-b · C-20 `chat-bubble` 对话气泡 / 消息流

- **定位**：时间窗插队条（调研明令"不等批次"）——shadcn v4 刚把 Bubble/Message Scroller 定为官方词、词汇站零覆盖；**中文用户搜"AI 聊天界面组件"此刻零命中**。
- **辨析**：与 Snackbar（消息是持久流 vs 瞬时反馈）；与 Empty State（有对话内容 vs 无）；definition 交代"气泡（单条形态）vs 消息流（滚动容器行为）是两个正交维度"。
- **demo 必须做到**：
  - 气泡：`::before` 画小尾巴三角；**分组连续消息**（同角色相邻时去头像位、间距收紧——IM 标准态）；左右双角色（用户右、AI 左）配色区分。
  - 流式回复：发送后 AI 气泡按字符 setInterval 追加（模拟 token 流，**禁 fetch**，页面注释写明"生产接 SSE"话术进 core）；流式中光标闪烁。
  - 贴底不跳：**`overflow-anchor: auto` 原生滚动锚定**为第一流派（0 JS 的关键卖点！pitfalls 交代"手写 scroll 到底 = 用户往上翻历史时被新消息拽回底部的经典 bug"）；新消息 `scroll-snap-align: end` 或首次追加 `scrollIntoView` 兜底路径。
  - 输入区：Enter 发送 / Shift+Enter 换行（textarea 自动增高 ≤3 行）；时间分隔线（今天 14:02 居中细线）。
  - demo 顶部一句话说明"这条演示：发一条消息，看 AI 流式吐字、列表贴底不跳"。
  - 键盘/触屏：输入框永远可达；reduced-motion 下流式改整段直出。
- **流派**：`implSchool: ["css-state","passive-observer","capability-api","active-compute"]`（尾巴/分组 = css-state，overflow-anchor 被动监听，流式 = 主动计算）；`nativePath: "lite-js"`，`jsLines: 60`。
- **params（3 个）**：`MAXW`（气泡最大宽度 ch）、`RADIUS`（气泡圆角 px）、`TYPE_MS`（打字节奏 ms/字符）。
- **refs**：MDN `overflow-anchor`、w3c css-overflow anchoring spec。
- **别名**："AI 回答那个气泡框""聊天气泡带尾巴""打字机效果的消息流""往上翻不会被新消息拽走"……

## 4. 写手分工（目录互不重叠，可并行）

| 写手 | 词条目录（各自独占） |
|---|---|
| A1 | `terms/component/dialog/`、`terms/component/dropdown/` |
| A2 | `terms/component/select/`、`terms/component/tabs/` |
| A3 | `terms/component/switch/`、`terms/component/tag-input/` |
| A4 | `terms/component/file-upload/`、`terms/component/chat-bubble/` |

**禁止**：改 `scripts/`、`src/`、`README.md`、`NEW_ENTRY.md`、`BATCH-31.md`、其他人的目录；手填 `verifiedWith`。
骨架已由 `pnpm new-term` 生成（编号已写好、title 尾缀已带），写手只填两个文件的内容。
自检命令（只验自己这两条）：

```bash
node scripts/qa-one.mjs <slug-a> <slug-b>
```

## 5. demo 质量基线（BATCH-30 §4 全部继承，追加两条）

7. **`ui-dict:params` 块**：`const PARAMS = {"KEY": 数值}` 一行合法 JSON（照抄模板位置），每个 PARAMS 键真实被消费 + 页面 readout 行显示当前值。
8. **降级可见**：新平台特性（anchor/base-select/closedby）的 `@supports` 回落路径要能"关掉新浏览器仍演给旧浏览器看"——验收清单包含降级态。

## 6. 审校四问 + 本批两问

1. 名字业界真的这么叫吗？（对照 05 主报告 §三命名矩阵）
2. demo 还原 definition 了吗？
3. prompt 带着它/不带着它，生成结果有肉眼差别吗？
4. 坑是真的坑吗？（优先收 05c 反模式清单里的实证坑）
5. `jsLines` 承诺数得住吗？（数一遍 demo 交互 JS，样板除外）
6. 谱系交代了吗？（≥2 流派 + demo 选派理由）
