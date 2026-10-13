---
title: 20 · 模拟复习与可选两机实践
description: 先完成三个浏览器模型，再用固定 v2.6.4 预编译程序进行可收尾的双机 HTTP 验证。
---

# 20 · 模拟复习与可选两机实践

## 先回答原理，再决定是否动手

读完前面的章节，目标不是记住一串启动参数，而是能解释 A 的包为什么进入 TUN、NAT 打洞改变了什么、直连失败时数据由谁搬运，以及 B 的服务为什么还需要监听和回程。

先进入[三个浏览器演示](/labs)，依次完成 NAT 打洞、拓扑选路、完整请求路径。让打洞失败一次，说明为什么转向中转；断开一条链路，说明选路如何变化；再走完去程与回程，指出内层和外层地址。演示不访问你的路由器、不创建虚拟网卡，也不证明真实设备已互通。

以下真实实验完全可选，需要两台由你管理且允许联网的设备。本网站不会替你执行这些命令。贯穿案例的物理地址 A `192.168.10.20`、B `192.168.20.30` 只用于理解，实际环境可能不同；虚拟地址采用 A `10.144.144.1`、B `10.144.144.2`。R 的虚拟地址 `10.144.144.254` 是模型标记，不要求公共节点也使用它。

公网教学地址 `198.51.100.10`、`203.0.113.20`、`192.0.2.10` 是保留文档地址，不能执行。下面的 `REPLACE_WITH_…` 也都是占位符，必须替换；相同的网络名、长随机密钥要在两机保持一致，不能把示例文字当成真实密钥。

## 准备：固定版本，保留现状

