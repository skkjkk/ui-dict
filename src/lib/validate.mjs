// src/lib/validate.mjs
// 词条 schema 权威定义（README v0.2 的 zod 落地）。
// 构建期校验：任何一条词条不合规，build 直接失败并打印可读错误 —— 即“工厂入库闸”。
import { z } from "zod";

const PromptCard = z.object({
  core: z.string().min(20, "core 必须包含行为规格，不能是空泛形容词"),
  stack: z.string().min(10),
  constraints: z.array(z.string()).min(1, "至少一条负向清单"),
  verify: z.array(z.string()).min(1, "至少一条验收标准"),
  reference: z.string().optional(),
  variants: z
    .array(z.object({ label: z.string(), delta: z.string() }))
    .optional(),
});

const Category = z.enum(["component", "motion", "interaction", "layout", "style"]);

const NO_PREFIX = {
  component: "C",
  motion: "M",
  interaction: "I",
  layout: "L",
  style: "S",
};

export const TermSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id 必须是 kebab-case"),
    no: z.string().regex(/^[CMILS]-\d{2}$/),
    category: Category,
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
    promptTemplate: PromptCard,
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

export function validateTerm(obj, where = "") {
  const r = TermSchema.safeParse(obj);
  if (!r.success) {
    const issues = r.error.issues
      .map((i) => `    · ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`词条 schema 校验失败 [${where}]\n${issues}`);
  }
  return r.data;
}
