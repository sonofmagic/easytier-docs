import { DOMParser, parseHTML } from 'linkedom'
import { describe, expect, it, vi } from 'vitest'
import { canonicalSearchUrl, combineSearchResults, createSearchIndex, matchesQuery, normalizeSearchText, searchSupplement, summarize, tokenize } from '../src/lib/search.ts'
import { renderSearchResults } from '../src/search/client.ts'
import { extractSearchPage } from '../src/search/extract.ts'
import { pagefindHit } from '../src/search/pagefind.ts'

const index = createSearchIndex([
  { url: '/routing', title: '路由', blocks: [{ heading: '系统如何选择', anchor: '系统如何选择', text: '操作系统先查路由表，再选择数据包的下一跳。' }] },
  { url: '/nat', title: 'NAT 与 UDP 打洞', blocks: [{ heading: '双向探测', anchor: '双向探测', text: '双方主动发包进行 UDP 打洞，让 NAT 映射与过滤满足条件。' }] },
  { url: '/tun', title: 'TUN 网卡', blocks: [{ heading: '虚拟接口', anchor: '虚拟接口', text: 'EasyTier 从 TUN 虚拟网卡取得 IP 包。服务监听端口，通过本机回环地址观察回应。' }] },
  { url: '/reordered', title: '不能命中长词', blocks: [{ heading: '词序', anchor: '词序', text: '甲乙、丙丁、乙丙分开出现，NAT64 也不是 NAT。' }] },
])

