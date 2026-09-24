// src/lib/prompt.mjs —— 纯函数：PromptCard → 单段可复制 prompt。
// 同时被构建期脚本（scripts/gen-client-data.mjs）与浏览器岛（src/scripts/app.js）import，
// 保证「页面上展示的 prompt」「复制出的 prompt」在参数变化时永远同源。

export function assemblePrompt(t, overrides = {}) {
  const p = t.promptTemplate;
  if (!p) return "";
  const defaults = {};
  for (const par of t.params ?? []) defaults[par.key] = par.def;
  const v = (s) => String(s).replace(/\{(\w+)\}/g, (m, k) => String(overrides[k] ?? defaults[k] ?? m));

  const lines = [];
  lines.push(`实现一个「${t.nameZh}（${t.nameEn}）」，要求：`);
  lines.push("");
  lines.push("【行为规格】");
  lines.push(v(p.core).trim());
  lines.push("");
  lines.push("【技术约束】");
  lines.push(v(p.stack).trim());
  lines.push("单个自包含 HTML 文件；零第三方依赖、零网络请求、无构建步骤，粘贴即可运行。");
  if (p.constraints?.length) {
    lines.push("");
    lines.push("【避免】");
    for (const c of p.constraints) lines.push(`- ${v(c)}`);
  }
  if (p.reference) {
    lines.push("");
    lines.push(`【参考气质】${v(p.reference)}`);
  }
  if (p.verify?.length) {
    lines.push("");
    lines.push("【验收】生成后我应该看到：");
    for (const x of p.verify) lines.push(`- ${v(x)}`);
  }
  return lines.join("\n");
}

/** 整张词条卡 → Markdown（“复制词条卡”按钮；也是喂 AI 的一手料）。 */
export function termMarkdown(t) {
  const L = [];
  L.push(`# ${t.no} · ${t.nameZh} ${t.nameEn}`);
  if (t.aliases?.length) L.push(`\n别名：${t.aliases.join(" / ")}`);
  L.push(`\n## 定义\n${t.definition}`);
  if (t.anatomy?.length) L.push(`\n## 解剖\n${t.anatomy.map((a) => `- **${a.part}**${a.note ? ` — ${a.note}` : ""}`).join("\n")}`);
  if (t.whenNotToUse?.length) L.push(`\n## 何时不要用\n${t.whenNotToUse.map((s) => `- ${s}`).join("\n")}`);
  L.push(`\n## Prompt\n\`\`\`text\n${assemblePrompt(t)}\n\`\`\``);
  L.push(`\n## 实现（零依赖单文件）\n\`\`\`html\n${t.demoCode}\n\`\`\``);
  if (t.pitfalls?.length) L.push(`\n## 坑\n${t.pitfalls.map((s) => `- ${s}`).join("\n")}`);
  if (t.scenarios?.length) L.push(`\n## 适用场景\n${t.scenarios.map((s) => `- ${s}`).join("\n")}`);
  if (t.refs?.length) L.push(`\n## 规范出处\n${t.refs.map((s) => `- ${s}`).join("\n")}`);
  if (t.verifiedWith) L.push(`\n> prompt 验证：${t.verifiedWith} · 代码 MIT`);
  return L.join("\n");
}
