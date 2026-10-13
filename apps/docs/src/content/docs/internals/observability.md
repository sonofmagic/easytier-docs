---
title: 进阶 6 · 在正确位置抓包与排障
description: 对齐 TUN、原有接口、目标节点和服务日志的证据，区分 DNS、监听、建链、MTU、丢包与回程问题。
---

## 导读：先写一个能被证据回答的问题

“网络不通”太大，“A 在此时访问 B 的虚拟 IP、TCP 8080，连接超时”才有可检查的目标。先读[数据面与封装](/internals/packet-pipeline)、[控制面与建链](/internals/connectivity)和[第 19 章：按层排查](/chapters/19-diagnostics)。本篇依据 **EasyTier v2.6.4** 说明观察位置，工具示例主要面向 Linux/macOS；不是对读者设备实际运行的新抓包。

教学 A、B、R 为 `10.144.144.1`、`10.144.144.2`、`10.144.144.254`。公网示例是保留地址。实际测试必须使用自己已确认的目标、接口和权限，并记录时间、版本、源端与目标端，避免把不同场景的读数拼成一个过程。

## 第一步：四个观察位置各回答什么

**图 1 · 每个观察点只看到自己附近的一层**

![A 的 TUN 能看到内层虚拟 IP 包，A 的原有接口能看到外层隧道端点，B 的 TUN 能看到还原后的包，B 服务日志说明应用实际收到的请求；R 为可选中间节点。](/diagrams/capture-points.svg)

[打开可缩放的 SVG 原图](/diagrams/capture-points.svg)

**阅读顺序：**沿 A 到 B 找四个点，再比较内层、外层及应用证据。**结论：**看到了上一处，不等于下一处已收到；必须关联同一目标、时间与方向。

| 观察位置 | 主要可见信息 | 可支持的结论 | 单独不能证明什么 |
| --- | --- | --- | --- |
| A 的 TUN（虚拟 IP 包交接接口） | 内层虚拟 IP、TCP 端口、ICMP 与未另行加密的应用数据 | 系统是否把业务包交到虚拟接口 | 后续 ACL、加密、转发或底层发送成功 |
| A 的原有网络接口 | 外层端点、TCP/UDP、包长、时间；可能有 STUN 等控制报文 | 是否有相关外层发送与返回 | 密文属于哪一次 HTTP 请求；完整目标会话身份是否可信 |
| B 的 TUN | 解封装后交回系统的内层包与回包 | 目标端业务包是否出现在对应接口 | 应用已读取、业务授权成功或回应已到 A |
| B 的服务日志与监听状态 | 接受连接、方法、路径、状态码、业务耗时 | 应用是否收到请求并怎样回答 | 每段底层路径、NAT 行为或长期网络质量 |
| 目标 B 的节点与路由状态 | 目标、相邻连接、下一跳、统计 | 某时刻覆盖网络知道哪些路径 | 浏览器 TCP 8080 是否成功；最初具体打洞报文 |

加密情况下，在 TUN 上看到 HTTP 明文是正常的观察位置；HTTPS（使用 TLS 的 HTTP）应用在 TUN 上仍通常是 TLS 密文。外层字节增长也可能包含内部 RPC（远程过程调用）、握手和保活，不能直接等同下载内容长度。

## 第二步：先查路由和监听，少抓一些无关包

路由查询回答“目标 IP 会交给哪个接口”。Linux 可使用 `ip route get 10.144.144.2`，macOS 可使用 `route -n get 10.144.144.2`。这里是教学目标，实际应替换为已确认 B 地址；接口可能叫 `easytier0`、`utun6` 或别的名字，不能照抄。

B 的服务还需监听正确地址。Linux 的 `ss -lnt`、macOS 的 `lsof -nP -iTCP:8080 -sTCP:LISTEN` 可查看 TCP 监听。只监听 `127.0.0.1:8080`，不能据此承诺 A 对 B 虚拟 IP 的访问会进入服务。Windows 可在资源监视器或 PowerShell 的 `Get-NetTCPConnection -State Listen` 中看同类信息。

CLI 与 core 需版本、管理地址匹配。`easytier-cli node`、`peer`、`route` 查询的是管理接口，不是远端业务端口。v2.6.4 默认管理端点 `127.0.0.1:15888`；GUI 的实例配置可能不同，不能为查询失败就重启现有网络或把管理接口暴露到公网。

## 第三步：让一次抓包有界、有目标

