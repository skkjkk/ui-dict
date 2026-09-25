// scripts/replay-test.mjs
// prompt 回放测试工具化 —— 出厂自检第二关（NEW_ENTRY.md 铁律 3）的自动化执行器。
//
//   词条 promptTemplate ──assemblePrompt──▶ 与详情页「复制 Prompt」逐字节同源的文本
//        │ ① generate：丢给 OpenAI 兼容端点真跑一次生成（默认本地 qoder2api）
//        ▼
//   生成代码 generated.html
//        │ ② gate：单文件铁律复检（与 qa-demofiles 同一把尺子 src/lib/html-gate.mjs）
//        │ ③ render：headless Chrome（CDP）真浏览器渲染 —— 验收清单的机器可判定部分
//        ▼
//   报告 replay/<slug>/report.json + 截图 ──▶ ④ 人工/模型判读截图与验收清单
//        │ ⑤ --accept 回填 verifiedWith（"Qwen3.8-Flash · replay 2026-09-25 · 1/1 生成通过"）
//        ▼
//   entry.json（详情页页眉「prompt 验证」自动露出）
//
// 用法：
//   node scripts/replay-test.mjs <slug|no> [--model M] [--out N 次] [--accept] [--dry-run]
//   node scripts/replay-test.mjs --all [--only-unverified] [--dry-run]
//   node scripts/replay-test.mjs --judge --all [--judge-model M] [--accept]   # 视觉判读已有截图
//   node scripts/replay-test.mjs --status
//
// 环境变量：
//   REPLAY_API_BASE   默认 http://127.0.0.1:10081/v1（qoder2api 本地服务）
//   REPLAY_API_KEY    显式给 key；缺省读 REPLAY_API_KEY_FILE 指向的文件（默认见下）
//   REPLAY_MODEL      默认 Qwen3.8-Flash
//   UIDICT_CHROME     指定 chrome.exe（默认自动发现 ms-playwright 缓存 / 系统 Chrome/Edge）

import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadTerms, assemblePrompt } from "../src/lib/terms.mjs";
import { gateHtml } from "../src/lib/html-gate.mjs";
import { launchChrome } from "../src/lib/browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "replay");
const API_BASE = process.env.REPLAY_API_BASE ?? "http://127.0.0.1:10081/v1";
// key 文件不写死机器路径：优先 REPLAY_API_KEY_FILE，缺省按同级仓库约定解析（本地 qoder2api 运行时）
const API_KEY_FILE =
  process.env.REPLAY_API_KEY_FILE ??
  path.resolve(ROOT, "..", "dsh-qoder-connect", ".research", "qoder2api-runtime", "apikey.txt");

// ---------- CLI ----------
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const optNames = new Set(["model", "out", "settle"]);
const consumed = new Set();
for (let i = 0; i < argv.length; i++) {
  const m = /^--(\w+)$/.exec(argv[i]);
  if (m && optNames.has(m[1]) && i + 1 < argv.length) consumed.add(i + 1);
}
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : dflt;
};
const positional = argv.filter((a, i) => !a.startsWith("--") && !consumed.has(i));

// ---------- 生成端点 ----------
async function resolveKey() {
  if (process.env.REPLAY_API_KEY) return process.env.REPLAY_API_KEY;
  try { return (await fs.readFile(API_KEY_FILE, "utf8")).trim(); } catch { return null; }
}

/** 从模型回复中抽取 HTML 文档（剥 markdown 围栏；无围栏取 <!doctype…</html> 区段）。 */
export function extractHtml(text) {
  const fence = /```(?:html|HTML)\s*\n([\s\S]*?)```/.exec(text);
  if (fence) return fence[1].trim();
  const any = /```\s*\n([\s\S]*?)```/.exec(text);
  if (any && /<\s*(html|!doctype|body|div|style|script)/i.test(any[1])) return any[1].trim();
  const m = /<!doctype html[\s\S]*<\/html>/i.exec(text);
  if (m) return m[0].trim();
  const h = /<html[\s\S]*<\/html>/i.exec(text);
  if (h) return h[0].trim();
  return null;
}

/** 流式生成（SSE）：qoder2api 非流式会缓冲到超时，流式首字节 <1s。
 *  reasoning_effort=low：推理模型默认思考会吃掉整个 max_tokens 预算（实测 finish=length），
 *  回放测试要的是「照 prompt 生成代码」，低思考档位既快又足够。REPLAY_REASONING=none 可关。 */
