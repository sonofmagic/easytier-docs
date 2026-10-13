# 从零理解 EasyTier · Nimbus

中文根路由课程，包含 5 节预备课、20 章正文、术语表、三个 Vue 教学实验和真实 GUI 附录。使用 Node.js 24、pnpm 12.10.1。

从仓库根目录安装依赖并运行：

```sh
pnpm install --frozen-lockfile
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
pnpm exec repo doctor
pnpm exec repo check --full
```

本地入口为 http://127.0.0.1:4173/ ，静态产物为 `apps/docs/dist`。

`src/data/course.ts` 维护32页清单与阅读顺序；六个组件页面为 MDX。Nimbus 负责文档运行时、Markdown/MDX/llms 入口与 Pagefind 索引；中文补充搜索仅索引实际公开正文。

完整启动、实验、部署与验收说明见仓库根 README 和 VERIFICATION。模板来源保留在 UPSTREAM.md 与 nimbus.json，旧站模板历史保留在 repoctl 登记中。
