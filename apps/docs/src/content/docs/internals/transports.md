---
title: 进阶 5 · 怎样比较传输引擎
description: 从报文、字节流、可靠性、队头阻塞和网络允许条件对照 TCP、UDP、WS/WSS、QUIC、WireGuard、FakeTCP 及 TCP 流代理。
---

## 导读：先定位置，再比较性能

不存在一种协议在所有网络里都最合适。选择之前先明确：你在更换相邻节点的**外层隧道**，还是在代理虚拟网络内的一条 **TCP 流**？先读[协议地图](/internals/protocol-map)和[第 18 章：延迟、丢包与 MTU](/chapters/18-performance)。本篇比较依据固定为 **EasyTier v2.6.4**，通用协议性质与该版本实现分别说明。

示例仍是 A `10.144.144.1` 访问 B `10.144.144.2:8080`。无代理时，内层 TCP（传输控制协议）由 A、B 系统管理；外层使用什么，通常不改变这个内层 TCP 连接。代理模式则会在中间接管流并重新搬运，不能把两种路径画成完全相同的逐包模型。

## 第一步：先理解报文与字节流

UDP（用户数据报协议）以一个个报文为单位交付：发送一个报文，接收方得到一个报文或根本收不到。它自身不保证到达、顺序或自动重传。上层若需要这些能力，可以自己增加；内层 TCP 就会在其看到的丢包基础上确认与重传。

TCP 提供可靠、有序的字节流。发送方分几次写入，不保证接收方分几次读出，所以 EasyTier 的 TCP 隧道需要长度分帧来找回包边界。某段字节丢失时，即使后面的字节已到，也可能暂时无法按顺序交付。这叫**队头阻塞**：队伍最前的缺口挡住后续交付。

这解释了 TCP-over-TCP 的一个代价：外层丢包先触发外层 TCP 恢复，所有排在其后面的隧道数据等待；内层 TCP 同时也有自己的时钟和拥塞反应。这不表示 TCP 隧道一定差，它在仅允许 TCP 的路径上仍可能提供实际可用的运输。

**图 1 · 把协议放到两个独立比较轴上**

![一条轴区分 TCP、UDP 等底层协议及允许条件，另一条轴区分隧道和 TCP 流代理；QUIC 出现在两种位置，WSS 位于基于 TCP 的隧道家族。](/diagrams/transport-axes.svg)

[打开可缩放的 SVG 原图](/diagrams/transport-axes.svg)

**阅读顺序：**先找底层使用 TCP 还是 UDP，再看功能位于隧道还是流代理，最后查看可靠性与保护说明。**结论：**“底层能通过”“怎样恢复丢包”“是不是代理”和“怎样认证”是不同维度。

## 第二步：逐项比较相邻节点隧道

| 传输 | v2.6.4 URL 与底层 | 怎样搬包 | 何时值得考虑、需要确认什么 |
| --- | --- | --- | --- |
| TCP | `tcp://`；原有网络 TCP | EasyTier 包放入有序字节流，用长度分帧 | TCP 路径可用时；检查监听、允许规则及双层恢复影响 |
| UDP | `udp://`；原有网络 UDP | 报文承载，有自身建连和包型 | 常见直接连接路径；普通数据报不变成完整可靠流，检查 NAT 和 UDP 允许条件 |
| WS：WebSocket | `ws://`；HTTP 升级后基于 TCP | 用 WebSocket 消息承载 | 需要 `websocket` feature；经过代理时还需代理支持升级与长连接 |
| WSS：安全 WebSocket | `wss://`；TLS + WebSocket + TCP | WS 外再使用 TLS（传输层安全协议） | 同一 feature；有加密不等于此版本已验证预期服务器的公共 CA 身份 |
| QUIC | `quic://`；原有网络 UDP | QUIC 双向可靠流中分帧搬包，可复用连接 | 需要 `quic` feature；仍需要底层 UDP 可达，不能据名字宣称所有包无队头阻塞 |
| WireGuard | `wg://`；原有网络 UDP | WireGuard 协议层承载节点数据 | 需要 `wireguard` feature；区分节点间传输与 VPN portal 标准客户端接入 |
| FakeTCP | `faketcp://`；TCP 外观的用户态特殊传输 | 在对应平台驱动上按特殊报文逻辑搬运 | 需要 `faketcp` feature、权限及驱动能力；不等于系统普通 TCP 字节流，也不保证绕过所有规则 |

