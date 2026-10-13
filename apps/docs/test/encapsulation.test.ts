import { describe, expect, it } from 'vitest'
import { clampEncapsulationStep, encapsulationSnapshot, encapsulationSteps, innerRequest, moveEncapsulationStep, outerEndpoints } from '../src/data/encapsulation'

describe('协议分层与封装教学模型', () => {
  it.each(['udp', 'tcp'] as const)('%s 外层下内层协议、地址与目标端口在全程保持不变', (transport) => {
    for (let stage = 0; stage < encapsulationSteps.length; stage++) {
      const snapshot = encapsulationSnapshot(stage, transport)
      expect(snapshot.inner).toEqual({ application: 'HTTP', transport: 'TCP', source: '10.144.144.1:53124', target: '10.144.144.2:8080', payload: 'GET / HTTP/1.1 …' })
      if (snapshot.outer) {
        expect(snapshot.outer).toEqual({ ...outerEndpoints, transport })
      }
    }
  })

  it('切换外层只改变运输层，保持当前位置和已有加密状态', () => {
    const index = encapsulationSteps.findIndex(step => step.id === 'wire')
    const udp = encapsulationSnapshot(index, 'udp')
    const tcp = encapsulationSnapshot(index, 'tcp')
    expect(tcp.stage).toBe(udp.stage)
    expect(tcp.step).toEqual(udp.step)
    expect(tcp.inner).toBe(udp.inner)
    expect(tcp.visibleInner).toBeNull()
    expect(tcp.outer!.transport).toBe('tcp')
    expect(tcp.layers.find(layer => layer.id === 'outer-transport')!.title).toContain('TCP')
    expect(tcp.layers.filter(layer => layer.id !== 'outer-transport')).toEqual(udp.layers.filter(layer => layer.id !== 'outer-transport'))
  })

  it('密文投影隐藏内层地址、端口与内容，目的节点解密之后才恢复', () => {
    expect(encapsulationSteps.filter(step => step.encrypted).map(step => step.id)).toEqual(['encrypt', 'wire', 'unwrap'])
    for (let stage = 0; stage < encapsulationSteps.length; stage++) {
      const { step, visibleInner, layers } = encapsulationSnapshot(stage, 'udp')
      if (step.encrypted) {
        expect(visibleInner).toBeNull()
        expect(layers.some(layer => layer.id === 'ciphertext')).toBe(true)
        expect(layers.some(layer => ['ip', 'tcp', 'http'].includes(layer.id))).toBe(false)
        const displayText = layers.map(layer => layer.detail).join(' ')
        expect(displayText).not.toContain(innerRequest.source)
        expect(displayText).not.toContain(innerRequest.target)
        expect(displayText).not.toContain(innerRequest.payload)
      }
      else {
        expect(visibleInner).toBe(innerRequest)
        expect(layers.some(layer => layer.id === 'ciphertext')).toBe(false)
      }
    }
  })

  it('外层只在物理网络运输阶段存在，取下外层之后仍须解密', () => {
    const wire = encapsulationSnapshot(encapsulationSteps.findIndex(step => step.id === 'wire'), 'udp')
    expect(wire.layers.map(layer => layer.id)).toEqual(['outer-ip', 'outer-transport', 'peer', 'ciphertext'])
    const unwrap = encapsulationSnapshot(wire.stage + 1, 'udp')
    expect(unwrap.outer).toBeNull()
    expect(unwrap.step.encrypted).toBe(true)
    const received = encapsulationSnapshot(encapsulationSteps.findIndex(step => step.id === 'tun-receive'), 'udp')
    expect(received.layers.map(layer => layer.id)).toEqual(['ip', 'tcp', 'http'])
    expect(received.step.encrypted).toBe(false)
    expect(received.layers.some(layer => layer.id === 'peer')).toBe(false)
  })

  it('前后操作不会越界，初始快照恢复第一步和默认 UDP', () => {
    const last = encapsulationSteps.length - 1
    expect(moveEncapsulationStep(0, -1)).toBe(0)
    expect(moveEncapsulationStep(last, 1)).toBe(last)
    expect(moveEncapsulationStep(0, 1)).toBe(1)
    expect(moveEncapsulationStep(last, -1)).toBe(last - 1)
    expect([-10, 1.9, 999, Number.NaN, Number.POSITIVE_INFINITY].map(clampEncapsulationStep)).toEqual([0, 1, last, 0, 0])
    const initial = encapsulationSnapshot(0, 'udp')
    expect(initial.step.id).toBe('application')
    expect(initial.transport).toBe('udp')
    expect(initial.outer).toBeNull()
    expect(initial.visibleInner).toBe(innerRequest)
  })
})
