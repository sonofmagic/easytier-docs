import type { SearchHit, SearchIndex } from '../lib/search.ts'
import { combineSearchResults, isSearchIndex, queryParts, searchSupplement } from '../lib/search.ts'
import { createPagefindSearch } from './pagefind.ts'

export function renderSearchResults(container: HTMLElement, hits: SearchHit[]) {
  const fragment = document.createDocumentFragment()
  for (const hit of hits) {
    const item = document.createElement('li')
    const link = document.createElement('a')
    link.href = hit.url
    link.className = 'search-result-title'
    link.textContent = hit.title
    const excerpt = document.createElement('p')
    excerpt.textContent = hit.excerpt
    item.append(link, excerpt)
    if (hit.subResults?.length) {
      const sections = document.createElement('ul')
      sections.className = 'search-result-sections'
      for (const section of hit.subResults) {
        const row = document.createElement('li')
        const target = document.createElement('a')
        target.href = section.url
        target.textContent = section.title
        row.append(target)
        sections.append(row)
      }
      item.append(sections)
    }
    fragment.append(item)
  }
  container.replaceChildren(fragment)
}

export function mountSearch(root: HTMLElement): () => void {
  const form = root.querySelector<HTMLFormElement>('form')!
  const input = root.querySelector<HTMLInputElement>('input')!
  const status = root.querySelector<HTMLElement>('[role="status"]')!
  const results = root.querySelector<HTMLElement>('[data-search-results]')!
  const submit = form.querySelector<HTMLButtonElement>('button')!
  const base = `${(root.dataset.base ?? '/').replace(/\/+$/u, '')}/`
  const native = createPagefindSearch(base, window.location.origin)
  const lifetime = new AbortController()
  let index: Promise<SearchIndex> | undefined
  let request = 0
  let debounce: ReturnType<typeof setTimeout> | undefined

  function loadIndex() {
    index ??= fetch(`${base}search/chinese-index.json`, { signal: lifetime.signal }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Search index: HTTP ${response.status}`)
      }
      const value: unknown = await response.json()
      if (!isSearchIndex(value)) {
        throw new Error('Invalid search index')
      }
      return value
    }).catch((error: unknown) => {
      index = undefined
      throw error
    })
    return index
  }

  async function search() {
    const current = ++request
    const query = input.value.trim()
    if (!queryParts(query).length) {
      results.replaceChildren()
      status.textContent = query ? '请输入中文词语或英文术语。' : ''
      submit.disabled = false
      results.setAttribute('aria-busy', 'false')
      return
    }
    submit.disabled = true
    results.setAttribute('aria-busy', 'true')
    status.textContent = '正在搜索正文…'
    const responses = await Promise.allSettled([
      native.search(query),
      loadIndex().then(value => searchSupplement(value, query)),
    ])
    if (current !== request || lifetime.signal.aborted) {
      return
    }
    const hits = combineSearchResults(
      responses[0].status === 'fulfilled' ? responses[0].value : [],
      responses[1].status === 'fulfilled' ? responses[1].value : [],
      query,
    )
    const failed = responses.filter(response => response.status === 'rejected').length
    renderSearchResults(results, hits)
    status.textContent = failed === 2
      ? '搜索索引加载失败，请刷新后重试。开发时请先构建并预览网站。'
      : hits.length
        ? `找到 ${hits.length} 个相关页面${failed ? '；部分搜索暂时不可用。' : '。'}`
        : `没有找到“${query}”，试试较短词语。${failed ? '部分搜索暂时不可用。' : ''}`
    submit.disabled = false
    results.setAttribute('aria-busy', 'false')
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    clearTimeout(debounce)
    void search()
  }, { signal: lifetime.signal })
  input.addEventListener('input', () => {
    ++request
    clearTimeout(debounce)
    debounce = setTimeout(() => void search(), 220)
    // Clearing input must also recover the submit control after an old request.
    if (!input.value.trim()) {
      submit.disabled = false
      results.setAttribute('aria-busy', 'false')
      results.replaceChildren()
      status.textContent = ''
    }
  }, { signal: lifetime.signal })
  root.addEventListener('toggle', () => {
    if ((root as HTMLDetailsElement).open) {
      input.focus()
    }
  }, { signal: lifetime.signal })
  return () => {
    lifetime.abort()
    ++request
    clearTimeout(debounce)
    void native.destroy()
  }
}
