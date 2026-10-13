import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { tokenize } from '../.vitepress/data/course'

interface SearchDocument { id: string, text: string }
interface SearchIndex {
  addAll: (documents: SearchDocument[]) => void
  search: (query: string, options: { combineWith: 'AND', prefix: boolean }) => { id: string }[]
}

// Use VitePress's own MiniSearch dependency so the tested engine matches the site.
const requireFromVitePress = createRequire(import.meta.resolve('vitepress'))
const MiniSearch = requireFromVitePress('minisearch') as new (options: {
  fields: string[]
  tokenize: (text: string) => string[]
}) => SearchIndex

function createIndex() {
  const index = new MiniSearch({ fields: ['text'], tokenize })
  index.addAll([
    { id: 'routing', text: '操作系统先查路由表，再选择数据包的下一跳。' },
    { id: 'nat', text: '双方主动发包进行UDP打洞，让NAT映射与过滤满足条件。' },
    { id: 'tun', text: 'EasyTier从TUN虚拟接口取得IP包，交给节点转发。' },
  ])
  return index
}

describe('中文与协议名称的本地搜索', () => {
  it('英文协议名称不区分大小写，重复词不制造重复 token', () => {
    expect(tokenize('NAT nat NaT TUN tun TuN')).toEqual(['nat', 'tun'])
  })

  it('连续中文正文包含路由和打洞的完整双字查询词', () => {
    const terms = tokenize('操作系统查路由表然后尝试UDP打洞')
    expect(terms).toEqual(expect.arrayContaining(['路由', '打洞', 'udp']))
    expect(terms).not.toContain('操作系统查路由表然后尝试')
  })

  it.each([
    ['路由', 'routing'],
    ['打洞', 'nat'],
    ['NAT', 'nat'],
    ['nAt', 'nat'],
    ['TUN', 'tun'],
    ['tUn', 'tun'],
  ])('真实 MiniSearch 索引能用 %s 找到 %s 正文', (query, expected) => {
    expect(createIndex().search(query, { combineWith: 'AND', prefix: true }).map(hit => hit.id)).toContain(expected)
  })

  it('组合查询同时满足中文概念和英文协议，避免只命中其中一个词', () => {
    const index = createIndex()
    expect(index.search('NAT 打洞', { combineWith: 'AND', prefix: true }).map(hit => hit.id)).toEqual(['nat'])
    expect(index.search('NAT 路由', { combineWith: 'AND', prefix: true })).toEqual([])
  })

  it('空白和标点不会成为查询 token', () => {
    expect(tokenize('  ，。！？—  ')).toEqual([])
    expect(tokenize('TCP/IP，UDP:8080')).toEqual(['tcp', 'ip', 'udp', '8080'])
  })
})
