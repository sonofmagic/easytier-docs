---
title: 来源与版本说明
description: 分开通用网络标准、EasyTier v2.6.4 固定实现与持续更新的官方文档，并说明教学模拟的边界。
---

# 来源与版本说明

这套教程把三类依据分开：网络协议的通用原理、EasyTier 某个固定版本的实现、会随时间更新的操作指南。不能用新版文档中的一项行为，悄悄替代旧版程序的实际行为。

本文核对日期为 **2026 年 10 月 13 日**。命令与具体默认值以 **EasyTier v2.6.4** 为基准；该 tag 在核对时对应提交 `8428a89d2dabc94c97d370ec607c6ca142473626`。章节中的 tag 链接便于阅读，下面提供提交链接便于固定源码。版本升级后，需要重新核对参数、默认值与平台差异。

## 通用网络原理：查标准，不猜产品行为

| 来源                                                                                                   | 用来核对什么                                                 | 对应学习内容                                                           |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| [RFC 1918](https://www.rfc-editor.org/rfc/rfc1918)                                                     | IPv4 私有地址空间                                            | [地址与网段](/chapters/03-addresses)                                   |
| [RFC 4632](https://www.rfc-editor.org/rfc/rfc4632)                                                     | CIDR 与地址前缀                                              | [地址与网段](/chapters/03-addresses)、[路由](/chapters/05-routing)     |
| [RFC 9293](https://www.rfc-editor.org/rfc/rfc9293)                                                     | TCP 的连接、确认和可靠字节流                                 | [TCP 与 UDP](/chapters/04-protocols)、[完整请求](/chapters/15-journey) |
| [RFC 768](https://www.rfc-editor.org/rfc/rfc768)                                                       | UDP 数据报与端口                                             | [TCP 与 UDP](/chapters/04-protocols)                                   |
| [RFC 3022](https://www.rfc-editor.org/rfc/rfc3022)                                                     | 传统 NAT 的地址和端口转换概念                                | [NAT](/chapters/06-nat)                                                |
| [RFC 4787](https://www.rfc-editor.org/rfc/rfc4787)                                                     | UDP NAT 的映射、过滤和相关行为                               | [NAT](/chapters/06-nat)、[打洞](/chapters/11-hole-punch)               |
| [RFC 8489](https://www.rfc-editor.org/rfc/rfc8489)                                                     | STUN 协议及其能力边界                                        | [STUN](/chapters/10-stun)                                              |
| [RFC 8445](https://www.rfc-editor.org/rfc/rfc8445)                                                     | ICE 的候选地址与连通性检查思路                               | [打洞](/chapters/11-hole-punch)，不据此宣称 EasyTier 完整实现 ICE      |
| [RFC 1034](https://www.rfc-editor.org/rfc/rfc1034)、[RFC 1035](https://www.rfc-editor.org/rfc/rfc1035) | DNS 概念与消息                                               | [应用与 DNS](/chapters/17-apps-dns)                                    |
| [RFC 1191](https://www.rfc-editor.org/rfc/rfc1191)                                                     | IPv4 路径 MTU 发现                                           | [性能](/chapters/18-performance)                                       |
| [RFC 9000](https://www.rfc-editor.org/rfc/rfc9000)                                                     | QUIC 传输协议                                                | [性能](/chapters/18-performance)，具体代理行为仍看 EasyTier 源码       |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)                                                     | HTTP 响应语义                                                | [应用与 DNS](/chapters/17-apps-dns)                                    |
| [RFC 5737](https://www.rfc-editor.org/rfc/rfc5737)                                                     | `192.0.2.0/24`、`198.51.100.0/24`、`203.0.113.0/24` 文档地址 | 全站公网示意，不能用于真实连接                                         |
| [RFC 2606](https://www.rfc-editor.org/rfc/rfc2606)                                                     | `.test` 等保留测试名称                                       | [应用与 DNS](/chapters/17-apps-dns)中的纸上示例                        |

这些标准解释概念和协议，不代表每台家庭路由器都满足相同条件，也不代表 EasyTier 的具体算法等于某篇 RFC 的完整实现。

## 固定版资料：核对命令和实现

- [v2.6.4 发布页](https://github.com/EasyTier/EasyTier/releases/tag/v2.6.4)：实践章使用的预编译 ZIP 和版本；发布资产与源码各有用途。
- [固定提交 README](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/README.md)：共享节点组网、去中心化连接、子网代理及 CLI 查询。
- [core.rs 参数定义](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/core.rs)与[app.yml 参数说明](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/locales/app.yml)：网络名、密钥、虚拟地址、监听、系统转发及 KCP/QUIC 选项。
- [common/config.rs](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/common/config.rs)：默认配置与网络身份结构。
- [instance/virtual_nic.rs](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/instance/virtual_nic.rs)：TUN 创建、数据交接及加密启用后的 MTU 调整。
- [instance/instance.rs](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/instance/instance.rs)：代理初始化、系统转发分支与节点各组件的生命周期。
- [connector 目录](https://github.com/EasyTier/EasyTier/tree/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/connector)、[common/stun.rs](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/common/stun.rs)：连接建立、NAT 探测与打洞实现入口。
- [peers 目录](https://github.com/EasyTier/EasyTier/tree/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/peers)与[tunnel/packet_def.rs](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/tunnel/packet_def.rs)：节点之间的路径、收发与包结构。
- [gateway/tcp_proxy.rs](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/gateway/tcp_proxy.rs)：默认 TCP 子网代理如何连接本地目标。
- [gateway/kcp_proxy.rs](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/gateway/kcp_proxy.rs)与[gateway/quic_proxy.rs](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/gateway/quic_proxy.rs)：TCP 流代理的具体实现。
- [easytier-cli.rs](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/easytier-cli.rs)与[utils/string.rs](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/utils/string.rs)：管理入口、状态表和 `p2p` / `relay(n)` 显示转换。
- [DNS 实现目录](https://github.com/EasyTier/EasyTier/tree/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/instance/dns_server)与[ACL 处理](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/common/acl_processor.rs)：名称解析和权限边界。

源码中的默认设置不保证覆盖所有构建方式、无 TUN 模式或平台特例。教程遇到具体平台实验时，仍以该平台程序的版本、帮助、日志和系统状态交叉检查。

## 当前官方文档：执行前再次核对

以下链接是持续更新的指南，适合了解新能力和最新平台说明。它们**不是 v2.6.4 的冻结文档**，公共节点地址尤其需要执行前确认。

- [官方组网介绍](https://easytier.cn/guide/networking.html)、[共享节点快速组网](https://easytier.cn/guide/network/quick-networking.html)、[自建共享节点](https://easytier.cn/guide/network/host-public-server.html)、[去中心化组网](https://easytier.cn/guide/network/decentralized-networking.html)。这些指南提供配置方法，具体可用节点地址需要自行确认。
- [命令行安装](https://easytier.cn/guide/installation.html)、[子网代理](https://easytier.cn/guide/network/point-to-networking.html)、[网对网](https://easytier.cn/guide/network/network-to-network.html)。
- [KCP 与 QUIC 代理](https://easytier.cn/guide/network/kcp-proxy.html)、[魔法 DNS](https://easytier.cn/guide/network/magic-dns.html)、[ACL](https://easytier.cn/guide/config/acl.html)、[P2P 优化](https://easytier.cn/guide/network/p2p-optimize.html)。
- [Python http.server](https://docs.python.org/3/library/http.server.html)：第 20 章临时 HTTP 验证的辅助工具文档。

本教程不复制官方文档中全局关闭防火墙、执行远程安装脚本等做法；两机实验采用固定版预编译下载，并要求定向允许和定向收尾。

## 教学模型与验证边界

[浏览器演示](/labs)使用简化模型：NAT 规则是指定的预设，拓扑权重是人为设定的数值，路径变化立即展示，包旅程只抽取关键步骤。它们帮助解释因果，不模拟全部打洞预测策略、真实拥塞控制、协议字节布局或路由收敛过程。

全站固定使用 A、B、R 的示例地址，临时端口、延迟、HTTP 状态等标为教学或预期示例。除非明确附有真实实验记录，不把这些数值描述成实测。实际环境要按照[第 20 章](/chapters/20-practice)验证；成功与失败都应记录版本、目标、路径和结果。

如果发现资料之间不一致，先判断它们属于哪一类，再比较版本、平台和配置条件。学习原理时不必读完全部源码，但做具体判断时，应知道证据来自哪里。
