// src/lib/types.mjs —— 词条 Schema 权威定义（zod）。
// 分层规则：schema 定义只住这一层；validate.mjs 是薄执行壳（加载 + 抛错格式化），
// 其他模块一律 import 这里的常量/类型，禁止反向依赖执行壳。
// 被谁用：qa-demofiles / validate.mjs / gen-client-data（经 terms.mjs）——单一事实源。
import { z } from "zod";

export const PROMPT_CARD = z.object({
  core: z.string().min(20, "core 必须包含行为规格，不能是空泛形容词"),
  stack: z.string().min(10),
  constraints: z.array(z.string()).min(1, "至少一条负向清单"),
  verify: z.array(z.string()).min(1, "至少一条验收标准"),
  reference: z.string().optional(),
  variants: z
    .array(z.object({ label: z.string(), delta: z.string() }))
    .optional(),
});

export const CATEGORY_KEYS = ["component", "motion", "interaction", "layout", "style"];

export const CATEGORY = z.enum(CATEGORY_KEYS);

// 编号前缀 ↔ 分类：schema 级约束，QA / 校验 / 生成模板共用一份
export const NO_PREFIX = {
  component: "C",
  motion: "M",
  interaction: "I",
  layout: "L",
  style: "S",
};

// 词典编号的词典学含义（侧栏罗马数字 / 文档 / 新增向导共用）
export const ROMAN = { component: "Ⅰ", motion: "Ⅱ", interaction: "Ⅲ", layout: "Ⅳ", style: "Ⅴ" };

// —— v0.3 调研线 05 新增：实现谱系三字段（均 optional，旧词条零改动）——
// nativePath：「HTML 能不能原生做」的可筛选徽章（05a 建议），四档：
export const NATIVE_PATHS = {
  "css-only": { badge: "🟢", label: "纯 HTML/CSS · 0 行交互 JS" },
  "lite-js": { badge: "🔵", label: "少量原生 JS（≤30 行）" },
  "styled-js": { badge: "🟠", label: "定位/状态 JS 必要（≤150 行）" },
  "no-native": { badge: "⚪", label: "无原生对应 · 全靠手写" },
};
// implSchool：六实现流派枚举（05c 定名），一个组件常并存多派，值域 = 流派键
export const IMPL_SCHOOLS = {
  "css-state": { short: "① 状态机 CSS", full: "radio/checkbox + :checked + ~/:has()" },
  "semantic-native": { short: "② 语义原生", full: "<details name> / <dialog> + commandfor" },
  "platform-overlay": { short: "③ 新平台弹层", full: "popover + anchor() + position-try" },
  "passive-observer": { short: "④ 被动监听", full: "IntersectionObserver / animation-timeline" },
  "active-compute": { short: "⑤ 主动计算", full: "pointer / scroll / 拖拽物理" },
  "capability-api": { short: "⑥ 能力型 API", full: "contenteditable / FileReader / clipboard / datalist" },
};

export const TermSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id 必须是 kebab-case"),
    no: z.string().regex(/^[CMILS]-\d{2}$/),
    category: CATEGORY,
    nameZh: z.string().min(1),
    nameEn: z.string().min(1),
    aliases: z
      .array(z.string())
      .min(1, "aliases 至少 1 条")
      .refine((a) => a.length >= 3, { message: "建议 ≥3 条口语描述以支撑反查" })
      .optional(),
    definition: z.string().min(20),
    whenNotToUse: z.array(z.string()).optional(),
    confusedWith: z.array(z.string()).optional(),
    anatomy: z
      .array(z.object({ part: z.string(), note: z.string().optional() }))
      .optional(),
    promptTemplate: PROMPT_CARD,
    params: z
      .array(
        z.object({
          key: z.string(),
          label: z.string(),
          def: z.union([z.number(), z.string()]),
          min: z.number(),
          max: z.number(),
          step: z.number(),
          hint: z.string().optional(),
        }),
      )
      .optional(),
    // —— v0.3 新字段（optional，调研线 05 §八.1/2 落地）——
    // nativePath：原生实现路径徽章（详情页 🟢🔵🟠⚪ + 首页 data 属性可筛选）
    nativePath: z.enum(Object.keys(NATIVE_PATHS)).optional(),
    // implSchool：该组件并存的实现流派（谱系展示，多个）
    implSchool: z.array(z.enum(Object.keys(IMPL_SCHOOLS))).optional(),
    // jsLines：交互逻辑 JS 行数上限承诺（0 = 承诺纯 CSS 成立；参数样板 ≤15 行不计入）
    jsLines: z.number().int().min(0).max(500).optional(),
    scenarios: z.array(z.string()).min(1).optional(),
    pitfalls: z.array(z.string()).min(1).optional(),
    related: z.array(z.string()).optional(),
    refs: z.array(z.string().url()).optional(),
    verifiedWith: z.string().optional(),
    contributors: z
      .array(
        z.object({
          generator: z.string(),
          reviewer: z.string(),
          date: z.string(),
        }),
      )
      .min(1, "至少署名一位贡献者/审校人"),
    // demoCode 由 demo.html 注入，不在此校验内容（由 QA 脚本负责单文件铁律）
  })
  .superRefine((t, ctx) => {
    const p = NO_PREFIX[t.category];
    if (!t.no.startsWith(p + "-")) {
      ctx.addIssue({
        code: "custom",
        path: ["no"],
        message: `no 前缀应与 category 一致：${t.category} → ${p}-xx`,
      });
    }
  });

export { z };
