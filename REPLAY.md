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
   │ ④ render：headless Chrome（CDP，零依赖）真浏览器渲染 + 滚动遍历 + 控制台/异常收集 + 整页截图
   ▼
报告 replay/<slug>/report.json + gen-*.html + gen-*.png
   │ ⑤ 人工/模型判读截图，确认行为与验收清单一致
   ▼
--accept 回填 verifiedWith（"Qwen3.8-Flash · replay 2026-09-25 · 1/1 生成通过"）
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
```

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

## 判读：机器过 ≠ 入库

工具给的是**证据**（生成的代码、渲染截图、运行时错误），不是**结论**。铁律 + 渲染「过」只保证
「模型产出了一个能跑、零依赖、无报错的页面」——它是否**还原了这条词条定义的行为**（磁吸有没有弹簧过冲？
骨架屏有没有微光循环？）仍需人眼看截图对照 `verify` 清单，或交给视觉模型判读。**审校四问的 ③
（带着这条 prompt、不带着它，生成结果有肉眼差别吗）是本工具服务但无法替你回答的那一问。**
`--accept` 只是把「跑过了且你认可」这个人工决定落进 `verifiedWith`，不自动背书。

## 与既有资产的关系

- `qa-demofiles.mjs`（第一关·静态）：卡**源文件** demo.html 的单文件铁律 —— 生产闸。
- `regression-check.mjs`：卡详情页 SSR 结构锚点 —— 版式回归。
- `replay-test.mjs`（第二关·动态）：卡**模型生成物**能否跑起来 —— 本工具。
- 三者共用 `src/lib/`：`prompt.mjs`（拼装）、`html-gate.mjs`（铁律）、`browser.mjs`（渲染器）。
