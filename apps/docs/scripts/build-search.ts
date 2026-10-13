import { Buffer } from 'node:buffer'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sitePages } from '../src/data/course.ts'
import { createSearchIndex, searchAcceptanceQueries, searchSupplement } from '../src/lib/search.ts'
import { extractSearchPage } from '../src/search/extract.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = path.join(root, 'dist')

async function builtFile(route: string) {
  const stem = route.replace(/^\//u, '')
  for (const candidate of route === '/' ? ['index.html'] : [`${stem}.html`, `${stem}/index.html`]) {
    const target = path.join(dist, candidate)
    try {
      if ((await stat(target)).isFile()) {
        return target
      }
    }
    catch { /* Try the alternative Astro output shape. */ }
  }
  throw new Error(`${route}: no built HTML file`)
}

const pages = await Promise.all(sitePages.map(async page => extractSearchPage(await readFile(await builtFile(page.route), 'utf8'), page.route)))
const index = createSearchIndex(pages)
for (const query of searchAcceptanceQueries) {
  if (!searchSupplement(index, query).length) {
    throw new Error(`Public visible body search did not match ${query}`)
  }
}
await mkdir(path.join(dist, 'search'), { recursive: true })
const data = `${JSON.stringify(index)}\n`
await writeFile(path.join(dist, 'search/chinese-index.json'), data, 'utf8')
console.log(`正文补充索引：${index.pages.length} 页、${index.blocks.length} 文本块、${Object.keys(index.postings).length} 单字/双字/英文项、${Buffer.byteLength(data)} 字节；${searchAcceptanceQueries.length} 项真实正文查询通过。`)
