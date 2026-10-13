/** The supplemental index and the browser share exactly the same tokenizer. */
export function normalizeSearchText(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim()
}

export function queryParts(text: string): string[] {
  return [...new Set(normalizeSearchText(text).match(/\p{Script=Han}+|[a-z0-9_]+/gu) ?? [])]
}

export function tokenize(text: string): string[] {
  const tokens = new Set<string>()
  for (const run of queryParts(text)) {
    if (/\p{Script=Han}/u.test(run)) {
      const characters = Array.from(run)
      for (let index = 0; index < characters.length; index++) {
        tokens.add(characters[index]!)
        if (index + 1 < characters.length) {
          tokens.add(characters[index]! + characters[index + 1]!)
        }
      }
    }
    else {
      tokens.add(run)
    }
  }
  return [...tokens]
}

export interface SearchPageInput {
  url: string
  title: string
  blocks: { text: string, heading: string, anchor: string }[]
}

export interface SearchBlock {
  page: number
  heading: string
  anchor: string
  text: string
  normalizedText: string
}

export interface SearchIndex {
  version: 1
  pages: { url: string, title: string }[]
  blocks: SearchBlock[]
  postings: Record<string, number[]>
}

export interface SearchHit {
  url: string
  title: string
  heading: string
  /** Plain text. Render with textContent, never innerHTML. */
  excerpt: string
  source: 'pagefind' | 'supplement'
  subResults?: { title: string, url: string }[]
}

export const searchAcceptanceQueries = ['服务', '监听', '本机', '回环', '端口', '路由', '打洞', '网卡', 'NAT', 'TUN', '路', '洞', '卡', '回程', '中继', 'DNS', 'MTU', 'Noise', 'QUIC', 'KCP', '封装', '控制面', '抓包'] as const

/** Reject external/active URLs, normalize both Astro and Pagefind URL shapes. */
export function canonicalSearchUrl(href: string, origin = 'https://easytier.icebreaker.top'): string | null {
  try {
    const url = new URL(href, origin)
    if (url.origin !== new URL(origin).origin || !/^https?:$/.test(url.protocol)) {
      return null
    }
    const route = url.pathname.replace(/(?:\/index)?\.html$/u, '').replace(/\/+$/u, '') || '/'
    return `${route}${url.hash}`
  }
  catch {
    return null
  }
}

export function createSearchIndex(pages: SearchPageInput[]): SearchIndex {
  const index: SearchIndex = { version: 1, pages: [], blocks: [], postings: Object.create(null) as Record<string, number[]> }
  for (const page of pages) {
    const url = canonicalSearchUrl(page.url)
    if (!url || url.includes('#') || index.pages.some(item => item.url === url)) {
      throw new Error(`Invalid or duplicate search page: ${page.url}`)
    }
    const pageId = index.pages.push({ url, title: page.title }) - 1
    for (const block of page.blocks) {
      const text = block.text.replace(/\s+/gu, ' ').trim()
      if (!text) {
        continue
      }
      const blockId = index.blocks.push({ page: pageId, heading: block.heading, anchor: block.anchor, text, normalizedText: normalizeSearchText(text) }) - 1
      for (const term of tokenize(text)) {
        (index.postings[term] ??= []).push(blockId)
      }
    }
  }
  return index
}

/** Ngram intersection is only a candidate filter; contiguous phrase checks matter. */
export function matchesQuery(text: string, query: string): boolean {
  const parts = queryParts(query)
  if (!parts.length) {
    return false
  }
  const normalized = normalizeSearchText(text)
  const words = new Set(queryParts(text).filter(part => !/\p{Script=Han}/u.test(part)))
  return parts.every(part => /\p{Script=Han}/u.test(part) ? normalized.includes(part) : words.has(part))
}

export function summarize(text: string, query: string, length = 160): string {
  const clean = text.replace(/\s+/gu, ' ').trim()
  if (clean.length <= length) {
    return clean
  }
  const normalized = normalizeSearchText(clean)
  const match = queryParts(query).map(part => normalized.indexOf(part)).filter(position => position >= 0).sort((a, b) => a - b)[0] ?? 0
  // A little preceding context keeps the match understandable. NFKC can change
  // offsets, so this is an excerpt hint only, never part of match validation.
  const start = Math.max(0, match - 36)
  return `${start ? '…' : ''}${clean.slice(start, start + length)}${start + length < clean.length ? '…' : ''}`
}

function textRank(text: string, query: string): number {
  const normalized = normalizeSearchText(text)
  const phrase = normalizeSearchText(query)
  if (normalized === phrase) {
    return 2
  }
  return phrase && normalized.includes(phrase) ? 1 : 0
}

function hitRank(hit: SearchHit, query: string): number {
  return textRank(hit.title, query) * 100 + textRank(hit.heading, query) * 10 + (hit.source === 'pagefind' ? 1 : 0)
}

/** One result per page, retaining usable heading links from both providers. */
export function combineSearchResults(native: SearchHit[], supplement: SearchHit[], query: string, limit = 20): SearchHit[] {
  const unique = new Map<string, SearchHit>()
  for (const incoming of [...native, ...supplement]) {
    const url = canonicalSearchUrl(incoming.url)
    if (!url) {
      continue
    }
    const key = url.split('#')[0]!
    const hit = { ...incoming, url, subResults: [...(incoming.subResults ?? [])] }
    const existing = unique.get(key)
    const best = existing && hitRank(existing, query) >= hitRank(hit, query) ? existing : hit
    const headingLinks = [
      ...(existing?.subResults ?? []),
      ...(existing?.heading ? [{ title: existing.heading, url: existing.url }] : []),
      ...(hit.subResults ?? []),
      ...(hit.heading ? [{ title: hit.heading, url: hit.url }] : []),
    ]
    best.subResults = [...new Map(headingLinks.flatMap((item) => {
      const target = canonicalSearchUrl(item.url)
      return target && target.split('#')[0] === key ? [[target, { title: item.title, url: target }] as const] : []
    })).values()].slice(0, 4)
    unique.set(key, best)
  }
  return [...unique.values()].sort((a, b) => hitRank(b, query) - hitRank(a, query)).slice(0, limit)
}

export function searchSupplement(index: SearchIndex, query: string, limit = 20): SearchHit[] {
  const terms = tokenize(query)
  if (!terms.length) {
    return []
  }
  const postings = terms.map(term => Object.hasOwn(index.postings, term) ? index.postings[term]! : []).sort((a, b) => a.length - b.length)
  if (!postings[0]?.length) {
    return []
  }
  const sets = postings.slice(1).map(posting => new Set(posting))
  const hits: SearchHit[] = []
  for (const blockId of postings[0]) {
    if (!sets.every(set => set.has(blockId))) {
      continue
    }
    const block = index.blocks[blockId]!
    if (!matchesQuery(block.normalizedText, query)) {
      continue
    }
    const page = index.pages[block.page]!
    hits.push({
      url: `${page.url}${block.anchor ? `#${encodeURIComponent(block.anchor)}` : ''}`,
      title: page.title,
      heading: block.heading,
      excerpt: summarize(block.text, query),
      source: 'supplement',
    })
  }
  return combineSearchResults([], hits, query, limit)
}

export function isSearchIndex(value: unknown): value is SearchIndex {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Partial<SearchIndex>
  return candidate.version === 1 && Array.isArray(candidate.pages) && Array.isArray(candidate.blocks) && !!candidate.postings && typeof candidate.postings === 'object'
}
