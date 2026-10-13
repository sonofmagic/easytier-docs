import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseHTML } from 'linkedom'
import { parse as parseYaml } from 'yaml'
import { internals, learningPages, sitePages } from '../src/data/course.ts'
import { canonicalSearchUrl, isSearchIndex, matchesQuery, searchAcceptanceQueries, searchSupplement } from '../src/lib/search.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = path.join(root, 'dist')
const origin = 'https://easytier.icebreaker.top'
const errors: string[] = []
const documents = new Map<string, ReturnType<typeof parseHTML>['document']>()
const knownRoutes = new Set(sitePages.map(page => page.route))

async function isFile(file: string) {
  try {
    return (await stat(file)).isFile()
  }
  catch {
    return false
  }
}

function outputCandidates(route: string) {
  return route === '/' ? ['index.html'] : [`${route.slice(1)}.html`, `${route.slice(1)}/index.html`]
}

async function sourceTitle(file: string) {
  for (const candidate of [file, file.replace(/\.md$/u, '.mdx'), file.replace(/\.mdx$/u, '.md')]) {
    const target = path.join(root, 'src/content/docs', candidate)
    if (await isFile(target)) {
      const text = await readFile(target, 'utf8')
      const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/u)
      const data = parseYaml(frontmatter?.[1] ?? '') as { title?: unknown } | undefined
      return typeof data?.title === 'string' ? data.title.trim() : ''
    }
  }
  return ''
}

for (const page of sitePages) {
  const output = (await Promise.all(outputCandidates(page.route).map(async file => await isFile(path.join(dist, file)) ? file : null))).find(Boolean)
  if (!output) {
    errors.push(`${page.route}: 未构建 HTML。`)
    continue
  }
  const { document } = parseHTML(await readFile(path.join(dist, output), 'utf8'))
  documents.set(page.route, document)
  if (document.documentElement.lang !== 'zh-CN') {
    errors.push(`${page.route}: html lang 必须为 zh-CN。`)
  }
  const headings = [...document.querySelectorAll('h1')]
  const title = await sourceTitle(page.file)
  if (headings.length !== 1 || headings[0]?.textContent?.trim() !== title) {
    errors.push(`${page.route}: 唯一 H1 必须与 frontmatter title 一致。`)
  }
  if (!document.title.includes(title) || !document.title.includes('从零理解 EasyTier')) {
    errors.push(`${page.route}: 文档 title 或站点品牌缺失。`)
  }
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href')
  if (canonical !== `${origin}${page.route}`) {
    errors.push(`${page.route}: canonical 地址不兼容旧无尾斜杠 URL（${canonical ?? '缺失'}）。`)
  }
  if (document.querySelectorAll('[data-pagefind-body]').length !== 1) {
    errors.push(`${page.route}: 需要一个可搜索正文区域。`)
  }
  const identifiers = [...document.querySelectorAll('[id]')].map(element => element.id).filter(Boolean)
  if (new Set(identifiers).size !== identifiers.length) {
    errors.push(`${page.route}: 重复 DOM id，可能破坏锚点或控件标签。`)
  }
  const body = document.querySelector('[data-pagefind-body]')
  if (body?.textContent?.includes('Project docs') || body?.textContent?.includes('Bilingual Nimbus')) {
    errors.push(`${page.route}: 留下模板示例文字。`)
  }
  const stem = page.route === '/' ? '' : `${page.route.slice(1)}/`
  for (const extension of ['md', 'mdx']) {
    const endpoint = path.join(dist, `${stem}index.${extension}`)
    if (!(await isFile(endpoint))) {
      errors.push(`${page.route}: 缺少预渲染 index.${extension}。`)
    }
    else if (!(await readFile(endpoint, 'utf8')).trim()) {
      errors.push(`${page.route}: index.${extension} 为空。`)
    }
  }
}

// Check all emitted navigation, body links, images and heading fragments.
for (const [route, document] of documents) {
  for (const element of document.querySelectorAll('a[href], img[src]')) {
    const href = element.getAttribute(element.tagName === 'IMG' ? 'src' : 'href') ?? ''
    if (!href || /^(?:mailto:|tel:|data:|blob:)/iu.test(href)) {
      continue
    }
    let url: URL
    try {
      url = new URL(href, `${origin}${route}`)
    }
    catch {
      errors.push(`${route}: 无效链接 ${href}`)
      continue
    }
    if (url.origin !== origin) {
      continue
    }
    const clean = canonicalSearchUrl(url.href)!.split('#')[0]!
    if (knownRoutes.has(clean)) {
      if (url.hash) {
        let anchor: string
        try {
          anchor = decodeURIComponent(url.hash.slice(1))
        }
        catch {
          errors.push(`${route}: 无效锚点编码 ${href}`)
          continue
        }
        if (!documents.get(clean)?.getElementById(anchor)) {
          errors.push(`${route}: 锚点不存在 ${href}`)
        }
      }
      continue
    }
    const decoded = decodeURIComponent(url.pathname)
    const file = path.resolve(dist, `.${decoded}`)
    const relative = path.relative(dist, file)
    if (relative.startsWith(`..${path.sep}`) || relative === '..' || !(await isFile(file))) {
      errors.push(`${route}: 内部输出链接不存在 ${href}`)
    }
  }
}

