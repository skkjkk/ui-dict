# REPLAY.md · prompt 回放测试工具

> 兑现 [NEW_ENTRY.md](NEW_ENTRY.md) 铁律 3「prompt 回放测试」的自动化执行器。
> 出厂自检三关的第二关（粘贴即活 / **prompt 回放测试** / 动效四要素）从「人肉跑一次」升级为「一条命令跑完并回填 verifiedWith」。

## 它做什么

一条词条的 prompt 到底能不能让 AI 生成出「和 demo 行为一致」的代码？这是词典站信任的根基，
也是 PromptBase「bad test generations 即拒」、shadcn「口号与真实性脱节」的教训所在。本工具把这条链路自动化：

```
词条 promptTemplate
   │ ① assemblePrompt（与详情页「复制 Prompt」逐字节同源，复用 src/lib/prompt.mjs）
   ▼
生成的 prompt 文本
   │ ② generate：丢给 OpenAI 兼容端点真跑一次（默认本地 qoder2api，可换任意 /v1 端点）
   ▼
generated.html（模型产出的代码）
   │ ③ gate：单文件铁律复检（复用 src/lib/html-gate.mjs，与 qa-demofiles 同一把尺子）
   │ ④ render：headless Chrome（CDP，零依赖）真浏览器渲染 —— 滚动遍历触发 scroll 动效、
   │    交互激活点开「点开才见」的浮层（命令面板/抽屉/弹层）、控制台/异常收集、整页截图
   ▼
报告 replay/<slug>/report.json + gen-*.html + baseline.png + gen-*.png
   │ ⑤ judge：视觉模型（Qwen3.8-Flash 是视觉模型）对照基准截图 + 验收清单，判「生成是否还原定义」
   ▼
--accept 回填 verifiedWith（"Qwen3.8-Flash · replay 2026-09-25 · 1/1 生成通过 · 视觉判读 high"）
```

**为什么这算「工具化」而不是又一个测试**：它复用了站点自己的两个纯函数模块
（`prompt.mjs` 拼装、`html-gate.mjs` 铁律），所以「回放测的 prompt」和「用户复制到的 prompt」、
「回放卡的铁律」和「出厂 QA 卡的铁律」是**同一份代码**，永不漂移。

## 用法

```bash
# 看验证进度（哪些词条已回填 verifiedWith）
pnpm replay:status

# 冒烟：不花模型额度，只把 20 条基准 demo 全部真浏览器渲染一遍（验证渲染器本身）
pnpm replay:dry

# 单条 live 回放（真调模型生成 + 铁律 + 渲染）
pnpm replay bottom-sheet
node scripts/replay-test.mjs M-01          # 编号或 slug 都行
node scripts/replay-test.mjs ripple --out 3 # 多次生成看方差（temperature 0.7）

# 全量 live（慢，按条计费额度）
node scripts/replay-test.mjs --all
node scripts/replay-test.mjs --all --only-unverified

# 通过后回填 verifiedWith（只在全过才写，且只改那一行，不重排 entry.json）
node scripts/replay-test.mjs count-up --accept

# 视觉判读（第五关）：用视觉模型对照基准截图 + 验收清单，判「生成是否还原定义」
#   读已有截图，不重新生成/渲染；--recapture 先从已存 gen-*.html 重渲染（带交互激活）再判
node scripts/replay-test.mjs --judge --all
node scripts/replay-test.mjs --judge command-palette --recapture   # 改了证据必重判
node scripts/replay-test.mjs --judge --all --accept                # 复用判读结论，回填含「视觉判读 high/medium」
```

### 判读模式（`--judge`）

出厂自检第二关的「人眼判读」这一步也交给视觉模型（Qwen3.8-Flash 是视觉模型）：
把**基准 demo 截图**（图一，定义应有的样子）和**生成截图**（图二）并排喂给模型，
连同词条定义 + 解剖部件 + 验收清单，要求只输出结构化 JSON：
`{faithful, confidence, matched[], missing[], notJudgeable[], verdict}`。

- **诚实约束**：静态截图判不了动效过程与 hover/click 反馈 —— prompt 明确要求把这些
  列入 `notJudgeable` 而非臆断缺失，所以判读结论只覆盖「静态视觉可判定」的部分。
  这正是它作为**粗筛**的价值：能抓「该有面板却只有背景」这类硬伤，动效细节仍靠渲染闸 + 人眼。
- **交互激活**（`activate()`）：命令面板/抽屉/弹层这类「点开才见」的词条，
  初始静态截图只有触发钮，判读会误杀（首轮 C-06 就被误判 ✗）。渲染后自动探测隐藏浮层
  （`[role=dialog]/.sheet/.palette/…`），点最可能的触发钮、兜底 Ctrl+K 把它打开再截图 ——
  重捕获后 C-06 翻为 ✓，且是**证据支撑**的翻案（截图里真能看到输入框+列表+高亮+快捷键徽章）。
