import type { MarkdownRenderer } from 'vitepress'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createMarkdownRenderer } from 'vitepress'
import { parse as parseYaml } from 'yaml'
import { chapters, learningPages, sitePages } from '../.vitepress/data/course.ts'

type MarkdownToken = ReturnType<MarkdownRenderer['parse']>[number]

const docsRoot = fileURLToPath(new URL('../', import.meta.url))
const chapterFiles = chapters.map(([slug]) => `chapters/${slug}.md`)
const pages = sitePages.map(page => page.file)
const errors: string[] = []
const markdown = await createMarkdownRenderer(docsRoot)
let checked = 0
let proseCharacters = 0
const requiredSections = ['这一章要解决的问题', '先回顾两件事', '一步一步看', '先预测，再观察', '常见误解', '两道练习', '进阶阅读', '来源与下一章']

if (chapters.length !== 20 || new Set(chapterFiles).size !== 20) {
  errors.push('课程导航必须包含 20 个不同的章节。')
}

if (pages.length !== 32 || new Set(pages).size !== pages.length) {
  errors.push('站点清单必须包含 32 个不同的页面。')
}
for (const [index, lesson] of learningPages.entries()) {
  if (!lesson.goal.trim() || !lesson.terms.length) {
    errors.push(`${lesson.file}: 清单缺少学习目标或核心术语。`)
  }
  for (const prerequisite of lesson.prerequisites) {
    const prerequisiteIndex = learningPages.findIndex(page => page.route === prerequisite)
    if (prerequisiteIndex < 0 || prerequisiteIndex >= index) {
      errors.push(`${lesson.file}: 先修内容不存在或顺序倒置 ${prerequisite}`)
    }
  }
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

  if (learningPages.some(page => page.file === file)) {
    const prose = proseLines.join('\n')
    const openingAnswers = (prose.match(/<details(?:\s[^>]*)?>/g) ?? []).length
    const closingAnswers = (prose.match(/<\/details\s*>/g) ?? []).length
    const answers = [...prose.matchAll(/<details\s+class=["']answer["'][^>]*>([\s\S]*?)<\/details\s*>/g)]
    if (answers.length < 2 || answers.some(answer => !/<summary>[^<]+<\/summary>[\s\S]*\p{Script=Han}/u.test(answer[1]!)) || closingAnswers !== openingAnswers) {
      errors.push(`${file}: 至少需要两个带说明的 class="answer" 折叠答案，且全部 details 必须闭合。`)
    }
    const chineseCharacters = (prose.match(/\p{Script=Han}/gu) ?? []).length
    proseCharacters += chineseCharacters
    const sectionTitles = tokens.flatMap((token, index) => token.type === 'heading_open' && token.tag === 'h2' ? [tokens[index + 1]?.content ?? ''] : [])
    for (const section of requiredSections) {
      if (!sectionTitles.includes(section)) {
        errors.push(`${file}: 缺少教学段落「${section}」。`)
      }
    }
    if (!/<details\s+class=["']advanced["']/.test(prose)) {
      errors.push(`${file}: 进阶阅读需要使用 class="advanced"，不能冒充练习答案。`)
    }
    for (const prerequisite of learningPages.find(page => page.file === file)!.prerequisites) {
      if (!hrefs.includes(prerequisite)) {
        errors.push(`${file}: 未链接清单中的先修内容 ${prerequisite}`)
      }
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
  console.log(`文档检查通过：${checked} 个页面、5 节预备课、${chapterFiles.length} 个正文章节；教学结构、先修顺序、标题、围栏、文件链接、图解与练习符合要求。`)
  console.log(`非代码教学正文合计 ${proseCharacters} 个汉字（仅报告，不作为易懂程度的门槛）。锚点与真实阅读体验另由浏览器验收和人工审阅确认。`)
}