try {
  const anchors = JSON.parse(await readFile(path.join(root, 'public/course-anchors.json'), 'utf8')) as Record<string, string[]>
  for (const page of sitePages) {
    const expected = anchors[page.route]
    if (!Array.isArray(expected) && internals.some(lesson => lesson.route === page.route)) {
      continue // New lessons have no historical anchors; original pages still require the baseline.
    }
    if (!Array.isArray(expected)) {
      errors.push(`${page.route}: 旧锚点基线缺少此页。`)
      continue
    }
    for (const anchor of expected) {
      if (!documents.get(page.route)?.getElementById(anchor)) {
        errors.push(`${page.route}: 旧锚点丢失 #${anchor}`)
      }
    }
  }
}
catch (error) {
  errors.push(`无法读取旧锚点基线：${String(error)}`)
}

try {
  const manifest = JSON.parse(await readFile(path.join(dist, 'course-manifest.json'), 'utf8')) as {
    pages?: { route: string }[]
    lessons?: { route: string, prerequisites: string[] }[]
    learningPages?: { route: string, prerequisites: string[] }[]
  }
  const routes = manifest.pages?.map(page => page.route) ?? []
  if (routes.length !== sitePages.length || new Set(routes).size !== sitePages.length || sitePages.some(page => !routes.includes(page.route))) {
    errors.push('course-manifest.json 必须准确列出全部 38 页。')
  }
  const lessons = manifest.lessons ?? manifest.learningPages
  if (!lessons || lessons.length !== learningPages.length || learningPages.some(page => !lessons.some(lesson => lesson.route === page.route && JSON.stringify(lesson.prerequisites) === JSON.stringify(page.prerequisites)))) {
    errors.push('course-manifest.json 必须准确列出 31 节学习内容及先修路径。')
  }
}
catch (error) {
  errors.push(`course-manifest.json 无法读取：${String(error)}`)
}

try {
  const value: unknown = JSON.parse(await readFile(path.join(dist, 'search/chinese-index.json'), 'utf8'))
  if (!isSearchIndex(value)) {
    throw new Error('schema invalid')
  }
  if (value.pages.length !== sitePages.length || sitePages.some(page => !value.pages.some(indexed => indexed.url === page.route))) {
    errors.push('补充搜索索引没有准确覆盖 38 页。')
  }
  for (const query of searchAcceptanceQueries) {
    const hits = searchSupplement(value, query)
    if (!hits.length || new Set(hits.map(hit => hit.url.split('#')[0])).size !== hits.length) {
      errors.push(`补充搜索 ${query}: 无结果或未按页面去重。`)
    }
    for (const hit of hits) {
      const target = new URL(hit.url, origin)
      const document = documents.get(target.pathname)
      const pageId = value.pages.findIndex(page => page.url === target.pathname)
      if (!document || !value.blocks.some(block => block.page === pageId && matchesQuery(block.text, query))) {
        errors.push(`补充搜索 ${query}: 结果没有真实正文证据 ${hit.url}`)
      }
      if (target.hash && !document?.getElementById(decodeURIComponent(target.hash.slice(1)))) {
        errors.push(`补充搜索 ${query}: 结果锚点不存在 ${hit.url}`)
      }
    }
  }
}
catch (error) {
  errors.push(`补充搜索产物无效：${String(error)}`)
}

if (!(await isFile(path.join(dist, 'pagefind/pagefind.js')))) {
  errors.push('Pagefind loader 缺失；Nimbus 的 warning 不能作为成功验收。')
}
try {
  const metadata = JSON.parse(await readFile(path.join(dist, 'pagefind/pagefind-entry.json'), 'utf8')) as { version?: string, languages?: Record<string, unknown> }
  if (metadata.version !== '1.5.2' || !Object.keys(metadata.languages ?? {}).some(language => language.split('-')[0] === 'zh')) {
    errors.push('Pagefind 元数据必须使用 1.5.2 并包含中文语言索引。')
  }
}
catch (error) {
  errors.push(`Pagefind 元数据缺失或无法读取：${String(error)}`)
}

