// src/lib/validate.mjs —— 入库闸的执行壳（薄）。
// Schema 权威定义在 types.mjs；这里只做「跑校验 + 把失败翻译成可读错误」。
// 新代码请 import types.mjs 的常量（NO_PREFIX / CATEGORY_KEYS…），不要从这里拿。
import { TermSchema } from "./types.mjs";

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
