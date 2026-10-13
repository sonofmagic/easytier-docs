import type MarkdownIt from 'markdown-it'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import Markdown from 'markdown-it'
import { parse as parseYaml } from 'yaml'
import { chapters, internals, learningPages, sitePages } from '../src/data/course.ts'

type MarkdownToken = ReturnType<MarkdownIt['parse']>[number]

const root = fileURLToPath(new URL('../', import.meta.url))
const docsRoot = path.join(root, 'src/content/docs')
const publicRoot = path.join(root, 'public')
const errors: string[] = []
const markdown = new Markdown({ html: true })
const requiredSections = ['这一章要解决的问题', '先回顾两件事', '一步一步看', '先预测，再观察', '常见误解', '两道练习', '进阶阅读', '来源与下一章']
let checked = 0
let proseCharacters = 0

async function isFile(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isFile()
  }
  catch {
    return false
  }
}

async function contentFile(file: string) {
  for (const candidate of [file, file.replace(/\.md$/u, '.mdx'), file.replace(/\.mdx$/u, '.md')]) {
    if (await isFile(path.join(docsRoot, candidate))) {
      return candidate
    }
  }
  return file
}

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(async entry => entry.isDirectory() ? markdownFiles(path.join(directory, entry.name)) : /\.mdx?$/u.test(entry.name) ? [path.join(directory, entry.name)] : []))).flat()
}

function flatten(tokens: readonly MarkdownToken[]): MarkdownToken[] {
  return tokens.flatMap(token => [token, ...flatten(token.children ?? [])])
}