async function generateOnce(content, { model, key, timeoutMs = 240000, idleMs = 60000, maxTokens = 12000, temperature = 0.7 }) {
  const extra = {};
  const effort = process.env.REPLAY_REASONING ?? "low";
  if (effort !== "none" && effort !== "off") extra.reasoning_effort = effort;
  const t0 = Date.now();
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      max_tokens: Number(process.env.REPLAY_MAX_TOKENS ?? maxTokens),
      temperature, // 判读用 0 求稳定，生成用 0.7 看方差
      stream: true,
      ...extra,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const rd = res.body.getReader();
  const dec = new TextDecoder();
  let text = "", reasoning = "", usage = null, finish = "", buf = "", lastByte = Date.now();
  for (;;) {
    const idle = new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`流空闲 ${idleMs / 1000}s 无新字节（上游可能卡死）`)), idleMs)
    );
    let chunk;
    try {
      chunk = await Promise.race([rd.read(), idle]);
    } catch (e) {
      rd.cancel().catch(() => {});
      throw e;
    }
    if (chunk.done) break;
    lastByte = Date.now();
    buf += dec.decode(chunk.value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload);
        const d = j.choices?.[0]?.delta;
        if (d?.content) text += d.content;
        if (d?.reasoning_content) reasoning += d.reasoning_content;
        if (j.choices?.[0]?.finish_reason) finish = j.choices[0].finish_reason;
        if (j.usage) usage = j.usage;
      } catch { /* 非 JSON 心跳行 */ }
    }
  }
  return { content: text, html: extractHtml(text), reasoningChars: reasoning.length, finish, ms: Date.now() - t0, usage };
}

// ---------- 渲染断言（机器可判定的验收项） ----------
async function renderCheck(page, html, settleMs) {
  const r = await page.render(html, { settleMs });
  const runtimeErrors = [...r.runtime, ...r.console];
  // 滚动遍历：让 IntersectionObserver / scroll-driven 动效真正触发（否则截图只有折叠线以上）
  await page
    .eval(
      `(async () => {
        const h = document.body.scrollHeight;
        for (let y = 0; y <= h; y += innerHeight / 2) { scrollTo(0, y); await new Promise(r => requestAnimationFrame(r)); }
        scrollTo(0, h); await new Promise(r => setTimeout(r, 900));
        return true;
      })()`
    )
    .catch(() => {});
  // 交互激活：点开「点开才见」的浮层（命令面板/抽屉/弹层），否则静态截图拍不到核心部件
  const act = await page.activate().catch(() => null);
  const probes = await page
    .eval(
      `(() => ({
        children: document.body ? document.body.children.length : 0,
        textLen: document.body ? document.body.innerText.trim().length : 0,
        interactive: document.querySelectorAll("button,a,input,[role=dialog],[contenteditable]").length,
        animating: document.getAnimations ? document.getAnimations().length : 0,
      }))()`
    )
    .catch(() => null);
  return {
    ok: !runtimeErrors.length && !!probes && probes.children > 0 && probes.textLen > 0,
    runtimeErrors: runtimeErrors.slice(0, 8),
    failedRequests: r.failed.slice(0, 5),
    activated: act?.opened ? act.via : null,
    probes,
  };
}