- 判读结论写进 `report.json` 的 `judge` 块；`--accept` 折进 `verifiedWith`
  （`… · 视觉判读 high`）。幂等：已有结论默认复用，`--recapture`/`--re-judge` 强制重判。

**2026-09-25 首轮全量判读**：20/20 视觉还原通过（high 8 / medium 12）。medium 集中在
「核心是动效、静态图只能判结构」的动效/交互类词条 —— 判读器对此诚实，没有假装能判动效。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `REPLAY_API_BASE` | `http://127.0.0.1:10081/v1` | OpenAI 兼容端点（默认本地 qoder2api） |
| `REPLAY_API_KEY` | 自动读 qoder2api `apikey.txt` | 换端点必须显式给 |
| `REPLAY_MODEL` | `Qwen3.8-Flash` | 生成模型 |
| `REPLAY_MAX_TOKENS` | `12000` | 生成上限（推理模型要留够思考预算） |
| `REPLAY_REASONING` | `low` | 推理档位；`none` 关闭 `reasoning_effort` |
| `UIDICT_CHROME` | 自动发现 | chrome.exe 路径（默认 ms-playwright 缓存→系统 Chrome/Edge） |

## 设计要点（踩过的坑）

1. **流式生成**：qoder2api 非流式会缓冲到超时（实测 300s 不返回），流式首字节 <1s。
   工具用 SSE 逐块拼装 + 空闲超时（60s 无新字节判卡死）。
2. **推理档位 `low`**：默认思考会吃光整个 `max_tokens`（实测 `finish=length` 只吐 3.7KB），
   回放要的是「照 prompt 生成代码」，`reasoning_effort=low` 既快又足。
3. **滚动遍历**：截图默认只拍折叠线以上，scroll-driven 词条（数字翻滚/滚动叙事/视差/粘性分区）
   的核心行为在折叠线下。渲染后按半屏步进滚到底，触发 IntersectionObserver，再整页截图
   （`captureBeyondViewport`）—— 这样截图里能看到数字**正在滚**（如 2,458）而非终值。
4. **闸与渲染互不污染**：模型常省略 `<!DOCTYPE html>`。铁律闸按 `requireDoctype:false`
   把「缺 DOCTYPE 但文档完整」降级为警告（生产词条仍由 qa-demofiles 硬卡源文件）；
   渲染副本缺 DOCTYPE 时补一个强制标准模式，避免 quirks 假阳性。
5. **真事件**：交互探针走 CDP `Input.dispatchMouseEvent`（真实命中测试），不用 `el.click()` 合成捷径。
6. **回填只改一行**：`--accept` 用正则定位 `verifiedWith` 行替换 / 末尾插入，`JSON.parse` 兜底校验，
   绝不 `JSON.stringify(entry,null,2)` 重排整个文件（会毁掉手调的紧凑数组排版，污染 diff）。

## 判读：机器过 ≠ 入库（判读是粗筛，不是终审）

工具给的是**证据**（生成的代码、渲染截图、运行时错误），不是**终审结论**。铁律 + 渲染「过」只保证
「模型产出了一个能跑、零依赖、无报错的页面」——它是否**还原了这条词条定义的行为**，由第五关
`--judge`（视觉模型对照基准截图 + 验收清单）做**粗筛**：抓「该有面板却只有背景」这类硬伤，
并把静态可判的解剖部件逐一核对。但动效过程（磁吸过冲、微光循环、吸附时序）静态图天然判不了，
判读器被明确要求把这些列入 `notJudgeable` 而非臆断 —— 所以 **medium 置信的动效词条，
审校四问的 ③（带/不带这条 prompt，生成结果有肉眼差别吗）仍需人眼对照 `replay/<slug>/gen-1.png`
与验收清单**，判读只是把「明显没还原」的先挡在门外。`--accept` 落进 `verifiedWith` 的是
「生成 + 铁律 + 渲染 + 视觉粗筛」四关的通过记录，不替人背终审的锅。

## 与既有资产的关系

- `qa-demofiles.mjs`（第一关·静态）：卡**源文件** demo.html 的单文件铁律 —— 生产闸。
- `regression-check.mjs`：卡详情页 SSR 结构锚点 —— 版式回归。
- `replay-test.mjs`（第二关·动态）：卡**模型生成物**能否跑起来 —— 本工具。
- 三者共用 `src/lib/`：`prompt.mjs`（拼装）、`html-gate.mjs`（铁律）、`browser.mjs`（渲染器）。