async function checkInternalLink(file: string, href: string) {
  if (!href || href.startsWith('#') || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(href)) {
    return
  }
  const route = href.split(/[?#]/u, 1)[0]!
  let decoded: string
  try {
    decoded = decodeURIComponent(route)
  }
  catch {
    errors.push(`${file}: 无效 URL 编码 ${href}`)
    return
  }
  const target = decoded.startsWith('/') ? path.resolve(docsRoot, `.${decoded}`) : path.resolve(docsRoot, path.dirname(file), decoded)
  const relative = path.relative(docsRoot, target)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    errors.push(`${file}: 链接越过公开内容边界 ${href}`)
    return
  }
  const clean = target.replace(/\.(?:html|mdx?)$/u, '')
  const candidates = [target, `${clean}.md`, `${clean}.mdx`, path.join(clean, 'index.md'), path.join(clean, 'index.mdx')]
  if (decoded.startsWith('/')) {
    candidates.push(path.join(publicRoot, decoded.slice(1)))
  }
  if (['/course-manifest.json', '/llms.txt', '/llms-full.txt', '/robots.txt', '/sitemap-index.xml', '/sitemap-0.xml'].includes(decoded) || /\/index\.mdx?$/u.test(decoded)) {
    return // Generated outputs are verified against final HTML by check-built.
  }
  if (!(await Promise.all(candidates.map(isFile))).some(Boolean)) {
    errors.push(`${file}: 内部链接没有对应文件 ${href}`)
  }
}

if (chapters.length !== 20 || new Set(chapters.map(([slug]) => slug)).size !== 20 || sitePages.length !== 38 || new Set(sitePages.map(page => page.route)).size !== 38) {
  errors.push('课程清单必须包含 20 个不同章节和 38 个不同页面。')
}
if (learningPages.length !== 31 || learningPages.filter(page => page.kind === 'basics').length !== 5 || internals.length !== 6) {
  errors.push('教学清单必须包含 5 节预备课、20 章与 6 篇进阶。')
}
for (const [index, lesson] of learningPages.entries()) {
  if (!lesson.goal.trim() || !lesson.terms.length) {
    errors.push(`${lesson.file}: 缺少学习目标或核心术语。`)
  }
  for (const prerequisite of lesson.prerequisites) {
    const before = learningPages.findIndex(page => page.route === prerequisite)
    if (before < 0 || before >= index) {
      errors.push(`${lesson.file}: 先修内容不存在或顺序倒置 ${prerequisite}`)
    }
  }
}

const expectedFiles = await Promise.all(sitePages.map(page => contentFile(page.file)))
for (const actual of await markdownFiles(docsRoot)) {
  const file = path.relative(docsRoot, actual).replaceAll(path.sep, '/')
  if (!expectedFiles.includes(file)) {
    errors.push(`${file}: 内容未列入 38 页清单，可能留下模板或意外公开文件。`)
  }
}

for (const [pageIndex, page] of sitePages.entries()) {
  const file = expectedFiles[pageIndex]!
  let source: string
  try {
    source = await readFile(path.join(docsRoot, file), 'utf8')
  }
  catch {
    errors.push(`${file}: 页面缺失。`)
    continue
  }
  checked++
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u)
  if (!frontmatter) {
    errors.push(`${file}: 缺少 YAML frontmatter。`)
  }
  else {
    try {
      const data: unknown = parseYaml(frontmatter[1]!)
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        errors.push(`${file}: frontmatter 必须为对象。`)
      }
      else {
        for (const field of ['title', 'description']) {
          const value = (data as Record<string, unknown>)[field]
          if (typeof value !== 'string' || !value.trim()) {
            errors.push(`${file}: 缺少非空 ${field}。`)
          }
        }
        for (const field of ['draft', 'noindex', 'searchable']) {
          if ((data as Record<string, unknown>)[field] === (field !== 'searchable')) {
            errors.push(`${file}: 已发布课程不能被 draft/noindex/searchable 隐去。`)
          }
        }
      }
    }
    catch (error) {
      errors.push(`${file}: YAML 无法解析：${String(error)}`)
    }
  }
  const body = frontmatter ? source.slice(frontmatter[0].length) : source
  const tokens = markdown.parse(body, {})
  const headings = tokens.filter(token => token.type === 'heading_open').map(token => Number(token.tag.slice(1)))
  if (headings.includes(1)) {
    errors.push(`${file}: 正文不重复 H1；页面唯一 H1 由布局和 frontmatter 提供。`)
  }
  for (let index = 1; index < headings.length; index++) {
    if (headings[index]! > headings[index - 1]! + 1) {
      errors.push(`${file}: 标题层级跳跃 H${headings[index - 1]} → H${headings[index]}。`)
    }
  }
  const lines = body.split(/\r?\n/u)
  const proseLines = [...lines]
  for (const token of tokens.filter(token => token.type === 'fence' || token.type === 'code_block')) {
    if (!token.map) {
      continue
    }
    const [start, end] = token.map
    for (let line = start; line < end; line++) {
      proseLines[line] = ''
    }
    if (token.type === 'fence') {
      const closing = new RegExp(`^[ \\t]*${token.markup[0]}{${token.markup.length},}[ \\t]*$`)
      if (end - start < 2 || !closing.test(lines[end - 1] ?? '')) {
        errors.push(`${file}: 第 ${start + 1} 行代码围栏未闭合。`)
      }
      if (!token.info.trim()) {
        errors.push(`${file}: 第 ${start + 1} 行代码围栏缺少语言。`)
      }
    }
  }
  const hrefs = flatten(tokens).flatMap((token) => {
    if (token.type === 'link_open') {
      return [token.attrGet('href') ?? '']
    }
    if (token.type === 'image') {
      return [token.attrGet('src') ?? '']
    }
    if (token.type.startsWith('html_')) {
      return [...token.content.matchAll(/<(?:a|img)\s[^>]*?\b(?:href|src)\s*=\s*["']([^"']+)["']/giu)].map(match => match[1]!)
    }
    return []
  })
  for (const href of new Set(hrefs)) {
    await checkInternalLink(file, href)
  }
  const lesson = learningPages.find(item => item.route === page.route)
  if (!lesson) {
    continue
  }
  const prose = proseLines.join('\n')
  const opens = (prose.match(/<details(?:\s[^>]*)?>/gu) ?? []).length
  const closes = (prose.match(/<\/details\s*>/gu) ?? []).length
  const answers = [...prose.matchAll(/<details\s+class(?:Name)?=["']answer["'][^>]*>([\s\S]*?)<\/details\s*>/gu)]
  if (answers.length < 2 || opens !== closes || answers.some(answer => !/<summary>[^<]+<\/summary>[\s\S]*\p{Script=Han}/u.test(answer[1]!))) {
    errors.push(`${file}: 至少两个有解释的 answer 折叠答案，全部 details 需闭合。`)
  }
  const sectionTitles = tokens.flatMap((token, index) => token.type === 'heading_open' && token.tag === 'h2' ? [tokens[index + 1]?.content ?? ''] : [])
  for (const section of lesson.kind === 'internals' ? [] : requiredSections) {
    if (!sectionTitles.includes(section)) {
      errors.push(`${file}: 缺少教学段落「${section}」。`)
    }
  }
  if (!/<details\s+class(?:Name)?=["']advanced["']/u.test(prose)) {
    errors.push(`${file}: 进阶阅读需明确为 advanced 选读。`)
  }
  for (const prerequisite of lesson.prerequisites) {
    if (!hrefs.includes(prerequisite)) {
      errors.push(`${file}: 未链接先修内容 ${prerequisite}`)
    }
  }
  if (lesson.kind !== 'internals' && !tokens.some(token => token.type === 'fence' && token.info.trim() === 'mermaid') && !/<Mermaid[\s/>]/u.test(body)) {
    errors.push(`${file}: 缺少 Mermaid 图解。`)
  }
  if (!sectionTitles.some(title => title.includes('来源')) || !hrefs.some(href => href.startsWith('https://'))) {
    errors.push(`${file}: 缺少来源章节或 HTTPS 资料链接。`)
  }
  if (lesson.kind === 'internals') {
    const figures = flatten(tokens).filter(token => token.type === 'image' && token.attrGet('src')?.startsWith('/diagrams/'))
    if (figures.length !== 2 || figures.some(figure => !figure.content.trim())) {
      errors.push(`${file}: 进阶篇需两张带非空替代文本的本地 SVG 图解。`)
    }
    if ((prose.match(/\p{Script=Han}/gu) ?? []).length < 1200) {
      errors.push(`${file}: 进阶篇需充分解释，不能只有协议列表和图。`)
    }
  }
  proseCharacters += (prose.match(/\p{Script=Han}/gu) ?? []).length
}

if (errors.length) {
  console.error(`文档检查失败（${errors.length} 项）：\n${errors.map(error => `- ${error}`).join('\n')}`)
  process.exitCode = 1
}
else {
  console.log(`结构检查通过：${checked} 页、5 节预备课、20 章、6 篇进阶；教学段落、目标与先修顺序、标题、围栏、来源、文件链接、图解、练习完整。`)
  console.log(`非代码教学正文 ${proseCharacters} 汉字（仅报告数量，阅读质量由人工与浏览器验收）。`)
}
