import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const { values } = parseArgs({ options: { port: { type: 'string', default: '4173' } } })
const port = Number(values.port)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('--port 必须是 1–65535 之间的整数。')
}
const root = fileURLToPath(new URL('../dist/', import.meta.url))
await stat(path.join(root, 'index.html')).catch(() => {
  throw new Error('尚未构建网站，请先运行 pnpm docs:build。')
})
const mime: Record<string, string> = {
  '.md': 'text/markdown; charset=utf-8',
  '.mdx': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
  '.xml': 'application/xml; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.wasm': 'application/wasm',
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end()
    return
  }
  let pathname: string
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname)
  }
  catch {
    response.writeHead(400).end('Invalid URL')
    return
  }
  if (pathname === '/_headers' || pathname === '/_redirects') {
    response.writeHead(404).end('Not found')
    return
  }
  const resolved = path.resolve(root, `.${pathname}`)
  const relative = path.relative(root, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative) || pathname.includes('\0')) {
    response.writeHead(403).end('Forbidden')
    return
  }
  let target = path.join(root, '404.html')
  let status = 404
  const candidates = [resolved, ...(relative ? [`${resolved}.html`] : []), path.join(resolved, 'index.html')]
  for (const candidate of candidates) {
    if (await stat(candidate).then(info => info.isFile()).catch(() => false)) {
      target = candidate
      status = 200
      break
    }
  }
  response.writeHead(status, { 'Content-Type': mime[path.extname(target)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
  if (request.method === 'HEAD') {
    response.end()
    return
  }
  const stream = createReadStream(target)
  stream.on('error', () => response.destroy())
  stream.pipe(response)
})

server.on('error', (error) => {
  console.error(`本地预览启动失败：${error.message}`)
  process.exitCode = 1
})
// Explicit local binding for safe local reading.
server.listen(port, '127.0.0.1', () => {
  console.log(`本地阅读：http://127.0.0.1:${port}/（Ctrl+C 停止）`)
})
