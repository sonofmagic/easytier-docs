# 验证记录

验证日期：2026-10-13（Asia/Shanghai）。最新一轮将网站迁移至 Nimbus，保留零基础课程与历史实机记录。下面按版本记录验收；此前的 VitePress 记录不代表 Nimbus 的发布状态。

## Nimbus 迁移验收

- 使用 `repo new docs --template nimbus` 创建 `apps/docs`。固定 Nimbus 0.17.0、Astro 7.3.8、Vue 集成 7.0.3、Pagefind 1.5.2；运行和云端构建使用 Node.js 24、pnpm 12.10.1、Wrangler 4.149.0。
- 保留 32 页中文课程、原有路由和 371 个旧标题锚点、三个 Vue 岛实验、下载包和脱敏 GUI 附录；26 页 Markdown、6 页 MDX。课程清单与模型在独立数据模块中，`course-manifest.json` 兼容旧结构。
- 已通过官方 `repo workspace remove` 审核计划并移除旧站；重新生成受管 TypeScript 配置、运行 `repo init` 和 frozen-lockfile 安装。旧模板登记和基线保留作为历史。
- `repo doctor`：57 通过、307 警告、0 失败，见[脱敏报告](verification/nimbus-doctor.json)。预期警告包含旧 `apps/website` 目标已移除、原模板定向改造及既有依赖安装证据提示；没有改登记或关闭规则隐藏警告。
- `repo check --full` 通过 lint、类型、50 项测试、类型测试及构建，见[执行报告](verification/nimbus-repo-check.json)。Astro diagnostics 为 0 errors、0 warnings、0 hints。
- 部署 dry-run 通过，读取 311 个静态资源。Workers Static Assets 改为 `apps/docs/dist`；无尾斜杠 URL、真实 404、源码 MIME 和缓存规则均有静态检查。
- [本地后台浏览器验收](verification/nimbus-local-browser.json)：桌面和手机各 32 页、28 幅 Mermaid 图、十个真实搜索词、三模型正反向与重置、浅色/暗色、移动目录和展开内容通过；0 运行错误、0 失败请求。检查全部页面 DOM id 唯一和实验 label 对应控件。
- Pagefind 原生索引及真实正文中文补充索引均已生成。补充索引覆盖 32 页、2182 个正文块；单字、双字、大小写、连续正文证据、安全摘要、按页面去重及无结果通过模型/产物检查，[补充浏览器验收](verification/nimbus-extra-local.json)实际验证单字、双字、英文大小写、无结果、去重与标题定位；Pagefind 原生十词查询均有结果。首页通过五节预备课连续进入第一章，全部答案和进阶区可展开。
- Markdown、MDX、根和分节 llms 索引及 llms-full 已校验；机器可读输出保留 Mermaid 源码，并包含课程组件和实验文字说明。
- 本轮没有重测历史组网，没有改变 EasyTier 配置、节点、接口、路由、防火墙或 DNS。

### Nimbus 自动部署

首次迁移提交 `db2b905eaa09b2663f3a4aded5d24baef859f7b9` 已自动上线，构建 `87bf9860-1f74-4625-bd16-67f8da979704`，控制台显示就绪、1m 50s、版本前缀 `353a759c` 承担 100% 流量。随后补充验收发现 Pagefind 原生部分词候选需要完整正文校验，已修复并增加两项回归测试；修正版与正式站全面验收将在下一次实际推送后记录。沿用已授权的单仓库 Git 集成，仅 `main` 自动完整检查与发布，不重新申请 GitHub App 权限。

## 零基础课程改版

- 新增预备课索引和五节课程，全站 32 页；原二十章编号与 URL 保留。正文分为问题、回顾、分步图解、预测观察、误解、两道练习、进阶阅读、来源。
- 25 节课程各有两道带理由的练习；技术细节置于独立进阶折叠区。全站 28 幅 Mermaid 图，67 项现象式术语。字数仅作报告，不作为易懂的判据。
- 中央课程清单复用于首页、侧栏、前后页和浏览器验收。三个模型增加先修提示，数据包外层细节默认折叠。
- [本地浏览器验收](verification/newcourse-local-result.json)：32 页、十个搜索词、三个实验及重置、暗色模式、全部 32 页手机宽度、展开内容均通过；0 运行错误、0 失败请求。核对 2341 个内部链接和 743 个锚点，无断链，预备课连续到第一章。
- [下载实验真实运行](verification/local-lab-results.json)：ZIP 仅含网页、文本和说明，逐字节匹配源码；200、404、重复端口启动失败及原服务保持可用、停止后连接失败均成立，脚本自建进程和临时目录已清理。
- [完整新手浏览器操作](verification/beginner-browser-result.json)：从首页依次走过五节预备课到第一章，展开答案；禁用缓存后访问真实本机网页，文本可读，缺失路径返回 404；Ctrl+C 停止专用服务后，新请求得到 `ERR_CONNECTION_REFUSED`，不是 HTTP 404。另确认 8877 无监听进程。
- 浏览器发现 Python 默认文本响应无编码声明导致中文乱码；实验文本改为带 UTF-8 编码标记并实际复验，公开 ZIP 同步更新。
- 本轮没有重新执行历史组网 ping，没有修改 EasyTier、接口、路由、防火墙或系统 DNS。

