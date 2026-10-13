import vue from '@astrojs/vue'
import nimbus, { defineConfig as defineNimbusConfig } from '@cloudflare/nimbus-docs'
import { defineConfig } from 'astro/config'
import { basics, chapters, internals, stages } from './src/data/course'
import { componentMarkdown } from './src/lib/component-markdown'
import { legacyHeadings, mermaidDiagrams } from './src/lib/markdown'

export default defineConfig({
  site: 'https://easytier.icebreaker.top',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [vue(), nimbus(defineNimbusConfig({
    site: 'https://easytier.icebreaker.top',
    title: '从零理解 EasyTier',
    description: '先在自己的电脑上看见请求，再一步一步理解 EasyTier。',
    locale: 'zh-CN',
    github: null,
    sidebar: { scope: 'full', items: [
      { label: '开始阅读', items: [{ label: '学习路线', link: '/course' }, { label: '四个交互实验', link: '/labs' }] },
      { label: '预备课 · 先在本机看见', items: [{ label: '预备课与下载实验包', link: '/basics' }, ...basics.map(x => ({ label: x.title, link: x.route }))] },
      ...stages.map(s => ({ label: `${s.range} · ${s.title}`, items: chapters.slice(s.start, s.end).map(([slug, title]) => ({ label: `${slug.slice(0, 2)} ${title}`, link: `/chapters/${slug}` })) })),
      { label: '进阶 · 协议与核心原理', items: internals.map(lesson => ({ label: lesson.title, link: lesson.route })) },
      { label: '随时查阅', items: [{ label: '本机 GUI 实测', link: '/cases/local-gui' }, { label: '术语表', link: '/glossary' }, { label: '资料与版本', link: '/sources' }] },
    ] },
  }), {
    icons: false,
    rules: { 'nimbus/frontmatter-shape': 'error', 'nimbus/internal-link': 'error', 'nimbus/single-h1': 'error' },
    markdown: { mdastPlugins: [legacyHeadings], hastPlugins: [mermaidDiagrams], componentMap: componentMarkdown },
  })],
})
