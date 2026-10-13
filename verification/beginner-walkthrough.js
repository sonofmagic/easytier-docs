/* eslint no-unused-expressions: off, unicorn/prefer-dom-node-text-content: off -- Runs in the task-owned Playwright CLI session. */
async (page) => {
  const base = await page.evaluate(() => location.origin)
  const response = await page.request.get(`${base}/course-manifest.json`)
  const manifest = await response.json()
  const lessons = manifest.lessons.filter(lesson => lesson.kind === 'basics')
  const visited = []
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(base)
  await page.getByRole('link', { name: '从本机预备课开始' }).click()
  for (let index = 0; index < lessons.length; index++) {
    const lesson = lessons[index]
    await page.waitForURL(`${base}${lesson.route}`)
    await page.locator('main h1').waitFor()
    const answer = page.locator('details.answer').first()
    await answer.locator('summary').click()
    if (await answer.getAttribute('open') === null) {
      throw new Error(`Answer did not expand: ${lesson.route}`)
    }
    visited.push(lesson.route)
    const next = manifest.lessons[index + 1]
    await page.getByRole('link', { name: `下一章 ${next.title}`, exact: true }).click()
  }
  await page.waitForURL('**/chapters/01-why')
  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('Network.enable')
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
    const demo = 'http://127.0.0.1:8877'
    const home = await page.goto(`${demo}/`)
    if (home.status() !== 200) {
      throw new Error('Demo homepage did not return 200')
    }
    await page.getByRole('heading', { name: '这是我电脑上的网页', exact: true }).waitFor()
    await page.screenshot({ path: 'verification/local-webpage-browser.png' })
    await page.getByRole('link', { name: '请求存在的文字文件：message.txt', exact: true }).click()
    await page.waitForURL('**/message.txt')
    if (!(await page.locator('body').innerText()).includes('你看见了浏览器向本机服务发出的一次请求')) {
      throw new Error('Demo message not readable in browser')
    }
    const missing = await page.goto(`${demo}/not-here.txt`)
    if (missing.status() !== 404 || !(await page.locator('body').innerText()).includes('404')) {
      throw new Error('Missing path did not show an HTTP 404 response')
    }
    return { visited, continuedToChapter1: true, demo: { home: 200, messageReadable: true, missing: 404, browserCacheDisabled: true }, next: 'Stop only the task-owned demo server, then verify a fresh request fails.' }
  }
  finally {
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: false })
    await cdp.detach()
  }
}
