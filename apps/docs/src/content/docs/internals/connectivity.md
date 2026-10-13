---
title: 进阶 3 · 节点怎样认识彼此并建立连接
description: 按启动、引导、内部 RPC、候选端点、双向打洞、握手、保活和中继解释 v2.6.4 的控制面。
---

## 导读：有联系地址，不等于已经能联系

数据面负责搬业务包，**控制面**负责让节点知道谁存在、有哪些路径、哪些端点值得尝试。先读[协议地图](/internals/protocol-map)、[第 11 章：打洞](/chapters/11-hole-punch)和[第 14 章：拓扑与选路](/chapters/14-topology)。这一篇把那些零散动作串成一段生命周期，依据 **EasyTier v2.6.4** 的实现说明。

A 的虚拟 IP 为 `10.144.144.1`，B 为 `10.144.144.2`，R 为 `10.144.144.254`。虚拟地址让应用选目标；`198.51.100.10:31000` 这样的底层端点让 EasyTier 尝试建立相邻连接。后者是文档保留地址，只作图示。

## 第一步：启动把本机条件准备好

节点读取配置，建立管理与节点处理模块，根据模式准备 TUN（系统与隧道程序交接 IP 包的虚拟接口）、地址、监听和连接任务。监听表示有程序准备接收某种底层协议，不表示远端已经能到达这个端口。运行中的进程、成功创建的网卡和第一条有效节点连接，是三个不同观察。

本地虚拟地址可以显式配置，也可使用 EasyTier 的 `--dhcp` 自动选择。v2.6.4 的实现会参考已知成员使用的地址并检测冲突；它不是在整个覆盖网络广播普通 LAN DHCP（动态主机配置协议）报文的二层桥。地址变更也会影响已有路由与连接，不能把“自动分配”理解成永久不变。

## 第二步：先连入口，才能交换更多信息

A 配置了 R 的连接地址，先通过原有网络联系 R，完成底层隧道和 EasyTier 握手。若 URL 使用名称，DNS（域名系统）解析属于这一阶段的一个前提。连接器的 HTTP、TXT、SRV 等入口可以用于取得连接信息，不能把它们都当成持续搬运包的隧道协议。

有了已有连接，节点便能交换成员、特征、地址候选和拓扑等信息。RPC（远程过程调用）可以直觉理解成“把带参数的请求交给对方服务，并等待回答”，例如请求对方提供可尝试的 IP 和监听信息，或协调发送打洞包。

**内部节点 RPC**通过覆盖网络服务协作；CLI 查询 core 的**本机管理 RPC**则是另一条管理接口。管理查询失败，不直接证明远端业务隧道失败；管理接口也不是 B 的 TCP 8080 服务。

**图 1 · 一条连接是被建立、观察并维护的状态**

![从本机启动到入口连接、成员发现、候选交换、直连尝试、握手和可用状态；失败可保留中继路径，换网或超时会触发重新观察与建链。](/diagrams/connection-lifecycle.svg)

[打开可缩放的 SVG 原图](/diagrams/connection-lifecycle.svg)

**阅读顺序：**沿启动到可用的实线看必要交接，再沿失败和换网的分支看后续动作。**结论：**发现成员、传输可达、身份握手与业务成功是不同阶段；控制面在业务开始后仍持续工作。

## 第三步：候选端点来自不同证据

可尝试的端点可能包括：对方公布的 LAN（局域网）地址及监听端口、可用公网 IPv6 地址、STUN 观测的外部地址、网关辅助建立的映射等。候选意味着“准备试”，不是“已经验证”。

STUN（NAT 会话穿越工具）服务器收到请求后，把观察到的源地址端口放进回应。这个服务器没有登录路由器；返回的是一次外部观察。NAT（网络地址转换）的**映射**回答源地址端口怎样换，**过滤**回答哪些外部来源允许进入，两者要分开看。

UPnP（通用即插即用）和 NAT-PMP（NAT 端口映射协议）则可请求支持的本地网关建立端口映射。v2.6.4 的辅助模块管理租期与续期，并向后续建链提供映射信息。它不能配置不受本机控制的运营商上游 NAT；本地网关答应映射，也不等于全路径已通。

**图 2 · 候选要同时满足地址、过滤和时间条件**

![A 使用本地 UDP 40000 向 STUN 发送时，被观察为外部端口 31000；向 B 的 32000 发送时却可能映射为 31001。图中将 NAT 映射与过滤列为独立条件。](/diagrams/nat-candidates.svg)

[打开可缩放的 SVG 原图](/diagrams/nat-candidates.svg)

**阅读顺序：**先比较 STUN 与 B 两个目的地，再看映射和过滤两列，最后看状态过期。**结论：**“端点被发现”与“对方能从这里进来”是不同命题；更换目的地或时间，条件可能变化。

## 第四步：双方探测为直接连接创造条件

假设映射能够复用，但两侧过滤都要求本机先向某个远端发过包。A 向 B 候选端点发送 UDP（用户数据报协议）探测，可能使 A 侧开始允许 B 返回。首包在 B 侧被丢弃，不代表 A 侧的动作无用。

B 随后向 A 发送，补齐 B 侧状态；A 再重试，两个方向便可能通过。关键条件还包括正确端点、匹配的协议与 socket（系统提供给程序的通信入口）、未过期状态以及可用链路。若 A 向 B 时换了外部端口，B 仍向旧端口发送，双方再积极也可能碰不到正确入口。

v2.6.4 不是只把一个 STUN 地址告诉对方就结束：UDP 打洞模块针对观测组合使用不同策略，包括锥型、对称型到锥型、部分可预测对称型组合，必要时尝试多个端口。TCP（传输控制协议）打洞另有实现，不能照搬 UDP 的报文时序。NAT 类型名只是策略输入之一，不是成功保证。

