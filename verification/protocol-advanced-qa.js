async (page) => {
  const base = new URL(page.url()).origin;
  const manifest=await (await page.request.get(base+'/course-manifest.json')).json();
  const routes=manifest.pages.filter(p=>p.route.startsWith('/internals/')).map(p=>p.route);
  const report={pages:0,images:0,errors:[],mobile:[],interactions:[]};
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error'||(msg.type()==='warning'&&/Hydration/.test(msg.text())))report.errors.push(msg.text())});
  for(const theme of ['light','dark']) {
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:1000});
      await page.goto(base);
      await page.evaluate(theme=>{localStorage.setItem('easytier-theme',theme)},theme);
      for(const route of routes) {
        await page.goto(base+route);
        await page.locator('main h1').waitFor();
        const images=page.locator('article img[src^="/diagrams/"]');
        if(await images.count()!==2)throw new Error('Expected 2 figures '+route);
        await page.waitForFunction(()=>[...document.querySelectorAll('article img')].every(img=>img.complete&&img.naturalWidth>0));
        const overflow=await page.evaluate(()=>({viewport:innerWidth,body:document.documentElement.scrollWidth}));
        if(overflow.body>width+2)throw new Error('Horizontal overflow '+route+' '+JSON.stringify(overflow));
        if(width===390)report.mobile.push({route,theme,overflow:false});
        if(theme==='light'&&width===1440){report.pages++;report.images+=await images.count();}
        if(route==='/internals/packet-pipeline'){
          const lab=page.getByTestId('encapsulation-lab');
          await lab.scrollIntoViewIfNeeded();
          await page.waitForFunction(()=>document.querySelector('[data-testid=encapsulation-lab]').closest('astro-island').hasAttribute('ssr')===false);
          if(!(await page.getByTestId('encapsulation-previous').isDisabled()))throw new Error('First previous not disabled');
          for(let i=0;i<4;i++)await page.getByTestId('encapsulation-next').click();
          await page.getByTestId('encapsulation-transport').selectOption('tcp');
          const hidden=await page.getByTestId('encapsulation-inner-fields').innerText();
          if(/10\.144\.144\.|53124|GET\s*\//.test(hidden))throw new Error('Plaintext exposed at encrypted stage');
          if(!(await lab.innerText()).includes('外层 TCP'))throw new Error('Outer TCP missing');
          await page.getByTestId('encapsulation-previous').click();
          for(let i=0;i<5;i++)await page.getByTestId('encapsulation-next').click();
          if(!(await page.getByTestId('encapsulation-next').isDisabled()))throw new Error('Final next not disabled');
          const restored=await page.getByTestId('encapsulation-inner-fields').innerText();
          if(!restored.includes('10.144.144.2:8080')||!restored.includes('TCP'))throw new Error('Business invariant lost');
          await page.getByTestId('encapsulation-reset').focus();
          await page.keyboard.press('Enter');
          if(await page.getByTestId('encapsulation-transport').inputValue()!=='udp')throw new Error('Reset transport wrong');
          if(!(await page.getByTestId('encapsulation-previous').isDisabled()))throw new Error('Reset stage wrong');
          const cleanScreenshot = await page.addStyleTag({content:'.site-header,.skip-link{visibility:hidden}'});
          await lab.screenshot({path:'verification/protocol-lab-'+width+'-'+theme+'.png'});
          await cleanScreenshot.evaluate(el=>el.remove());
          report.interactions.push({width,theme,steps:9,outerSwitch:true,masked:true,restore:true,keyboardReset:true});
        }
        if(route==='/internals/protocol-map'){
          await images.first().scrollIntoViewIfNeeded();
          await images.first().screenshot({path:'verification/protocol-map-'+width+'-'+theme+'.png'});
        }
      }
    }
  }
  if(report.errors.length)throw new Error(report.errors.join('; '));
  return report;
}
