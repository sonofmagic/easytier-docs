# 验证记录

验证日期：2026-10-13（Asia/Shanghai）。本记录覆盖加入实机附录后的源码、本地生产构建和首次远程发布。远程 HTTPS 和浏览器检查已通过，`main` 自动部署尚未接通。

## 完成内容

- 20 章完整中文教程，章节共 39,231 个中文字符（包含图表、标题与答案；不含英文和数字）。
- 26 个站点页面，22 幅 Mermaid 图，54 项术语。
- 章节中有 40 道带答案练习，实机附录另有 3 道。全站共 46 个 `details` 折叠区块，其中还包含说明区块，不能把区块数量写成练习数量。
- 三个纯前端教学实验：数据包去回程、NAT 映射与过滤、四节点选路。
- 新增[本机 GUI 实测附录](apps/website/cases/local-gui.md)，以脱敏摘要解释系统路由、目标连接状态和一次四包 ICMP 往返。
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

### 自动部署待完成

Cloudflare Workers Builds 的 `main` 自动部署尚未接通，不能把首次手动发布写成自动部署验收成功。当前 CLI OAuth 缺少 Workers CI 权限，原生 Chrome 操作连接失效；已打开的 in-app browser 控制台登录仍待用户完成。接下来需要通过控制台连接仓库、设置构建和部署命令，并实际推送一次更新确认自动部署成功。目标配置见 README。

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

## 范围与资源

后台远程测试浏览器已关闭，CLI `list` 确认无测试浏览器。开发服务已停止，生产预览 <http://127.0.0.1:4173/> 保留供本地阅读。首次线上发布、远程 HTTP 和浏览器验收已确认；控制台登录标签页为后续 Git 集成接管保留，`main` 自动部署仍待接通。原生 Chrome 操作失败期间曾尝试新建空白标签，当前无法确认其归属，因此没有关闭任何用户页面；其余未改动现有浏览器窗口。

交互测试验证教学模型与页面行为。实机附录验证的是既有 GUI 网络的一次有限 ICMP 往返；没有执行第 20 章的临时两机 HTTP 实验，也没有进行管理员权限修改或性能测试。

文档结构检查验证内部链接对应文件，补充的浏览器检查核对实际渲染的内部路由与页内锚点。外部网站长期可用性不在本地测试范围内。来源指向固定版本源码或注明当前文档；发布版本未来变化时，应按资料来源页的方法重新核对。
