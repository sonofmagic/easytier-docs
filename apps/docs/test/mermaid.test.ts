import { readFile } from 'node:fs/promises'
import { evaluate, markdownToHtml, markdownToMdast, mdxToMdast } from 'satteri'
import { describe, expect, it } from 'vitest'
import { createLegacySlugger, legacyHeadings, legacyRootHeadingId, legacySlug, mermaidDiagrams } from '../src/lib/markdown'
import { resolveMermaidTheme } from '../src/lib/mermaid-render'

interface TestElement { tag: unknown, props: Record<string, unknown> }

function findProps(value: unknown, key: string): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap(item => findProps(item, key))
  }
  if (!value || typeof value !== 'object' || !('props' in value)) {
    return []
  }
  const { props } = value as TestElement
  return [...(key in props ? [props[key]] : []), ...findProps(props.children, key)]
}

describe('Nimbus Mermaid fences', () => {
  const source = 'flowchart LR\n A["引号 & <tag> {{ value }}"] --> B["it\'s fine"]\n'

  it('encodes authored text in a safe HTML container and retains escaped source', () => {
    const { html } = markdownToHtml(`\`\`\`mermaid\n${source}\`\`\``, { hastPlugins: [mermaidDiagrams] })
    const graph = html.match(/data-mermaid="([^"]+)"/)![1]!
    expect(decodeURIComponent(graph)).toBe(source)
    expect(html).not.toContain('<tag>')
    expect(html).toContain('&lt;tag&gt;')
    expect(html).toContain('mermaid__diagram')
    expect(html).toContain('查看图表文字')
    expect(html).not.toContain('<Mermaid')
  })

  it('handles MDX fences as literal diagram text rather than expressions', async () => {
    const jsx = (tag: unknown, props: unknown) => ({ tag, props })
    const module = await evaluate(`\`\`\`mermaid\n${source}\`\`\``, {
      hastPlugins: [mermaidDiagrams],
      Fragment: Symbol('fragment'),
      jsx,
      jsxs: jsx,
    })
    const content = (module.default as (props: Record<string, unknown>) => unknown)({})
    const encoded = findProps(content, 'data-mermaid')
    expect(encoded).toHaveLength(1)
    expect(decodeURIComponent(String(encoded[0]))).toBe(source)
  })

  it('keeps ordinary fences and the mmd source escape hatch as code', () => {
    const { html } = markdownToHtml('```ts\nconst answer = 42\n```\n\n```mmd\nflowchart LR\n A --> B\n```', { hastPlugins: [mermaidDiagrams] })
    expect(html).toContain('language-ts')
    expect(html).toContain('language-mmd')
    expect(html).not.toContain('data-mermaid=')
  })

  it('does not change Mermaid fences in the machine-readable Markdown tree', () => {
    const authored = `\`\`\`mermaid\n${source}\`\`\``
    for (const parse of [markdownToMdast, mdxToMdast]) {
      const tree = parse(authored)
      expect(tree).toMatchObject({ children: [{ type: 'code', lang: 'mermaid', value: source.trimEnd() }] })
    }
    expect(markdownToHtml(authored, { hastPlugins: [mermaidDiagrams] }).html.match(/data-mermaid=/g)).toHaveLength(1)
  })

  it('renders independent containers and gives dark mode priority', () => {
    const { html } = markdownToHtml('```mermaid\nflowchart LR\n A --> B\n```\n\n```mermaid\nsequenceDiagram\n A->>B: Hello\n```', { hastPlugins: [mermaidDiagrams] })
    expect(html.match(/data-mermaid=/g)).toHaveLength(2)
    expect(resolveMermaidTheme(false, 'forest')).toBe('forest')
    expect(resolveMermaidTheme(true, 'forest')).toBe('dark')
    expect(resolveMermaidTheme(false, {})).toBe('default')
    expect(resolveMermaidTheme(false, undefined)).toBe('default')
  })
})