describe('正文中文与英文搜索', () => {
  it('索引单字和相邻双字，英文大小写与全角兼容，按 code point 处理汉字', () => {
    expect(tokenize('查路由 NAT nat ＴＵＮ')).toEqual(['查', '查路', '路', '路由', '由', 'nat', 'tun'])
    expect(tokenize('𠮷野')).toEqual(['𠮷', '𠮷野', '野'])
    expect(normalizeSearchText('Ａ NAT\n地址')).toBe('a nat 地址')
  })

  it.each([
    ['路', '/routing'],
    ['路由', '/routing'],
    ['打洞', '/nat'],
    ['网卡', '/tun'],
    ['NAT', '/nat'],
    ['nAt', '/nat'],
    ['TUN', '/tun'],
    ['ＴＵＮ', '/tun'],
    ['服务', '/tun'],
    ['监听', '/tun'],
    ['本机', '/tun'],
    ['回环', '/tun'],
    ['端口', '/tun'],
  ])('%s 从实际文本找到 %s', (query, route) => {
    expect(searchSupplement(index, query).map(hit => hit.url.split('#')[0])).toContain(route)
  })

  it('组合词必须同块满足；不能把散落的双字当作完整长词', () => {
    expect(searchSupplement(index, 'NAT 打洞').map(hit => hit.url.split('#')[0])).toEqual(['/nat'])
    expect(searchSupplement(index, 'NAT 路由')).toEqual([])
    expect(searchSupplement(index, '甲乙丙丁')).toEqual([])
    expect(matchesQuery('NAT64 映射', 'NAT')).toBe(false)
    expect(matchesQuery('NAT 地址', 'NAT')).toBe(true)
  })

  it('空、标点、未知词无结果；混合字词不跨标点造双字', () => {
    expect(tokenize('  ，。！？—  ')).toEqual([])
    expect(tokenize('TCP/IP，UDP:8080')).toEqual(['tcp', 'ip', 'udp', '8080'])
    expect(tokenize('路，由')).not.toContain('路由')
    expect(searchSupplement(index, '')).toEqual([])
    expect(searchSupplement(index, '不存在的术语')).toEqual([])
    expect(searchSupplement(JSON.parse(JSON.stringify(index)), 'constructor __proto__')).toEqual([])
  })

  it('真实可见正文进入索引，隐藏区域和导航不进入；折叠答案仍可阅读与搜索', () => {
    const page = extractSearchPage('<!doctype html><html><head><title>Page</title></head><body><nav>外部导航</nav><main data-pagefind-body><h1>页面</h1><h2 id="标题">观察</h2><p>虚拟 <code>TUN</code> 网卡</p><p hidden>秘密文本</p><div data-pagefind-ignore><p>忽略正文</p></div><p><span hidden>隐藏词</span>保留文字</p><details><summary>练习</summary><p>折叠答案</p></details><script>脚本词</script></main></body></html>', '/test')
    const actual = createSearchIndex([page])
    expect(searchSupplement(actual, 'TUN')[0]!.url).toBe('/test#%E6%A0%87%E9%A2%98')
    expect(searchSupplement(actual, '折叠')).toHaveLength(1)
    for (const word of ['秘密', '忽略', '隐藏', '脚本', '导航']) {
      expect(searchSupplement(actual, word)).toEqual([])
    }
  })

  it('合并 Pagefind/补充结果按页面去重，保留可靠章节锚点与确定排序', () => {
    const supplemental = searchSupplement(index, '路由')
    const merged = combineSearchResults([
      { url: '/routing.html', title: '路由', heading: '', excerpt: '原生结果', source: 'pagefind', subResults: [{ title: '系统如何选择', url: '/routing#%E7%B3%BB%E7%BB%9F%E5%A6%82%E4%BD%95%E9%80%89%E6%8B%A9' }] },
      { url: 'https://evil.invalid/', title: '外部结果', heading: '', excerpt: '', source: 'pagefind' },
    ], supplemental, '路由')
    expect(merged).toHaveLength(1)
    expect(merged[0]!.source).toBe('pagefind')
    expect(merged[0]!.subResults).toHaveLength(1)
    expect(merged[0]!.subResults![0]!.url).toContain('#')
    expect(canonicalSearchUrl('/routing/index.html#step')).toBe('/routing#step')
    expect(canonicalSearchUrl('javascript:alert(1)')).toBeNull()
    expect(canonicalSearchUrl('//evil.invalid/')).toBeNull()
  })

  it('Pagefind 候选必须在完整正文中满足连续中文及每个英文词，不能接受模糊命中', () => {
    const candidate = { url: '/nat.html', meta: { title: 'NAT' }, excerpt: '部分词命中的摘要' }
    expect(pagefindHit({ ...candidate, content: '不存在的文件返回 404，教学中应该区分回应。' }, '不存在的教学概念abcdef987654321', 'https://easytier.icebreaker.top')).toBeNull()
    expect(pagefindHit({ ...candidate, content: '甲乙、丙丁、乙丙分别出现。' }, '甲乙丙丁', 'https://easytier.icebreaker.top')).toBeNull()
    expect(pagefindHit({ ...candidate, content: 'NAT64 的映射。' }, 'NAT', 'https://easytier.icebreaker.top')).toBeNull()
    expect(pagefindHit({ ...candidate, content: 'NAT 映射存在。' }, 'NAT 打洞', 'https://easytier.icebreaker.top')).toBeNull()
    expect(pagefindHit({ ...candidate, content: undefined as unknown as string }, 'NAT', 'https://easytier.icebreaker.top')).toBeNull()
  })

  it('完整正文匹配保留摘要以外的命中，展示文本去掉 Pagefind 高亮 HTML', () => {
    vi.stubGlobal('DOMParser', DOMParser)
    try {
      const candidate = {
        url: '/nat.html',
        meta: { title: 'NAT 与打洞' },
        content: `NAT 映射。${'正文中的其他说明。'.repeat(100)}双方 UDP 打洞。`,
        excerpt: '<html><body><mark>NAT</mark> 映射。</body></html>',
        sub_results: [{ title: '双向探测', url: '/nat.html#双向探测' }],
      }
      const hit = pagefindHit(candidate, 'nat 打洞', 'https://easytier.icebreaker.top')
      expect(hit).toMatchObject({ url: '/nat', title: 'NAT 与打洞', excerpt: 'NAT 映射。', source: 'pagefind' })
      expect(hit!.subResults).toEqual([{ title: '双向探测', url: '/nat#%E5%8F%8C%E5%90%91%E6%8E%A2%E6%B5%8B' }])
    }
    finally {
      vi.unstubAllGlobals()
    }
  })

  it('摘要保持纯文本，结果渲染不执行提供方的 HTML', () => {
    const { document } = parseHTML('<html><body><ul id="results"></ul></body></html>')
    vi.stubGlobal('document', document)
    try {
      const text = '<img src=x onerror=alert(1)> 路由 <script>alert(2)</script>'
      const container = document.getElementById('results')! as unknown as HTMLElement
      renderSearchResults(container, [{ url: '/routing', title: text, heading: '', excerpt: summarize(text, '路由'), source: 'supplement' }])
      expect(container.textContent).toContain(text)
      expect(container.querySelector('img,script')).toBeNull()
      expect(container.innerHTML).toContain('&lt;img')
    }
    finally {
      vi.unstubAllGlobals()
    }
  })

  it('拒绝重名/外部页面并限制摘要与结果数量', () => {
    expect(() => createSearchIndex([{ url: 'https://evil.invalid', title: 'x', blocks: [] }])).toThrow()
    expect(() => createSearchIndex([{ url: '/', title: 'x', blocks: [] }, { url: '/', title: 'y', blocks: [] }])).toThrow()
    expect(searchSupplement(index, 'IP', 1).length).toBeLessThanOrEqual(1)
    expect(summarize(`${'前文'.repeat(100)}路由${'后文'.repeat(100)}`, '路由')).toContain('路由')
  })
})