WS/WSS 使用 TCP，因而仍受其有序交付影响。代理或设备“允许 443”也不代表能通过任意 WSS 服务；实际 HTTP 升级、TLS、空闲超时及路径政策都会参与结果。

WireGuard 有自己的协议加密与握手，但 `wg://` 不表示内层 HTTP 自动变成 HTTPS。`wireguard.rs` 还区分内部节点用途与外部客户端用途，后者需 VPN portal 配置，不应直接把 EasyTier 节点 URL 填进标准客户端并期待完整等价。

FakeTCP 源码包含最小用户态 TCP 报文处理、连接状态、原始包捕获与平台后端。Linux、macOS、Windows 后端及回退路径不同，权限和设备环境决定能否运行。它的“TCP 外观”不应被教学简化成“完整遵守普通 TCP 可靠流语义”。

## 第三步：QUIC 的标准性质与此版本实现分开读

标准 QUIC 提供可靠流、多路复用、丢包恢复与拥塞控制，通常结合 TLS 1.3。多个不同流可以避免一条流丢失阻塞另一条流的交付；但**同一条可靠流内**仍需保证顺序。EasyTier v2.6.4 隧道在双向流上使用分帧读写，不能把协议的多流潜力说成“任何隧道包都不会等待”。

更关键的是，此版本 `quic.rs` 使用 `quinn_plaintext` 的客户端和服务端配置。因此这里不能从标准 QUIC 的 TLS 描述推断 EasyTier QUIC 隧道自身提供完整内容加密和可信证书认证；节点数据保护需按 EasyTier 选用的加密与[安全模式](/internals/security)核对。

WSS 则实际使用 TLS，但该版本客户端配置跳过服务器证书信任链验证。证书签名处理与“证书确实属于预期运营者”不是同一回事。不同传输的这些实现选择，是为什么“哪种协议更安全”不能脱离实际认证机制回答。

## 第四步：KCP / QUIC TCP 流代理是另一层能力

KCP 是提供可靠传输策略的协议实现；QUIC 也可用于可靠流。EasyTier 的 `enable_kcp_proxy`、`enable_quic_proxy` 用它们代理虚拟网络中的 TCP 流：源侧截获符合条件的连接，代理在两节点间搬流，目的侧再联系目标 TCP 服务。

这与“把每个原始 TCP/IP 包装入 UDP 隧道”不同。代理改变中间的流搬运与终止位置，但应用通常仍像使用 TCP 服务一样工作。KCP 的输出会装为 EasyTier `KcpSrc` / `KcpDst` 包型；QUIC 代理也有自己的 `QuicSrc` / `QuicDst` 包型，继续利用覆盖网络发往目标节点。

因此：没有因为启用 KCP 代理就得到 `kcp://` 节点隧道 URL；也没有因为启用 QUIC 代理就把外层连接强制变成 `quic://`。实际覆盖路径可以继续直连或中继，代理自己的报文仍要被这个路径运走。

目的端的 `disable_kcp_input` / `disable_quic_input`、中继相关控制、构建 feature 和目标模式都会影响使用结果。v2.6.4 的相关目的连接器含 IPv4 限制，不能只见开关就承诺所有 IPv6 TCP 目标同样被代理。UDP 游戏、ICMP ping 也不会因此自动获得 TCP 流代理收益。

**图 2 · 谁恢复丢包，谁就引入相应等待与成本**

![图中比较未启用流代理的两条路径：外层 UDP 丢失第 2 个报文时，第 3 个可以先到，由内层 TCP 处理缺口；外层 TCP 则先恢复第 2 段，后续字节等待按序交付。](/diagrams/transport-recovery.svg)

[打开可缩放的 SVG 原图](/diagrams/transport-recovery.svg)

**阅读顺序：**先看两列同时丢失第 2 个数据的情况，再比较第 3 个数据在外层怎样交付，最后找内层 TCP 恢复的职责。**结论：**增加可靠机制不等于增加物理容量；重传、缓存、CPU 与排队都有成本。此图不启用流代理，代理接管的位置需结合上文另行理解。