### 本轮自动检查

| 检查                | 实际结果                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `repo doctor`       | exit 0；42 通过、267 提示、0 失败，保留模板改造及锁文件 override 证据限制提示                                           |
| `repo check --full` | lint、类型、30 项模型/分词/图表与渲染测试、类型测试、构建均通过；[脱敏执行报告](verification/newcourse-repo-check.json) |
| 文档检查            | 32 页、先修顺序、八段教学结构、图解、两道答案练习、来源、文件链接通过；50,381 个汉字仅报告                              |
| 模型覆盖            | 100% 行覆盖、97.08% 分支覆盖；保留正反向地址、双向打洞、断链重选、分区与重置验证                                        |
| Wrangler dry-run    | 4.149.0 通过，读取 228 个静态资源，无绑定，未以 dry-run 发布                                                            |

### 自动发布配置

已通过登录后的控制台连接 `sonofmagic/easytier-docs`，GitHub App 只获该仓库范围，按用户确认恢复运行。生产分支为 `main`，预览分支构建关闭；环境 `NODE_VERSION=24`、`PNPM_VERSION=12.10.1`，构建命令 `pnpm exec repo check --full`，部署命令 `pnpm exec wrangler deploy`，Wrangler 固定 4.149.0。实际提交、成功构建及线上版本已匹配，首次自动部署验收完成。

### 本轮首次自动部署验收

