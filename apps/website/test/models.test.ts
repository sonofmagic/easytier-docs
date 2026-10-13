import { describe, expect, it } from 'vitest'
import { choosePath, createJourney, links, natSnapshot } from '../.vitepress/data/models'

describe('数据包往返教学模型', () => {
  it.each(['direct', 'relay'] as const)('%s 路径保持业务目的，回程交换业务源与目标', (mode) => {
    const journey = createJourney(mode)
    const request = journey.filter(step => step.direction === 'request')
    const response = journey.filter(step => step.direction === 'response')
    for (const step of request) {
      expect([step.innerSource, step.innerTarget]).toEqual(['10.144.144.1:53124', '10.144.144.2:8080'])
    }
    for (const step of response) {
      expect([step.innerSource, step.innerTarget]).toEqual(['10.144.144.2:8080', '10.144.144.1:53124'])
    }
    expect([request[0]!.at, request.at(-1)!.at]).toEqual(['A', 'B'])
    expect([response[0]!.at, response.at(-1)!.at]).toEqual(['B', 'A'])
  })

  it('直连使用实际外层端点，回程也交换外层源与目标', () => {
    const journey = createJourney('direct')
    expect(journey.some(step => step.at === 'R')).toBe(false)
    for (const step of journey.filter(step => step.outerSource !== '—')) {
      expect([step.outerSource, step.outerTarget]).toEqual(step.direction === 'request'
        ? ['198.51.100.10:31000', '203.0.113.20:32000']
        : ['203.0.113.20:32000', '198.51.100.10:31000'])
    }
  })

  it('中继改变外层端点，R 仍只转发加密负载', () => {
    const journey = createJourney('relay')
    const relaySteps = journey.filter(step => step.at === 'R')
    expect(relaySteps).toHaveLength(2)
    expect(relaySteps.map(step => [step.direction, step.outerSource, step.outerTarget, step.encrypted])).toEqual([
      ['request', '192.0.2.10:11010', '203.0.113.20:32000', true],
      ['response', '192.0.2.10:11010', '198.51.100.10:31000', true],
    ])
    const firstExternalStep = journey.find(step => step.outerSource !== '—')!
    expect(firstExternalStep.outerTarget).toBe('192.0.2.10:11010')
    const receivingSteps = journey.filter(step => step.outerSource === '192.0.2.10:11010' && step.at !== 'R')
    expect(receivingSteps.map(step => step.at)).toEqual(['B', 'A'])
  })

  it.each(['direct', 'relay'] as const)('%s 路径只在封装运输阶段加密，交回系统前已解密', (mode) => {
    for (const direction of ['request', 'response'] as const) {
      const steps = createJourney(mode).filter(step => step.direction === direction)
      expect(steps.slice(0, 2).every(step => !step.encrypted && step.outerSource === '—')).toBe(true)
      expect(steps.slice(2, -3).every(step => step.encrypted && step.outerSource !== '—')).toBe(true)
      expect(steps.slice(-3).every(step => !step.encrypted)).toBe(true)
      expect(steps.at(-2)!.outerSource).toBe('—')
    }
  })
})

