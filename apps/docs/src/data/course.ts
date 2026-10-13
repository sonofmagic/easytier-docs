export const chapters = [
  ['01-why', 'B 能打开自己的网页，为什么 A 不一定能', '两台电脑都能上网，为什么却不能互访？'],
  ['02-packets', '一次请求怎样交到另一个程序', '沿着应用、操作系统、网卡追踪请求。'],
  ['03-addresses', '电脑上的地址和地址范围', '区分公网、私网、接口地址和网段。'],
  ['04-protocols', '到了这台电脑，怎样找到正确程序', '用本机网页理解端口和正在等待请求的程序。'],
  ['05-routing', '系统怎样选择下一步，回应怎样回来', '知道请求交给谁，也检查回应能否回来。'],
  ['06-nat', '为什么出去容易，别人找进来却可能失败', '为什么向外能连，别人却连不进来。'],
  ['07-tun', '系统怎样把 IP 包交给 EasyTier', '系统怎样把数据交给 EasyTier。'],
  ['08-startup', '启动成功，还需要哪些条件', '配置、网卡、监听与初始连接。'],
  ['09-membership', '先认识入口，再认识彼此', '知道新节点怎样认识同一网络里的其他节点。'],
  ['10-stun', '请外部观察者告诉我地址', '从外部观察地址，认识探测边界。'],
  ['11-hole-punch', '双方发包，为什么可能连起来', '双方发包怎样改变 NAT 状态。'],
  ['12-security', '内容、身份与权限是三件事', '分清机密性、身份和授权。'],
  ['13-relay', '中继帮忙搬包，目标仍然是 B', '直接通道不可用时，请另一节点帮忙转交。'],
  ['14-topology', '有几条路，应该选哪一条', '链路变化时，寻找另一条路径。'],
  ['15-journey', '追踪一次完整请求', '走完内层 IP 包的去程与回程。'],
  ['16-subnet-proxy', '访问远端整个局域网', '子网代理与回程。'],
  ['17-apps-dns', '网络通了，应用为什么还不通', 'DNS、监听与业务权限。'],
  ['18-performance', '延迟、丢包与 MTU', '带宽、延迟、丢包与 MTU。'],
  ['19-diagnostics', '按层排查，而不是反复重装', '从 GUI 中一个目标开始，逐层收集证据。'],
  ['20-practice', '模拟复习与可选两机实践', '解释已观察到的现象，再选择真实两机验证。'],
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

export interface Lesson {
  route: string
  file: string
  title: string
  goal: string
  prerequisites: readonly string[]
  terms: readonly string[]
  kind: 'basics' | 'chapter'
}

export const basics: Lesson[] = [
  { route: '/basics/browser-and-programs', file: 'basics/browser-and-programs.md', title: '预备 1 · 浏览器、文件和运行中的程序', goal: '分清文件与服务，学会打开终端和进入实验目录。', prerequisites: [], terms: ['浏览器', '程序', '终端', '目录'], kind: 'basics' },
  { route: '/basics/local-webpage', file: 'basics/local-webpage.md', title: '预备 2 · 在自己电脑上打开一个网页', goal: '亲眼看到服务启动、收到请求和停止。', prerequisites: ['/basics/browser-and-programs'], terms: ['服务', '请求', '回应', '本机'], kind: 'basics' },
  { route: '/basics/read-a-url', file: 'basics/read-a-url.md', title: '预备 3 · 拆开一行网址', goal: '指出网址中的地址、端口和路径，理解 localhost。', prerequisites: ['/basics/local-webpage'], terms: ['IP', '端口', '路径', '回环', 'localhost'], kind: 'basics' },
  { route: '/basics/my-network', file: 'basics/my-network.md', title: '预备 4 · 找到自己电脑的网络地址', goal: '区分本机、原有网络和 EasyTier 虚拟地址。', prerequisites: ['/basics/read-a-url'], terms: ['网卡', '接口', '虚拟 IP', '路由器'], kind: 'basics' },
  { route: '/basics/observe-a-request', file: 'basics/observe-a-request.md', title: '预备 5 · 亲眼看请求和回应', goal: '从网络面板区分 200、404 与连接失败。', prerequisites: ['/basics/local-webpage', '/basics/read-a-url'], terms: ['HTTP', '状态码', '监听', '缓存'], kind: 'basics' },
]

const chapterPrerequisites = [
  ['/basics/local-webpage', '/basics/read-a-url'],
  ['/basics/browser-and-programs', '/chapters/01-why'],
  ['/basics/my-network', '/chapters/02-packets'],
  ['/chapters/03-addresses', '/basics/read-a-url'],
  ['/chapters/03-addresses', '/chapters/02-packets'],
  ['/chapters/04-protocols', '/chapters/05-routing'],
  ['/chapters/02-packets', '/chapters/05-routing'],
  ['/chapters/07-tun', '/basics/local-webpage'],
  ['/chapters/08-startup', '/chapters/03-addresses'],
  ['/chapters/06-nat', '/chapters/09-membership'],
  ['/chapters/06-nat', '/chapters/10-stun'],
  ['/chapters/09-membership', '/chapters/11-hole-punch'],
  ['/chapters/09-membership', '/chapters/12-security'],
  ['/chapters/05-routing', '/chapters/13-relay'],
  ['/chapters/07-tun', '/chapters/14-topology'],
  ['/chapters/05-routing', '/chapters/15-journey'],
  ['/basics/observe-a-request', '/chapters/15-journey'],
  ['/chapters/04-protocols', '/chapters/15-journey'],
  ['/chapters/17-apps-dns', '/chapters/18-performance'],
  ['/chapters/15-journey', '/chapters/19-diagnostics'],
] as const

const chapterTerms = [
  ['异地访问', '虚拟地址'],
  ['数据包', '操作系统'],
  ['子网', 'CIDR', '私网', '公网'],
  ['监听', 'TCP', 'UDP', 'ICMP'],
  ['网关', '路由', '回程'],
  ['NAT', '映射', '过滤', '防火墙'],
  ['TUN', 'Overlay', 'Underlay'],
  ['节点', '监听', '配置'],
  ['引导', '网络名称', '身份'],
  ['STUN', '端点'],
  ['打洞', '双向探测'],
  ['封装', '加密', '身份验证', '授权'],
  ['中继', '多跳'],
  ['邻居', '拓扑', '选路'],
  ['内层', '外层', '回程'],
  ['子网代理', '转发', 'SNAT'],
  ['DNS', '访问控制'],
  ['带宽', '延迟', '丢包', 'MTU'],
  ['peer', 'route', '证据'],
  ['复现', '验证边界'],
] as const

export const learningPages: Lesson[] = [
  ...basics,
  ...chapters.map(([slug, title, goal], index): Lesson => ({
    route: chapterLink(slug),
    file: `chapters/${slug}.${['11-hole-punch', '14-topology', '15-journey'].includes(slug) ? 'mdx' : 'md'}`,
    title: `${slug.slice(0, 2)} ${title}`,
    goal,
    prerequisites: chapterPrerequisites[index]!,
    terms: chapterTerms[index]!,
    kind: 'chapter',
  })),
]

export const sitePages = [
  { route: '/', file: 'index.mdx' },
  { route: '/course', file: 'course.mdx' },
  { route: '/labs', file: 'labs.mdx' },
  { route: '/glossary', file: 'glossary.md' },
  { route: '/sources', file: 'sources.md' },
  { route: '/cases/local-gui', file: 'cases/local-gui.md' },
  { route: '/basics', file: 'basics.md' },
  ...learningPages,
]
