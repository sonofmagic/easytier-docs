<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #doc-before>
      <div class="version-note">
        独立学习教程 · EasyTier v2.6.4 · 从本机观察开始
      </div>
    </template>
    <template #not-found>
      <div class="not-found">
        <p class="eyebrow">
          404
        </p>
        <h1>这里没有章节</h1>
        <p>从学习路线找到下一步，或搜索一个网络术语。</p>
        <a class="primary-link" href="/course">回到学习路线</a>
      </div>
    </template>
  </Layout>
</template>
