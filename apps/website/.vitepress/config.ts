import { defineConfig } from 'vitepress'
import { chapterLink, chapters, stages, tokenize } from './data/course.ts'
import { mermaidMarkdown } from './mermaid/markdown.ts'

export default defineConfig({
  lang: 'zh-CN',
  title: '从零理解 EasyTier',
  description: '20 章中文教程与三个交互实验：从 IP、路由和 NAT，理解 EasyTier 的完整数据流。',
  cleanUrls: true,
  sitemap: { hostname: 'https://easytier.icebreaker.top' },
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]],
  themeConfig: {
    logo: '/favicon.svg',
    siteTitle: '从零理解 EasyTier',
    nav: [
      { text: '学习路线', link: '/course' },
      { text: '交互实验', link: '/labs' },
      { text: '实机案例', link: '/cases/local-gui' },
      { text: '术语表', link: '/glossary' },
      { text: '资料来源', link: '/sources' },
    ],
    sidebar: [
      { text: '开始阅读', items: [{ text: '学习路线与贯穿案例', link: '/course' }, { text: '浏览器交互实验', link: '/labs' }] },
      ...stages.map(stage => ({
        text: `${stage.range} · ${stage.title}`,
        collapsed: false,
        items: chapters.slice(stage.start, stage.end).map(([slug, text]) => ({ text: `${slug.slice(0, 2)} ${text}`, link: chapterLink(slug) })),
      })),
      { text: '随时查阅', items: [{ text: '实机案例：读懂现有 GUI 组网', link: '/cases/local-gui' }, { text: '术语表', link: '/glossary' }, { text: '资料来源与版本', link: '/sources' }] },
    ],
    outline: { label: '本章目录', level: [2, 3] },
    docFooter: { prev: '上一章', next: '下一章' },
    darkModeSwitchLabel: '外观',
    darkModeSwitchTitle: '切换为暗色',
    lightModeSwitchTitle: '切换为浅色',
    sidebarMenuLabel: '章节目录',
    returnToTopLabel: '返回顶部',
    search: {
      provider: 'local',
      options: {
        miniSearch: { options: { tokenize }, searchOptions: { combineWith: 'AND', prefix: true } },
        translations: {
          button: { buttonText: '搜索教程', buttonAriaLabel: '搜索教程' },
          modal: {
            displayDetails: '显示详细内容',
            resetButtonTitle: '清除搜索',
            backButtonTitle: '返回',
            noResultsText: '没有找到相关章节',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
          },
        },
      },
    },
  },
  markdown: { config: mermaidMarkdown },
})
