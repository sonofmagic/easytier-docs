import type { SearchPageInput } from '../lib/search.ts'
import { parseHTML } from 'linkedom'

const excluded = 'script, style, template, nav, [data-pagefind-ignore], [hidden], [aria-hidden="true"], [data-search]'
const blocks = 'h1, h2, h3, h4, h5, h6, p, li, pre, summary, blockquote, th, td, dt, dd, figcaption'

/** Read only rendered public prose, not frontmatter, imports, or hidden keywords. */
export function extractSearchPage(html: string, url: string): SearchPageInput {
  const { document } = parseHTML(html)
  const body = document.querySelector('[data-pagefind-body]')
  if (!body) {
    throw new Error(`${url}: missing searchable visible body`)
  }
  const title = body.querySelector('h1')?.textContent?.trim() ?? document.title
  const output: SearchPageInput['blocks'] = []
  const seen = new Set<string>()
  let heading = title
  let anchor = ''
  for (const element of body.querySelectorAll(blocks)) {
    if (element.closest(excluded)) {
      continue
    }
    const copy = element.cloneNode(true) as typeof element
    for (const ignored of copy.querySelectorAll(excluded)) {
      ignored.remove()
    }
    const text = (copy.textContent ?? '').replace(/\s+/gu, ' ').trim()
    if (!text) {
      continue
    }
    if (/^H[1-6]$/u.test(element.tagName)) {
      heading = text
      anchor = element.id
    }
    const key = `${anchor}\0${text}`
    if (!seen.has(key)) {
      seen.add(key)
      output.push({ text, heading, anchor })
    }
  }
  if (!title || !output.length) {
    throw new Error(`${url}: empty visible content`)
  }
  return { url, title, blocks: output }
}
