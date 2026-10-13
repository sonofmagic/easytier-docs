<script setup lang="ts">
import type { JourneyMode } from '../../data/models.ts'
import { computed, ref, watch } from 'vue'
import { createJourney } from '../../data/models.ts'

const props = withDefaults(defineProps<{ controlId?: string }>(), { controlId: 'packet-journey-path' })
const id = props.controlId
const mode = ref<JourneyMode>('direct')
const index = ref(0)
const steps = computed(() => createJourney(mode.value))
const current = computed(() => steps.value[index.value]!)
watch(mode, () => {
  index.value = 0
})
</script>

<template>
  <section class="lab" aria-label="数据包旅程" data-testid="packet-lab">
    <div class="lab-toolbar">
      <label :for="id">传输路径</label>
      <select :id="id" v-model="mode" aria-label="传输路径">
        <option value="direct">
          A 与 B 直连
        </option>
        <option value="relay">
          经过 R 中继
        </option>
      </select>
    </div>
    <div class="packet-track" aria-label="当前处理位置">
      <div v-for="node in mode === 'direct' ? ['A', 'B'] : ['A', 'R', 'B']" :key="node" class="packet-node" :class="{ active: current.at === node }">
        <span>{{ node }}</span>
        <small>{{ node === 'A' ? '发起请求的电脑' : node === 'B' ? '8080 服务所在电脑' : '转发节点' }}</small>
      </div>
    </div>
    <div class="lab-reading" aria-live="polite">
      <div class="lab-meta">
        {{ current.direction === 'request' ? '去程 A → B' : '回程 B → A' }} · 步骤 {{ index + 1 }} / {{ steps.length }}
      </div>
      <h3 data-testid="packet-step">
        {{ current.title }}
      </h3>
      <p>{{ current.detail }}</p>
    </div>
    <div class="packet-fields">
      <div class="inner-fields">
        <span class="field-label">应用要访问谁 · 内层地址与业务端口</span><code>{{ current.innerSource }}</code><span>→</span><code>{{ current.innerTarget }}</code>
      </div>
    </div>
    <details class="advanced packet-transport">
      <summary>展开：外层端点与安全细节</summary>
      <p class="lab-tag">
        此模型的业务使用 TCP，外层使用 UDP，安全模式会话已经建立。
      </p>
      <div class="packet-fields">
        <div class="outer-fields">
          <span class="field-label">外层 · 互联网 UDP 端点</span><code>{{ current.outerSource }}</code><span>→</span><code>{{ current.outerTarget }}</code>
        </div>
      </div>
      <p class="lab-note">
        {{ current.encrypted ? '此处业务负载已加密；显示内层字段是为学习，不代表 R 或运营商能读取它们。' : '已建立的网络被简化为一个包的轨迹；握手、TCP 确认、重传与实际链路时序没有展开。' }}
      </p>
    </details>
    <div class="lab-actions">
      <button :disabled="index === 0" @click="index--">
        上一步
      </button>
      <button class="primary" :disabled="index === steps.length - 1" @click="index++">
        下一步
      </button>
      <button @click="index = 0">
        重新开始
      </button>
    </div>
    <p class="lab-disclaimer">
      教学模型 · 公网地址来自文档保留网段，不能用于实际连接；浏览器不会发送网络探测。
    </p>
  </section>
</template>
