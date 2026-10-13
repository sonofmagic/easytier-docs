# 从零理解 EasyTier

5 节本机预备课 + 20 章中文教程，共 32 个阅读页面，包含术语表、带答案练习、三个浏览器交互模型和已有 EasyTier GUI 实机附录。面向从零开始的读者：先看见自己电脑里的网页请求，再解释异地网络。独立学习资料，非 EasyTier 官方网站。

- 网站：[easytier.icebreaker.top](https://easytier.icebreaker.top/)
- 源码：[sonofmagic/easytier-docs](https://github.com/sonofmagic/easytier-docs)
- [从本机预备课开始](https://easytier.icebreaker.top/basics/browser-and-programs)
- [预备课索引与实验下载](https://easytier.icebreaker.top/basics)
- [直接进入第一章](https://easytier.icebreaker.top/chapters/01-why)
- [本机 GUI 实测](https://easytier.icebreaker.top/cases/local-gui)

## 零基础阅读与本机实验

阅读正式网站不需要克隆源码或安装 Node.js。首页优先提供“从本机预备课开始”，按浏览器与程序 → 本机网页 → 网址 → 网络地址 → 请求与回应走完 5 节，再进入正文第一章。每节先解释动作和预期现象，正文中先回顾基础、预测再观察；答案与进阶内容可以折叠。

实验 ZIP：[network-basics-demo.zip](https://easytier.icebreaker.top/downloads/network-basics-demo.zip)。解压后专用文件夹内只有 `index.html`、`message.txt`、`README.txt`；源码在 `examples/network-basics-demo/`。网页没有自动探测、遥测或上传本机读数。

亲手实验需要已安装的 Python 3。先修课讲解如何检查版本、打开终端、进入实验目录，以及 macOS、Windows、Linux 的必要区别；缺少 Python 时由读者按官方说明安装。网站和下载文件不会自动安装软件，也不会修改现有 EasyTier、路由或防火墙。

在确认好的实验目录中，macOS/Linux 执行：

```sh
python3 -m http.server 8877 --bind 127.0.0.1
```

Windows 使用已确认的 Python 3 入口，如 `py -3 -m http.server 8877 --bind 127.0.0.1`。打开 <http://127.0.0.1:8877/>，观察网页、Python 请求日志和 Chrome Network 面板，比较 `message.txt` 的 200、`not-here.txt` 的 404，以及停止服务后的连接失败。端口占用时改用 8878，网址同步修改，不结束未知程序。实验只监听回环，不能被其他电脑通过家庭 IP 或 EasyTier 虚拟 IP 访问；这与远端教学服务 TCP 8080 是不同实验。

停止时只在自己启动的 Python 终端按 Ctrl+C，再停用浏览器缓存或使用新查询 URL 验证连接失败。已有 EasyTier GUI 保持运行。完整步骤和边界见预备课，HTTP、监听、路由等术语在相应操作中解释。

## 源码本地阅读

使用 Node.js 24；工作区最低要求 Node.js 24，固定使用 pnpm 12.10.1。先安装对应版本的 Node.js 和 pnpm，然后执行：

```sh
git clone https://github.com/sonofmagic/easytier-docs.git
cd easytier-docs
pnpm install --frozen-lockfile
pnpm docs:dev
```

打开 <http://127.0.0.1:4173/>，点击“从本机预备课开始”；已有基础时可选择“直接进入第一章”。退出服务用 Ctrl+C。依赖安装会运行工作区的初次构建。

## 构建与检查

```sh
pnpm docs:build
pnpm docs:preview
```

构建产物在 `apps/docs/dist`。生产预览使用项目内的静态服务器，明确绑定本机 `127.0.0.1:4173`；先停止占用该端口的本项目开发服务。Nimbus 基于 Astro，项目的静态预览服务器明确绑定回环接口，并返回真实 404。如果端口被其他应用占用，开发时使用 `pnpm --dir apps/docs dev --port 4174`，生产预览使用 `pnpm --dir apps/docs preview --port 4174`，保留其他应用。

完整验收：

```sh
pnpm exec repo doctor
pnpm exec repo check --full
```

`repo check --full` 覆盖课程清单、预备课和章节结构、内部路径、lint、类型、模型测试及站点构建。浏览器验收补充渲染后的锚点、手机导航、搜索、图表、模型和新手完整学习路线。

本机实验有独立的标准库验收脚本，无第三方依赖、无浏览器：

```sh
python3 verification/local-lab-qa.py
```

脚本核对 ZIP 恰好包含三个文件、内容与 `examples/` 一致；临时解压并启动只监听 `127.0.0.1` 的 Python 服务，验证首页、文本、404、端口占用与停止后连接失败。优先 8877，其次 8878，均占用则选临时端口并写入结果；只清理自己创建的子进程与临时目录，保留未知监听。实际 JSON 写入 `verification/local-lab-results.json`。浏览器缓存和可见 Network 面板行为另外验收，不由此脚本代替。

浏览器脚本均从当前页面获取待测网站 origin，可用于本地或正式站：

- `verification/browser-qa.js`：32 页、图表、搜索、三个模型与手机布局。
- `verification/links-navigation-qa.js`：渲染后内部路由、锚点和手机导航。
- `verification/beginner-walkthrough.js`：点击首页新手入口，逐节展开答案，走完 5 节进入第一章，再在浏览器验证实验网页、文本和 404，并停用缓存。

使用 Playwright CLI 时，从仓库根目录运行，先打开待测网站，然后通过 `run-code --filename=verification/browser-qa.js` 等执行。新手脚本的实验段还要求执行者预先从专用演示目录启动本任务的 `127.0.0.1:8877` 服务；脚本不自动启动 Python，执行者需在最后停止自建服务并另验一次新请求连接失败。它不能替代独立 Python 脚本的资源清理。

截图写入 `verification/`。浏览器测试使用独立后台会话，结束后显式关闭；保留其他任务或用户原有浏览器。实际通过情况见 `VERIFICATION.md`，命令说明本身不表示某次验收已完成。

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

Cloudflare Workers Builds 已完成实际 `main` 推送验收：提交 `b8fe3b1` 触发完整检查后成功发布，正式站 32 页、搜索、图表、实验与手机导航通过。GitHub App 仅授权 `sonofmagic/easytier-docs`；GitHub 检查 CI 继续用于 PR/手动触发。以下为生效配置：

| 设置       | 值                                      |
| ---------- | --------------------------------------- |
| Git 仓库   | `sonofmagic/easytier-docs`              |
| 生产分支   | `main`                                  |
| 构建根目录 | 仓库根目录                              |
| Node.js    | `24`                                    |
| pnpm       | `12.10.1`                               |
| 构建命令   | `pnpm exec repo check --full`           |
| 部署命令   | `pnpm exec wrangler deploy`             |
| 自动部署   | 仅 `main`；关闭非生产分支和 PR 预览部署 |

Cloudflare Git 集成使用 `NODE_VERSION=24`、`PNPM_VERSION=12.10.1` 和工作区冻结锁文件，日志确认 Node.js 24.21.0、pnpm 12.10.1 和 Wrangler 4.149.0。平台安装依赖并管理部署令牌，不把本机 OAuth 凭据复制到 GitHub。模板 npm 发布工作流已禁用；其他分支和 PR 不部署预览。需要手动发布时仍先完整检查，再执行 `pnpm docs:deploy`。

首次自动构建编号 `834fa71d-6cce-480e-af8e-a4f85156fb2a`，Worker 版本 `4a37649e-ab2d-49b7-881b-7bb482fed311`。后续发布记录见 [VERIFICATION.md](VERIFICATION.md)。

自动部署流程中，检查失败时不会运行部署，线上保留上一次成功版本。当前手动发布也应遵守先检查再发布的顺序。查看或回退版本：

```sh
pnpm exec wrangler versions list
pnpm exec wrangler rollback <VERSION_ID>
```

回退前查看 `VERIFICATION.md` 中的发布记录，并确认目标版本。回退后同时修复或撤销造成问题的源码提交，避免下一次自动构建重新发布它。

## 内容与维护

- `apps/docs/src/content/docs/basics/`、`basics.md`：5 节本机预备课和入门索引。
- `examples/network-basics-demo/`、`apps/docs/public/downloads/`：实验源文件及公开 ZIP。
- `apps/docs/src/content/docs/chapters/`：20 章教程，使用统一 A、B、R 案例及版本。
- `apps/docs/src/content/docs/cases/local-gui.md`：真实观测附录；公开地址已替换，设备使用别名。
- `apps/docs/src/content/docs/glossary.md`、`sources.md`：术语和来源。
- `apps/docs/src/content/docs/labs.mdx`：三个实验的操作说明。
- `apps/docs/src/data/course.ts`：单一课程清单，统一预备课、章节、前置关系、导航和中文分词。
- `apps/docs/src/data/models.ts`：确定性教学模型；Vue 岛组件位于 `apps/docs/src/components/labs/`。
- `apps/docs/scripts/check-docs.ts`：文档结构和内部路径检查；Vitest 覆盖模型与分词。

各实现相关结论固定依据 EasyTier v2.6.4，release commit 为 `8428a89d2dabc94c97d370ec607c6ca142473626`。当前官网可能更新，正文区分通用原理与该版本实现。先修本机实验由读者亲手运行 Python，真实新建双机组网放在可选进阶说明；网站不会自动安装 EasyTier、Python 或修改网络配置。附录仅记录授权的有限 ICMP 测试，不代表 HTTP 可用性、具体打洞过程或性能已验证。

## 项目来源

通过 `pnpm dlx create-repoctl@1.2.5 <目标目录> --yes --templates vitepress --lang zh-CN` 创建，repoctl 固定 5.10.3。pnpm 12 的 `create` 参数传递与旧说明存在差异，因此实际使用 `dlx` 执行同一脚手架。保留 repoctl 管理配置与 Mermaid 安全渲染组件，改为中文单语言文档。

三个实验是模型：NAT 映射与过滤分别展示，拓扑延迟使用简单相加且即时选路，包旅程省略真实握手和重传。模型测试不等于真实跨网组网或性能测试。

验证记录与截图见 [VERIFICATION.md](VERIFICATION.md)、`verification/`。

## Nimbus 工程

站点由 repoctl 的 Nimbus 模板创建，使用 Nimbus 0.17.0、Astro 7.3.8、Pagefind 1.5.2 和 Vue 岛组件。源码位于 `apps/docs`；组件页面使用 MDX，其余课程使用 Markdown。中文单字与双字查询由真实公开正文生成的补充索引支持，搜索仅在浏览器本地运行。

课程清单集中在 `src/data/course.ts`；布局从 frontmatter 输出唯一 H1。旧 URL 与页内锚点保留。Markdown、MDX 源码及 llms 入口随静态网站构建。

原 VitePress 模板的登记与基线作为迁移历史保留，旧目标缺失会产生预期 doctor 警告；不修改登记来伪装为 Nimbus。当前验收记录见 `VERIFICATION.md`。
