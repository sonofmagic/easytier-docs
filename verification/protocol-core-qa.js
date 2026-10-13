async (page) => {
  const base = await page.evaluate(() => window.location.origin);
  const manifest=await (await page.request.get(base+'/course-manifest.json')).json();
  const routes=manifest.pages.filter(p=>!p.route.startsWith('/internals/')).map(p=>p.route);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error'||(msg.type()==='warning'&&/Hydration/.test(msg.text())))errors.push(msg.text())});
  const report={pages:0,diagrams:0,views:[],errors};
  for(const theme of ['light','dark'])for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  await page.goto(base);
  await page.evaluate(theme=>localStorage.setItem('easytier-theme',theme),theme);
  for(const route of routes){
    await page.goto(base+route);
    await page.locator('main h1').waitFor();
    const count=await page.locator('[data-mermaid]').count();
    if(count){
      await page.waitForFunction(()=>[...document.querySelectorAll('[data-mermaid]')].every(el=>el.getAttribute('aria-busy')==='false'),null,{timeout:20000});
      const bad=await page.locator('.mermaid [role=alert]').allTextContents();
      if(bad.length)throw new Error(route+': '+bad.join(' | '));
      if(await page.locator('.mermaid svg').count()!==count)throw new Error('Missing rendered diagram '+route);
    }
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2))throw new Error('Horizontal page overflow '+route+' '+width);
    if(theme==='light'&&width===1440){report.pages++;report.diagrams+=count;}
  }
  report.views.push({theme,width,pages:routes.length});
  }
  if(errors.length)throw new Error(errors.join('; '));
  return report;
}
