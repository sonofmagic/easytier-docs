<script setup lang="ts">
import type { RouteMetric } from '../../data/models.ts'
import { computed, ref, useId } from 'vue'
import { choosePath, links } from '../../data/models.ts'

const id = useId()
const metric = ref<RouteMetric>('hops')
const enabled = ref<string[]>(links.map(link => link.id))
const selected = computed(() => choosePath(enabled.value, metric.value))
const positions: Record<string, { x: number, y: number }> = { A: { x: 60, y: 145 }, B: { x: 540, y: 145 }, C: { x: 300, y: 45 }, R: { x: 300, y: 245 } }
function reset() {
  metric.value = 'hops'
  enabled.value = links.map(link => link.id)
}
</script>

<template>
  <section class="lab" aria-label="拓扑选路实验" data-testid="topology-lab">
    <div class="lab-toolbar">
      <label :for="id">选路指标</label>
      <select :id="id" v-model="metric" aria-label="选路指标">
        <option value="hops">
          最少跳数
        </option><option value="latency">
          最低演示延迟
        </option>
      </select>
    </div>
    <div class="graph-scroll">
      <svg class="topology-graph" viewBox="0 0 600 295" role="img" aria-label="A、B、C、R 四个普通节点的连接拓扑，选中路径以蓝色显示">
        <g v-for="link in links" :key="link.id" :class="{ selected: selected?.edges.includes(link.id), disconnected: !enabled.includes(link.id) }" class="graph-link">
          <line :x1="positions[link.a]!.x" :y1="positions[link.a]!.y" :x2="positions[link.b]!.x" :y2="positions[link.b]!.y" />
          <text :x="(positions[link.a]!.x + positions[link.b]!.x) / 2" :y="(positions[link.a]!.y + positions[link.b]!.y) / 2 - 9" text-anchor="middle">{{ link.latency }} ms</text>
        </g>
        <g v-for="(point, node) in positions" :key="node" class="graph-node" :class="{ selected: selected?.nodes.includes(node) }">
          <circle :cx="point.x" :cy="point.y" r="22" /><text :x="point.x" :y="point.y + 6" text-anchor="middle">{{ node }}</text>
        </g>
      </svg>
    </div>
    <fieldset class="link-controls">
      <legend>启用链路（取消勾选模拟断开）</legend>
      <label v-for="link in links" :key="link.id"><input v-model="enabled" type="checkbox" :value="link.id" :aria-label="`${link.a}—${link.b} 链路`">{{ link.a }}—{{ link.b }} <small>{{ link.latency }} ms</small></label>
    </fieldset>
    <div class="lab-reading" aria-live="polite">
      <h3 data-testid="selected-route">
        {{ selected ? selected.nodes.join(' → ') : 'A 到 B 不可达' }}
      </h3>
      <p v-if="selected">
        {{ selected.edges.length }} 跳 · 演示延迟总和 {{ selected.latency }} ms。{{ selected.edges.length === 1 ? '当前使用直连。' : `业务包经 ${selected.nodes.slice(1, -1).join('、')} 转发。` }}
      </p>
      <p v-else>
        没有一条完整的可用路径。路由算法无法凭空创建可用节点连接。
      </p>
    </div>
    <div class="lab-actions">
      <button @click="reset">
        重置拓扑
      </button>
    </div>
    <p class="lab-disclaimer">
      教学模型 · C、R 是普通转发节点；采用静态链路延迟简单相加、即时重新选路。真实 EasyTier 的测量、成本、拓扑同步与收敛并不等于此模型。
    </p>
  </section>
</template>
