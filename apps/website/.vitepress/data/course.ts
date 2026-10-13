export const chapters = [
  ['01-why', 'EasyTier 解决什么问题', '两台电脑都能上网，为什么却不能互访？'],
  ['02-packets', '请求怎样变成数据包', '沿着应用、操作系统、网卡追踪请求。'],
  ['03-addresses', 'IP、子网和 CIDR', '区分公网、私网、接口地址和网段。'],
  ['04-protocols', '端口、TCP、UDP、ICMP', '区分业务协议与隧道协议。'],
  ['05-routing', '网关、ARP、路由表与回程', '下一跳与最长前缀匹配。'],
  ['06-nat', 'NAT、过滤与防火墙', '为什么向外能连，别人却连不进来。'],
  ['07-tun', '虚拟网络与 TUN', '系统怎样把数据交给 EasyTier。'],
  ['08-startup', 'EasyTier 节点怎样启动', '配置、网卡、监听与初始连接。'],
  ['09-membership', '节点怎样入网', '引导、网络身份与信息同步。'],
  ['10-stun', 'STUN 怎样发现外部端点', '从外部观察地址，认识探测边界。'],
  ['11-hole-punch', 'UDP 打洞逐步推演', '双方发包怎样改变 NAT 状态。'],
  ['12-security', '封装、加密和身份验证', '分清机密性、身份和授权。'],
  ['13-relay', '直连失败后的中继', '共享节点、多跳与去中心化。'],
  ['14-topology', '拓扑与选路', '链路变化时，寻找另一条路径。'],
  ['15-journey', '完整追踪一次请求', '走完内层 IP 包的去程与回程。'],
  ['16-subnet-proxy', '访问远端整个局域网', '子网代理与回程。'],
  ['17-apps-dns', 'IP 通了仍打不开应用', 'DNS、监听与业务权限。'],
  ['18-performance', '性能为什么受限', '带宽、延迟、丢包与 MTU。'],
  ['19-diagnostics', '读状态并逐层排查', '用 node、peer、route 解释证据。'],
  ['20-practice', '综合练习与可选真实实验', '从模型走到两台真实设备。'],
] as const

export const stages = [
  { title: '先看懂网络', range: '01—06', start: 0, end: 6, goal: '知道数据往哪里走，也知道为什么可能被挡住。' },
  { title: '理解 EasyTier', range: '07—14', start: 6, end: 14, goal: '把网卡、发现、打洞、加密和路由连成一个系统。' },
  { title: '跟随一次通信', range: '15—18', start: 14, end: 18, goal: '追踪完整数据流，再看子网、应用和性能。' },
  { title: '用证据验证', range: '19—20', start: 18, end: 20, goal: '解释状态、定位故障，选择做真实实验。' },
] as const

export function chapterLink(slug: string) {
  return `/chapters/${slug}`
}

/** Search serializes this function: keep its body self-contained. */
export function tokenize(text: string): string[] {
  const tokens = new Set<string>()
  for (const run of text.toLowerCase().match(/\p{Script=Han}+|[a-z0-9_]+/gu) ?? []) {
    if (/\p{Script=Han}/u.test(run)) {
      const chars = Array.from(run)
      for (let i = 0; i < chars.length; i++) {
        tokens.add(chars[i]!)
        if (i + 1 < chars.length) {
          tokens.add(chars[i]! + chars[i + 1]!)
        }
      }
    }
    else {
      tokens.add(run)
    }
  }
  return [...tokens]
}