## 怎样做可归因的观察

先记录目标 B 的实际路径、隧道协议、版本、文件大小与下载方向。A 下载 B，主要数据从 B 发到 A，应关注 B 上行；低 RTT（往返时间）不能代替吞吐量测量。代理条目或对应统计可以补充“实际用了代理”的证据，配置开关本身只说明意图。

对比时固定非敏感文件和两端环境，多次做有界测量，每次只改一项并保留恢复办法。不要把同时换传输、开启代理、改 MTU（最大传输单元）之后的速度差归因给某一个协议。本篇不执行读者网络上的测试，也不向文档保留地址发包。

## 进阶阅读：可靠性不等于无限加速

<details class="advanced">
<summary>重传策略与拥塞条件怎样影响体验</summary>

内层 TCP、KCP 或 QUIC 通过确认和重传处理丢失，但各自发送节奏、窗口、定时器及拥塞策略不同。更积极地补发可能减少某些随机丢包造成的等待，也可能在容量已满时增加拥塞；对短交互和长文件的影响也不同。

v2.6.4 的 KCP 代理构造了特定配置，QUIC 隧道也有 BBR（瓶颈带宽与往返传播时间）拥塞控制等实现参数。源码默认是比较依据，不是对任意路径速度的保证。多路复用只能解决相应流之间的某些等待，无法取消共同底层的带宽瓶颈。

</details>

## 常见误解

“开代理能打通被完全封禁的底层协议”遗漏了搬运路径仍需可达；“QUIC 自动让浏览器使用 HTTP/3”混淆了应用与节点传输；“FakeTCP 就是更快的标准 TCP”混淆了特殊报文语义；“WireGuard 和 Noise 都出现，所以所有连接都是 WireGuard”则把共享密码学思想当成相同线上协议。

## 两道练习与答案

1. 节点当前通过 `tcp://` 中继，开启 KCP TCP 流代理后下载变快。能否说“改成了 KCP 隧道并成功 UDP 打洞”？

<details class="answer">
<summary>查看第 1 题答案</summary>

不能。KCP 代理位于 TCP 流搬运层，外层仍可能是 TCP 中继；速度变化也需要对照才能归因。要证明直连或 UDP，需另外检查该目标的实际路径与相邻连接。

</details>

2. QUIC 有多流能力，为什么一条 EasyTier 分帧流仍可能等待前面的丢失数据？

<details class="answer">
<summary>查看第 2 题答案</summary>

QUIC 可靠流在流内仍保证有序交付。不同流之间的隔离，不会把一条流自身的顺序要求取消；需要看实现把数据怎样分配到流上。

</details>

## 来源：固定版本源码与通用规范

- [v2.6.4 传输枚举与 feature 条件](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/tunnel/mod.rs)、[Cargo 特性](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/Cargo.toml)。
- [v2.6.4 TCP](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/tunnel/tcp.rs)、[UDP](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/tunnel/udp.rs)、[WS/WSS](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/tunnel/websocket.rs)、[TLS 策略](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/tunnel/insecure_tls.rs)。
- [v2.6.4 QUIC 隧道](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/tunnel/quic.rs)、[WireGuard](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/tunnel/wireguard.rs)、[FakeTCP](https://github.com/EasyTier/EasyTier/tree/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/tunnel/fake_tcp)。
- [v2.6.4 KCP 代理](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/gateway/kcp_proxy.rs)、[QUIC 代理](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/gateway/quic_proxy.rs)、[TCP 代理](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/gateway/tcp_proxy.rs)。
- [RFC 9293：TCP](https://www.rfc-editor.org/rfc/rfc9293)、[RFC 6455：WebSocket](https://www.rfc-editor.org/rfc/rfc6455)、[RFC 9000：QUIC](https://www.rfc-editor.org/rfc/rfc9000)、[RFC 9002：QUIC 丢失检测与拥塞控制](https://www.rfc-editor.org/rfc/rfc9002)、[KCP 项目说明](https://github.com/skywind3000/kcp)、[WireGuard 协议说明](https://www.wireguard.com/protocol/)。

最后进入[抓包与排障](/internals/observability)，把每一层的说法变成可检查的证据。
