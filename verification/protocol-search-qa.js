async (page) => {
  const base = await page.evaluate(() => window.location.origin);
  const queries = ['Noise', 'QUIC', 'KCP', '封装', '控制面', '抓包'];
  const report = { origin: base, search: [], pagefind: {}, exports: [], errors: [] };
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') report.errors.push(msg.text()); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base);
  await page.locator('[data-search] summary').click();
  for (const query of queries) {
    await page.locator('#docs-search').fill(query);
    await page.locator('[data-search] button[type=submit]').click();
    await page.waitForFunction(() => document.querySelector('[data-search-results]').getAttribute('aria-busy') === 'false', null, { timeout: 30000 });
    const links = await page.locator('.search-result-title').evaluateAll(els => els.map(el => el.getAttribute('href')));
    const status = await page.locator('#search-status').innerText();
    if (!links.length || !links.some(href => href.startsWith('/internals/')) || /失败|不可用/.test(status)) throw new Error('Search failed: ' + query + ' ' + status);
    if (new Set(links.map(href => href.split('#')[0])).size !== links.length) throw new Error('Duplicate pages: ' + query);
    report.search.push({ query, pages: links.length, advanced: links.filter(href => href.startsWith('/internals/')), status });
  }
  report.pagefind = await page.evaluate(async queries => {
    const pagefind = await import('/pagefind/pagefind.js');
    const api = pagefind.createInstance({ basePath: '/pagefind/', baseUrl: '/' });
    const counts = {};
    await api.init();
    for (const query of queries) counts[query] = (await api.search(query)).results.length;
    await api.destroy();
    return counts;
  }, queries);
  for (const [query, count] of Object.entries(report.pagefind)) if (!count) throw new Error('Native Pagefind returned no results: ' + query);
  const manifest = await (await page.request.get(base + '/course-manifest.json')).json();
  const routes = manifest.pages.filter(p => p.route.startsWith('/internals/')).map(p => p.route);
  for (const path of ['/internals/llms.txt', '/llms-full.txt', ...routes.flatMap(route => [route + '/index.md', route + '/index.mdx'])]) {
    const response = await page.request.get(base + path);
    const text = await response.text();
    const mime = response.headers()['content-type'];
    if (response.status() !== 200 || !/text\/(plain|markdown)/.test(mime) || !text.trim()) throw new Error('Export HTTP failed: ' + path);
    if (!path.endsWith('.mdx') && /<EncapsulationLab\b/.test(text)) throw new Error('Raw experiment tag in plain-text export: ' + path);
    if (/packet-pipeline\/index\.md$/.test(path) && (!text.includes('协议分层与封装') || !/^9\. /m.test(text))) throw new Error('Experiment textual equivalent missing: ' + path);
    if (/packet-pipeline\/index\.mdx$/.test(path) && !text.includes('<EncapsulationLab')) throw new Error('MDX source component missing: ' + path);
    report.exports.push({ path, status: response.status(), mime, characters: text.length });
  }
  if (report.errors.length) throw new Error(report.errors.join('; '));
  return report;
}
