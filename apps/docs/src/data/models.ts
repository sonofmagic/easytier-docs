export type JourneyMode = 'direct' | 'relay'
export type NatPreset = 'open' | 'bilateral' | 'dependent'
export type RouteMetric = 'hops' | 'latency'

export interface JourneyStep {
  title: string
  detail: string
  at: 'A' | 'B' | 'R'
  direction: 'request' | 'response'
  innerSource: string
  innerTarget: string
  outerSource: string
  outerTarget: string
  encrypted: boolean
}

/** A deterministic teaching trace, not a real network or an encryption engine. */
export function createJourney(mode: JourneyMode): JourneyStep[] {
  const steps: JourneyStep[] = []
  for (const direction of ['request', 'response'] as const) {
    const outbound = direction === 'request'
    const from = outbound ? 'A' : 'B'
    const to = outbound ? 'B' : 'A'
    const innerSource = outbound ? '10.144.144.1:53124' : '10.144.144.2:8080'
    const innerTarget = outbound ? '10.144.144.2:8080' : '10.144.144.1:53124'
    const source = outbound ? '198.51.100.10:31000' : '203.0.113.20:32000'
    const target = outbound ? '203.0.113.20:32000' : '198.51.100.10:31000'
    function add(title: string, detail: string, at: 'A' | 'B' | 'R', outerSource = '—', outerTarget = '—', encrypted = false) {
      steps.push({ title, detail, at, direction, innerSource, innerTarget, outerSource, outerTarget, encrypted })
    }
    add(outbound ? 'A 发出业务请求' : 'B 发出业务响应', '应用使用 TCP。这里追踪其中一个 IP 包；完整 HTTP 请求通常包含许多包。', from)
    add('系统路由选择 TUN', '目的虚拟 IP 命中 EasyTier 网段路由，操作系统把内层 IP 包交给虚拟网卡。', from)
    add('EasyTier 读取并封装', 'EasyTier 根据目的节点选路。本模型使用已建立的 UDP 隧道与安全模式会话；加密内层数据。', from, source, mode === 'relay' ? '192.0.2.10:11010' : target, true)
    add('物理网络传输', '外层端点用于互联网传输。公网地址由 NAT 映射得到，虚拟 IP 留在隧道内部。', from, source, mode === 'relay' ? '192.0.2.10:11010' : target, true)
    if (mode === 'relay') {
      add('R 转发给目标节点', 'R 使用另一条隧道转发。外层端点改变，内层业务目标保持一致；安全模式下 R 不能解密端到端业务负载。', 'R', '192.0.2.10:11010', target, true)
    }
    add('对端验证并解封装', '目的节点验证会话数据、解密并取出原始 IP 包。教学视图始终显示内层字段，不能据此推断中继能读取它们。', to, mode === 'relay' ? '192.0.2.10:11010' : source, target, false)
    add('写回 TUN，交给系统', '系统收到面向本机虚拟 IP 的 TCP 包，按目标端口把它交给对应套接字。', to)
    add(outbound ? 'B 的 8080 服务收到请求' : 'A 的应用收到响应', outbound ? '服务生成响应；回程同样需要路由、隧道和可达路径。点击下一步观察返回过程。' : '回程完成。业务源与目标已经交换；互联网仍只负责送达外层包。', to)
  }
  return steps
}

export const natPresets: { id: NatPreset, title: string, mapping: string, filtering: string }[] = [
  { id: 'open', title: '容易建立直连', mapping: '同一本地 UDP 端点复用外部端口', filtering: '允许来自任意远端的入站包' },
  { id: 'bilateral', title: '需要双方发包', mapping: '同一本地 UDP 端点复用外部端口', filtering: '只允许本地曾发包的远端端点' },
  { id: 'dependent', title: '固定端点探测失败', mapping: '换一个目的端点，就分配另一个外部端口', filtering: '每条映射只接受对应远端的回包' },
]

