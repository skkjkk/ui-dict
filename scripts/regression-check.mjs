// 批量回归：对每条词条详情页做结构断言（十段版式关键锚点 + 滑杆 + 三按钮 + demo 直链）
import { TERMS, DEMOS } from "../src/generated/site-data.js";

const BASE = "http://localhost:4332";
const results = [];

for (const t of TERMS) {
  const url = `${BASE}/term/${t.slug}/`;
  try {
    const res = await fetch(url);
    const html = await res.text();
    const checks = {
      "200": res.status === 200,
      "标题": html.includes(`<h1`) && html.includes(t.nameZh),
      "编号": html.includes(t.no),
      "别名chips": (t.aliases ?? []).slice(0, 2).every((a) => html.includes(a.slice(0, 6))),
      "复制Prompt钮": html.includes("复制 Prompt"),
      "独立页Demo钮": html.includes("独立页打开 Demo"),
      "滑杆区": (t.params?.length ?? 0) === 0 || html.includes("data-param"),
      "prompt预览": html.includes("【行为规格】"),
      "demo直链200": (await fetch(`${BASE}/demos/${t.slug}.html`)).ok,
    };
    const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    results.push(`${failed.length === 0 ? "✓" : "✗"} ${t.no} ${t.nameZh.padEnd(6)} ${failed.length ? "缺:" + failed.join(",") : "全过"}`);
  } catch (e) {
    results.push(`✗ ${t.no} ${t.nameZh} FETCH FAIL ${e.message}`);
  }
}
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${TERMS.length - bad}/${TERMS.length} 词条详情页回归通过`);
process.exit(bad ? 1 : 0);