这种过程与 ICE（交互式连接建立）的“候选与检查”概念有相似之处，但不能因此宣称 EasyTier v2.6.4 使用标准 ICE，或将其报文当成浏览器 WebRTC 的 ICE 交换。

## 第五步：可达之后仍需握手、选路和维护

底层能交换报文之后，EasyTier 还需识别节点、核对网络身份并建立可使用的连接。普通模式与 `secure_mode` 的认证路径不同，详见[安全与身份](/internals/security)。打洞包到了，不等于安全握手成功；安全握手成功，也不等于 B 已监听 HTTP 服务。

如果没有 A—B 直接连接，但 A—R—B 允许转发，数据面可以使用中继。已有入口可能兼任中继，也可能只承担引导作用；不能因为入网时联系了 R，就认定每次业务都经它。

节点通过拓扑同步和路径计算选择下一跳。链路关闭、延迟变化、网络政策或模式会影响选择，收敛不是图上瞬间变色。连接 Ping/Pong 与业务流量统计帮助观察活性和延迟，并在状态丢失时关闭连接或重试；这里的 EasyTier Ping 包不等于操作系统 ICMP ping。

## 怎样观察与定位阶段

按时间记录四列：本机运行和监听；到入口 R 的连接；目标 B 的路由和直接关系；实际业务访问。B 已出现在路由信息中，只说明控制面知道它，不能跳过到 B 的路径检查。B 当前 `p2p` / UDP 又只说明该目标当时的连接与路径，不会证明最初采用了哪个打洞算法。

日志若显示名称解析、连接超时、网络身份不匹配或安全握手失败，分别归回对应阶段。不要用“都叫连接失败”掩盖第一个明确错误。没有抓包和对应日志时，应写“当前直连存在，建立过程未知”，而不是倒推出特定 STUN 请求或端口预测。

## 进阶阅读：从服务到包型

<details class="advanced">
<summary>源码怎样把控制面接到已有隧道上</summary>

`direct.rs` 的服务请求对方提供 IP 列表、监听候选等信息；UDP 打洞 RPC 负责选择监听与协调探测。`peer_rpc.rs` 及 `peer_rpc_service.rs` 负责内部请求响应的承载。`peer_ospf_route.rs` 使用内部拓扑数据和图算法计算路径，通过自己的 RPC 同步信息。

虽然模块叫 OSPF（开放最短路径优先），它不是将 EasyTier 直接注册成标准 OSPF 路由器；不能把 RFC 2328 的报文格式、区域配置或路由器互通当作此实现的既有行为。阅读时区分标准提供的思想与源码实际采用的私有接口。

`peer_conn_ping.rs` 的探测频率会参考流量和丢失状态，不宜把图解里的固定时间间隔当成真实抓包预期。`peer_manager.rs` 还会根据直连、跨网络入口及下一跳决定实际发送路径。

</details>

## 常见误解

“NAT 类型是 Symmetric，所以直连绝不可能”把观测分类当成定理。“有公网 IPv6，所以不需要打洞或允许规则”忽略了路由、防火墙与监听。“入口在线，所以 B 在线”把两个目标混为一谈。“直连失败，所以完全不能访问”遗漏允许的中继路径；反过来，中继存在也不保证应用服务正常。

## 两道练习与答案

1. STUN 观测 A 为 `198.51.100.10:31000`，A 发往 B 时却使用 31001。B 一直发往 31000，最先应检查哪个条件？

<details class="answer">
<summary>查看第 1 题答案</summary>

检查候选端点是否对应实际面向 B 的映射，以及对端过滤条件。旧 STUN 结果可以是真实的，却不适用于新目的地。重试次数不能代替端点匹配。

</details>

2. R 与 A、B 都有连接，A 的业务经 R 成功。能否证明 A—B 打洞失败，或证明 A—B 从未直连？

<details class="answer">
<summary>查看第 2 题答案</summary>

不能。你只观察到了这次选用中继的路径；可能尚未尝试、正在尝试、受政策限制或先前直连后来失效。需要同一目标、时间和相应过程证据才能区分。

</details>

## 来源：固定版本源码与通用规范

- [v2.6.4 启动与虚拟地址冲突检测](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/instance/instance.rs)、[监听](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/instance/listeners.rs)、[手动连接](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/connector/manual.rs)。
- [v2.6.4 直接连接候选](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/connector/direct.rs)、[STUN](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/common/stun.rs)、[UPnP / NAT-PMP](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/common/upnp.rs)。
- [v2.6.4 UDP 打洞](https://github.com/EasyTier/EasyTier/tree/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/connector/udp_hole_punch)、[TCP 打洞](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/connector/tcp_hole_punch.rs)、[内部 RPC](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/peers/peer_rpc.rs)、[内部路由](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/peers/peer_ospf_route.rs)、[连接探测](https://github.com/EasyTier/EasyTier/blob/8428a89d2dabc94c97d370ec607c6ca142473626/easytier/src/peers/peer_conn_ping.rs)。
- [RFC 8489：STUN](https://www.rfc-editor.org/rfc/rfc8489)、[RFC 4787：UDP NAT 行为要求](https://www.rfc-editor.org/rfc/rfc4787)、[RFC 6886：NAT-PMP](https://www.rfc-editor.org/rfc/rfc6886)、[RFC 8445：ICE](https://www.rfc-editor.org/rfc/rfc8445)：通用协议对照，不表示 EasyTier 对所有条款都作出了实现承诺。

下一篇[安全与身份](/internals/security)继续问：“路径通了，怎样确认另一端和值得允许的操作？”
