import { renderMermaid, resolveMermaidTheme } from '../lib/mermaid-render'

export const MERMAID_THEME_EVENT = 'easytier:theme-change'

export function mountMermaidDiagrams(root: ParentNode = document): () => void {
  const nodes = [...root.querySelectorAll<HTMLElement>('[data-mermaid]')]
  const versions = new Map<HTMLElement, number>()
  const requestedThemes = new Map<HTMLElement, string>()
  let disposed = false

  async function draw(node: HTMLElement) {
    const dark = document.documentElement.classList.contains('dark') || document.documentElement.dataset.theme === 'dark'
    const theme = resolveMermaidTheme(dark, node.dataset.mermaidTheme)
    if (node.dataset.renderedTheme === theme || requestedThemes.get(node) === theme || disposed) {
      return
    }
    const version = (versions.get(node) ?? 0) + 1
    versions.set(node, version)
    requestedThemes.set(node, theme)
    delete node.dataset.renderedTheme
    const diagram = node.querySelector<HTMLElement>('.mermaid__diagram')
    const status = node.querySelector<HTMLElement>('.mermaid__status')
    if (!diagram || !status) {
      requestedThemes.delete(node)
      return
    }
    node.setAttribute('aria-busy', 'true')
    status.hidden = false
    status.setAttribute('role', 'status')
    status.textContent = '正在绘制图表…'
    diagram.replaceChildren()
    try {
      const result = await renderMermaid(decodeURIComponent(node.dataset.mermaid ?? ''), theme)
      if (disposed || versions.get(node) !== version || !node.isConnected) {
        return
      }
      // Only strict-mode Mermaid output enters this sink, never authored HTML.
      diagram.innerHTML = result.svg
      result.bindFunctions?.(diagram)
      node.dataset.renderedTheme = theme
      status.hidden = true
    }
    catch (cause) {
      if (!disposed && versions.get(node) === version && node.isConnected) {
        status.setAttribute('role', 'alert')
        status.textContent = `图表绘制失败：${cause instanceof Error ? cause.message : String(cause)}`
      }
    }
    finally {
      if (!disposed && versions.get(node) === version) {
        requestedThemes.delete(node)
        node.setAttribute('aria-busy', 'false')
      }
    }
  }

  const drawAll = () => {
    for (const node of nodes) {
      void draw(node)
    }
  }
  const observer = new MutationObserver(drawAll)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
  window.addEventListener(MERMAID_THEME_EVENT, drawAll)
  drawAll()
  return () => {
    disposed = true
    observer.disconnect()
    window.removeEventListener(MERMAID_THEME_EVENT, drawAll)
    versions.clear()
    requestedThemes.clear()
  }
}

if (typeof document !== 'undefined') {
  let cleanup: (() => void) | undefined
  const start = () => {
    cleanup?.()
    cleanup = mountMermaidDiagrams()
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  }
  else {
    start()
  }
  document.addEventListener('astro:page-load', start)
  document.addEventListener('astro:before-swap', () => cleanup?.())
}
