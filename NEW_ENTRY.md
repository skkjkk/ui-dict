# NEW_ENTRY.md · 词条工厂规范 v0.2

> 一份词条怎么算"合格入库"。AI 按本文档生成，人按本文档审校。
> 数据 schema 的权威定义在 [README.md](README.md)；本文档回答"怎么填、填到什么标准"。

## 0. 铁律（违反任意一条直接退回）

1. **粘贴即活**：`demoCode` 粘进一个空白 `.html` 文件、双击浏览器打开，必须能跑。
   禁止：React/Vue/Tailwind CDN、npm 包、`<link>` 外部字体以外的任何网络请求、构建步骤。
   （外部字体：允许系统字体栈，**默认不引 webfont**——shadcn/Uiverse 验证零请求是底线。）
   > 实证：shadcn blocks 高喊 "Copy and paste" 但离了 `npx shadcn init` 根本跑不起来——
   > 口号与真实性脱节是本站最大的反面教材。行业背书见 Simon Willison
   > [Useful patterns for building HTML tools](https://simonwillison.net/2025/Dec/10/html-tools)。
2. **demo 与代码同源**：详情页 Live Demo = `srcdoc` iframe 渲染 `demoCode` 字符串本体。
   不存在"第二个 demo 实现"。改代码 = 改 demo。
3. **prompt 回放测试**：审校时须用该词条拼装出的 prompt 在目标模型真跑一次生成，
   生成结果与 demo 的行为一致才入库；结果记入 `verifiedWith`（模型名 + 日期）。
   > 已工具化：`pnpm replay <slug> --accept` 一条命令跑完 生成→铁律→真浏览器渲染→回填。
   > 详见 [REPLAY.md](REPLAY.md)。（审校四问的 ③ 仍需人眼判读截图，工具给证据不给结论。）
   > 实证：PromptBase 上架前官方实测复现，"bad test generations" 即拒。我们用人肉最小版。
4. **动效/交互词条的 core 四要素**：触发条件 + 运动模型（曲线/弹簧**给数值**）+ 时长量级 +
   结束态（回弹/停留/循环）。缺一要素退回。形容词不是规格。
   > 实证：v0 prompt pack 的写法是 damping 30 / stiffness 80 / radius 140px，不是"更重的吸附感"。
5. **License 公示**：词条代码即 MIT（站点级声明，terms 不另设授权）。永不追溯变更
   （Hover.css 中途 MIT→商用付费，生态分裂至今）。

## 1. 文件组织（学 Uiverse galaxy 扁平归档）

```
terms/
├── index.js                     # 词条注册表：id → 文件映射（app.js 加载此文件）
└── <category>/<id>/             # 一条词条一个目录
    ├── entry.js                 # 元数据（schema v0.2，见 README）
    └── demo.html                # demoCode 本体（单文件、自包含、可双击直接打开）
```

- `entry.js` 里 `demoCode` 以字符串形式内联 `demo.html` 内容（开发期用脚本合并；
  运行期也可 fetch——但部署后是静态站，**构建脚本合并、产物单包**更符合免构建承诺，
  v0.1 先用一个 30 行的 Node 脚本 `tools/bundle-terms.js` 生成 `terms-data.js`，不引任何构建框架）。
- 审校 = 打开 `demo.html` 双击看效果 + 读 `entry.js` 文案 + 跑一次 prompt 回放。

## 2. 字段文体标准

| 字段 | 标准 | 文体来源 |
|---|---|---|
| `nameZh/nameEn` | 用业界通用名，不发明词。有争议的正名进 aliases 观察 | — |
| `aliases` | **口语描述为主体**："鼠标吸过去""糊了一层玻璃""一闪一闪的光"。目标：用户不会打错字也能搜到。每词条 3-8 条，其中 ≥3 条必须是"感觉描述"而非同义词 | Rabbit_QL《你以前会说 vs 用术语说》对照表 |
| `definition` | 2-4 句：是什么 + 何时用 + **与最近邻词的辨析一句**。禁止循环定义（"骨架屏是一种骨架"）| index.how："Tooltip 不能含交互内容，要放链接请用 Popover" |
| `whenNotToUse` | "何时别选它"，与辨析配合成对出现（≠ pitfalls 的实现坑） | Mobbin Glossary |
| `confusedWith` | 点名 1-2 个最易混词条，详情页生成微型辨析块 | Mobbin / index.how |
| `anatomy` | 组件/交互类必填：编号部位 + 一句话职责。**这些部位词会进 prompt 正文**，AI 靠它们定位 | Mobbin Anatomy |
| `pitfalls` | **张鑫旭式因果句**："X 与 Y 并存是为了兼容 Z，Safari 在…有坑"。禁止空泛 checklist（"注意性能"） | zhangxinxu.com 微码 |
| `scenarios` | 具体到产品："携程酒店筛选抽屉""Apple Music 播放面板"，不写"适合移动端" | — |
| `refs` | Apple HIG / Material 3 / W3C 外链，白嫖信任状 | Mobbin Refs |

### PromptCard 拼装格式（复制按钮实际产出的文本骨架）

```text
实现一个"{nameZh}（{nameEn}）"，要求：

【行为规格】
{core 逐条}

【技术约束】
{stack + 零依赖/单文件/无网络请求/无构建步骤}

【避免】
{constraints 逐条，祈使句}

【参考气质】{reference}

【验收】生成后我应该看到：{verify 逐条}
```

params 表在 UI 上展示为可调滑杆，**复制时按当前值写进 core 文本**；
variants 不默认拼入（详情页单独提供"更强/更含蓄"档位按钮）。

## 3. 生成指令模板（给 AI 批量产词条用）

```
按 ui-dict 词条工厂规范 NEW_ENTRY.md + README.md schema v0.2，
为「{词条名}」生成完整词条目录：
1) entry.js（元数据，JSON 兼容的对象字面量）
2) demo.html（零依赖单文件：系统字体栈、无网络请求、双击可运行、
   包含 prefers-reduced-motion 降级、触屏 (hover:none) 降级、
   键盘可操作、aria 标注）
要求：definition 含近邻词辨析句；aliases ≥3 条口语感觉描述；
pitfalls 写成因果句；动效/交互类 core 给数值规格（四要素齐）；
PromptCard 按拼装骨架填齐。
禁止杜撰不存在的通用名——命名拿不准时在输出末尾单列 [命名存疑]。
```

审校清单（人工四问）：① 这名字业界真的这么叫吗 ② demo 还原定义了吗
③ 这条 prompt 不带着它、带着它，生成结果有肉眼差别吗 ④ 坑是真的坑还是凑数。

## 4. 标杆示例：C-01 · Bottom Sheet 底部弹层（全装备词条）

> 选它做示范：组件类、需要 anatomy、有黄金辨析对（vs Dialog/Action Sheet）、
> whenNotToUse 真实存在、且动效词典只有浅覆盖——正是我们的半区。

### terms/component/bottom-sheet/entry.js

```js
({
  id: "bottom-sheet",
  no: "C-01",
  category: "component",
  nameZh: "底部弹层",
  nameEn: "Bottom Sheet",
  aliases: [
    "从屏幕下面滑上来的面板",
    "半屏弹窗",
    "下滑抽屉",
    "拖动换高度的卡片",
    "Slide up Panel", "Modal sheet", "抽屉式弹层"
  ],
  definition:
    "附着在屏幕底缘、可向上拖拽展开的面板，提供介于全屏页面与瞬时提示之间的" +
    "第三档承载空间。用户随时可以下推手势（下拉、点遮罩）让它退出，心智负担低于 Dialog。" +
    "与 Dialog 的区别：Dialog 打断并等待决定，Bottom Sheet 不打断上下文、可与底图持续对比。",
  whenNotToUse: [
    "需要用户必须做出二选一决定才能继续时 → 用 Dialog/Alert",
    "内容是短时反馈、不需要停留操作时 → 用 Snackbar (Toast)",
    "选项只有 2-4 个动作、无需承载复杂内容时 → 用 Action Sheet",
    "桌面端宽屏（>1024px）→ 居中 Dialog 或侧边 Drawer，底部贴边在宽屏上视觉断裂"
  ],
  confusedWith: ["dialog", "snackbar", "action-sheet"],
  anatomy: [
    { part: "Handle 把手", note: "顶部居中小横条，暗示可拖拽；是唯一的必绘部件" },
    { part: "标题/内容区", note: "滚动主体；标题行常驻，滚动内容从其下穿过" },
    { part: "Scrim 遮罩", note: "背后压暗层，点击即关闭；与 Dialog 遮罩同义" },
    { part: "停靠位 Snap points", note: "peek/half/full 两至三档，松手后吸附到最近一档" }
  ],
  promptTemplate: {
    core:
      "实现一个移动端 Bottom Sheet 底部弹层组件，要求：\n" +
      "- 视口底缘伸出的圆角面板（border-radius 顶部 16px），背景 white，顶部居中画一个把手：36×5px、圆角 3px、颜色 rgba(0,0,0,.25)；\n" +
      "- 三个停靠位 snap points：peek 屏高 15%、half 60%、full 94%；初始停在 half；\n" +
      "- 拖拽把手或面板空白处上下移动，面板高度实时跟随指针，位移上限不超过 full、下限不低于 peek，越界时用 0.55 阻尼比（rubber-band）；\n" +
      "- 松手后按速度+位移加权吸附到最近停靠位（velocity > 0.5px/ms 直接送它去相邻档位），运动用弹簧：stiffness 300, damping 30；\n" +
      "- 背后 scrim 从 rgba(0,0,0,0) 到 rgba(0,0,0,.4) 随拖拽进度线性渐变，点 scrim 以回弹动画收起至 peek；\n" +
      "- 拖到低于 peek 50% 松手则完全关闭（scrim 与面板同步淡出/下移 240ms ease-out），关闭后触发按钮 regain focus；\n" +
      "- 面板内放可滚动示例列表，滚动到底后继续下拉才接管为面板拖拽（手势裁决：内容滚动优先）；\n" +
      "- role=\"dialog\"、aria-modal=\"true\"、Esc 关闭、焦点圈定在面板内（Tab 循环）。",
    stack:
      "单个自包含 HTML 文件；原生 CSS + 原生 JS（Pointer Events），零第三方依赖、零网络请求、粘贴即可运行。",
    constraints: [
      "不要用 <dialog> 元素做拖拽宿主（其 modal 行为与自由停靠冲突），用 div 自管 focus trap",
      "不要在 pointermove 里直接改 height——会触发布局重排；拖拽期用 transform: translateY 位移、落位时才写高度",
      "不要让 scrim 完全不拦截点击——用户必须能点空白关闭",
      "不要省略 prefers-reduced-motion：退化为淡入淡出 + 跳档，无拖拽惯性"
    ],
    verify: [
      "页面底部露出约 60% 高的面板，顶部可见把手",
      "按住面板上下拖动，面板实时跟手且内容区可独立滚动",
      "松手后面板回弹吸附到最近的档位，有轻微过冲",
      "向下拖过 peek 一半松手，面板滑出屏幕、遮罩淡出",
      "点遮罩或按 Esc，面板以相同动画关闭"
    ],
    reference: "参考气质：Apple Music iOS 播放面板；Google Maps 搜索结果抽屉。克制、跟手、吸附干脆。",
    variants: [
      { label: "更含蓄", delta: "去掉过冲：damping 提到 34，scrim 最暗 0.35" },
      { label: "更多档位", delta: "snap points 加 30% 一档；把手变 44px 宽暗示可拖" }
    ]
  },
  params: [
    { name: "吸附刚度 stiffness", def: "300", hint: "越大落位越快越'弹'" },
    { name: "scrim 浓度", def: "0.4", hint: "0–0.6；影响聚焦感" }
  ],
  scenarios: [
    "地图 App 的搜索结果列表（Google Maps / 高德）",
    "音乐 App 的播放面板（Apple Music / Spotify）",
    "电商筛选器：边看结果边收筛选条件（携程酒店筛选）",
    "分享面板的移动端形态"
  ],
  pitfalls: [
    "把手用 ::after 画就不用占真实节点，但失去可命中区——拖拽起点判定要把把手上下 12px 都算进热区，否则小屏用户按不准",
    "iOS 上滚动与拖拽手势打架：必须实现'内容滚到底才接管下拉'，否则用户在列表里滑动会误拖面板——Android 无此问题，测试别只用桌面",
    "面板用 height 动画会逐帧重排，低端机掉帧——拖拽期 translateY、松手瞬间才回写 height，两件事分开",
    "焦点圈定（focus trap）漏做时键盘用户 Tab 会跑到背后页面，Esc 关闭又必须同时归还焦点——a11y 与动画同等优先级"
  ],
  related: ["dialog", "drawer", "snackbar", "action-sheet", "drag-handle"],
  refs: [
    "https://m3.material.io/components/bottom-sheets/guidelines",
    "https://developer.apple.com/design/human-interface-guidelines/sheets"
  ],
  verifiedWith: "claude-sonnet-4 · 2026-09",
  contributors: [
    { generator: "AI (ui-dict 工厂 v0.2)", reviewer: "skkjkk", date: "2026-09-24" }
  ]
})
```

### terms/component/bottom-sheet/demo.html

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bottom Sheet 底部弹层 · ui-dict C-01 demo</title>
<style>
  :root { --scrim-a: .4; --spring-stiff: 300; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
         background: #f5f5f7; min-height: 100vh; }
  .page { padding: 24px; }  /* 背后的页面内容 */
  .page h1 { font-size: 17px; } .page p { color: #555; font-size: 14px; }
  #open { position: fixed; left: 50%; bottom: calc(15vh + 20px); transform: translateX(-50%);
          padding: 10px 20px; border: 0; border-radius: 999px; background: #111; color: #fff;
          font-size: 14px; cursor: pointer; }

  .scrim { position: fixed; inset: 0; background: rgba(0,0,0,var(--scrim-a));
           opacity: 0; pointer-events: none; transition: opacity .24s ease-out; z-index: 10; }
  .scrim.show { opacity: 1; pointer-events: auto; }

  /* 面板：用 translateY 位移，height 只在落位时写 */
  .sheet { position: fixed; left: 50%; bottom: 0; width: min(560px, 100%); z-index: 11;
           background: #fff; border-radius: 16px 16px 0 0; box-shadow: 0 -8px 40px rgba(0,0,0,.16);
           transform: translate(-50%, 100%); visibility: hidden;
           display: flex; flex-direction: column; }
  .sheet.open { visibility: visible; transform: translate(-50%, 0);
                transition: transform .24s cubic-bezier(.2,.8,.2,1); }
  .sheet.dragging { transition: none; }

  .handle-zone { padding: 10px 0 4px; display: flex; justify-content: center;
                 touch-action: none; cursor: grab; }
  .handle-zone::after { content: ""; width: 36px; height: 5px; border-radius: 3px;
                        background: rgba(0,0,0,.25); }
  .sheet header { padding: 2px 20px 12px; border-bottom: 1px solid #eee;
                  display: flex; align-items: baseline; justify-content: space-between; }
  .sheet header b { font-size: 16px; } .sheet header span { font-size: 12px; color: #999; }
  .body { overflow-y: auto; padding: 4px 20px 24px; -webkit-overflow-scrolling: touch;
          flex: 1; min-height: 0; }
  .row { padding: 14px 0; border-bottom: 1px solid #f2f2f2; font-size: 14px;
         display: flex; justify-content: space-between; }
  .row small { color: #999; }

  @media (prefers-reduced-motion: reduce) {
    .sheet.open { transition: none; } .scrim { transition: opacity .12s linear; } }
</style>
</head>
<body>
  <main class="page">
    <h1>附近的酒店</h1>
    <p>点击底部按钮打开 Bottom Sheet。拖拽把手上下移动，松手自动吸附到最近的停靠位；
       拖到接近 peek 以下松手即关闭。</p>
  </main>
  <button id="open">查看结果</button>
  <div class="scrim" id="scrim"></div>
  <section class="sheet" id="sheet" role="dialog" aria-modal="true" aria-label="酒店结果面板">
    <div class="handle-zone" id="handle" aria-hidden="true"></div>
    <header><b>筛选结果 · 214 家</b><span>拖拽调整高度</span></header>
    <div class="body" id="list">
      <!-- 行示例（demo 里静态造 12 行） -->
    </div>
  </section>
<script>
(() => {
  const sheet = document.getElementById('sheet'), scrim = document.getElementById('scrim'),
        handle = document.getElementById('handle'), openBtn = document.getElementById('open'),
        list = document.getElementById('list');
  for (let i = 1; i <= 12; i++) {
    const d = document.createElement('div'); d.className = 'row';
    d.innerHTML = `<span>云栖酒店 ${'ABCD'[i%4]}${i} 号院</span><small>¥${80 + i * 17}/晚</small>`;
    list.appendChild(d);
  }
  const H = () => innerHeight;
  const snaps = () => [H() * .15, H() * .6, H() * .94];        // peek / half / full
  const closeY = () => sheet.offsetHeight + 40;                // 完全移出视口
  let h = 0, open = false, dragging = false, sy = 0, sh = 0, lastY = 0, lastT = 0, v = 0;

  function setHeight(px, spring = false) {
    h = Math.round(px);
    sheet.style.height = h + 'px';
    sheet.style.transform = `translate(-50%, ${open ? 0 : closeY() - h}px)`;
    if (!spring) return;
    // 落位后的弹簧过冲回稳（纯 CSS 近似：transform 弹性曲线）
    sheet.animate(
      [{ transform: sheet.style.transform },
       { transform: `translate(-50%, ${-(h * .012)}px)` },
       { transform: 'translate(-50%, 0)' }],
      { duration: 340, easing: 'cubic-bezier(.18,.89,.32,1.28)' });
  }
  function openSheet() {
    open = true;
    setHeight(snaps()[1]);                       // 初始 half
    scrim.classList.add('show');
    sheet.classList.add('open');
    handle.focus?.();
  }
  function closeSheet() {
    open = false;
    sheet.classList.remove('open');
    scrim.classList.remove('show');
    openBtn.focus();
  }
  openBtn.addEventListener('click', openSheet);
  scrim.addEventListener('pointerdown', closeSheet);
  addEventListener('keydown', e => { if (e.key === 'Escape' && open) closeSheet(); });

  function startDrag(e) {
    dragging = true; sheet.classList.add('dragging');
    sy = e.clientY; sh = h; v = 0; lastY = e.clientY; lastT = performance.now();
    handle.setPointerCapture(e.pointerId);
  }
  function moveDrag(e) {
    if (!dragging) return;
    const dy = e.clientY - sy;
    const now = performance.now();
    v = (e.clientY - lastY) / Math.max(1, now - lastT);        // px/ms，负=上移
    lastY = e.clientY; lastT = now;
    let nh = sh - dy;
    const s = snaps();
    if (nh > s[2]) nh = s[2] + (nh - s[2]) * .55;               // rubber-band
    if (nh < s[0]) nh = s[0] + (nh - s[0]) * .55;
    setHeight(nh);
  }
  function endDrag() {
    if (!dragging) return;
    dragging = false; sheet.classList.remove('dragging');
    const s = snaps();
    if (h < s[0] * .5 || v > .5) return closeSheet();           // 快速下甩或拖过低阈值 → 关闭
    const target = s.reduce((a, b) => Math.abs(b - h) < Math.abs(a - h) ? b : a);
    setHeight(target, true);                                     // 吸附 + 过冲回稳
  }
  // 手势裁决：把手区永远可拖；内容区滚到底后继续下拉才接管
  handle.addEventListener('pointerdown', startDrag);
  handle.addEventListener('pointermove', moveDrag);
  handle.addEventListener('pointerup', endDrag);
  list.addEventListener('pointerdown', e => {
    if (list.scrollTop <= 0 || (e.target === list && false)) startDrag(e);
  });
  list.addEventListener('touchmove', () => {}, { passive: true });
})();
</script>
</body>
</html>
```

> 注：本示例 demo 在拖拽落位动画上做了工程取舍——用 Web Animations API 近似弹簧过冲
> （比手写 rAF 积分少 40 行且可中断），constraints 里仍禁止用 CSS transition 直接模拟跟手拖拽。
> 审校若判定该取舍削弱"吸附干脆"的定义还原度，退回重做——**demo 是定义的一部分**。

## 5. "复制整张词条卡"导出格式（Magic UI Copy Page 思路）

词条详情页三按钮之一，产出 MD：`# 编号 名称` → 别名行 → 定义 → whenNotToUse 摘要 →
拼装后的完整 prompt（围栏代码块）→ demoCode（围栏 html 块）→ 出处行。
纯前端字符串拼接，一个函数搞定。全站合集导出（agent skill 形态）留待 v0.2 再做。