// ---------- 视觉判读（第五关：机器过 ≠ 入库，让视觉模型回答审校四问③） ----------
/** 从模型回复中抽 JSON（剥 ```json 围栏，取首个平衡的 {...}）。 */
function extractJson(text) {
  const fence = /```(?:json)?\s*\n?([\s\S]*?)```/i.exec(text);
  const cand = (fence ? fence[1] : text) ?? "";
  const start = cand.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < cand.length; i++) {
    const c = cand[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      if (--depth === 0) {
        try { return JSON.parse(cand.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

const b64png = async (p) => "data:image/png;base64," + (await fs.readFile(p)).toString("base64");

/**
 * 视觉判读一张生成截图 vs 基准 demo 截图。
 * 关键诚实点：静态截图判不了动效过程与 hover/click 反馈 —— 明确要求模型把这些
 * 列入 notJudgeable 而非臆断，判读结论只覆盖「静态视觉可判定」的部分。
 */
async function judgeOne(t, report, { model, key }) {
  const dir = path.join(OUT, t.slug);
  const baseShot = path.join(dir, "baseline.png");
  const genRun = report.runs.find((r) => /^生成 #\d+$/.test(r.label) && !r.fail && r.render?.ok);
  const genShot = path.join(dir, `${/^生成 #(\d+)$/.exec(genRun?.label ?? "")?.[1] ?? "1"}.png`);
  const genShotFinal = (await fs.stat(genShot).catch(() => null)) ? genShot : path.join(dir, "gen-1.png");
  if (!(await fs.stat(baseShot).catch(() => null)) || !(await fs.stat(genShotFinal).catch(() => null))) {
    return { skipped: "缺 baseline.png 或 gen-1.png，无法判读" };
  }
  const p = t.promptTemplate;
  const verify = (p.verify ?? []).map((x, i) => `${i + 1}. ${x}`).join("\n");
  const instruction =
    `你是前端设计词条的审校，正在做「prompt 回放测试」的视觉判读。给你两张截图：\n` +
    `【图一 · 基准 demo】人工编写的参考实现，它定义了这条词条应有的样子。\n` +
    `【图二 · 模型生成】完全依据下方 prompt 生成的实现。\n\n` +
    `词条：${t.nameZh}（${t.nameEn}）\n` +
    `定义：${t.definition}\n` +
    (t.anatomy?.length ? `解剖部件：${t.anatomy.map((a) => a.part).join("、")}\n` : "") +
    `\n验收清单（生成结果应满足）：\n${verify}\n\n` +
    `请判断【图二】是否忠实还原了词条定义与验收清单。规则：\n` +
    `1. 只依据静态截图**看得见**的东西判断；动效过程、悬停/点击/拖拽反馈、时序等静态图看不出的，` +
    `一律放进 notJudgeable，不要臆断成缺失或满足；\n` +
    `2. 布局/配色/组件形态/文案承载 与基准「同类且正确」即可，不要求像素一致（模型自由发挥是正常的）；\n` +
    `3. 若图二明显没实现定义的核心效果（如该有面板却只有背景、该有骨架却空白），faithful=false。\n\n` +
    `只输出一个 JSON，不要多余文字：\n` +
    `{"faithful": true/false, "confidence": "high|medium|low", ` +
    `"matched": ["图二确实满足的验收项"], "missing": ["静态可见但没做对的项"], ` +
    `"notJudgeable": ["静态截图无法判定的项"], "verdict": "一句话结论"}`;

  const content = [
    { type: "text", text: instruction },
    { type: "text", text: "【图一 · 基准 demo】" },
    { type: "image_url", image_url: { url: await b64png(baseShot) } },
    { type: "text", text: "【图二 · 模型生成】" },
    { type: "image_url", image_url: { url: await b64png(genShotFinal) } },
  ];
  const g = await generateOnce(content, { model, key, temperature: 0, maxTokens: 2500 });
  const j = extractJson(g.content);
  if (!j || typeof j.faithful !== "boolean") {
    return { error: "判读回复非结构化 JSON", raw: g.content.slice(0, 400), ms: g.ms };
  }
  return {
    faithful: j.faithful,
    confidence: j.confidence ?? "?",
    matched: Array.isArray(j.matched) ? j.matched : [],
    missing: Array.isArray(j.missing) ? j.missing : [],
    notJudgeable: Array.isArray(j.notJudgeable) ? j.notJudgeable : [],
    verdict: j.verdict ?? "",
    ms: g.ms,
  };
}

// ---------- 报告与回填 ----------
function stamp() {
  return new Date().toISOString().slice(0, 10);
}

async function writeReport(slug, report) {
  await fs.mkdir(path.join(OUT, slug), { recursive: true });
  await fs.writeFile(path.join(OUT, slug, "report.json"), JSON.stringify(report, null, 2));
}

/** 只改 verifiedWith 一行，保留 entry.json 其余字节（不重排紧凑数组/对象）。 */
async function writeVerifiedWith(t, value) {
  const file = path.join(ROOT, "terms", t.category, t.slug, "entry.json");
  const raw = await fs.readFile(file, "utf8");
  let next;
  if (/^\s*"verifiedWith"\s*:/m.test(raw)) {
    next = raw.replace(/^(\s*)"verifiedWith"\s*:\s*"(?:[^"\\]|\\.)*"/m, (_m, g1) => `${g1}"verifiedWith": ${JSON.stringify(value)}`);
  } else {
    // 在最后一个闭合 } 前插入（保持顶层对象结构）
    const i = raw.lastIndexOf("}");
    const before = raw.slice(0, i);
    const trimmed = before.replace(/\s+$/, "");
    const needsComma = !/[{,]$/.test(trimmed);
    next = trimmed + (needsComma ? "," : "") + `\n  "verifiedWith": ${JSON.stringify(value)}\n}` + raw.slice(i + 1);
  }
  JSON.parse(next); // 保险：改完仍是合法 JSON
  await fs.writeFile(file, next);
  return value;
}

/** 由 report（含可选 judge 块）拼 verifiedWith 文本。 */
function acceptValue(report) {
  const pass = report.runs.filter((r) => r.render?.ok && r.gate?.length === 0).length;
  let v = `${report.model} · replay ${stamp()} · ${pass}/${report.runs.length} 生成通过`;
  const j = report.judge;
  if (j && typeof j.faithful === "boolean") {
    v += j.faithful ? ` · 视觉判读 ${j.confidence}` : " · 视觉判读未过";
  }
  return v;
}

// ---------- 主流程 ----------
async function runOne(t, { model, key, dryRun, runs, accept, chrome }) {
  const prompt = assemblePrompt(t); // 与详情页复制按钮逐字节同源
  const report = {
    slug: t.slug, no: t.no, nameZh: t.nameZh, model, promptChars: prompt.length,
    date: new Date().toISOString(), dryRun, runs: [],
  };
  console.log(`\n▶ ${t.no} ${t.nameZh}（${t.slug}）· ${dryRun ? "dry-run：渲染基准 demo" : `live：${model} × ${runs} 次`}`);

  const sources = [];
  if (dryRun) {
    sources.push({ label: "基准 demo（demoCode）", html: t.demoCode });
  } else {
    for (let i = 0; i < runs; i++) {
      process.stdout.write(`  … 生成 ${i + 1}/${runs}`);
      try {
        const g = await generateOnce(prompt, { model, key });
        process.stdout.write(` ${g.ms}ms finish=${g.finish}${g.html ? "" : "（未找到 HTML 文档！）"}\n`);
        sources.push({ label: `生成 #${i + 1}`, html: g.html, genMs: g.ms, usage: g.usage, finish: g.finish, reasoningChars: g.reasoningChars, rawLen: g.content.length });
        await fs.mkdir(path.join(OUT, t.slug), { recursive: true });
        await fs.writeFile(
          path.join(OUT, t.slug, `gen-${i + 1}.html`),
          g.html ?? g.content,
        );
      } catch (e) {
        process.stdout.write(` 失败: ${e.message}\n`);
        sources.push({ label: `生成 #${i + 1}`, error: e.message });
      }
    }
  }

  for (const s of sources) {
    const run = { label: s.label };
    if (s.error) {
      run.fail = `生成失败: ${s.error}`;
      report.runs.push(run);
      continue;
    }
    if (!s.html) {
      run.fail = "回复中不含完整 HTML 文档（模型没产出可运行代码）";
      report.runs.push(run);
      continue;
    }
    // ② 单文件铁律复检（生成代码同样要过出厂闸；缺 DOCTYPE 降级为警告）
    const gate = gateHtml(s.html, { requireDoctype: !dryRun });
    run.gate = gate.errors;
    if (gate.warnings.length) run.gateWarnings = gate.warnings;
    // ③ 真浏览器渲染
    const page = await chrome.newPage();
    try {
      run.render = await renderCheck(page, s.html, Number(opt("settle", 2500)));
      const shot = await page.screenshot();
      await fs.mkdir(path.join(OUT, t.slug), { recursive: true });
      const genNo = /^生成 #(\d+)$/.exec(s.label);
      const shotName = genNo ? `gen-${genNo[1]}` : "baseline";
      const shotFile = path.join(OUT, t.slug, `${shotName}.png`);
      await fs.writeFile(shotFile, shot);
      run.screenshot = path.relative(ROOT, shotFile);
    } catch (e) {
      run.render = { ok: false, runtimeErrors: [`渲染器异常: ${e.message}`] };
    } finally {
      await page.close();
    }
    const verdict = !run.gate.length && run.render.ok;
    console.log(`  ${verdict ? "✓" : "✗"} ${s.label}: 铁律 ${run.gate.length ? run.gate.join("; ") : "过"} · 渲染 ${run.render.ok ? "过" : "挂: " + (run.render.runtimeErrors ?? []).slice(0, 2).join(" | ")}`);
    report.runs.push(run);
  }

  report.pass = report.runs.filter((r) => !r.fail && r.render?.ok && !r.gate?.length).length;
  report.total = report.runs.length;
  await writeReport(t.slug, report);

  if (accept && !dryRun && report.pass === report.total) {
    const v = await writeVerifiedWith(t, acceptValue(report));
    console.log(`  ✓ verifiedWith 已回填：${v}`);
  } else if (accept && !dryRun) {
    console.log(`  ⚠ 未全部通过，拒绝回填 verifiedWith（${report.pass}/${report.total}）`);
  }
  return report;
}

async function main() {
  const terms = await loadTerms();
  const byKey = (k) => terms.find((t) => t.slug === k || t.no.toLowerCase() === k.toLowerCase() || t.id === k);

  if (flags.has("--status")) {
    const done = terms.filter((t) => t.verifiedWith);
    console.log(`回放验证状态：${done.length}/${terms.length} 条已回填 verifiedWith`);
    for (const t of terms) {
      console.log(`  ${t.verifiedWith ? "✓" : "·"} ${t.no} ${t.nameZh.padEnd(6)} ${t.verifiedWith ?? "未验证"}`);
    }
    return;
  }

  // ---------- 视觉判读模式：读已有证据截图，只调视觉模型，不重新生成 ----------
  if (flags.has("--judge")) {
    const judgeModel = opt("judge-model", opt("model", process.env.REPLAY_MODEL ?? "Qwen3.8-Flash"));
    const key = await resolveKey();
    if (!key) { console.error("✗ 找不到 key（REPLAY_API_KEY 或 apikey.txt）"); process.exit(2); }
    let targets;
    if (flags.has("--all")) targets = terms;
    else if (positional.length) targets = positional.map(byKey).filter(Boolean);
    else { console.error("用法: --judge <slug|no> | --judge --all [--accept] [--recapture] [--judge-model M]"); process.exit(2); }

    // --recapture：从已存的 gen-1.html + demoCode 重渲染 baseline.png/gen-1.png（带交互激活），
    // 不重新调模型生成 —— 让「点开才见」的词条（命令面板/抽屉/弹层）拍到展开态，判读才有公平证据。
    const recapture = flags.has("--recapture");
    console.log(`视觉判读 · ${targets.length} 条 · 判读模型 ${judgeModel}${recapture ? " · 先重捕获证据（含交互激活）" : "（读已有截图）"}`);
    const chrome = recapture ? await launchChrome() : null;
    const rows = [];
    try {
      for (const t of targets) {
        let report;
        try { report = JSON.parse(await fs.readFile(path.join(OUT, t.slug, "report.json"), "utf8")); }
        catch { console.log(`  · ${t.no} ${t.nameZh}：无 report.json，先跑 replay`); continue; }

        if (recapture) {
          const genRun = report.runs.find((r) => /^生成 #\d+$/.test(r.label) && !r.fail && r.render?.ok);
          const genNo = /^生成 #(\d+)$/.exec(genRun?.label ?? "")?.[1] ?? "1";
          const genHtml = path.join(OUT, t.slug, `gen-${genNo}.html`);
          const shots = [["baseline", t.demoCode], [`gen-${genNo}`, genHtml]];
          for (const [name, src] of shots) {
            let html = src;
            if (name !== "baseline") { try { html = await fs.readFile(src, "utf8"); } catch { html = null; } }
            if (!html) continue;
            const page = await chrome.newPage();
            try {
              const rc = await renderCheck(page, html, Number(opt("settle", 2500)));
              await fs.writeFile(path.join(OUT, t.slug, `${name}.png`), await page.screenshot());
              if (name !== "baseline" && genRun) genRun.render = rc; // 更新报告里的渲染结论
            } catch { /* 保留旧截图 */ } finally { await page.close(); }
          }
          await writeReport(t.slug, report);
        }

        process.stdout.write(`  ▶ ${t.no} ${t.nameZh}`);
        let j;
        // 幂等：已有结构化判读结论则复用（--re-judge 强制重判；--recapture 改了证据则必重判）
        if (report.judge && typeof report.judge.faithful === "boolean" && !flags.has("--re-judge") && !recapture) {
          j = report.judge;
          console.log(` — ${j.faithful ? "✓ 还原" : "✗ 未还原"} [${j.confidence}]（复用已有判读）`);
          rows.push({ t, j, report });
          continue;
        }
        try { j = await judgeOne(t, report, { model: judgeModel, key }); }
        catch (e) { j = { error: e.message }; }
        report.judge = j;
        report.judgeModel = judgeModel;
        await writeReport(t.slug, report);
        if (j.skipped) console.log(` — 跳过（${j.skipped}）`);
        else if (j.error) console.log(` — 判读失败：${j.error}`);
        else console.log(` — ${j.faithful ? "✓ 还原" : "✗ 未还原"} [${j.confidence}] ${j.verdict}`);
        rows.push({ t, j, report });
      }
    } finally {
      if (chrome) await chrome.close();
    }
    // 汇总 + 可选回填（--accept 只回填「生成过 + 判读 faithful=true」的）
    const judged = rows.filter((r) => typeof r.j.faithful === "boolean");
    const faithful = judged.filter((r) => r.j.faithful);
    console.log(`\n══ 判读汇总：${faithful.length}/${judged.length} 条视觉还原通过（共判 ${rows.length} 条）`);
    const notFaithful = judged.filter((r) => !r.j.faithful);
    if (notFaithful.length) {
      console.log("   未还原：");
      for (const r of notFaithful) console.log(`     ✗ ${r.t.no} ${r.t.nameZh} [${r.j.confidence}] ${r.j.verdict}`);
    }
    if (flags.has("--accept")) {
      for (const r of faithful) {
        const v = await writeVerifiedWith(r.t, acceptValue(r.report));
        console.log(`   ✓ ${r.t.no} 回填：${v}`);
      }
    }
    process.exit(notFaithful.length ? 1 : 0);
  }

  let targets;
  if (flags.has("--all")) {
    targets = flags.has("--only-unverified") ? terms.filter((t) => !t.verifiedWith) : terms;
  } else {
    targets = positional.map(byKey).filter(Boolean);
    const missing = positional.filter((k) => !byKey(k));
    if (missing.length) console.error(`未知词条: ${missing.join(", ")}（--status 查看全部）`);
    if (!targets.length) {
      console.log("用法: node scripts/replay-test.mjs <slug|no> [--accept] | --all [--only-unverified] [--dry-run] | --status");
      console.log("词条: " + terms.map((t) => `${t.no}=${t.slug}`).join(" "));
      process.exit(2);
    }
  }

  const dryRun = flags.has("--dry-run");
  const model = opt("model", process.env.REPLAY_MODEL ?? "Qwen3.8-Flash");
  const runs = Number(opt("out", 1));
  const key = dryRun ? null : await resolveKey();
  if (!dryRun && !key && API_BASE.includes("127.0.0.1")) {
    console.error("✗ 找不到 qoder2api 的本地 key（REPLAY_API_KEY 或 apikey.txt），且本地服务未确认。先跑 dsh-qoder2api 服务或显式设 key。");
    process.exit(2);
  }

  console.log(`回放测试 · ${targets.length} 条 · 端点 ${API_BASE} · 模型 ${model}${dryRun ? " · DRY-RUN（只渲染基准 demo，不调模型）" : ""}`);
  const chrome = await launchChrome();
  const results = [];
  try {
    for (const t of targets) results.push(await runOne(t, { model, key, dryRun, runs, accept: flags.has("--accept"), chrome }));
  } finally {
    await chrome.close();
  }
  const bad = results.filter((r) => r.pass !== r.total);
  console.log(`\n══ 汇总：${results.length - bad.length}/${results.length} 条全部通过 · 报告在 replay/`);
  if (bad.length) console.log("   未过: " + bad.map((r) => `${r.no}(${r.pass}/${r.total})`).join(" "));
  process.exit(bad.length ? 1 : 0);
}

main().catch((e) => {
  console.error("回放测试崩溃:", e);
  process.exit(1);
});
