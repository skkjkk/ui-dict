# scripts/ · 数据管线与工具带

构建链与验收工具的唯一地图。命令入口全部在 `package.json` scripts 里，本文件解释**谁依赖谁、什么顺序跑**。

## 数据管线（构建期单向流）

```
terms/<category>/<id>/
  ├── entry.json      结构化元数据（schema 权威：src/lib/types.mjs）
  └── demo.html       零依赖单文件 demo（产品承诺：双击即活）
        │
        ▼  pnpm gen = sync → qa → gen-client-data
scripts/sync-demofiles.mjs   demo.html 逐字节 → src/generated/demos.js
                             同时写出 public/demos/<slug>.html（直链/爬虫/AI 直读）
scripts/qa-demofiles.mjs     入库闸：单文件铁律 · DOCTYPE · params 块 · 身份一致性(id/目录/category/编号)
scripts/gen-client-data.mjs  → src/generated/site-data.js   词条元数据（客户端岛 bundle 用，无代码体）
                             → src/generated/demo-urls.js   slug→/demos/<slug>.html 地址簿
                             → public/ui-dict.md            全站导出（整本喂 AI）
        │
        ▼  astro build（SSR 读 demos.js，把每页自己的 demo 内联进静态 HTML）
src/pages/index.astro        首页：卡片 iframe 进视口才 fetch /demos/<slug>.html，离视口 3s 卸载
src/pages/term/[slug].astro  详情页：demo 源码 SSR 内联进 #code，浏览器岛零请求零携带
```

**同源铁律的实现位**：`复制出去的代码 = iframe 渲染的 srcdoc = /demos/<slug>.html 文件`。
- 详情页三态：SSR 内联进 `#code` 的字符串就是源码本体；`entry.js` 从 DOM 读它作 base。
- 首页卡片：`previewSrcdoc()` 给 `/demos/<slug>.html` 的**内容**加展示层注入（与直链文件同一份字符串）。

## 分层（改哪里）

| 层 | 位置 | 规则 |
|---|---|---|
| Schema / 常量 | `src/lib/types.mjs` | 权威定义；谁都不许反向依赖执行壳 |
| 数据加载 | `src/lib/terms.mjs` | 读盘 + 校验 + demoCode 注入（仅 Node） |
| 词条闸 | `src/lib/validate.mjs` + `scripts/qa-demofiles.mjs` | 不合规即退回 |
| 纯逻辑（双端） | `src/lib/params.mjs` · `prompt.mjs` · `previews.mjs` · `search.mjs` | 无 DOM 无 fs，Node/浏览器都能跑 |
| 浏览器岛 | `src/scripts/frame.js`（iframe/复制/动效）· `home.js` · `entry.js` · `site.js` | 只做 DOM 绑定，逻辑下沉 lib |
| 页面 | `src/pages/*.astro` | SSR 组装；脚本经 `<script import>` 进岛 |

改**预览观感**（卡片里藏什么/摆哪）→ `src/lib/previews.mjs` 的 `PREVIEW_FIXES`，键 = 词条编号，不碰 terms/。
改**搜索行为** → `src/lib/search.mjs`（切词/排序/兜底，可独立单测）。
加**新词条** → `pnpm new-term <category> <id>`（见下）。

## 词条工厂（AI 快速扩展闭环）

```bash
pnpm new-term motion magnetic-follow        # 生成 terms/motion/magnetic-follow/（编号自动分配）
pnpm new-term layout hero-split --no L-07   # 显式指定编号
# 然后填 entry.json + 改 demo.html 效果区 → pnpm qa → pnpm build
```

模板在 `terms/_template/`（QA 会跳过下划线目录）。给 AI 的生成指令模板见 [NEW_ENTRY.md](../NEW_ENTRY.md)。

## 验收工具带

| 命令 | 干什么 | 依赖 |
|---|---|---|
| `pnpm qa` | 静态出厂自检（入库闸的快速档） | Node |
| `pnpm regression` | 33 词条详情页结构断言（锚点/按钮/滑杆/直链） | 需 `astro preview` @4332 |
| `pnpm verify:origin` | **三态同源字节级回归**：#code / iframe srcdoc / demos 直链 四方对比 | 零 npm 依赖 CDP，需 preview |
| `pnpm audit` | **可观测性审计**：DCL/load/传输字节/长任务(壳/demo 归因)/活 iframe/JS 堆/console 错误 | 零 npm 依赖（内置 CDP 渲染器），需本地起 dev/preview |
| `pnpm verify:grid` 等 | 版式/行为断言 | playwright |
| `pnpm replay` | prompt 回放：生成→铁律→真浏览器渲染→回填 verifiedWith | Node + Chrome |

### 性能预算（audit 默认阈值，超了即 FAIL）

| 指标 | 预算 | 为什么 |
|---|---|---|
| load | ≤ 3000ms | 本地静态服务下超过即有结构性问题 |
| 单页传输 | ≤ 900KB | 首页曾因全量 demo bundle 单项 ~600KB 超标，已改为按需 fetch |
| 壳长任务(>50ms) | ≤ 3 个/5s | 卡顿直接证据（按 attribution 归因：只算站点壳，iframe 内的归 demo 内容单列） |
| 活 iframe | ≤ 10 | 预览不回收会随词条数线性吃内存 |

阈值可在 `scripts/audit-page.mjs` 顶部 `BUDGET` 调整；CI 接法：`astro preview &` 后 `pnpm audit --base http://localhost:4321`。
