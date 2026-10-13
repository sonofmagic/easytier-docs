/* eslint no-unused-expressions: off, unicorn/prefer-dom-node-text-content: off -- Playwright CLI evaluates this function; innerText checks rendered content. */
async (page) => {
  const origin = await page.evaluate(() => location.origin)
  const report = { origin, date: new Date().toISOString(), search: [], pagefind: {}, headingTarget: null, beginnerFlow: [] }
  const check = (condition, message) => {
    if (!condition) {
      throw new Error(message)
    }
  }
  const querySearch = async (query, expectResults = true) => {
    await page.locator('.search-panel').evaluate(element => element.open = true)
    await page.locator('#docs-search').fill(query)
    await page.getByRole('button', { name: '搜索', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('[data-search-results]')?.getAttribute('aria-busy') === 'false')
    const result = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('[data-search-results] > li')]
      return {
        status: document.querySelector('#search-status')?.textContent ?? '',
        urls: rows.map(row => row.querySelector('a.search-result-title')?.getAttribute('href') ?? ''),
        safeSummary: rows.every((row) => {
          const summary = row.querySelector(':scope > p')
          return summary && summary.childElementCount === 0 && summary.textContent.trim().length > 0
        }),
        safeLinks: rows.every(row => [...row.querySelectorAll('a')].every((link) => {
          const url = new URL(link.href)
          return url.origin === location.origin && /^https?:$/.test(url.protocol)
        })),
      }
    })
    check((result.urls.length > 0) === expectResults, `Search result expectation: ${query}: ${result.status}`)
    check(!result.status.includes('暂时不可用') && !result.status.includes('失败'), `Both search providers available: ${query}`)
    const routes = await page.evaluate(urls => urls.map(url => new URL(url, location.origin).pathname), result.urls)
    check(routes.length === new Set(routes).size, `Top-level page deduplication: ${query}`)
    check(result.safeSummary && result.safeLinks, `Plain-text summaries and same-origin links: ${query}`)
    report.search.push({ query, pages: routes.length, status: result.status, deduplicated: true, safeSummary: true })
    return routes.toSorted()
  }
  try {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(origin)
    await page.locator('main h1').waitFor()
    for (const query of ['路', '洞', '卡', '服务', '回程', '中继']) {
      await querySearch(query)
    }
    const natRoutes = await querySearch('NAT')
    for (const query of ['nat', 'NaT']) {
      check(JSON.stringify(await querySearch(query)) === JSON.stringify(natRoutes), `NAT case-insensitive results: ${query}`)
    }
    const tunRoutes = await querySearch('TUN')
    check(JSON.stringify(await querySearch('tun')) === JSON.stringify(tunRoutes), 'TUN case-insensitive results')
    await querySearch('不存在的教学概念abcdef987654321', false)
    check((await page.locator('#search-status').innerText()).includes('没有找到'), 'Explicit no-result message')
    await querySearch('路由')
    const target = page.locator('.search-result-sections a[href*="#"]').first()
    await target.waitFor()
    const href = await target.getAttribute('href')
    check(href, 'Actual heading result has a URL')
    const destination = await page.evaluate((url) => {
      const target = new URL(url, location.origin)
      return { href: target.href, pathname: target.pathname }
    }, href)
    await target.click()
    await page.waitForURL(destination.href)
    await page.locator('main h1').waitFor()
    const heading = await page.evaluate(() => {
      const id = decodeURIComponent(location.hash.slice(1))
      const element = document.getElementById(id)
      return { id, text: element?.textContent ?? '', heading: element?.matches('h1, h2, h3, h4, h5, h6') ?? false }
    })
    check(heading.id && heading.heading && heading.text.trim(), 'Search heading click lands on a real heading anchor')
    report.headingTarget = { route: destination.pathname, anchor: heading.id, title: heading.text }
    report.pagefind = await page.evaluate(async () => {
      const module = await import('/pagefind/pagefind.js')
      const api = module.createInstance({ basePath: '/pagefind/', baseUrl: '/' })
      const counts = {}
      try {
        await api.init()
        for (const query of ['服务', '监听', '本机', '回环', '端口', '路由', '打洞', '网卡', 'NAT', 'TUN']) {
          counts[query] = (await api.search(query)).results.length
        }
        return counts
      }
      finally {
        await api.destroy()
      }
    })
    check(Object.values(report.pagefind).every(count => count > 0), 'Original Pagefind API finds all ten acceptance terms')
    await page.goto(origin)
    await page.getByRole('link', { name: '从本机预备课开始', exact: true }).click()
    const routes = ['/basics/browser-and-programs', '/basics/local-webpage', '/basics/read-a-url', '/basics/my-network', '/basics/observe-a-request', '/chapters/01-why']
    for (let index = 0; index < routes.length; index++) {
      const route = routes[index]
      await page.waitForURL(origin + route)
      await page.locator('main h1').waitFor()
      const exercises = page.locator('article details.answer')
      check(await exercises.count() === 2, `Two complete exercise answers: ${route}`)
      for (let answer = 0; answer < 2; answer++) {
        const detail = exercises.nth(answer)
        check(await detail.getAttribute('open') === null, `Answer starts folded: ${route}: ${answer + 1}`)
        await detail.locator('summary').click()
        check(await detail.getAttribute('open') !== null && (await detail.innerText()).trim().length > 30, `Exercise answer opens with explanation: ${route}: ${answer + 1}`)
      }
      const advanced = page.locator('article details.advanced')
      const count = await advanced.count()
      check(count > 0, `Optional advanced reading exists: ${route}`)
      for (let item = 0; item < count; item++) {
        const detail = advanced.nth(item)
        await detail.locator('summary').click()
        check(await detail.getAttribute('open') !== null && (await detail.innerText()).trim().length > 30, `Advanced reading opens: ${route}: ${item + 1}`)
      }
      report.beginnerFlow.push({ route, title: (await page.locator('main h1').innerText()).trim(), answers: 2, advanced: count })
      if (index + 1 < routes.length) {
        const next = page.locator('nav[aria-label="前后课"] a[rel="next"]')
        check(await next.getAttribute('href') === routes[index + 1], `Sequential beginner next-course destination: ${route}`)
        await next.click()
      }
    }
    report.beginnerBoundary = 'Reading-only flow; no local Python server, device-network change, scan or real-node probe.'
    return report
  }
  catch (error) {
    throw new Error(JSON.stringify({ ...report, failure: error.message }))
  }
}