describe('NAT 映射与过滤教学模型', () => {
  it('只有 A 发包时不宣称双向可达，B 发包后回程可达，再重试建立双向通信', () => {
    const oneSide = natSnapshot('bilateral', 3)
    expect([oneSide.aToB, oneSide.bToA]).toEqual([false, false])
    expect(oneSide.entries.find(entry => entry.node === 'A')!.allowed).toContain('B :32000')
    expect(oneSide.entries.find(entry => entry.node === 'B')!.allowed).toBe('STUN')

    const reply = natSnapshot('bilateral', 4)
    expect([reply.aToB, reply.bToA]).toEqual([false, true])
    expect(reply.entries.find(entry => entry.node === 'B')!.allowed).toContain('A :31000')

    const retried = natSnapshot('bilateral', 5)
    expect([retried.aToB, retried.bToA]).toEqual([true, true])
    expect(retried.result).toContain('双向直连成功')
  })

  it('端点无关过滤允许第一次 A 探测，无需 B 先加入允许名单', () => {
    const snapshot = natSnapshot('open', 3)
    expect(snapshot.aToB).toBe(true)
    expect(snapshot.entries.every(entry => entry.allowed === '任意远端')).toBe(true)
    expect(snapshot.entries).toHaveLength(2)
  })

  it('目的依赖映射改变端点，继续探测旧 STUN 端点无法获得双向通信', () => {
    const snapshot = natSnapshot('dependent', 5)
    const aEntries = snapshot.entries.filter(entry => entry.node === 'A')
    const bEntries = snapshot.entries.filter(entry => entry.node === 'B')
    expect(aEntries.map(entry => [entry.inside, entry.outside])).toEqual([
      ['192.168.10.20:40000', '198.51.100.10:31000'],
      ['192.168.10.20:40000', '198.51.100.10:31001'],
    ])
    expect(bEntries.map(entry => [entry.inside, entry.outside])).toEqual([
      ['192.168.20.30:40000', '203.0.113.20:32000'],
      ['192.168.20.30:40000', '203.0.113.20:32001'],
    ])
    expect(aEntries[0]!.allowed).toBe('STUN')
    expect(bEntries[0]!.allowed).toBe('STUN')
    expect(aEntries[1]!.allowed).toBe(bEntries[0]!.outside)
    expect(bEntries[1]!.allowed).toBe(aEntries[0]!.outside)
    expect([snapshot.aToB, snapshot.bToA]).toEqual([false, false])
    expect(snapshot.result).toContain('当前探测失败')
  })

  it('每次计算独立，初始阶段为空，切换预设不会继承之前的允许状态', () => {
    natSnapshot('bilateral', 5)
    const initial = natSnapshot('dependent', 0)
    expect(initial.entries).toEqual([])
    expect([initial.aToB, initial.bToA]).toEqual([false, false])
    expect(natSnapshot('bilateral', 1).entries.every(entry => entry.allowed === 'STUN')).toBe(true)
  })
})

describe('拓扑与路径教学模型', () => {
  const all = links.map(link => link.id)

  it('最少跳选择直连，最低演示延迟选择经 C 的两跳路径', () => {
    expect(choosePath(all, 'hops')).toEqual({ nodes: ['A', 'B'], edges: ['AB'], latency: 80 })
    expect(choosePath(all, 'latency')).toEqual({ nodes: ['A', 'C', 'B'], edges: ['AC', 'CB'], latency: 30 })
  })

  it('C 失效后最低延迟选择经 R 的路径', () => {
    const withoutC = all.filter(id => id !== 'AC' && id !== 'CB')
    expect(choosePath(withoutC, 'latency')).toEqual({ nodes: ['A', 'R', 'B'], edges: ['AR', 'RB'], latency: 40 })
  })

  it.each(['hops', 'latency'] as const)('%s 指标无法修复网络分区', (metric) => {
    expect(choosePath(['CB', 'RB'], metric)).toBeNull()
    expect(choosePath([], metric)).toBeNull()
  })

  it('所有链路开关组合中的选中路径都不重复节点，也不使用已断开的边', () => {
    for (let mask = 0; mask < 2 ** links.length; mask++) {
      const enabled = links.filter((_, index) => mask & (1 << index)).map(link => link.id)
      for (const metric of ['hops', 'latency'] as const) {
        const chosen = choosePath(enabled, metric)
        if (!chosen) {
          continue
        }
        expect(chosen.nodes[0]).toBe('A')
        expect(chosen.nodes.at(-1)).toBe('B')
        expect(new Set(chosen.nodes).size).toBe(chosen.nodes.length)
        expect(chosen.edges).toHaveLength(chosen.nodes.length - 1)
        expect(chosen.edges.every(edge => enabled.includes(edge as typeof enabled[number]))).toBe(true)
        let latency = 0
        chosen.edges.forEach((id, index) => {
          const edge = links.find(link => link.id === id)!
          expect([edge.a, edge.b].sort()).toEqual(chosen.nodes.slice(index, index + 2).sort())
          latency += edge.latency
        })
        expect(chosen.latency).toBe(latency)
      }
    }
  })
})