describe('VitePress anchor compatibility', () => {
  it('preserves Chinese text, numeric prefixes, Unicode normalization and punctuation', () => {
    expect(legacySlug('01 · B 能打开自己的网页，为什么 A 不一定能')).toBe('_01-·-b-能打开自己的网页-为什么-a-不一定能')
    expect(legacySlug('Café / TUN & NAT')).toBe('cafe-tun-nat')
    expect(legacySlug('ＡＢＣ １２３')).toBe('abc-123')
    expect(legacySlug('“hello”_world')).toBe('hello-world')
  })

  it('deduplicates IDs across collisions as well as repeated headings', () => {
    const slug = createLegacySlugger()
    expect([slug('One'), slug('One-1'), slug('One'), slug('One')]).toEqual(['one', 'one-1', 'one-2', 'one-3'])
  })

  it('sets IDs before Astro collects the TOC, with per-document counters', () => {
    const render = () => markdownToHtml('## 第一步：读 `NAT`\n\n## 同名\n\n## 同名', { mdastPlugins: [legacyHeadings] }).html
    const one = render()
    expect(one).toContain('id="第一步-读-nat"')
    expect(one).toContain('id="同名"')
    expect(one).toContain('id="同名-1"')
    expect(render()).toBe(one)
  })

  it('keeps the layout-owned historical H1 and reserves it for body headings', () => {
    const rootId = legacyRootHeadingId('/chapters/01-why/', 'unused fallback')
    expect(rootId).toBe('_01-·-b-能打开自己的网页-为什么-a-不一定能')
    expect(legacyRootHeadingId('/', 'Home')).toBeNull()
    expect(legacyRootHeadingId('/new-page', 'New page')).toBe('new-page')
    const { html } = markdownToHtml('## 01 · B 能打开自己的网页，为什么 A 不一定能', {
      mdastPlugins: [legacyHeadings],
      fileURL: new URL('file:///workspace/apps/docs/src/content/docs/chapters/01-why.md'),
    })
    expect(html).toContain(`id="${rootId}-1"`)
  })

  it('preserves every captured heading ID across the migrated Markdown and MDX pages', async () => {
    const baseline = JSON.parse(await readFile(new URL('../src/data/legacy-anchors.json', import.meta.url), 'utf8')) as Record<string, { ids: string[], h1: string | null }>
    const jsx = (tag: unknown, props: unknown) => ({ tag, props })
    for (const [route, record] of Object.entries(baseline)) {
      const stem = route === '/' ? 'index' : route.slice(1)
      let fileURL = new URL(`../src/content/docs/${stem}.md`, import.meta.url)
      let source: string
      try {
        source = await readFile(fileURL, 'utf8')
      }
      catch {
        fileURL = new URL(`../src/content/docs/${stem}.mdx`, import.meta.url)
        source = await readFile(fileURL, 'utf8')
      }
      let ids: string[]
      if (fileURL.pathname.endsWith('.mdx')) {
        const names = [...source.matchAll(/<([A-Z]\w*)\b/g)].map(match => match[1]!)
        const components = Object.fromEntries(names.map(name => [name, () => null]))
        let module: Record<string, unknown>
        try {
          module = await evaluate(source, { mdastPlugins: [legacyHeadings], fileURL, Fragment: Symbol('fragment'), jsx, jsxs: jsx })
        }
        catch (cause) {
          throw new Error(`${route}: MDX compilation failed`, { cause })
        }
        const content = (module.default as (props: Record<string, unknown>) => unknown)({ components })
        ids = findProps(content, 'id').map(String)
      }
      else {
        const { html } = markdownToHtml(source, { mdastPlugins: [legacyHeadings], fileURL })
        ids = [...html.matchAll(/<h[1-6]\b[^>]+\bid="([^"]+)"/g)].map(match => match[1]!)
      }
      const actual = [...(record.h1 ? [record.h1] : []), ...ids]
      // New diagrams add headings; every historical anchor must stay in order.
      expect(actual.filter(id => record.ids.includes(id)), route).toEqual(record.ids)
    }
  })
})
