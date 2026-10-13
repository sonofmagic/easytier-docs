/* eslint no-unused-expressions: off, unicorn/prefer-dom-node-text-content: off -- Playwright CLI evaluates this function; innerText checks rendered text. */
async (page) => {
  const base = await page.evaluate(() => location.origin)
  const slugs = ['01-why', '02-packets', '03-addresses', '04-protocols', '05-routing', '06-nat', '07-tun', '08-startup', '09-membership', '10-stun', '11-hole-punch', '12-security', '13-relay', '14-topology', '15-journey', '16-subnet-proxy', '17-apps-dns', '18-performance', '19-diagnostics', '20-practice']
  const routes = ['/', '/course', '/labs', '/glossary', '/sources', '/cases/local-gui', ...slugs.map(slug => `/chapters/${slug}`)]
  const pages = new Map()
  const links = []
  for (const route of routes) {
    await page.goto(base + route)
    await page.locator('main h1').waitFor()
    const data = await page.evaluate(() => ({
      ids: [...document.querySelectorAll('[id]')].map(el => el.id),
      links: [...document.querySelectorAll('a[href]')].map(el => new URL(el.href)).filter(url => url.origin === location.origin).map(url => ({ href: url.href, pathname: url.pathname, hash: decodeURIComponent(url.hash.slice(1)) })),
    }))
    pages.set(route, new Set(data.ids))
    links.push(...data.links.map(link => ({ from: route, ...link })))
  }
  let anchors = 0
  for (const { from, href, pathname, hash } of links) {
    const route = pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/'
    const ids = pages.get(route)
    if (!ids) {
      throw new Error(`Unknown internal route: ${from} -> ${href}`)
    }
    if (hash) {
      anchors++
      if (!ids.has(hash)) {
        throw new Error(`Broken anchor: ${from} -> ${href}`)
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/chapters/01-why`)
  await page.getByRole('button', { name: '章节目录', exact: true }).click()
  await page.getByRole('link', { name: '02 请求怎样变成数据包', exact: true }).click()
  await page.waitForURL('**/chapters/02-packets')
  await page.goto(`${base}/chapters/01-why`)
  const quiz = page.locator('main details').first()
  await quiz.locator('summary').click()
  if (!(await quiz.getAttribute('open') !== null)) {
    throw new Error('Quiz failed to expand')
  }
  await page.getByRole('link', { name: '下一章 02 请求怎样变成数据包', exact: true }).click()
  await page.waitForURL('**/chapters/02-packets')
  return { pages: pages.size, internalLinks: links.length, anchors, mobileMenu: true, quizExpansion: true, nextChapter: true }
}