for (const endpoint of ['llms.txt', 'llms-full.txt', 'robots.txt', 'sitemap-index.xml', 'sitemap-0.xml', '404.html']) {
  if (!(await isFile(path.join(dist, endpoint)))) {
    errors.push(`缺少静态输出 ${endpoint}`)
  }
}
try {
  // Nimbus deliberately publishes a small tree: root index links section
  // indexes, which link their documents. Verify the tree rather than flatten it.
  const queue = ['/llms.txt']
  const visited = new Set<string>()
  const urls = new Set<string>()
  while (queue.length) {
    const endpoint = queue.shift()!
    if (visited.has(endpoint)) {
      continue
    }
    visited.add(endpoint)
    const file = path.resolve(dist, `.${endpoint}`)
    const relative = path.relative(dist, file)
    if (relative === '..' || relative.startsWith(`..${path.sep}`)) {
      throw new Error(`llms index escaped output directory: ${endpoint}`)
    }
    const index = await readFile(file, 'utf8')
    for (const match of index.matchAll(/\]\(([^)]+)\)/gu)) {
      const target = new URL(match[1]!, origin)
      if (target.origin !== origin) {
        continue
      }
      if (target.pathname.endsWith('/llms.txt')) {
        queue.push(target.pathname)
      }
      else if (target.pathname.endsWith('/index.md')) {
        urls.add(target.pathname.replace(/\/index\.md$/u, '').replace(/\/+$/u, '') || '/')
      }
    }
  }
  for (const page of sitePages) {
    if (!urls.has(page.route)) {
      errors.push(`llms.txt/分节索引树未列出 ${page.route}`)
    }
  }
  if (urls.size !== sitePages.length) {
    errors.push(`llms 索引树需要覆盖准确 38 页，实际 ${urls.size}。`)
  }
}
catch (error) {
  errors.push(`llms.txt 无法读取：${String(error)}`)
}
try {
  const sitemap = await readFile(path.join(dist, 'sitemap-0.xml'), 'utf8')
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => {
    const url = new URL(match[1]!)
    return `${url.origin}${url.pathname.replace(/\/+$/u, '') || '/'}`
  })
  if (urls.length !== sitePages.length || sitePages.some(page => !urls.includes(`${origin}${page.route}`))) {
    errors.push('sitemap 必须准确包含 38 个无尾斜杠正式地址。')
  }
}
catch (error) {
  errors.push(`sitemap 无法读取：${String(error)}`)
}
try {
  const headers = await readFile(path.join(dist, '_headers'), 'utf8')
  const rules = [...headers.matchAll(/^([^\s#][^\n]*)\n((?:[ \t][^\n]*\n?)*)/gmu)].map(match => ({ pattern: match[1]!.trim(), body: match[2]! }))
  for (const [pattern, mediaType] of [['/*.md', 'text/markdown'], ['/*.mdx', 'text/plain'], ['/*.txt', 'text/plain']]) {
    if (!rules.some(rule => rule.pattern === pattern && rule.body.includes(`Content-Type: ${mediaType}; charset=utf-8`))) {
      errors.push(`_headers 缺少 ${pattern} 的 UTF-8 ${mediaType} 覆盖。`)
    }
  }
  if (!rules.some(rule => rule.pattern === '/*' && rule.body.includes('X-Content-Type-Options: nosniff'))) {
    errors.push('_headers 缺少全局 nosniff。')
  }
  if (rules.length > 100 || headers.split('\n').some(line => line.length > 2000)) {
    errors.push('_headers 超过 Workers 规则/行长限制。')
  }
  if (rules.some(rule => /^\/(?:\*|pagefind\/\*|search\/\*)$/u.test(rule.pattern) && /Cache-Control:.*immutable/iu.test(rule.body))) {
    errors.push('HTML/Pagefind/补充搜索索引不能设置全局 immutable。')
  }
}
catch (error) {
  errors.push(`_headers 无法读取：${String(error)}`)
}
try {
  const source = await readFile(path.join(root, 'public/downloads/network-basics-demo.zip'))
  const output = await readFile(path.join(dist, 'downloads/network-basics-demo.zip'))
  if (!source.equals(output)) {
    errors.push('下载 ZIP 与审核过的公开实验文件不一致。')
  }
}
catch (error) {
  errors.push(`下载 ZIP 缺失：${String(error)}`)
}

if (errors.length) {
  console.error(`静态产物验收失败（${errors.length} 项）：\n${errors.map(error => `- ${error}`).join('\n')}`)
  process.exitCode = 1
}
else {
  console.log(`静态产物验收通过：${documents.size} 页；旧 URL/锚点、内部链接、H1/canonical、课程清单、Markdown/MDX/llms、Pagefind 1.5.2、${searchAcceptanceQueries.length} 项真实正文搜索、MIME 规则和下载 ZIP。`)
  console.log('HTTPS、真实 HTTP 404/MIME/重定向、Pagefind 原生查询、图表和交互须继续由生产浏览器及远程 HTTP 验收。')
}
