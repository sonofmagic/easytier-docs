import type { MarkdownRenderer } from 'vitepress'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createMarkdownRenderer } from 'vitepress'
import { parse as parseYaml } from 'yaml'
import { chapters } from '../.vitepress/data/course.ts'

type MarkdownToken = ReturnType<MarkdownRenderer['parse']>[number]

const docsRoot = fileURLToPath(new URL('../', import.meta.url))
const chapterFiles = chapters.map(([slug]) => `chapters/${slug}.md`)
const pages = ['index.md', 'course.md', 'labs.md', 'glossary.md', 'sources.md', 'cases/local-gui.md', ...chapterFiles]
const errors: string[] = []
const markdown = await createMarkdownRenderer(docsRoot)
let checked = 0

if (chapters.length !== 20 || new Set(chapterFiles).size !== 20) {
  errors.push('课程导航必须包含 20 个不同的章节。')
}

function flattenTokens(tokens: readonly MarkdownToken[]): MarkdownToken[] {
  return tokens.flatMap(token => [token, ...flattenTokens(token.children ?? [])])
}

async function isFile(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isFile()
  }
  catch {
    return false
  }
}

async function checkInternalLink(file: string, href: string) {
  if (!href || href.startsWith('#') || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(href)) {
    return
  }
  const route = href.split(/[?#]/, 1)[0]!
  if (!route) {
    return
  }
  let decoded: string
  try {
    decoded = decodeURIComponent(route)
  }
  catch {
    errors.push(`${file}: 链接包含无效的 URL 编码 ${href}`)
    return
  }
  const resolved = decoded.startsWith('/')
    ? path.resolve(docsRoot, `.${decoded}`)
    : path.resolve(docsRoot, path.dirname(file), decoded)
  const relative = path.relative(docsRoot, resolved)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    errors.push(`${file}: 内部链接越过站点目录 ${href}`)
    return
  }
  const clean = resolved.replace(/\.html$/, '')
  const candidates = [resolved, `${clean}.md`, path.join(clean, 'index.md')]
  if (decoded.startsWith('/')) {
    candidates.push(path.join(docsRoot, 'public', decoded.slice(1)))
  }
  if (!(await Promise.all(candidates.map(isFile))).some(Boolean)) {
    errors.push(`${file}: 内部链接没有对应文件 ${href}`)
  }
}

for (const file of pages) {
  let source: string
  try {
    source = await readFile(path.join(docsRoot, file), 'utf8')
  }
  catch {
    errors.push(`${file}: 页面不存在或无法读取。`)
    continue
  }
  checked++
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!frontmatter) {
    errors.push(`${file}: 缺少 YAML frontmatter。`)
  }
  else {
    try {
      const data: unknown = parseYaml(frontmatter[1]!)
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        errors.push(`${file}: frontmatter 必须是字段对象。`)
      }
      else {
        for (const field of ['title', 'description']) {
          const value = (data as Record<string, unknown>)[field]
          if (typeof value !== 'string' || !value.trim()) {
            errors.push(`${file}: frontmatter 缺少非空 ${field}。`)
          }
        }
      }
    }
    catch (error) {
      errors.push(`${file}: YAML 无法解析：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const body = frontmatter ? source.slice(frontmatter[0].length) : source
  const tokens = markdown.parse(body, {})
  const headings = tokens.filter(token => token.type === 'heading_open').map(token => Number(token.tag.slice(1)))
  const homeComponent = file === 'index.md' && /<HomePage[\s/>]/.test(body)
  if (headings.filter(level => level === 1).length !== (homeComponent ? 0 : 1)) {
    errors.push(`${file}: 正文应有一个 H1；使用 HomePage 的首页由组件提供标题，不写 Markdown H1。`)
  }
  for (let index = 1; index < headings.length; index++) {
    if (headings[index]! > headings[index - 1]! + 1) {
      errors.push(`${file}: 标题从 H${headings[index - 1]} 跳到 H${headings[index]}。`)
    }
  }

  const lines = body.split(/\r?\n/)
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
        errors.push(`${file}: 第 ${start + 1} 行的代码围栏未闭合。`)
      }
      if (!token.info.trim()) {
        errors.push(`${file}: 第 ${start + 1} 行的代码围栏需要语言标记。`)
      }
    }
  }

  const flatTokens = flattenTokens(tokens)
  const hrefs = flatTokens.flatMap((token) => {
    if (token.type === 'link_open') {
      return [token.attrGet('href') ?? '']
    }
    if (token.type === 'image') {
      return [token.attrGet('src') ?? '']
    }
    if (token.type === 'html_block' || token.type === 'html_inline') {
      return [...token.content.matchAll(/<(?:a|img)\s[^>]*?\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]!)
    }
    return []
  })
  for (const href of new Set(hrefs)) {
    await checkInternalLink(file, href)
  }

  if (chapterFiles.includes(file)) {
    const prose = proseLines.join('\n')
    const openingAnswers = (prose.match(/<details(?:\s[^>]*)?>/g) ?? []).length
    const closingAnswers = (prose.match(/<\/details\s*>/g) ?? []).length
    if (openingAnswers < 2 || closingAnswers !== openingAnswers) {
      errors.push(`${file}: 至少需要两个完整的 details 折叠答案。`)
    }
    const chineseCharacters = (prose.match(/\p{Script=Han}/gu) ?? []).length
    if (chineseCharacters < 1500) {
      errors.push(`${file}: 非代码正文仅 ${chineseCharacters} 个中文字符，至少需要 1500。`)
    }
    if (!tokens.some(token => token.type === 'fence' && token.info.trim() === 'mermaid')) {
      errors.push(`${file}: 缺少 Mermaid 图解。`)
    }
    const hasSourcesHeading = tokens.some((token, index) => token.type === 'heading_open' && tokens[index + 1]?.content.includes('来源'))
    if (!hasSourcesHeading || !hrefs.some(href => href.startsWith('https://'))) {
      errors.push(`${file}: 需要来源章节和完整的 HTTPS 资料链接。`)
    }
  }
}

if (errors.length) {
  console.error(`文档检查失败（${errors.length} 项）：\n${errors.map(error => `- ${error}`).join('\n')}`)
  process.exitCode = 1
}
else {
  console.log(`文档检查通过：${checked} 个页面、${chapterFiles.length} 个导航章节；标题、围栏、文件链接、图解、练习与正文长度符合要求。`)
  console.log('本检查验证链接对应的文件；页内锚点暂不校验。')
}
