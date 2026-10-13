import { parseHTML } from 'linkedom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MERMAID_THEME_EVENT, mountMermaidDiagrams } from '../src/scripts/mermaid'

const engine = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }))
vi.mock('mermaid', () => ({ default: engine }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

describe('Mermaid rendering queue', () => {
  it('serializes global theme configuration, isolates failure and removes every hidden container', async () => {
    const containers: { remove: ReturnType<typeof vi.fn>, setAttribute: ReturnType<typeof vi.fn> }[] = []
    vi.stubGlobal('document', {
      createElement: () => {
        const container = { style: {}, setAttribute: vi.fn(), remove: vi.fn() }
        containers.push(container)
        return container
      },
      body: { append: vi.fn() },
    })
    const { renderMermaid } = await import('../src/lib/mermaid-render')
    const first = Promise.withResolvers<{ svg: string }>()
    const started = Promise.withResolvers<void>()
    engine.render.mockImplementationOnce(() => {
      started.resolve()
      return first.promise
    }).mockRejectedValueOnce(new Error('Invalid diagram')).mockResolvedValueOnce({ svg: '<svg />' })

    const one = renderMermaid('flowchart LR; A-->B', 'forest')
    const two = renderMermaid('invalid', 'dark')
    const failure = expect(two).rejects.toThrow('Invalid diagram')
    const three = renderMermaid('flowchart LR; B-->C', 'neutral')
    await started.promise
    expect(engine.initialize).toHaveBeenCalledTimes(1)
    expect(engine.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'forest', securityLevel: 'strict', suppressErrorRendering: true, startOnLoad: false }))
    first.resolve({ svg: '<svg />' })
    await one
    await failure
    await expect(three).resolves.toEqual({ svg: '<svg />' })
    expect(engine.initialize.mock.calls.map(([config]) => config.theme)).toEqual(['forest', 'dark', 'neutral'])
    expect(new Set(engine.render.mock.calls.map(([id]) => id)).size).toBe(3)
    expect(containers).toHaveLength(3)
    for (const container of containers) {
      expect(container.remove).toHaveBeenCalledOnce()
      expect(container.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true')
    }
  })
})

function diagramDocument() {
  const { document, window } = parseHTML('<html><body><div data-mermaid="flowchart%20LR%3BA--%3EB"><p class="mermaid__status"></p><div class="mermaid__diagram"></div></div></body></html>')
  vi.stubGlobal('document', document)
  vi.stubGlobal('window', window)
  vi.stubGlobal('MutationObserver', window.MutationObserver)
  return { document, window, node: document.querySelector<HTMLElement>('[data-mermaid]')! }
}

describe('Mermaid client lifecycle', () => {
  it('discards queued stale themes and settles on the current app theme', async () => {
    const { document, window, node } = diagramDocument()
    const first = Promise.withResolvers<{ svg: string }>()
    const started = Promise.withResolvers<void>()
    engine.render.mockImplementationOnce(() => {
      started.resolve()
      return first.promise
    }).mockResolvedValue({ svg: '<svg data-fresh="true"></svg>' })
    const cleanup = mountMermaidDiagrams()
    try {
      await started.promise
      document.documentElement.classList.add('dark')
      window.dispatchEvent(new window.Event(MERMAID_THEME_EVENT))
      document.documentElement.classList.remove('dark')
      window.dispatchEvent(new window.Event(MERMAID_THEME_EVENT))
      first.resolve({ svg: '<svg data-stale="true"></svg>' })
      await vi.waitFor(() => expect(node.dataset.renderedTheme).toBe('default'))
      expect(node.querySelector('[data-stale]')).toBeNull()
      expect(node.querySelector('[data-fresh]')).not.toBeNull()
      expect(node.getAttribute('aria-busy')).toBe('false')
      expect(engine.initialize.mock.calls.map(([config]) => config.theme)).toEqual(['default', 'dark', 'default'])
    }
    finally {
      cleanup()
    }
  })

  it('leaves a removed page untouched and disconnects theme callbacks', async () => {
    const { window, node } = diagramDocument()
    const pending = Promise.withResolvers<{ svg: string }>()
    const started = Promise.withResolvers<void>()
    engine.render.mockImplementationOnce(() => {
      started.resolve()
      return pending.promise
    })
    const cleanup = mountMermaidDiagrams()
    await started.promise
    cleanup()
    pending.resolve({ svg: '<svg data-late="true"></svg>' })
    await vi.waitFor(() => expect(engine.render).toHaveBeenCalledOnce())
    window.dispatchEvent(new window.Event(MERMAID_THEME_EVENT))
    await Promise.resolve()
    expect(node.querySelector('[data-late]')).toBeNull()
    expect(engine.render).toHaveBeenCalledOnce()
  })
})
