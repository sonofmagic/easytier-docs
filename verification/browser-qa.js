/* eslint no-unused-expressions: off, unicorn/prefer-dom-node-text-content: off -- Playwright CLI evaluates this function; innerText checks rendered text. */
async (page) => {
  const base = await page.evaluate(() => location.origin)
  const output = 'verification'
  const errors = []
  const failures = []
  const onError = error => errors.push(error.message)
  const onResponse = (response) => {
    if (response.status() >= 400) {
      failures.push(`${response.status()} ${response.url()}`)
    }
  }
  page.on('pageerror', onError)
  page.on('response', onResponse)
  const report = { pages: 0, diagrams: 0, search: [], interactions: [], mobile: [], errors, failures }
  const check = (condition, message) => {
    if (!condition) {
      throw new Error(message)
    }
  }
  const equalText = async (locator, expected) => {
    await locator.filter({ hasText: expected }).waitFor()
    check((await locator.innerText()).trim() === expected, `Expected ${expected}`)
  }
  try {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(base)
    await page.getByRole('heading', { name: /先在自己的电脑上/ }).waitFor()
    await page.screenshot({ path: `${output}/home-desktop.png`, fullPage: true })
    await page.getByRole('link', { name: '从本机预备课开始' }).click()
    await page.waitForURL('**/basics/browser-and-programs')
    check(page.url().endsWith('/basics/browser-and-programs'), 'Beginner entry navigation')
    const manifestResponse = await page.request.get(`${base}/course-manifest.json`)
    check(manifestResponse.ok(), 'Course manifest available')
    const manifest = await manifestResponse.json()
    const routes = manifest.pages.map(entry => entry.route)
    check(routes.length === 32, 'All 32 pages in central manifest')
    for (const route of routes) {
      await page.goto(base + route)
      await page.locator('main h1').waitFor()
      check(await page.locator('main h1').count() === 1, `Single H1: ${route}`)
      const count = await page.locator('.mermaid').count()
      if (count) {
        await page.waitForFunction(() => [...document.querySelectorAll('.mermaid')].every(el => el.getAttribute('aria-busy') === 'false'), null, { timeout: 20000 })
        check(await page.locator('.mermaid [role=alert]').count() === 0, `Diagram errors: ${route}`)
        check(await page.locator('.mermaid svg').count() === count, `Rendered diagrams: ${route}`)
      }
      report.pages++
      report.diagrams += count
    }
    await page.goto(`${base}/labs`)
    const packet = page.getByTestId('packet-lab')
    await equalText(packet.getByTestId('packet-step'), 'A 发出业务请求')
    check(await packet.locator('.packet-transport').getAttribute('open') === null, 'Transport detail starts collapsed')
    await packet.locator('.packet-transport summary').click()
    check(await packet.locator('.outer-fields').isVisible(), 'Transport detail expands')
    for (let i = 0; i < 7; i++) {
      await packet.getByRole('button', { name: '下一步', exact: true }).click()
    }
    await equalText(packet.getByTestId('packet-step'), 'B 发出业务响应')
    check((await packet.locator('.inner-fields').innerText()).includes('10.144.144.2:8080'), 'Reply source address')
    await packet.getByRole('combobox', { name: '传输路径' }).selectOption('relay')
    await equalText(packet.getByTestId('packet-step'), 'A 发出业务请求')
    for (let i = 0; i < 4; i++) {
      await packet.getByRole('button', { name: '下一步', exact: true }).click()
    }
    await equalText(packet.getByTestId('packet-step'), 'R 转发给目标节点')
    check((await packet.locator('.inner-fields').innerText()).includes('10.144.144.2:8080'), 'Relay preserves business destination')
    for (let i = 0; i < 11; i++) {
      await packet.getByRole('button', { name: '下一步', exact: true }).click()
    }
    await equalText(packet.getByTestId('packet-step'), 'A 的应用收到响应')
    check(await packet.getByRole('button', { name: '下一步', exact: true }).isDisabled(), 'No step after completion')
    await packet.getByRole('button', { name: '重新开始' }).click()
    check(await packet.getByRole('button', { name: '上一步', exact: true }).isDisabled(), 'Packet reset')
    report.interactions.push('Packet: reply addresses, relay, completion, mode change and reset')
    const nat = page.getByTestId('nat-lab')
    for (const preset of ['open', 'bilateral', 'dependent']) {
      await nat.getByRole('combobox', { name: '网络预设' }).selectOption(preset)
      for (let i = 0; i < 5; i++) {
        await nat.getByRole('button', { name: '下一步', exact: true }).click()
      }
      const result = (await nat.getByTestId('nat-result').innerText()).trim()
      check(result === (preset === 'dependent' ? '当前探测失败，可中继' : '模型中双向直连成功'), `NAT preset ${preset}`)
      await nat.getByRole('button', { name: '重置实验' }).click()
      check(await nat.locator('tbody tr').count() === 1 && (await nat.locator('tbody').innerText()).includes('还没有产生映射'), 'NAT reset table')
    }
    report.interactions.push('NAT: all three presets, result and reset')
    const topology = page.getByTestId('topology-lab')
    await equalText(topology.getByTestId('selected-route'), 'A → B')
    await topology.getByRole('combobox', { name: '选路指标' }).selectOption('latency')
    await equalText(topology.getByTestId('selected-route'), 'A → C → B')
    await topology.getByRole('checkbox', { name: 'C—B 链路', exact: true }).uncheck()
    await equalText(topology.getByTestId('selected-route'), 'A → R → B')
    for (const link of ['A—B 链路', 'A—C 链路', 'A—R 链路']) {
      await topology.getByRole('checkbox', { name: link, exact: true }).uncheck()
    }
    await equalText(topology.getByTestId('selected-route'), 'A 到 B 不可达')
    await topology.getByRole('button', { name: '重置拓扑' }).click()
    await equalText(topology.getByTestId('selected-route'), 'A → B')
    report.interactions.push('Topology: metrics, fallback, partition and reset')
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: `${output}/labs-desktop.png`, fullPage: true })
    for (const query of ['服务', '监听', '本机', '回环', '端口', '路由', '打洞', '网卡', 'NAT', 'TUN']) {
      await page.getByRole('button', { name: '搜索教程' }).click()
      const input = page.locator('#localsearch-input')
      await input.fill(query)
      await page.locator('.VPLocalSearchBox .results a').first().waitFor()
      check(await page.locator('.VPLocalSearchBox .results a').count() > 0, `Search: ${query}`)
      report.search.push(query)
      await page.keyboard.press('Escape')
    }
    await page.getByRole('switch').click()
    check(await page.locator('html.dark').count() === 1, 'Dark theme')
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: `${output}/labs-dark.png`, fullPage: true })
    await page.getByRole('switch').click()
    await page.setViewportSize({ width: 390, height: 844 })
    for (const route of routes) {
      await page.goto(base + route)
      await page.locator('main h1').waitFor()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      check(!overflow, `Mobile page overflow: ${route}`)
      report.mobile.push(route)
      if (route === '/') {
        await page.screenshot({ path: `${output}/home-mobile.png`, fullPage: true })
      }
      if (route === '/labs') {
        await page.screenshot({ path: `${output}/labs-mobile.png`, fullPage: true })
      }
      if (route === '/basics/observe-a-request') {
        await page.locator('details.advanced summary').first().click()
        check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'Expanded beginner detail mobile overflow')
        await page.screenshot({ path: `${output}/basics-mobile.png`, fullPage: true })
      }
      if (route === '/cases/local-gui') {
        await page.screenshot({ path: `${output}/case-mobile.png`, fullPage: true })
      }
    }
    const download = await page.request.get(`${base}/downloads/network-basics-demo.zip`)
    check(download.ok() && (await download.body()).length > 100, 'Demo ZIP downloadable')
    report.download = 'network-basics-demo.zip'
    check(errors.length === 0, `Browser runtime errors: ${errors.join('; ')}`)
    check(failures.length === 0, `Failed requests: ${failures.join('; ')}`)
    return report
  }
  catch (error) {
    throw new Error(JSON.stringify({ ...report, failure: error.message }))
  }
  finally {
    page.off('pageerror', onError)
    page.off('response', onResponse)
  }
}
