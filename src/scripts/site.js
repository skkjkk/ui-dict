// src/scripts/site.js —— 全站外壳岛：页脚“减少动效”开关的绑定与状态渲染。
import { prefersReduced, toggleReducedMotion } from "./frame.js";

const btn = document.getElementById("motion-toggle");
if (btn) {
  const render = () => { btn.textContent = `减少动效：${prefersReduced() ? "开" : "关"}`; };
  btn.addEventListener("click", () => { toggleReducedMotion(); render(); });
  render();
}
