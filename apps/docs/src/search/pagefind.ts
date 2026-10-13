import type { SearchHit } from '../lib/search.ts'
import { canonicalSearchUrl, matchesQuery } from '../lib/search.ts'

interface PagefindData {
  url: string
  /** Pagefind 1.5.2 returns the entire indexed body as plain text. */
  content: string
  meta: { title?: string }
  excerpt?: string
  sub_results?: { title: string, url: string }[]
}

interface PagefindInstance {
  init: () => Promise<void>
  search: (query: string) => Promise<{ results: { data: () => Promise<PagefindData> }[] }>
  destroy: () => Promise<void>
}

interface PagefindModule {
  createInstance: (options: { basePath: string, baseUrl: string }) => PagefindInstance
}

/** Native token matches are candidates; require evidence in the complete body. */
export function pagefindHit(page: PagefindData, query: string, origin: string): SearchHit | null {
  const url = canonicalSearchUrl(page.url, origin)
  if (!url || typeof page.content !== 'string' || !matchesQuery(page.content, query)) {
    return null
  }
  // An excerpt can omit query parts elsewhere in the page. Use it only for
  // presentation, after full-content validation, and decode highlights safely.
  const excerpt = new DOMParser().parseFromString(page.excerpt ?? '', 'text/html').body.textContent ?? ''
  return { url, title: page.meta.title ?? url, heading: '', excerpt, source: 'pagefind', subResults: page.sub_results?.flatMap((item) => {
    const target = canonicalSearchUrl(item.url, origin)
    return target ? [{ title: item.title, url: target }] : []
  }) }
}

/** Pagefind is generated after Vite builds. It must remain an external import. */
export function createPagefindSearch(base: string, origin: string) {
  let loading: Promise<PagefindInstance> | undefined
  let instance: PagefindInstance | undefined
  let disposed = false
  const baseUrl = `${base.replace(/\/+$/u, '')}/`
  async function load() {
    loading ??= import(/* @vite-ignore */ `${baseUrl}pagefind/pagefind.js`).then(async (module: PagefindModule) => {
      if (typeof module.createInstance !== 'function') {
        throw new TypeError('Pagefind 1.5.2 createInstance is required')
      }
      const api = module.createInstance({ basePath: `${baseUrl}pagefind/`, baseUrl })
      try {
        await api.init()
        if (disposed) {
          throw new Error('Search has been disposed')
        }
        instance = api
        return api
      }
      catch (error) {
        await api.destroy()
        throw error
      }
    }).catch((error: unknown) => {
      loading = undefined
      throw error
    })
    return loading
  }
  return {
    async search(query: string): Promise<SearchHit[]> {
      const api = await load()
      const response = await api.search(query)
      const pages = await Promise.all(response.results.slice(0, 30).map(result => result.data()))
      return pages.flatMap((page) => {
        const hit = pagefindHit(page, query, origin)
        return hit ? [hit] : []
      })
    },
    async destroy() {
      disposed = true
      await instance?.destroy()
      instance = undefined
    },
  }
}