下面只给**待替换模板**。先确认 `TUN_IF` 和 `UNDERLAY_IF`，填写真实接口后，在自己管理的两端针对一个目标做短时观察；不要原样运行占位符。抓包工具可能需要管理员权限，`-c 40` 限制数量，流量少时仍可用 Ctrl+C 停止。

```bash
# 内层：观察到 B 的 TCP 8080，以及相关 ICMP
sudo tcpdump -ni TUN_IF -c 40 'host 10.144.144.2 and (tcp port 8080 or icmp)'

# 外层：按当前连接的真实对端地址和端口限定
sudo tcpdump -ni UNDERLAY_IF -c 40 'host ACTUAL_PEER_IP and udp port ACTUAL_PEER_PORT'
```

外层是 TCP 时修改为 `tcp port`。经 R 时，A 原有接口的目标是当前运输段的 R，不一定是 B 公网端点。STUN（NAT 会话穿越工具）有它自己的服务器地址及端口，应另用对应过滤器；看业务 8080 的内层过滤器不能找到所有 STUN 请求。

Wireshark 的 `ip.addr == 10.144.144.2 && tcp.port == 8080` 是**显示过滤器**，与 tcpdump 的抓取过滤语法不同。显示过滤只隐藏无关包，不会删除文件中其他数据。首次复核可直接观察命令输出；需要保存文件时只保存相关流量，并在分享前脱敏和检查内容。

## 第四步：从 TCP 时序判断最早的缺口

TCP（传输控制协议）连接通常以 SYN、SYN-ACK、ACK 建立。可以直觉地看成 A 请求开始，B 回答可建立，A 确认；后续数据还要靠序号和确认号处理。三个包是在业务内层，外层 UDP 隧道不需要因此变成 TCP。

| 内层现象 | 下一项优先证据 | 谨慎解释 |
| --- | --- | --- |
| A 的 TUN 没看到预期 SYN | 业务目标、应用代理设置、路由与接口 | 可能根本没有从这个位置发出；先别推断远端 NAT |
| A 有 SYN，B 的 TUN 没有 | A 后续处理、目标路径、外层双向包与两端日志 | 将缺口缩小到两观察点之间，单凭一端抓包仍不能定位具体路由器 |
| B 收到 SYN 并回 RST | 服务监听及明确拒绝规则 | 常见于无监听或主动拒绝，不是一律“打洞失败” |
| B 回 SYN-ACK，A 未见 | 回程路由、规则、外层方向和 A 入站处理 | 去程到达不能代替回程条件 |
| 握手完成，HTTP 返回 404 / 403 | 目标服务身份、路径、账号与业务日志 | 已取得应用层回答，应先解释资源不存在或拒绝原因 |
| 数据有重传，服务仍断续 | 同期两端包、确认号、包长、拥塞和服务耗时 | 重传说明发送端认为数据需补发，不单独证明丢在哪一段 |

抓包位置靠近本机协议栈时，TSO/GSO/GRO（分段或聚合卸载）可能使你看见大于线上单包的记录，校验和也可能尚未填好。不要仅凭本机“大包”或“校验和错误”就宣布线路违规。抓包工具自身丢包、捕获开始太晚和两端时钟偏差，也会干扰时序判断。

## 第五步：DNS、MTU 和丢包用不同实验回答

DNS（域名系统）的问题先问“这个名称解析成了什么”。数字虚拟 IP 成功而名称失败，可用 `nslookup` 或 `dig` 查询，并记录所用解析器及 A/AAAA 回答；不要假定应用一定向 UDP 53 发了传统 DNS，它也可能使用缓存或加密 DNS。若没有发出业务 SYN，名称解析失败是比 NAT 更早的线索。

MTU（最大传输单元）问题与包大小关联。小 ICMP（互联网控制消息协议）探测成功，只说明小包条件；大包需要结合外层封装、路径 MTU 和反馈。IPv4 的“需要分片”反馈与 IPv6 的 Packet Too Big（包过大）消息是不同报文。必要反馈受阻时，可能出现小请求正常、大响应卡住，但服务缓慢、无线丢包与拥塞也能产生近似现象。

丢包和延迟必须记录目标、方向、次数与窗口。GUI 的连接探测、系统 ping 和业务 TCP 重传测量对象不同，4 次 ping 无丢失并不能否定较长窗口的 4% 统计。一次高 RTT（往返时间）也不能直接还原为“刚刚打洞”或“刚刚转中继”。

