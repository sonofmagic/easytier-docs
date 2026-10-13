export type OuterTransport = 'udp' | 'tcp'
export type EncapsulationLocation = 'A' | 'network' | 'B'
export type EncapsulationLayer = 'http' | 'tcp' | 'ip' | 'peer' | 'ciphertext' | 'outer-transport' | 'outer-ip'

export interface EncapsulationStep {
  id: string
  title: string
  detail: string
  at: EncapsulationLocation
  activeLayer: EncapsulationLayer
  encrypted: boolean
  hasInnerHeaders: boolean
  hasPeerHeader: boolean
  hasOuterHeaders: boolean
}

/** One illustrative request packet, with an established secure-mode session. */
export const encapsulationSteps: readonly EncapsulationStep[] = [
  { id: 'application', title: 'A 的应用生成 HTTP 请求', detail: 'HTTP（超文本传输协议）描述“我要哪个网页”。浏览器把请求字节交给已经连接的 TCP 套接字；这里用一小段 GET / 字节表示业务内容，并不表示完整请求只有一个包。', at: 'A', activeLayer: 'http', encrypted: false, hasInnerHeaders: false, hasPeerHeader: false, hasOuterHeaders: false },
  { id: 'inner-packet', title: '操作系统加上内层 TCP 与 IP', detail: 'TCP（传输控制协议）记录源端口与目标 8080 端口，IP（网际协议）记录 A、B 的虚拟地址。HTTP 字节在 TCP 内，TCP 段在 IP 包内；此时还没有互联网隧道头。', at: 'A', activeLayer: 'ip', encrypted: false, hasInnerHeaders: true, hasPeerHeader: false, hasOuterHeaders: false },
  { id: 'tun-send', title: '路由把内层 IP 包交给 A 的 TUN', detail: '系统发现目标虚拟地址应走 TUN（虚拟网络接口），EasyTier 从这里读取完整 IP 包。TUN 是交接接口，不是一种额外包头；路由到此并未把内层 TCP 改为 UDP。', at: 'A', activeLayer: 'ip', encrypted: false, hasInnerHeaders: true, hasPeerHeader: false, hasOuterHeaders: false },
  { id: 'encrypt', title: 'EasyTier 添加节点包头并加密负载', detail: 'EasyTier 用节点包头标识发送方、目的节点、类型等。本模型假定 A 与 B 已建立安全模式会话：把内层 IP 包作为负载加密。加密保护负载，不隐藏外层网络所需的全部元数据。', at: 'A', activeLayer: 'ciphertext', encrypted: true, hasInnerHeaders: true, hasPeerHeader: true, hasOuterHeaders: false },
  { id: 'wire', title: '外层隧道把密文送过物理网络', detail: '现在最外面是互联网 IP 和所选 TCP/UDP 传输，里面是 EasyTier 节点包头与密文。外层端口用于隧道，不是 B 的 8080 业务端口。公网端点是 NAT 映射后的教学示例，物理接口抓包的地址还取决于观察位置。', at: 'network', activeLayer: 'outer-transport', encrypted: true, hasInnerHeaders: true, hasPeerHeader: true, hasOuterHeaders: true },
  { id: 'unwrap', title: 'B 的隧道接收并取出 EasyTier 包', detail: 'B 的操作系统处理外层 IP 与 TCP/UDP，隧道实现恢复 EasyTier 包。外层封装已经取下，业务负载仍是密文；“收到隧道包”与“能够读取 HTTP”是两个阶段。', at: 'B', activeLayer: 'peer', encrypted: true, hasInnerHeaders: true, hasPeerHeader: true, hasOuterHeaders: false },
  { id: 'decrypt', title: 'B 验证会话数据，恢复内层 IP 包', detail: '目的节点 B 使用会话验证并解密负载。恢复后仍是原来的虚拟 IP、TCP 端口与 HTTP 字节；完整性验证失败的数据不会按正常业务包交付。此处恢复可读字段表示解密边界。', at: 'B', activeLayer: 'ip', encrypted: false, hasInnerHeaders: true, hasPeerHeader: true, hasOuterHeaders: false },
  { id: 'tun-receive', title: 'EasyTier 把原始 IP 包写回 B 的 TUN', detail: '交给 B 操作系统的是解密后的内层 IP 包，不带 EasyTier 节点包头或外层隧道头。系统按自己的虚拟地址和 TCP 套接字处理它。', at: 'B', activeLayer: 'tcp', encrypted: false, hasInnerHeaders: true, hasPeerHeader: false, hasOuterHeaders: false },
  { id: 'deliver', title: 'B 的 TCP 把请求字节交给 8080 服务', detail: 'B 的 TCP 重组有序字节流，HTTP 服务读取请求。图中的这一段字节最终到达同一个业务目标；TCP 建连、确认、重传、后续响应没有在这个单包模型中展开。', at: 'B', activeLayer: 'http', encrypted: false, hasInnerHeaders: true, hasPeerHeader: false, hasOuterHeaders: false },
]

export const innerRequest = Object.freeze({
  application: 'HTTP',
  transport: 'TCP',
  source: '10.144.144.1:53124',
  target: '10.144.144.2:8080',
  payload: 'GET / HTTP/1.1 …',
} as const)

export const outerEndpoints = Object.freeze({
  source: '198.51.100.10:31000',
  target: '203.0.113.20:32000',
})

export function clampEncapsulationStep(index: number): number {
  if (!Number.isFinite(index)) {
    return 0
  }
  return Math.max(0, Math.min(encapsulationSteps.length - 1, Math.trunc(index)))
}

export function moveEncapsulationStep(index: number, direction: -1 | 1): number {
  return clampEncapsulationStep(clampEncapsulationStep(index) + direction)
}

export interface EncapsulationViewLayer {
  id: EncapsulationLayer
  title: string
  detail: string
  active: boolean
}

/** A display projection: encrypted stages never expose plaintext inner fields. */
export function encapsulationSnapshot(index: number, transport: OuterTransport) {
  const stage = clampEncapsulationStep(index)
  const step = encapsulationSteps[stage]!
  const visibleInner = step.encrypted ? null : innerRequest
  const layers: EncapsulationViewLayer[] = []
  const add = (id: EncapsulationLayer, title: string, detail: string) => {
    layers.push({ id, title, detail, active: step.activeLayer === id })
  }

  if (step.hasOuterHeaders) {
    add('outer-ip', '外层 IP · 互联网送达', `${outerEndpoints.source.split(':')[0]} → ${outerEndpoints.target.split(':')[0]}`)
    add('outer-transport', `外层 ${transport.toUpperCase()} · 隧道传输`, `${outerEndpoints.source} → ${outerEndpoints.target}`)
  }
  if (step.hasPeerHeader) {
    add('peer', 'EasyTier 节点包头 · 节点间转交', '节点 A → 节点 B · Data · 加密标志随负载状态变化')
  }
  if (step.encrypted) {
    add('ciphertext', '加密负载 · 内层字段暂不可读', '内层 IP + TCP + HTTP → 密文；节点包头与外层端点仍用于送达')
  }
  else {
    if (step.hasInnerHeaders) {
      add('ip', '内层 IP · 虚拟网络目的', '10.144.144.1 → 10.144.144.2')
      add('tcp', '内层 TCP · 业务连接', `${innerRequest.source} → ${innerRequest.target}`)
    }
    add('http', 'HTTP · 应用字节', innerRequest.payload)
  }

  return {
    stage,
    step,
    transport,
    inner: innerRequest,
    visibleInner,
    layers,
    outer: step.hasOuterHeaders ? { ...outerEndpoints, transport } : null,
  }
}