export interface NatEntry { node: string, inside: string, outside: string, destination: string, allowed: string }
export function natSnapshot(preset: NatPreset, step: number) {
  const stage = Math.max(0, Math.min(5, Math.trunc(step)))
  const entries: NatEntry[] = []
  const filtered = preset !== 'open'
  const dependent = preset === 'dependent'
  if (stage >= 1) {
    for (const [node, inside, outside] of [
      ['A', '192.168.10.20:40000', '198.51.100.10:31000'],
      ['B', '192.168.20.30:40000', '203.0.113.20:32000'],
    ]) {
      entries.push({ node: node!, inside: inside!, outside: outside!, destination: dependent ? 'STUN' : '可复用映射', allowed: filtered ? 'STUN' : '任意远端' })
    }
  }
  if (stage >= 3) {
    if (dependent) {
      entries.push({ node: 'A', inside: '192.168.10.20:40000', outside: '198.51.100.10:31001', destination: 'B 的已知端点 :32000', allowed: '203.0.113.20:32000' })
    }
    else if (filtered) {
      entries[0]!.allowed += '、B :32000'
    }
  }
  if (stage >= 4) {
    if (dependent) {
      entries.push({ node: 'B', inside: '192.168.20.30:40000', outside: '203.0.113.20:32001', destination: 'A 的已知端点 :31000', allowed: '198.51.100.10:31000' })
    }
    else if (filtered) {
      entries[1]!.allowed += '、A :31000'
    }
  }
  const titles = ['尚未探测', '向 STUN 发包', '通过已知节点交换端点', 'A 向 B 探测', 'B 向 A 探测', '重试并观察结果']
  const details = [
    '两台设备在不同私网。映射表暂为空；先预测一下 A 单方面发包能否到达 B。',
    'A、B 都主动向 STUN 发包。STUN 报告自己看到的外部地址和端口；它不会替两台设备打开防火墙。',
    '双方经可达节点交换 STUN 观察到的 :31000 与 :32000。这里不让浏览器真的访问网络。',
    dependent ? 'A 换目的端点后，新映射变成 :31001；发往 B 的旧 :32000 映射，被只允许 STUN 的过滤条件拒绝。' : filtered ? 'A 已允许 B 回包，但 B 尚未向 A 发包，因此 B 的过滤规则拒绝 A 的第一次探测。' : '映射复用且过滤允许任意远端，A 的探测到达 B。',
    dependent ? 'B 也创建 :32001 新映射；探测仍发往 A 的旧 :31000。旧映射只接受 STUN，固定端点探测仍失败。' : 'B 主动向 A 发包。A 已向 B 发过包，因此回包获准；B 的过滤状态也开始允许 A。',
    dependent ? '当前固定端点模型未形成双向直连，可选择中继。真实 EasyTier 还可能尝试其他策略，不能推导出“这种网络必然无法打洞”。' : 'A 重试探测后，两侧映射和过滤条件都满足，模型中的双向通信成立。真实网络还需路由、防火墙和链路可用。',
  ]
  return { stage, title: titles[stage]!, detail: details[stage]!, entries, result: stage === 5 ? (dependent ? '当前探测失败，可中继' : '模型中双向直连成功') : '探测进行中', aToB: stage >= (preset === 'open' ? 3 : 5) && !dependent, bToA: stage >= 4 && !dependent }
}

export const links = [
  { id: 'AB', a: 'A', b: 'B', latency: 80 },
  { id: 'AC', a: 'A', b: 'C', latency: 15 },
  { id: 'CB', a: 'C', b: 'B', latency: 15 },
  { id: 'AR', a: 'A', b: 'R', latency: 20 },
  { id: 'RB', a: 'R', b: 'B', latency: 20 },
] as const

/** Enumerate simple paths in a four-node graph; deterministic tie-breaks. */
export function choosePath(enabled: readonly string[], metric: RouteMetric) {
  const paths: { nodes: string[], edges: string[], latency: number }[] = []
  function walk(node: string, nodes: string[], edges: string[], latency: number) {
    if (node === 'B') {
      paths.push({ nodes, edges, latency })
      return
    }
    for (const link of links) {
      if (!enabled.includes(link.id)) {
        continue
      }
      const next = link.a === node ? link.b : link.b === node ? link.a : undefined
      if (next && !nodes.includes(next)) {
        walk(next, [...nodes, next], [...edges, link.id], latency + link.latency)
      }
    }
  }
  walk('A', ['A'], [], 0)
  paths.sort((a, b) => (metric === 'hops' ? a.edges.length - b.edges.length || a.latency - b.latency : a.latency - b.latency || a.edges.length - b.edges.length) || a.nodes.join('').localeCompare(b.nodes.join('')))
  return paths[0] ?? null
}
