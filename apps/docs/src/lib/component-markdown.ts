import { basics, chapterLink, chapters, stages } from '../data/course'
import { choosePath, createJourney, links, natPresets, natSnapshot } from '../data/models'

function courseMarkdown() {
  return [
    '### 预备 1—5：先在本机看见',
    '',
    '从网页启停和界面读数开始，知道请求者、服务、地址、端口各是什么。',
    '',
    '[准备说明与实验包](/basics)',
    '',
    ...basics.map(lesson => `- [${lesson.title}](${lesson.route})：${lesson.goal}`),
    '',
    ...stages.flatMap(stage => [
      `### ${stage.range}：${stage.title}`,
      '',
      stage.goal,
      '',
      ...chapters.slice(stage.start, stage.end).map(([slug, title, description]) => `- [${slug.slice(0, 2)} ${title}](${chapterLink(slug)})：${description}`),
      '',
    ]),
  ].join('\n')
}

function homeMarkdown() {
  return [
    '先在自己的电脑上，看见一次网络请求。',
    '',
    '打开一个由自己电脑提供的网页，看它怎样回应、怎样失败。再一步步理解：EasyTier 如何把请求送到另一台电脑。',
    '',
    '[从本机预备课开始](/basics/browser-and-programs) · [直接进入第一章](/chapters/01-why)',
    '',
    '5 节预备课 + 20 章；真实本机实验；固定依据 EasyTier v2.6.4。',
    '',
    '第一站：同一台电脑里的两个程序。浏览器提出请求，服务读取演示文件并送回网页内容。看地址栏，看终端记录。',
    '',
    '本机网页 → 同一网络 → 异地网络 → EasyTier。预备课先把程序、网址和请求变成实际窗口里的现象。正文再跟着 A 访问 B 的网页，逐章解释路径和失败原因。必要的新词当场解释，计算与协议细节可以稍后选读。',
    '',
    courseMarkdown(),
    '',
    '电脑里已经运行 EasyTier？对照现有 GUI 的地址和路径，再看一次真实 ICMP 往返能证明什么。基础还不熟时，先完成预备课。',
    '',
    '[读真实 GUI 案例](/cases/local-gui)',
    '',
    '独立学习资料，非 EasyTier 官方网站。实现说明固定依据 v2.6.4；模型边界与资料来源见各章。',
  ].join('\n')
}

function packetMarkdown() {
  return [
    '### 数据包旅程：教学模型的文字轨迹',
    '',
    '可切换直连或经过 R 中继，并用上一步、下一步、重新开始观察。业务使用 TCP，外层使用 UDP，安全模式会话已经建立。',
    '',
    ...(['direct', 'relay'] as const).flatMap(mode => [
      `**${mode === 'direct' ? 'A 与 B 直连' : '经过 R 中继'}**`,
      '',
      ...createJourney(mode).map((step, index) => `${index + 1}. ${step.direction === 'request' ? '去程' : '回程'}，${step.at}：${step.title}。${step.detail} 内层 ${step.innerSource} → ${step.innerTarget}；外层 ${step.outerSource} → ${step.outerTarget}。`),
      '',
    ]),
    '教学模型省略握手、重传和真实时序，不发送网络探测。公网地址来自文档保留网段，不能用于连接；显示内层字段不代表中继能够读取安全模式的业务负载。',
  ].join('\n')
}

function natMarkdown() {
  return [
    '### NAT 打洞实验：固定预设的文字推演',
    '',
    '映射规则与过滤规则分别观察，可逐步探测、退回和重置。',
    '',
    ...natPresets.flatMap(preset => [
      `**${preset.title}**`,
      '',
      `映射：${preset.mapping}。过滤：${preset.filtering}。`,
      '',
      ...Array.from({ length: 6 }, (_, index) => {
        const snapshot = natSnapshot(preset.id, index)
        return `${index + 1}. ${snapshot.title}：${snapshot.detail} A → B：${snapshot.aToB ? '可达' : '尚未成立'}；B → A：${snapshot.bToA ? '可达' : '尚未成立'}。`
      }),
      '',
      `结果：${natSnapshot(preset.id, 5).result}。`,
      '',
    ]),
    '教学模型不模拟端口预测、映射过期、随机丢包或全部打洞策略；失败仅指当前预设的固定端点探测，不表示真实网络必然不能直连。',
  ].join('\n')
}

function topologyMarkdown() {
  const all = links.map(link => link.id)
  const hops = choosePath(all, 'hops')!
  const latency = choosePath(all, 'latency')!
  const withoutC = choosePath(all.filter(id => id !== 'AC' && id !== 'CB'), 'latency')!
  return [
    '### 拓扑选路实验：四节点模型的文字结果',
    '',
    '固定 A、B、C、R 四节点，可切换最少跳数或最低演示延迟，启停链路和重置。',
    '',
    ...links.map(link => `- ${link.a}—${link.b}：演示延迟 ${link.latency} ms。`),
    '',
    `全部链路可用，最少跳数选 ${hops.nodes.join(' → ')}，${hops.edges.length} 跳、演示延迟 ${hops.latency} ms。`,
    '',
    `最低演示延迟选 ${latency.nodes.join(' → ')}，${latency.edges.length} 跳、演示延迟 ${latency.latency} ms。`,
    '',
    `断开 C 相关链路后，最低演示延迟选 ${withoutC.nodes.join(' → ')}，${withoutC.edges.length} 跳、演示延迟 ${withoutC.latency} ms。`,
    '',
    '断开 A 的全部出边时，A 到 B 不可达；更换指标不能凭空创建路径。重置恢复全部链路并使用最少跳数。',
    '',
    '教学模型的 C、R 是普通转发节点，延迟直接相加、立即重选；真实测量、成本、信息同步与收敛不等于此模型。',
  ].join('\n')
}

/** Nimbus uses these conversions for each page's Markdown and LLM endpoints. */
export const componentMarkdown = {
  Aside: { revision: '1', render: ({ children }: { children?: string }) => children ?? '' },
  HomePage: { revision: '1', render: homeMarkdown },
  CourseMap: { revision: '1', render: courseMarkdown },
  PacketJourney: { revision: '1', render: packetMarkdown },
  NatLab: { revision: '1', render: natMarkdown },
  TopologyLab: { revision: '1', render: topologyMarkdown },
}
