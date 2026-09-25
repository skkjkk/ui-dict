# DEPLOY.md · 部署决策记录（2026-09-24）

> 用户拍板：**暂不上传 GitHub，继续本地开发完善后再部署。** 本文档锁定届时的决策，防止遗忘。

## 已定决策

1. **research/ 不进公开仓库**（用户拍板）。调研档案含竞品威胁评估与内部策略判断。
   届时二选一：
   - 方案 A（推荐）：公开仓只含产品代码，`research/` 留在本地或移入私有仓；
   - 方案 B：整仓私有，Pages 用私有源（Pro 付费）——不推荐，违背"免登录无墙"红线。
2. **平台：GitHub Pages**（免费、push 即部署、Actions 官方支持），域名先走
   `username.github.io/ui-dict`，稳定后接独立域名 + Internet Archive 主动存档
   （调研红线：Design Systems Interactive 域名一断全损的前车之鉴）。
3. **凭据现状**：机器无 gh CLI；git 有 GitHub HTTPS 凭据（manager）。建仓需手动
   github.com/new 或 `winget install GitHub.cli` + `gh auth login`。

## 部署前检查清单（届时执行）

- [ ] `research/` 移出公开范围（git filter 或新仓）
- [ ] astro.config `site` 换成真实域名
- [ ] 全词条 `verifiedWith` 回填（prompt 回放测试工具化后）
- [ ] `pnpm build` 产物自检：11+ 页、/demos/*.html 全可直链、/ui-dict.md 可下载
- [ ] GitHub Actions：on push → pnpm gen && build → deploy-pages
- [ ] 提交 https://web.archive.org/save 主动存档
- [ ] README 的 GitHub 链接占位符替换（Base.astro 页脚现为 github.com 占位）

## 本地开发中新增的部署友好特性（2026-09-24）

- `public/demos/<slug>.html`：每条 demo 成为**可直链、可分享、爬虫/AI 可直读**的静态文件
  （构建期由 sync 脚本从 terms/ 复制，逐字节同源）；
- `public/ui-dict.md`：全站词条导出（名字/别名/定义/辨析/prompt，不含代码体），
  即 index.how `npx skills add` 同款"喂 AI"资产，纯静态零依赖。