**图 2 · 每一步都用下一条证据缩小问题**

![诊断流程先确定目标、错误和时刻，然后查名称、系统路由、目标节点路径、服务监听、去回程，最后按包大小和负载研究 MTU、丢包或性能。](/diagrams/diagnostic-evidence.svg)

[打开可缩放的 SVG 原图](/diagrams/diagnostic-evidence.svg)

**阅读顺序：**从一个明确目标开始，找到最早缺失的证据，再沿相关分支继续。**结论：**排查顺序是减少未知，不是看见一个错误便同时改变全部配置。

## 进阶阅读：跨点关联比只盯一个界面更可靠

<details class="advanced">
<summary>怎样把内层、外层和控制面的记录拼到一起</summary>

先以同一业务五元组、内层序号、两端时间窗口关联 TUN 记录；再参考目标 B 的 route/peer 快照、连接端点和日志找到外层运输段。加密后不能只靠字节内容把某个内层包与某个外层包一一匹配，TCP 分段、重传、代理和压缩也可能改变边界。

`peer_manager.rs` 记录与处理数据、控制及转发路径，`peer_conn_ping.rs` 的探测口径也不是 ICMP。源码中的计数器可以解释读数属于哪一层，但状态快照不能复原完整历史。`p2p` 表示当前目标的一跳路径显示，`relay(n)` 是 cost 的展示；普通跳数语境的 `relay(2)` 通常是两跳、一台中间节点，而非两台中继。

看到外层 SYN 后完成了 TCP 连接，也还需核对 EasyTier 握手和网络身份；看到普通数据密文，也不能证明安全模式的公钥锁定正确。相关边界分别见[连接生命周期](/internals/connectivity)和[安全与身份](/internals/security)。

</details>

## 常见误解

“抓不到包就是没有发包”忽略了接口、过滤器和时间窗口；“有返回流量就是网页已经回答”忽略控制面和其他应用；“收到 RST 就是 NAT 不通”忽略明确拒绝；“重启好了就找到了根因”则忽略重启同时改变多个条件。报告应写已观察到什么和缺少哪项证据，避免从结果反推未经记录的过程。

## 两道练习与答案

1. A 的 TUN 发出 SYN，B 的 TUN 收到 SYN 并回 SYN-ACK，但 A 没看到 SYN-ACK。下一步先查 DNS 还是回程？

<details class="answer">
<summary>查看第 1 题答案</summary>

优先查回程。目标已形成并去程已到 B；核对 B 的回复路由、允许规则、外层回包以及 A 的入站处理。先对齐时间与接口，避免漏捕获造成误判。

</details>

2. 小 ping 全部成功，大文件停止。能否直接把 MTU 改到最小值并宣布已找到根因？

<details class="answer">
<summary>查看第 2 题答案</summary>

不能。需查包长、反馈、重传及服务耗时，并用有基线的一项改变验证假设。过小 MTU 会增加包数和开销，改变现象也不单独证明最初原因。

</details>

## 来源：固定版本源码与通用规范

- [v2.6.4 CLI 与默认管理端点](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/easytier-cli.rs)、[路径 cost 显示](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/utils/string.rs)。
- [v2.6.4 TUN](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/instance/virtual_nic.rs)、[包处理与转发](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/peers/peer_manager.rs)、[连接探测](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/peers/peer_conn_ping.rs)、[DNS 功能](https://github.com/EasyTier/EasyTier/tree/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/instance/dns_server)。
- [RFC 9293：TCP 状态与报文](https://www.rfc-editor.org/rfc/rfc9293)、[RFC 792：ICMP](https://www.rfc-editor.org/rfc/rfc792)、[RFC 4443：ICMPv6](https://www.rfc-editor.org/rfc/rfc4443)、[RFC 1191：路径 MTU](https://www.rfc-editor.org/rfc/rfc1191)、[RFC 8201：IPv6 路径 MTU](https://www.rfc-editor.org/rfc/rfc8201)。
- [tcpdump 使用手册](https://www.tcpdump.org/manpages/tcpdump.1.html)、[Wireshark 显示过滤器说明](https://www.wireshark.org/docs/wsug_html_chunked/ChWorkBuildDisplayFilterSection.html)：抓取与显示语法需分别使用。

需要现成证据可对照[脱敏 GUI 实机案例](/cases/local-gui)；想完整复习，再回到[学习路线](/course)把模型、实现与实测分别记录。