本章依据 EasyTier **v2.6.4**，不要混用主分支或随时变化的 latest 安装脚本。到[固定版本发布页](https://github.com/EasyTier/EasyTier/releases/tag/v2.6.4)下载命令行预编译 ZIP，按操作系统和 CPU 架构选择，解压后进入含有 core 与 CLI 的目录。

| 系统    | 已核实的预编译下载                                                                                                                                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS   | [Apple Silicon / aarch64](https://github.com/EasyTier/EasyTier/releases/download/v2.6.4/easytier-macos-aarch64-v2.6.4.zip) · [Intel / x86_64](https://github.com/EasyTier/EasyTier/releases/download/v2.6.4/easytier-macos-x86_64-v2.6.4.zip) |
| Windows | [x86_64](https://github.com/EasyTier/EasyTier/releases/download/v2.6.4/easytier-windows-x86_64-v2.6.4.zip) · [ARM64](https://github.com/EasyTier/EasyTier/releases/download/v2.6.4/easytier-windows-arm64-v2.6.4.zip)                         |
| Linux   | [x86_64](https://github.com/EasyTier/EasyTier/releases/download/v2.6.4/easytier-linux-x86_64-v2.6.4.zip) · [aarch64](https://github.com/EasyTier/EasyTier/releases/download/v2.6.4/easytier-linux-aarch64-v2.6.4.zip)                         |

Linux/macOS 创建 TUN 通常需要管理员权限；Linux 还需可用的 `/dev/net/tun`。Windows 在管理员 PowerShell 中运行，并保留压缩包随附文件。macOS 如果拦截下载程序，应按系统提示核验来源并单独允许，避免全局关闭系统保护。

先确认两机没有占用这些虚拟地址、没有与实验网段冲突的既有网络，也没有另一实例占用管理端口。记录原有接口和路由，只为需要的来源、程序与端口添加允许规则，不全局关闭防火墙。B 需要已安装 Python 3，并准备一个只含非敏感测试文件的空实验目录。

Linux/macOS 先检查版本；Windows 用 `.\easytier-core.exe --version`：

```bash
./easytier-core --version
```

若 Linux/macOS 报没有执行权限，先确认解压出的文件确实来自所选官方资产，再只为这两个实验程序增加执行权限。第一次接触时，优先让两机在同一可控 LAN 下验证，然后再换成跨网络条件；这样可以把程序、权限与服务问题，同远端入口和 NAT 问题分开观察。每次换网络仍要重新记录目标端点与路径，不能沿用上一次成功的结论。

## 启动：选择一种能达到初始节点的条件

**条件一：B 能访问 A 的真实 TCP 端点。** 可以是同 LAN 的地址，也可以是已正确放行或映射的公网端点。B 在另一个 LAN 时，不能直接照抄 A 的 `192.168.10.20`。在 Linux/macOS 的两个终端分别运行：

```bash
# A：保持前台运行
sudo ./easytier-core -i 10.144.144.1 --network-name "REPLACE_WITH_UNIQUE_NETWORK_NAME" --network-secret "REPLACE_WITH_LONG_RANDOM_SECRET" --listeners "tcp://0.0.0.0:11010" --rpc-portal "127.0.0.1:15888"

# B：替换为 B 真正可达的 A 地址，保持前台运行
sudo ./easytier-core -i 10.144.144.2 --network-name "REPLACE_WITH_UNIQUE_NETWORK_NAME" --network-secret "REPLACE_WITH_LONG_RANDOM_SECRET" -p "tcp://REPLACE_WITH_A_REACHABLE_HOST:11010" --rpc-portal "127.0.0.1:15888"
```

Windows 在管理员 PowerShell 中分别使用下面命令，端点条件相同：

```powershell
# A
.\easytier-core.exe -i 10.144.144.1 --network-name "REPLACE_WITH_UNIQUE_NETWORK_NAME" --network-secret "REPLACE_WITH_LONG_RANDOM_SECRET" --listeners "tcp://0.0.0.0:11010" --rpc-portal "127.0.0.1:15888"

# B
.\easytier-core.exe -i 10.144.144.2 --network-name "REPLACE_WITH_UNIQUE_NETWORK_NAME" --network-secret "REPLACE_WITH_LONG_RANDOM_SECRET" -p "tcp://REPLACE_WITH_A_REACHABLE_HOST:11010" --rpc-portal "127.0.0.1:15888"
```

**条件二：两机都没有彼此可达的初始端点。** 阅读[当前官方共享节点组网指南](https://easytier.cn/guide/network/quick-networking.html)，自行选定可信、当前可达且允许共享网络接入的 TCP 节点，或使用你已有的自建公网共享节点。该指南说明配置方式，并非可用节点列表，不能把其中占位符当作地址。核对节点的完整地址、端口与说明后，给上面的 A 命令末尾增加下面参数，把 B 原有的 `-p` 参数替换为同一个完整端点；A、B 的网络名和密钥仍相同。此代码块仅是参数片段：

```text
-p "tcp://REPLACE_WITH_SHARED_HOST:REPLACE_WITH_SHARED_PORT"
```

连接公共节点只是建立初始入口。A、B 后续可能尝试 UDP 打洞，TCP 入口成功不能证明 UDP 直连成功。不要把公共节点的可用性或中转容量当成永久保证；若仅中转可用，实验仍可验证虚拟地址和 HTTP，但结论必须如实记录。

## 验证：目标节点、HTTP 与实际路径

```mermaid
flowchart LR
  Start["两机 core 前台启动"] --> Peer["查询目标 B 与路由"]
  Peer --> Local["B 启动并自测 HTTP 8080"]
  Local --> Remote["A 访问 B 虚拟 IP"]
  Remote --> Record["记录 HTTP 与目标 B 的路径"]
  Record --> Clean["Ctrl+C 停止；核对接口、路由与进程"]
```

在另一个终端查询 `./easytier-cli node`、`./easytier-cli peer`、`./easytier-cli route`；Windows 对应 `.\easytier-cli.exe`。确认虚拟地址是计划值，目标 B 的那一行存在。显示 `p2p` 或 `relay(2)` 都可能正常；后者的 n 是路径 cost，不是中转节点数量。

B 确认虚拟网卡已出现后，在准备好的测试目录开启服务。绑定虚拟地址避免默认把目录开放到所有 IPv4 接口：

```bash
# B，Linux/macOS
python3 -m http.server 8080 --bind 10.144.144.2
```

```powershell
# B，Windows；已安装 Python 3 启动器时
py -3 -m http.server 8080 --bind 10.144.144.2
```

B 先访问 `http://10.144.144.2:8080/` 自测，再由 A 用浏览器访问同一地址，或在 Linux/macOS 用 `curl -v http://10.144.144.2:8080/`、Windows 用 `curl.exe -v http://10.144.144.2:8080/`。看到目录页或测试文件，并在 B 日志看到请求，才是应用层验证。

“HTTP 200”“B 行 p2p”“B 行 relay(2)”都是**预期结果示例，不是本站实测**。记录你实际看到的结果；公共节点那行 p2p 不证明 A、B 直连。若失败，按[第 19 章](/chapters/19-diagnostics)定位，不跳过本地自测。

## 收尾与常见误解

在 Python 服务终端按 Ctrl+C，再在两机 core 终端按 Ctrl+C，等待正常退出。检查实验进程已结束、临时虚拟接口和它添加的路由已撤除，8080 不再监听。只撤销自己为实验新增的防火墙、端口映射或路由规则，保留原有配置；若有残留，记录对应接口、规则和进程后定向处理，不清空全部路由或批量终止同名进程。

本实验没有安装系统服务、没有设置出口节点、没有开启魔法 DNS。若你自行增加这些功能，收尾还应核对服务自启动、默认路由和 DNS 改动。退出成功不代表所有手工配置自动恢复。

一次实验成功证明的是当前设备、当前配置、当前路径下的具体访问。它不保证换网络后仍然打洞成功，也不保证远端 LAN 自动可达。两机版本、操作系统与权限差异都应写入记录，而不是隐藏在“EasyTier 很简单”的结论里。

## 练习与答案

1. 公共节点 TCP 入口连接成功，A、B 的目标行仍为中转，这次实验算完全失败吗？能证明 UDP 直连吗？

<details>
<summary>第 1 题参考答案</summary>

不算完全失败。如果 HTTP 成功，已经验证该中转路径下的应用访问；但不能证明 UDP 直连，要按实际目标状态记录。

</details>

2. 退出 core 后，曾手工添加的端口映射还存在。应该清空路由器配置还是只撤销实验规则？

<details>
<summary>第 2 题参考答案</summary>

只撤销已记录、确认由自己为实验新增的规则，并核对结果。core 的退出无法自动清理你在外部设备上做的手工修改。

</details>

## 来源与继续学习

- [v2.6.4 发布资产](https://github.com/EasyTier/EasyTier/releases/tag/v2.6.4)、[固定版 README](https://github.com/EasyTier/EasyTier/blob/v2.6.4/README.md)、[CLI 参数定义](https://github.com/EasyTier/EasyTier/blob/v2.6.4/easytier/src/core.rs)与[参数说明](https://github.com/EasyTier/EasyTier/blob/v2.6.4/easytier/locales/app.yml)：版本、权限、端点与命令依据。
- [Python http.server 文档](https://docs.python.org/3/library/http.server.html)：临时服务及绑定地址参数，不应作为生产服务。
- [当前官方共享节点组网指南](https://easytier.cn/guide/network/quick-networking.html)与[自建共享节点指南](https://easytier.cn/guide/network/host-public-server.html)：提供配置方式；具体可用入口需自行核实。

已有 GUI 组网时，也可以先读[实机案例：读懂已有 GUI 组网](/cases/local-gui)。该案例使用运行中的 Mac 网络，完成目标路由与四次 ICMP 探测，和本章可选的双机 HTTP 实验分别记录。

需要回查概念时打开[术语表](/glossary)，需要核对事实时打开[来源与版本说明](/sources)。
