import type { HastNode, HastVisitorContext, PluginFactoryContext } from 'satteri'
import { defineHastPlugin, defineMdastPlugin } from 'satteri'
import legacyAnchors from '../data/legacy-anchors.json'

interface LegacyAnchorRecord { ids: string[], h1: string | null }
type ElementNode = Extract<HastNode, { type: 'element' }>
const anchors: Record<string, LegacyAnchorRecord> = legacyAnchors

/** Match the VitePress 2.0 alpha default exactly, including its numeric prefix. */
export function legacySlug(text: string): string {
  return text.normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    // eslint-disable-next-line no-control-regex -- Preserve the previous anchor normalization.
    .replace(/[\u0000-\u001F]/g, '')
    .replace(/[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, '_$1')
    .toLowerCase()
}

export function createLegacySlugger(reserved: readonly string[] = []) {
  const used = new Set(reserved)
  return (text: string): string => {
    const base = legacySlug(text)
    let slug = base
    let suffix = 1
    while (used.has(slug)) {
      slug = `${base}-${suffix++}`
    }
    used.add(slug)
    return slug
  }
}

function normalizeRoute(route: string): string {
  const clean = route.split(/[?#]/, 1)[0]!.replace(/\/index$/, '').replace(/\/+$/, '')
  return clean || '/'
}

/** Layout owns the single H1; its historical ID must still exist. */
export function legacyRootHeadingId(route: string, title: string): string | null {
  const record = anchors[normalizeRoute(route)]
  return record ? record.h1 : legacySlug(title)
}

function documentRoute(fileURL: URL | undefined): string | undefined {
  if (!fileURL) {
    return
  }
  const path = decodeURIComponent(fileURL.pathname)
  const marker = '/src/content/docs/'
  const index = path.lastIndexOf(marker)
  if (index < 0) {
    return
  }
  return normalizeRoute(`/${path.slice(index + marker.length).replace(/\.mdx?$/, '')}`)
}

/** A Sätteri factory, passed directly as mdastPlugins: [legacyHeadings]. */
export function legacyHeadings(context: PluginFactoryContext) {
  const route = documentRoute(context.fileURL)
  const rootId = route ? anchors[route]?.h1 : undefined
  const slug = createLegacySlugger(rootId ? [rootId] : [])
  return defineMdastPlugin({
    name: 'easytier-legacy-heading-ids',
    heading(node, ctx) {
      const data = { ...node.data } as Record<string, unknown>
      const properties = (data.hProperties ?? {}) as Record<string, unknown>
      ctx.setProperty(node, 'data', {
        ...data,
        hProperties: { ...properties, id: slug(ctx.textContent(node, { includeImageAlt: false, includeHtml: false })) },
      })
    },
  })
}

function classes(node: Readonly<HastNode>): string[] {
  if (node.type !== 'element') {
    return []
  }
  const value: unknown = node.properties.className
  return Array.isArray(value) ? value.map(String) : typeof value === 'string' ? value.split(/\s+/) : []
}

function mermaidSource(node: Readonly<HastNode>, ctx: HastVisitorContext): string | undefined {
  if (node.type !== 'element' || node.tagName !== 'pre') {
    return
  }
  const code = node.children.find(child => child.type === 'element' && child.tagName === 'code')
  const language = node.properties.dataLanguage ?? node.properties['data-language']
  if (!classes(node).includes('language-mermaid') && language !== 'mermaid' && (!code || !classes(code).includes('language-mermaid'))) {
    return
  }
  return ctx.textContent(code ?? node)
}

/** HTML-only transformation: machine Markdown retains its ordinary Mermaid fence. */
export const mermaidDiagrams = defineHastPlugin({
  name: 'easytier-mermaid-diagrams',
  element: {
    filter: ['pre'],
    visit(node, ctx) {
      const source = mermaidSource(node, ctx)
      if (source === undefined) {
        return
      }
      const element = (tagName: string, properties: Record<string, string | string[]>, children: ElementNode['children']): ElementNode => ({
        type: 'element',
        tagName,
        properties,
        children,
      })
      const text = (value: string): Extract<HastNode, { type: 'text' }> => ({ type: 'text', value })
      const encoded = encodeURIComponent(source).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
      ctx.replaceNode(node, element('div', { className: ['mermaid'], dataMermaid: encoded, ariaBusy: 'true' }, [
        element('p', { className: ['mermaid__status'], role: 'status' }, [text('正在绘制图表…')]),
        element('div', { className: ['mermaid__diagram'] }, []),
        element('details', { className: ['mermaid__source'] }, [
          element('summary', {}, [text('查看图表文字')]),
          element('pre', {}, [element('code', {}, [text(source)])]),
        ]),
      ]))
    },
  },
})
