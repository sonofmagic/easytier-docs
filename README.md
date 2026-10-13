# 从零理解 EasyTier

20 章完整中文教程、术语表、带答案练习、三个浏览器交互实验，以及本机 EasyTier GUI 实测附录。面向网络基础还没有串起来的读者；这是独立学习资料，非 EasyTier 官方网站。

- 网站：[easytier.icebreaker.top](https://easytier.icebreaker.top/)
- 源码：[sonofmagic/easytier-docs](https://github.com/sonofmagic/easytier-docs)
- [从第一章开始](https://easytier.icebreaker.top/chapters/01-why)
- [本机 GUI 实测](https://easytier.icebreaker.top/cases/local-gui)

## 本地阅读

推荐 Node.js 24；工作区最低要求 Node.js 22.13，固定使用 pnpm 12.10.1。先安装对应版本的 Node.js 和 pnpm，然后执行：

```sh
git clone https://github.com/sonofmagic/easytier-docs.git
cd easytier-docs
pnpm install --frozen-lockfile
pnpm docs:dev
```

打开 <http://127.0.0.1:4173/>，点击“从第一章开始”。退出服务用 Ctrl+C。依赖安装会运行工作区的初次构建。

## 构建与检查

```sh
pnpm docs:build
pnpm docs:preview
```

构建产物在 `apps/website/.vitepress/dist`。生产预览使用项目内的静态服务器，明确绑定本机 `127.0.0.1:4173`；先停止占用该端口的本项目开发服务。当前 VitePress alpha 的内置 preview 未按 host 参数限制监听地址，因此项目使用该服务器保证只在本机阅读。如果端口被其他应用占用，开发时使用 `pnpm --dir apps/website dev --port 4174`，生产预览使用 `pnpm --dir apps/website preview --port 4174`，保留其他应用。

完整验收：

```sh
pnpm exec repo doctor
pnpm exec repo check --full
```

`repo check --full` 覆盖文档结构、内部路径、lint、类型、模型测试及站点构建。浏览器验收补充渲染后的锚点、手机导航、搜索、图表和交互。`verification/browser-qa.js` 与 `verification/links-navigation-qa.js` 从当前页面获取站点 origin，可用于本地或正式站；使用 Playwright CLI 时，在仓库根目录运行，先打开待测站点，然后通过 `run-code --filename=verification/browser-qa.js` 或 `run-code --filename=verification/links-navigation-qa.js` 执行。截图写入仓库的 `verification/`，测试浏览器使用独立后台会话，结束后关闭。

## 发布与自动部署

Cloudflare Workers Static Assets 托管构建后的 HTML、JavaScript 和图片，没有动态业务后端。根目录 `wrangler.jsonc` 固定 Worker 名称 `easytier-docs`，绑定 `easytier.icebreaker.top`；HTML 使用 `auto-trailing-slash`，未知页面使用 `404-page`，不将所有路径回退到首页。

本机手动发布需要目标 Cloudflare 账号的部署权限：

```sh
pnpm install --frozen-lockfile
pnpm exec repo doctor
pnpm exec repo check --full
pnpm exec wrangler deploy --dry-run
pnpm exec wrangler login
pnpm docs:deploy
```

已登录时可跳过 `wrangler login`。项目固定 Wrangler 4.149.0，部署命令为 `pnpm exec wrangler deploy`；不要把 OAuth 凭据或 API 令牌写进 Git。`.wrangler/`、`.dev.vars*` 和本地环境文件已忽略。修改账号或域名时同步修改 `wrangler.jsonc` 和 VitePress 的 sitemap 正式域名。

Cloudflare Workers Builds 的 Git 集成使用以下设置：

| 设置 | 值 |
| --- | --- |
| Git 仓库 | `sonofmagic/easytier-docs` |
| 生产分支 | `main` |
| 构建根目录 | 仓库根目录 |
| Node.js | `24` |
| pnpm | `12.10.1` |
| 构建命令 | `pnpm exec repo check --full` |
| 部署命令 | `pnpm exec wrangler deploy` |
| 自动部署 | 仅 `main`；关闭非生产分支和 PR 预览部署 |

构建环境设置 `NODE_VERSION=24`、`PNPM_VERSION=12.10.1`，并保留工作区的冻结锁文件。由 Cloudflare Git 集成安装依赖并管理部署令牌；不把本机 OAuth 凭据复制到 GitHub。模板的 npm 发布工作流在新仓库中禁用，文档更新只通过 `main` 发布网站。

检查失败时不会运行部署，线上保留上一次成功版本。查看或回退版本：

```sh
pnpm exec wrangler versions list
pnpm exec wrangler rollback <VERSION_ID>
```

回退前查看 `VERIFICATION.md` 中的发布记录，并确认目标版本。回退后同时修复或撤销造成问题的源码提交，避免下一次自动构建重新发布它。

## 内容与维护

- `apps/website/chapters/`：20 章教程，使用统一 A、B、R 案例及版本。
- `apps/website/cases/local-gui.md`：真实观测附录；公开地址已替换，设备使用别名。
- `apps/website/glossary.md`、`sources.md`：术语和来源。
- `apps/website/labs.md`：三个实验的操作说明。
- `apps/website/.vitepress/data/course.ts`：标题、学习阶段、导航和中文分词。
- `apps/website/.vitepress/data/models.ts`：确定性教学模型；Vue 组件位于主题 `components/`。
- `apps/website/scripts/check-docs.ts`：文档结构和内部路径检查；Vitest 覆盖模型与分词。

各实现相关结论固定依据 EasyTier v2.6.4，release commit 为 `8428a89d2dabc94c97d370ec607c6ca142473626`。当前官网可能更新，正文区分通用原理与该版本实现。真实实验命令是可选说明，网站不会安装 EasyTier 或修改网络配置。附录仅记录授权的有限 ICMP 测试，不代表 HTTP 可用性、具体打洞过程或性能已验证。

## 项目来源

通过 `pnpm dlx create-repoctl@1.2.5 <目标目录> --yes --templates vitepress --lang zh-CN` 创建，repoctl 固定 5.10.3。pnpm 12 的 `create` 参数传递与旧说明存在差异，因此实际使用 `dlx` 执行同一脚手架。保留 repoctl 管理配置与 Mermaid 安全渲染组件，改为中文单语言文档。

三个实验是模型：NAT 映射与过滤分别展示，拓扑延迟使用简单相加且即时选路，包旅程省略真实握手和重传。模型测试不等于真实跨网组网或性能测试。

验证记录与截图见 [VERIFICATION.md](VERIFICATION.md)、`verification/`。
