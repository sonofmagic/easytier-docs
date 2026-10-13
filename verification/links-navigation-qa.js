/* eslint no-unused-expressions: off, unicorn/prefer-dom-node-text-content: off -- Playwright CLI evaluates this function; innerText checks rendered text. */
async (page) => {
  const base = await page.evaluate(() => location.origin)
  const manifestResponse = await page.request.get(`${base}/course-manifest.json`)
  if (!manifestResponse.ok()) {
    throw new Error('Course manifest unavailable')
  }
  const manifest = await manifestResponse.json()
  const routes = manifest.pages.map(entry => entry.route)
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
  const assets = new Set()
  for (const { from, href, pathname, hash } of links) {
    const route = pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/'
    if (route.startsWith('/downloads/')) {
      if (!assets.has(route)) {
        const response = await page.request.get(base + route)
        if (!response.ok()) {
          throw new Error(`Broken download: ${from} -> ${href}`)
        }
        assets.add(route)
      }
      continue
    }
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
  await page.getByRole('link', { name: manifest.lessons.find(entry => entry.route === '/chapters/02-packets').title, exact: true }).click()
  await page.waitForURL('**/chapters/02-packets')
  await page.goto(`${base}/chapters/01-why`)
  const quiz = page.locator('main details.answer').first()
  await quiz.locator('summary').click()
  if (!(await quiz.getAttribute('open') !== null)) {
    throw new Error('Quiz failed to expand')
  }
  await page.getByRole('link', { name: `下一章 ${manifest.lessons.find(entry => entry.route === '/chapters/02-packets').title}`, exact: true }).click()
  await page.waitForURL('**/chapters/02-packets')
  await page.goto(`${base}/basics/observe-a-request`)
  const next = manifest.lessons[5]
  await page.getByRole('link', { name: `下一章 ${next.title}`, exact: true }).click()
  await page.waitForURL('**/chapters/01-why')
  return { downloads: assets.size, beginnerToChapter: true, pages: pages.size, internalLinks: links.length, anchors, mobileMenu: true, quizExpansion: true, nextChapter: true }
}
