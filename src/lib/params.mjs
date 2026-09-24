// src/lib/params.mjs
// 词条 demo 的“参数块”约定 —— demo.html 必须包含且仅包含一对标记，
// 中间是一行合法 JS 对象字面量（JSON 值），因此粘贴/下载后 demo 仍自运行。
//
//   /* ui-dict:params:start */
//   const PARAMS = { "RADIUS": 120, "STIFF": 0.09 };
//   /* ui-dict:params:end */
//
// 运行期/构建期用 setParams 改写对象内的值，取代 POC 的裸数字正则（脆弱）。

const LINE_RE =
  /(\/\*\s*ui-dict:params:start\s*\*\/\s*\n?\s*)(const PARAMS\s*=\s*)(\{[\s\S]*?\})(\s*;?[\s\S]*?\/\*\s*ui-dict:params:end\s*\*\/)/;

/** 从 demoCode 读取当前参数对象；找不到标记返回 null。 */
export function getParams(raw) {
  const m = raw.match(LINE_RE);
  if (!m) return null;
  try {
    return JSON.parse(m[3]);
  } catch {
    return null;
  }
}

/** 是否含合法参数块（供工厂校验用）。 */
export function hasParamsBlock(raw) {
  const m = raw.match(LINE_RE);
  if (!m) return false;
  try {
    JSON.parse(m[3]);
    return true;
  } catch {
    return false;
  }
}

/**
 * 用给定值改写参数块，返回新的 demoCode。
 * 只改动已存在于块内的键；值统一 JSON 序列化，保证仍是合法 JS。
 * 幂等：无 changes 或未命中任何键时原样返回。
 */
export function setParams(raw, changes) {
  if (!changes || typeof changes !== "object") return raw;
  const m = raw.match(LINE_RE);
  if (!m) return raw;
  let obj;
  try {
    obj = JSON.parse(m[3]);
  } catch {
    return raw;
  }
  let touched = false;
  for (const [k, v] of Object.entries(changes)) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      obj[k] = coerce(v);
      touched = true;
    }
  }
  if (!touched) return raw;
  const serialized = JSON.stringify(obj);
  return raw.slice(0, m.index) + m[1] + m[2] + serialized + m[4] + raw.slice(m.index + m[0].length);
}

function coerce(v) {
  const n = Number(v);
  return typeof v === "number" || (v !== "" && !Number.isNaN(n) && typeof v !== "boolean") ? n : v;
}
