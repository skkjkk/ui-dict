# UI 词典 · UI Lexicon

> 前端设计词汇与模式的活词典——为"叫不出名字"而诞生。
> **输入你想要的感觉，找到它的名字、提示词和能跑的代码。**
>

## 它是什么

一个纯静态网页。收录 UI 组件、动效、交互、布局、风格五大类设计词汇，每个词条提供：

- **名字**（中文正名 + 英文原名 + 口语别名，可反查）
- **一句话定义**（含与近邻词的辨析）
- **Prompt 卡片**——结构化、数值化、可整段复制丢给任何 AI 编码工具
- **Live Demo**——所见即所得，参数可调，复制的代码随之实时变化
- **零依赖代码**——完整 HTML/CSS(+少量原生 JS) 单文件片段，粘进空白文件双击就能活
- **该用 / 不该用对照、易混淆辨析、适用场景 / 常见坑 / 相关词条**

## 它解决什么问题

vibe-coding 时代的真实断点：脑子里有一个效果（"鼠标靠近就被吸过去"），但叫不出它的名字（磁吸按钮 Magnetic Button），于是无法精确地描述给 AI。Jakob Nielsen（NN/g）已将其正式命名为 **"AI articulation barrier"**（[出处](https://www.uxtigers.com/post/prompt-augmentation)）。

本词典是一个**翻译层**：感觉 → 词汇 → prompt → 代码，四步同屏。

## 它不是什么

- ❌ 不是第 N 个组件库：护城河在"prompt 描述卡片"这层，与代码同级的一等公民
- ❌ 不是组件文档站：不绑定任何框架，不收 API 参数表
- ❌ 不是灵感画廊：每个词条必须可复制、可运行、可喂给 AI
- ❌ 不拼案例量、不拼词条数：与 Mobbin/21st/动效词典错位竞争，拼**完整度与可带走性**

## 调研结论速览（2026-09-24，30+ 产品走查，详见 [research/00-synthesis.md](research/00-synthesis.md)）

**方向全被验证**：prompt 已是行业一等产物（21st.dev "Every component ships as a prompt"）；单文件零依赖是 AI 时代资产流通的最优形态（Simon Willison、Uiverse 平台规范背书）。

**首创性已让位**：中文站「[动效词典](https://vibe-dictionary.picamoji.com)」核心链路重合度约 75%（可调 demo + "这样告诉 AI" + 代码下载 + 别名反查），英文站「[index.how/to/articulate](https://index.how)」以 agent skill 分发 188 词。**窗口期以月计，快速上线优于全量铺开。**

**确认的公开空位（本项目立旗点）**：
1. demo 与复制代码**同源**（srcdoc 渲染 demoCode 本身）——10 家代码站无一做到
2. **按描述反查**（输"鼠标吸过去"命中磁吸按钮）——30+ 家 0 支持
3. **词 + prompt + 可运行零依赖代码**三元交集——模式站有词没代码，代码站有代码没词
4. 组件/布局/风格三类的完整词条化 + 编号词典学装备——动效词典没做的半区

## 已定稿的产品决策

| # | 决策 | 结论 |
|---|------|------|
| A | Prompt 描述卡片 | ✅ 与代码同级的一等公民；从 string 升级为**结构化 PromptCard**（意图+数值规格+负向清单+验收清单+审美锚点），UI 拼装成单段可复制文本（调研线 04） |
| B | 分类体系 | ✅ 五类：组件 / 动效 / 交互 / 布局 / 风格；每类下预留子分组 |
| C | 代码形态与架构 | ✅ **分层解耦**（2026-09-24 定案）：**词条载荷**零依赖单文件（demo.html，产品承诺不变）；**站点外壳**用现代工具链（下）。二者互不冲突——21st/Aceternity 的 React 锁定正是我们的空位，词条纯度不因换栈动摇 |
| F | 技术栈 | ✅ **Astro 7 + TypeScript + Tailwind v4 + Shiki + MiniSearch + zod**；数据管线 `demo.html →(sync 逐字节)→ demos.js →(QA+校验)→ site-data.js`，SSR 与浏览器岛共用产物，`复制=渲染=下载` 三态严格同源。QA 脚本静态卡"粘贴即活"铁律 |
| D | 词条工厂 | ✅ schema 即生成规范：AI 批量产词条 + 人工审校入库；**出厂自检三关**：粘贴即活 / prompt 回放测试 / 动效四要素（见 NEW_ENTRY.md） |
| E | 差异化战略 | ✅ **避其锋芒混编**：首版在组件/布局/风格立完整标杆，动效交互只取其浅覆盖的效果词；叙事从"首创"改为"最完整、可带走" |
| — | 站点风格 | ✅ 编辑部 / 词典排版：衬线大标题、编号词条、页边注、留白与字距讲究（shadcn 证明克制排版撑得起开发者口碑） |
| — | 语言 | 词条名中英双语；释义以中文为主 |
| — | 搜索 | 纯前端全文（MiniSearch 级），索引以**口语别名为主体**，支持描述反查；空结果引导"试试「淡入」或 Fade" |
| — | License | 词条代码第一天公示 **MIT**，永不追溯变更（Hover.css 授权分裂为鉴） |

## 词条 Schema（v0.2，v0.1→v0.2 修订均有调研实证）

```ts
interface Term {
  id: string;              // kebab-case，如 "bottom-sheet"
  no: string;              // 词典编号：C-01 / A-01 / I-01 / L-01 / S-01（按分类分段）
  category: 'component' | 'motion' | 'interaction' | 'layout' | 'style';
  nameZh: string;          // 中文正名
  nameEn: string;          // 英文原名
  aliases: string[];       // 口语描述为主体（"鼠标吸过去"），为反查服务
  definition: string;      // 2-4 句：是什么 + 何时用 + 与近邻词辨析一句（index.how 式）
  whenNotToUse?: string[]; // "何时别选它"（Mobbin），≠ pitfalls
  confusedWith?: string[]; // 易混淆词条 id（Drawer vs Bottom Sheet 式辨析块）
  anatomy?: { part: string; note?: string }[]; // 组件类编号解剖，部位词是 prompt 的词汇源
  promptTemplate: PromptCard; // ↓ 复制时拼装成单段纯文本
  demoCode: string;        // 零依赖自包含单文件（Live Demo 与复制内容同源）
  params?: { name: string; def: string; hint?: string }[]; // 2-3 个可调参数，滑杆回写代码
  scenarios: string[];     // 适用场景
  pitfalls: string[];      // 张鑫旭式因果句："X 与 Y 并存是为了兼容 Z"
  related: string[];       // 相关词条 id
  verifiedWith?: string;   // "claude-sonnet-4 · 2026-09"——直面模型漂移，词典靠时效标注建立信任
  contributors: { generator: string; reviewer: string; date: string }[];
  refs?: string[];         // Apple HIG / Material 等权威规范外链
}

interface PromptCard {
  core: string;            // 主体段落，数值规格（触发条件/运动模型/时长/结束态四要素）
  stack: string;           // 输出形态硬约束（自包含单文件、零依赖、无构建步骤）
  constraints: string[];   // 负向清单，拼装进 "Avoid:" 段
  verify: string[];        // 验收清单："生成后你应该看到…"（v0 pack 句式）
  reference?: string;      // 审美锚点（"参考气质：Apple Music 播放面板"），锚点胜过十个形容词
  variants?: { label: string; delta: string }[]; // 轻量变体（更含蓄/更戏剧）
}
```

## 词条页版式蓝图（十段式，融合四线最优）

1. 页眉：`编号 ｜ 磁吸按钮 Magnetic Button ｜ 别名露出`
2. 一句话定义（含辨析句）
3. **When to use / When NOT to use** 双栏对照（Mobbin）
4. 操作行三按钮：`复制 Prompt ｜ 复制代码 ｜ 独立页打开 Demo`（21st + Aceternity + shadcn /view 合体）
5. Live Demo：srcdoc iframe 渲染 demoCode 本体 + 参数滑杆实时回写 + 全站"减少动效"开关
6. 代码块：整页版 / 核心片段两粒度复制（Animista 双粒度）
7. 易混淆辨析小块
8. 场景与坑（因果句文体）
9. 相关词条（hash 筛选，词条即查询视图）+ Refs 信任状
10. Prev/Next 编号导航

首页 = 编号词条全索引墙（卡片 hover 即播动效）+ 分类计数徽标 + 反查搜索框。

## 首版标杆词条（10 条，避其锋芒混编）

| 编号 | 词条 | 分类 | 选它的理由 |
|---|---|---|---|
| C-01 | Bottom Sheet 底部弹层 | 组件 | anatomy + 辨析 + whenNotToUse 全装备示范（模板示例见 [NEW_ENTRY.md](NEW_ENTRY.md)） |
| C-02 | Skeleton 骨架屏 | 组件 | Shimmer 截图无法表达、demo 即定义的实证词条 |
| C-03 | Snackbar (Toast) | 组件 | NN/g 别名学示范：一词多名的检索价值 |
| L-01 | Bento Grid 便当格 | 布局 | 风格站有词没代码，我们补全 |
| L-02 | Scrollytelling 滚动叙事 | 布局 | 跨类组合词条（+滚动驱动动效） |
| S-01 | Glassmorphism 毛玻璃 | 风格 | 含无障碍坑（对比度）的负责任示范 |
| S-02 | Neo-brutalism 新粗野主义 | 风格 | 风格类 prompt 的锚点写法示范 |
| M-01 | Magnetic Button 磁吸按钮 | 动效 | 动效词典浅覆盖域 + 完整弹簧数值规格（调研现成草案） |
| M-02 | Shimmer 微光扫过 | 动效 | 与 Skeleton 互为辨析对，演示 confusedWith 机制 |
| I-01 | Pull-to-Refresh 下拉刷新 | 交互 | 橡皮筋/回弹四要素最完整的交互词条 |

## 目录规划

```
ui-dict/
├── README.md          ← 你在这里（v0.2，2026-09-24 按调研结论修订）
├── NEW_ENTRY.md       ← 词条工厂规范 + 标杆词条 C-01 完整示例
├── research/          ← 同类产品调研 5 份报告（已完成）
├── poc/               ← 早期零构建 POC（srcdoc 同源可行性验证，已完成使命）
├── astro.config.mjs   ← Astro + Tailwind + @/ 别名
├── scripts/           ← 数据管线：sync-demofiles / qa-demofiles / gen-client-data · 回归：regression-check · 回放：replay-test（REPLAY.md）
├── src/
│   ├── lib/           ← params.mjs（参数块契约）· validate.mjs（zod 入库闸）· terms.mjs（加载器）· prompt.mjs（拼装）· html-gate.mjs（单文件铁律共享闸）· browser.mjs（零依赖 CDP 渲染器）
│   ├── layouts/       ← Base.astro 编辑部外壳
│   ├── pages/         ← index.astro 索引墙 · term/[slug].astro 详情页
│   ├── scripts/       ← 浏览器岛：frame / home（反查搜索）/ entry（滑杆同步）
│   ├── styles/        ← global.css（Tailwind v4 + 词典排版层）
│   └── generated/     ← 构建产物（gitignore）：demos.js · site-data.js
└── terms/             ← 词条数据：一条一目录（entry.json + demo.html），五类 10 条
```

## 状态

- [x] 产品定位与决策定稿 v1（2026-09-24）
- [x] 同类产品调研 4 线 + 汇总（[research/](research/00-synthesis.md)）
- [x] 战略卡位确认：差异化半区立旗；首版避其锋芒混编
- [x] Schema v0.2 + 词条页版式蓝图（本 README）
- [x] NEW_ENTRY.md 词条工厂规范 + C-01 标杆示例
- [x] 技术栈定案：Astro 7 + TS + Tailwind v4 + Shiki + MiniSearch + zod（决策 F）
- [x] 站点外壳 v0.1（数据管线 + 索引墙 + 详情页 + 浏览器岛）
- [x] 真实浏览器验证：首页活卡片 / 描述反查（"鼠标吸过去"→磁吸按钮）/ 详情页三态同源 / 滑杆→代码+prompt 同步 8/8 断言通过
- [x] 本地 git 管理（独立仓库，main 分支，LF 统一，构建产物已 ignore）
- [x] **首版 10 条标杆词条集齐**（五类全覆盖，QA+zod+构建+浏览器实测全绿）
- [x] **词条扩到 20 条**（组件7 · 动效4 · 交互2 · 布局4 · 风格3；写手并行管线二次验证）
- [x] **首页编辑部词典排版 v0.2**：报头双线 + 罗马数字目录 + 发刊词（引 AI articulation barrier）+ 页边注四步管线 + 分节活词条墙 + 分节搜索收起
- [ ] 部署上线（GitHub Pages / Vercel + 独立域名 + 主动归档 Internet Archive；决策见 DEPLOY.md）
- [x] **prompt 回放测试工具化**（`pnpm replay`：生成→铁律→真浏览器渲染→视觉判读→回填 verifiedWith；兑现出厂自检第二关，见 [REPLAY.md](REPLAY.md)）——**全 20 条双关验证回填**（Qwen3.8-Flash · 2026-09-25：20/20 生成通过 + 20/20 视觉还原判读通过）
