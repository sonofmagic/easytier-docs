import type { EnhanceAppContext, Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import Mermaid from '../mermaid/mermaid.vue'
import CourseMap from './components/CourseMap.vue'
import HomePage from './components/HomePage.vue'
import NatLab from './components/NatLab.vue'
import PacketJourney from './components/PacketJourney.vue'
import TopologyLab from './components/TopologyLab.vue'
import Layout from './Layout.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }: EnhanceAppContext) {
    for (const [name, component] of Object.entries({ HomePage, Mermaid, PacketJourney, NatLab, TopologyLab, CourseMap })) {
      app.component(name, component)
    }
  },
} satisfies Theme