- 提交：[`b8fe3b15e193bb63a2b787ce4e1af15784b8e0df`](https://github.com/sonofmagic/easytier-docs/commit/b8fe3b15e193bb63a2b787ce4e1af15784b8e0df)。实际推送到 `main`，由 Git 集成触发，没有运行本机手动发布代替。
- 构建：`834fa71d-6cce-480e-af8e-a4f85156fb2a`。GitHub `Workers Builds: easytier-docs` 检查为 completed/success；控制台显示安装、完整检查、部署均成功。
- 云端工具：Node.js 24.21.0、pnpm 12.10.1；使用 `pnpm install --frozen-lockfile`。完整检查包括 lint、类型、30 项测试、类型测试和构建，日志显示 `Checks finished`，再执行固定 Wrangler 4.149.0。
- 发布完成：`2026-10-13T06:17:03.859Z`（北京时间 14:17:03.859）；Worker 版本 `4a37649e-ab2d-49b7-881b-7bb482fed311`，自定义域名 `easytier.icebreaker.top`。
- [正式站浏览器记录](verification/newcourse-remote-browser.json)：32 页、28 幅图、十个搜索词、三个模型及重置、暗色、32 页手机无横向溢出；0 运行错误、0 失败请求。2341 个内部链接和 743 个锚点全部有效，下载和预备课到第一章连续导航通过。
- [正式 HTTPS 记录](verification/newcourse-remote-http.json)：32 页 HTTP 200，标题与 H1 匹配构建；未知路径 404，`.html` 重定向干净 URL，sitemap 恰好 32 项；下载 ZIP 与本地包及三个源码文件逐字节一致，SHA-256 为 `72859b3f5fc9d23e77a0c1f430e41dfd38f14291cb36084fb8772d30b75b5130`。
- 正式域名此次可直接正常解析。浏览器使用已有隔离后台会话，HTTPS 保留正常证书校验；无需本轮系统 DNS 或 hosts 修改。
- 自动部署记录更新将再推送一次，成功状态通过 GitHub 检查与 Cloudflare 构建记录核对；其验收摘要在仓库部署记录提交后的 GitHub 检查中可独立查看。

以下为首次 26 页版本的历史记录，不能当作本轮的新测量。

## 完成内容

- 20 章完整中文教程，章节共 39,231 个中文字符（包含图表、标题与答案；不含英文和数字）。
- 26 个站点页面，22 幅 Mermaid 图，54 项术语。
- 章节中有 40 道带答案练习，实机附录另有 3 道。全站共 46 个 `details` 折叠区块，其中还包含说明区块，不能把区块数量写成练习数量。
- 三个纯前端教学实验：数据包去回程、NAT 映射与过滤、四节点选路。
- 新增[本机 GUI 实测附录](apps/docs/src/content/docs/cases/local-gui.md)，以脱敏摘要解释系统路由、目标连接状态和一次四包 ICMP 往返。
- 来源基准：EasyTier v2.6.4，commit `8428a89d2dabc94c97d370ec607c6ca142473626`。

## 自动检查

| 检查                                  | 结果                                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 初次 `pnpm install --frozen-lockfile` | 通过；保留工作区锁文件，新增 Wrangler 固定为 4.149.0                                                  |
| `repo init -y`                        | 完成；保留已有受管根配置                                                                              |
| `repo doctor`                         | exit 0；42 通过、267 提示、0 失败                                                                     |
| `repo check --full`                   | 最终 lint、typecheck、test、build 全部通过；构建 hash `d249de5a6083a50e`                              |
| `check:docs`                          | 26 页通过；标题、围栏、内部文件、图解、来源、章节长度与答案结构完整                                   |
| Vitest                                | 4 文件、30 测试通过；模型行覆盖 100%                                                                  |
| Wrangler dry-run                      | 4.149.0 配置验证通过；读取最终构建的 206 个资源，未执行远程发布                                       |
| 本地生产构建浏览器                    | 26 页、22 幅图、全部三个实验通过；JavaScript 错误 0，HTTP 失败 0                                      |
| 内部链接与锚点                        | 浏览器核对 1410 个链接（含 389 个锚点），0 断链                                                       |
| 本地预览服务                          | 已确认仅监听 `127.0.0.1:4173`；原有服务边界专项：首页根目录边界、干净 URL、HEAD、404、403 与 405 通过 |
| 搜索                                  | 路由、打洞、网卡、NAT、TUN 均出现真实页面搜索结果                                                     |
| 手机阅读                              | 390×844：首页、完整请求章、实验页、实机附录无页面横向溢出；章节菜单、展开答案、下一章导航通过         |
| 主题                                  | 浅色与暗色均验证，桌面 1440×1000                                                                      |

`repo doctor` 的绝大多数提示来自 VitePress 原始 repoctl 内容的定向替换/删除，这是本教程改造的一部分；另外保留了 TypeScript override 与安装证据局限提示。未关闭规则或修改受管根配置来隐藏它们。构建有 Mermaid 相关的大块提示，图表引擎通过动态导入加载。

详细结果：[repo-check.json](verification/repo-check.json)、[browser-result.json](verification/browser-result.json)、[实机脱敏摘要](verification/live-case-result.json)。

## 首次公开发布

- 公开仓库：[sonofmagic/easytier-docs](https://github.com/sonofmagic/easytier-docs)，默认分支 `main`，首个公开提交为 `83b5176`。
- 正式网站：[easytier.icebreaker.top](https://easytier.icebreaker.top/)，托管于 Cloudflare Worker `easytier-docs`。
- 首次 Worker 版本：`17dcc518-9465-4e47-98c4-cb533cf9583e`。
- 发布时间：`2026-10-13T03:59:53.884Z`，对应北京时间 `2026-10-13 11:59:53.884`。
- 远程 HTTP 验证启用正常 TLS 证书校验：首页、第 1 章、第 15 章、实机附录和 sitemap 均为 HTTP 200，未知页面为 HTTP 404。26 页逐一 HTTPS 请求、有效证书、清洁 URL、404 和 26 项 sitemap 均通过；HTTP 本身可返回 200，未配置强制跳转 HTTPS，属额外观测。详情见[远程 HTTP 记录](verification/remote-http-result.json)、[全路由验证](verification/remote-routes-result.json)。

公共 DNS `1.1.1.1` 已返回 Cloudflare 地址。本机系统 DNS 仍受到之前的 NXDOMAIN 缓存影响，因此这次 HTTP 和浏览器验证分别使用进程级 `curl --resolve`、浏览器 `host-resolver-rules` 指向已确认的边缘地址，继续使用正式域名和正常 TLS 校验。没有修改系统 DNS、hosts 或网络配置；这项绕过仅影响测试进程。

首次 push 前暂时禁用 GitHub Actions 以避免模板发布任务竞态，随后禁用 `release.yml`、`release-intent-auto.yml`、`release-intent-check.yml`，恢复仓库 Actions，只有检查 CI 处于启用状态。工作流源文件保留，未用修改受管文件的方式隐藏发布流程。

### 首次发布时的自动部署状态（历史）

首次 26 页版本使用手动部署，当时 Workers Builds 尚未接通。本轮已完成控制台登录及 Git 连接，实际自动构建验收见本轮记录；CLI OAuth 的权限范围保持不变。

正式站后台浏览器验收已通过：26 页、22 幅图、五个中文/英文搜索词、三个实验、浅色/暗色和四种手机页面。运行错误 0，HTTP 失败 0；补充导航核对 1402 个渲染链接（含 381 个锚点），0 断链。链接数量按本次渲染状态统计，与本地 1410/389 的计数各自保留。浏览器仅出现 VitePress 字体预加载未使用提示，不影响页面运行。详情见[线上浏览器记录](verification/remote-browser-result.json)。

## 实机观察

目标已确认属于现有组网；本次仅读取运行中 GUI、虚拟接口及目标路由，并执行有界 ICMP 验证。公开使用 A `10.144.144.1`、B `10.144.144.2` 作为教程替换地址，实际设备地址和原始截图没有进入公开记录。

- GUI 与 core 均为 v2.6.4；core 提交标记为 `8428a89d`。
- 本机接口为 `utun6`，前缀 `/24`、MTU 1360；测试前后到 B 的系统路由均选择该接口。
- 测试前后目标 B 的 GUI 均显示 `p2p` / UDP。GUI 延迟从 20 ms 变为 36 ms，显示丢包均为 4%；这些值与 ping 使用不同统计口径。
- ICMP 探测开始于 `2026-10-13T11:43:36+08:00`，固定 4 次请求，单次等待 1000 ms，整个子进程限时 10 秒。
- 4 发 4 收、0.0% 丢包，四次 RTT 为 118.798、17.790、31.675、25.961 ms；min/avg/max/stddev 为 17.790/48.556/118.798/40.853 ms。
- 命令退出码 0，未触发超时；既有网络持续运行，没有修改网络配置、扫描端口或进行带宽压测。

这份证据确认本次 ICMP 往返和两个时间点的连接状态。HTTP 服务、具体打洞过程、独立家庭宽带环境、中继切换和长期性能没有验证，不能由这四次回应推断。网络名称、节点标识、实际公网端点、完整配置与原始 GUI 截图留在本地。

## 浏览器证据

使用 Playwright CLI 0.1.8，同一任务会话 `et-docs-1013`，实际确认 `headed: false`、in-memory profile。复用一个标签逐页验证，没有借用用户的 Chrome 登录态。

- [桌面首页](verification/home-desktop.png)
- [桌面实验](verification/labs-desktop.png)
- [暗色实验](verification/labs-dark.png)
- [手机首页](verification/home-mobile.png)
- [手机实验](verification/labs-mobile.png)
- [手机实机附录](verification/case-mobile.png)
- [正式站桌面首页](verification/remote-home-desktop.png)
- [正式站手机首页](verification/remote-home-mobile.png)
- [正式站手机实机附录](verification/remote-case-viewport.png)

开发版与本地生产 preview 均实际执行过验收；当前截图来自加入附录后的本地生产 preview。可复用脚本：[browser-qa.js](verification/browser-qa.js)、[链接与手机导航检查](verification/links-navigation-qa.js)。脚本使用当前页面 origin，支持本地和正式站；从仓库根目录通过 CLI `run-code --filename` 执行，页面与会话由调用方负责创建和关闭。

当前 VitePress alpha 的内置 preview 没有按 `--host` 限制监听地址。项目因此使用 `apps/website/scripts/preview.ts` 明确绑定回环接口，并实际检查监听地址；这项修正后执行了完整检查及本地生产构建浏览器验收。

## 首次发布时的范围与资源（历史）

后台远程测试浏览器已关闭，CLI `list` 确认无测试浏览器。开发服务已停止，生产预览 <http://127.0.0.1:4173/> 保留供本地阅读。首次线上发布、远程 HTTP 和浏览器验收已确认；控制台登录标签页为后续 Git 集成接管保留，`main` 自动部署仍待接通。原生 Chrome 操作失败期间曾尝试新建空白标签，当前无法确认其归属，因此没有关闭任何用户页面；其余未改动现有浏览器窗口。

交互测试验证教学模型与页面行为。实机附录验证的是既有 GUI 网络的一次有限 ICMP 往返；没有执行第 20 章的临时两机 HTTP 实验，也没有进行管理员权限修改或性能测试。

文档结构检查验证内部链接对应文件，补充的浏览器检查核对实际渲染的内部路由与页内锚点。外部网站长期可用性不在本地测试范围内。来源指向固定版本源码或注明当前文档；发布版本未来变化时，应按资料来源页的方法重新核对。
