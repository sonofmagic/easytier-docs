<script setup lang="ts">
import type { OuterTransport } from '../../data/encapsulation.ts'
import { computed, ref } from 'vue'
import { encapsulationSnapshot, encapsulationSteps, moveEncapsulationStep } from '../../data/encapsulation.ts'

const props = withDefaults(defineProps<{ controlId?: string }>(), { controlId: 'encapsulation-lab-transport' })
const transport = ref<OuterTransport>('udp')
const index = ref(0)
const snapshot = computed(() => encapsulationSnapshot(index.value, transport.value))
const locations = [
  { id: 'A', name: 'A', detail: '生成、封装、加密' },
  { id: 'network', name: '物理网络', detail: '只运输外层与密文' },
  { id: 'B', name: 'B', detail: '解封装、解密、交付' },
] as const

function move(direction: -1 | 1) {
  index.value = moveEncapsulationStep(index.value, direction)
}

function reset() {
  index.value = 0
  transport.value = 'udp'
}
</script>

<template>
  <section class="lab encapsulation-lab" aria-label="协议分层与封装实验" data-testid="encapsulation-lab">
    <p class="lab-tag">
      教学模型 · A 与 B 的安全模式会话已经建立；不启用压缩或 TCP 流代理。图示不按字节比例绘制。
    </p>
    <div class="lab-toolbar">
      <label :for="props.controlId">外层隧道传输</label>
      <select :id="props.controlId" v-model="transport" aria-label="外层隧道传输" data-testid="encapsulation-transport">
        <option value="udp">
          UDP 隧道
        </option>
        <option value="tcp">
          TCP 隧道
        </option>
      </select>
      <span class="encapsulation-invariant">内层业务始终使用 TCP → B 的 8080 服务</span>
    </div>
    <ol class="encapsulation-track" aria-label="当前处理位置：从 A 经过物理网络到 B">
      <li v-for="location in locations" :key="location.id" :class="{ active: snapshot.step.at === location.id }" :aria-current="snapshot.step.at === location.id ? 'step' : undefined">
        <strong>{{ location.name }}</strong>
        <small>{{ location.detail }}</small>
        <span v-if="snapshot.step.at === location.id" class="encapsulation-current">当前位置</span>
      </li>
    </ol>
    <div class="lab-reading" aria-live="polite" aria-atomic="true">
      <div class="lab-meta">
        去程 A → B · 步骤 {{ snapshot.stage + 1 }} / {{ encapsulationSteps.length }}
      </div>
      <h3 data-testid="encapsulation-step">
        {{ snapshot.step.title }}
      </h3>
      <p>{{ snapshot.step.detail }}</p>
    </div>
    <div class="encapsulation-diagram" role="group" aria-label="当前封装层次，从最外层向业务内容阅读">
      <p class="encapsulation-reading-order">
        阅读顺序：从上方最外层，向下读到内部负载。带“当前处理”标签的一层正在本步骤被处理。
      </p>
      <ol class="encapsulation-layers">
        <li v-for="layer in snapshot.layers" :key="layer.id" :class="{ 'active': layer.active, 'is-ciphertext': layer.id === 'ciphertext' }" :data-layer="layer.id">
          <div class="encapsulation-layer-heading">
            <strong>{{ layer.title }}</strong>
            <span v-if="layer.active" class="encapsulation-current">当前处理</span>
          </div>
          <p>{{ layer.detail }}</p>
        </li>
      </ol>
    </div>
    <div class="packet-fields" data-testid="encapsulation-inner-fields">
      <div v-if="snapshot.visibleInner" class="inner-fields">
        <span class="field-label">内层业务目的 · {{ snapshot.step.hasInnerHeaders ? '包头可读' : '尚待操作系统封装' }}</span>
        <code>{{ snapshot.visibleInner.source }}</code><span aria-label="发往">→</span><code>{{ snapshot.visibleInner.target }}</code>
        <span class="encapsulation-protocol">{{ snapshot.visibleInner.transport }}</span>
      </div>
      <div v-else class="inner-fields encapsulation-masked">
        <span class="field-label">内层业务字段 · 密文阶段</span>
        <span>IP 地址、TCP 端口和 HTTP 字节已遮蔽，目的节点 B 解密后恢复。</span>
      </div>
    </div>
    <p class="lab-note">
      {{ snapshot.step.hasOuterHeaders ? '此处展示 NAT 后的公网示例端点。切换外层 TCP/UDP 只替换隧道运输方式，密文里的业务仍为 TCP。' : '外层 IP 与 TCP/UDP 仅在运输阶段出现。TUN 是交接接口，图中不为它虚构一层网络包头。' }}
    </p>
    <div class="lab-actions">
      <button :disabled="snapshot.stage === 0" data-testid="encapsulation-previous" @click="move(-1)">
        上一步
      </button>
      <button class="primary" :disabled="snapshot.stage === encapsulationSteps.length - 1" data-testid="encapsulation-next" @click="move(1)">
        下一步
      </button>
      <button data-testid="encapsulation-reset" @click="reset">
        重置（UDP，第一步）
      </button>
    </div>
    <p class="lab-disclaimer">
      结论：换外层隧道不会改变内层业务协议。这里只演示一个请求包的逻辑处理顺序，不模拟真实抓包、TCP 分段或密文算法；公网地址来自文档保留网段，浏览器不发送网络探测。所有控件可用 Tab 聚焦，按钮用 Enter 或空格操作。
    </p>
    <p class="lab-note">
      无需交互也可阅读<a href="/internals/packet-pipeline">数据面与封装的静态图解和逐步文字说明</a>。
    </p>
  </section>
</template>
