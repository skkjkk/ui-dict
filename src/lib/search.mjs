// src/lib/search.mjs —— 描述反查搜索（纯逻辑，无 DOM，Node/浏览器双端可跑）。
// 分层规则：home.js 只负责把命中结果画到 DOM；切词/索引/排序/兜底全住这里，
// 未来加同义词表、拼音反查、搜索单测，都改这个文件。
import MiniSearch from "minisearch";

// MiniSearch 统一索引。分词：拉丁按词；CJK 产出「单字 + 二字组」。
// 查询侧 CJK 只用二字组（滤掉单字噪音），命中 gram 越多分越高：
//   "鼠标吸过去" → 鼠标/吸过/过去 三组，命中别名"鼠标靠近就被吸过去"全部 → 高分。
const isCJK = (ch) => ch >= "\u4e00" && ch <= "\u9fff";

export function tokenizeDoc(text) {
  const toks = [];
  let latin = "", cjk = "";
  const flushLatin = () => { if (latin) { toks.push(latin); latin = ""; } };
  const flushCjk = () => {
    if (!cjk) return;
    for (let i = 0; i < cjk.length; i++) {
      toks.push(cjk[i]);
      if (i + 1 < cjk.length) toks.push(cjk.slice(i, i + 2));
    }
    cjk = "";
  };
  for (const ch of String(text).toLowerCase()) {
    if (isCJK(ch)) { flushLatin(); cjk += ch; }
    else if (/[a-z0-9-]/.test(ch)) { flushCjk(); latin += ch; }
    else { flushLatin(); flushCjk(); }
  }
  flushLatin(); flushCjk();
  return toks;
}

export function queryTokens(text) {
  const all = tokenizeDoc(text);
  // 查询里的 CJK 只保留二字组（单字太噪）；若无二字组（单字查询）则保留单字兜底
  const bigrams = all.filter((t) => t.length === 2 && isCJK(t[0]));
  const latin = all.filter((t) => !isCJK(t[0]));
  const singleCJK = all.filter((t) => t.length === 1 && isCJK(t[0]));
  return [...latin, ...(bigrams.length ? bigrams : singleCJK)];
}

/** 搜索字段与文档组装的唯一事实源（新增可索引字段只改这里）。 */
const FIELDS = ["nameZh", "nameEn", "aliases", "definition", "scenarios"];

function toDoc(t) {
  return {
    id: t.slug,
    nameZh: t.nameZh,
    nameEn: t.nameEn,
    aliases: (t.aliases ?? []).join(" "),
    definition: t.definition ?? "",
    scenarios: (t.scenarios ?? []).join(" "),
  };
}

/** 建索引：传入词条数组（meta 层即可，不需要 demoCode），返回 { ms, search }。 */
export function createSearchIndex(terms) {
  const ms = new MiniSearch({ fields: FIELDS, storeFields: ["id"], tokenize: tokenizeDoc });
  ms.addAll(terms.map(toDoc));

  /**
   * 描述反查：逐 token OR 检索，按累计命中分排序；零命中时整句子串兜底
   * （MiniSearch 切词漏网的口语长句用原串直接包含匹配）。
   * @returns {string[]} 按 relevance 排序的 slug 列表
   */
  const search = (query) => {
    const q = String(query).trim();
    if (!q) return [];
    const scores = new Map();
    for (const tk of queryTokens(q)) {
      let hits = [];
      try { hits = ms.search(tk, { combineWith: "OR", prefix: true }); } catch { hits = []; }
      for (const h of hits) scores.set(h.id, (scores.get(h.id) ?? 0) + h.score);
    }
    if (!scores.size) {
      const n = q.toLowerCase().replace(/\s+/g, "");
      for (const t of terms) {
        const hay = (t.nameZh + t.nameEn + (t.aliases ?? []).join("") + t.definition + (t.scenarios ?? []).join(" "))
          .toLowerCase().replace(/\s+/g, "");
        if (hay.includes(n)) scores.set(t.slug, 1);
      }
    }
    return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  };

  return { ms, search };
}
