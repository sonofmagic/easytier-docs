<script setup lang="ts">
import type { NatPreset } from '../../data/models.ts'
import { computed, ref, useId, watch } from 'vue'
import { natPresets, natSnapshot } from '../../data/models.ts'

const id = useId()
const preset = ref<NatPreset>('bilateral')
const step = ref(0)
const configuration = computed(() => natPresets.find(item => item.id === preset.value)!)
const state = computed(() => natSnapshot(preset.value, step.value))
watch(preset, () => {
  step.value = 0
})
</script>

<template>
  <section class="lab" aria-label="NAT 打洞实验" data-testid="nat-lab">
    <div class="lab-toolbar">
      <label :for="id">网络预设</label>
      <select :id="id" v-model="preset" aria-label="网络预设">
        <option v-for="item in natPresets" :key="item.id" :value="item.id">
          {{ item.title }}
        </option>
      </select>
    </div>
    <dl class="nat-rules">
      <div><dt>映射规则</dt><dd>{{ configuration.mapping }}</dd></div>
      <div><dt>过滤规则</dt><dd>{{ configuration.filtering }}</dd></div>
    </dl>
    <div class="lab-reading" aria-live="polite">
      <div class="lab-meta">
        步骤 {{ step + 1 }} / 6
      </div>
      <h3>{{ state.title }}</h3>
      <p>{{ state.detail }}</p>
    </div>
    <div class="table-scroll" tabindex="0" role="region" aria-label="NAT 映射与过滤状态表">
      <table class="nat-table">
        <thead><tr><th>节点</th><th>私网端点</th><th>外部端点</th><th>映射目的</th><th>允许的远端</th></tr></thead>
        <tbody>
          <tr v-for="entry in state.entries" :key="entry.outside">
            <td>{{ entry.node }}</td><td><code>{{ entry.inside }}</code></td><td><code>{{ entry.outside }}</code></td><td>{{ entry.destination }}</td><td>{{ entry.allowed }}</td>
          </tr>
          <tr v-if="state.entries.length === 0">
            <td colspan="5">
              还没有产生映射。点击“下一步”发出第一次探测。
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="nat-status" aria-live="polite">
      <span>A → B：{{ state.aToB ? '可达' : '尚未成立' }}</span>
      <span>B → A：{{ state.bToA ? '可达' : '尚未成立' }}</span>
      <strong data-testid="nat-result">{{ state.result }}</strong>
    </div>
    <div class="lab-actions">
      <button :disabled="step === 0" @click="step--">
        上一步
      </button>
      <button class="primary" :disabled="step === 5" @click="step++">
        下一步
      </button>
      <button @click="step = 0">
        重置实验
      </button>
    </div>
    <p class="lab-disclaimer">
      教学模型 · 独立呈现映射与过滤；没有模拟端口预测、映射过期、随机丢包或全部打洞策略。失败仅指当前预设的固定端点探测。
    </p>
  </section>
</template>
