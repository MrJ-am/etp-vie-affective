import {test,expect,type Page} from '@playwright/test';

async function stable(page:Page){
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await expect(page.locator('[data-moving="true"]')).toHaveCount(0);
  await expect(page.locator('[data-glissement="true"]')).toHaveCount(0);
}
async function glisser(page:Page,selector:string,dx:number,dy=0,cancel=false){
  return page.locator(selector).first().evaluate((element,{dx,dy,cancel})=>{
    const r=element.getBoundingClientRect(),x=r.left+Math.min(90,r.width/2),y=r.top+Math.min(40,r.height/2);
    const point=(deltaX:number,deltaY:number)=>({identifier:7,target:element,clientX:x+deltaX,clientY:y+deltaY} as Touch);
    const envoyer=(type:string,touches:Touch[])=>{const event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperties(event,{touches:{value:touches},targetTouches:{value:touches},changedTouches:{value:touches.length?touches:[point(dx,dy)]}});element.dispatchEvent(event);return event.defaultPrevented;};
    envoyer('touchstart',[point(0,0)]);
    const prevent=envoyer('touchmove',[point(dx,dy)]);
    const panel=element.closest('[data-swipe-moment]')?.querySelector('.continuite-panneau[data-active="true"]');
    const translation=panel?getComputedStyle(panel).transform:'none';
    envoyer(cancel?'touchcancel':'touchend',[]);
    return{prevent,translation};
  },{dx,dy,cancel});
}

test('capsules : suite 0–14, swipe du contenu, lecture verticale et saisie préservées',async({browser,browserName})=>{
  const context=await browser.newContext({viewport:{width:390,height:900},hasTouch:true});
  const page=await context.newPage();await page.goto('/');await page.getByRole('button',{name:'Ouvrir la démonstration',exact:true}).click();
  await expect(page.locator('.capsule')).toHaveCount(15);
  expect(await page.locator('.capsule').evaluateAll(elements=>elements.map(e=>e.id))).toEqual(Array.from({length:15},(_,i)=>'capsule-'+i));
  for(const text of ['AVANT LES CAPSULES','APRÈS LES CAPSULES','LES DOUZE CAPSULES · CHAPITRES 1 À 12','LA FEUILLE DU PARCOURS'])await expect(page.getByText(text,{exact:true})).toHaveCount(0);
  await page.locator('#capsule-3 .capsule-ouvrir').click();await stable(page);
  await expect(page.locator('#capsule-3 .capsule-ouvrir')).toHaveAttribute('aria-expanded','true');
  const region=page.locator('#capsule-3 [data-swipe-moment]');
  await expect(region.getByText('AVANT LA SÉANCE',{exact:true})).toHaveCount(0);
  await expect(region.getByText('PENDANT LA SÉANCE',{exact:true})).toHaveCount(0);
  await expect(region.getByText('ENTRE LES SÉANCES',{exact:true})).toHaveCount(0);
  const surface='#capsule-3 .continuite-panneau[data-active="true"] .carnet-texte';
  const note=page.getByLabel('Ma note personnelle · facultatif',{exact:true}).filter({visible:true});
  await note.fill('Une note fictive conservée après le swipe.');
  const vertical=await glisser(page,surface,4,110);expect(vertical.prevent).toBe(false);await stable(page);
  await expect(region.getByRole('tab',{name:'Avant',exact:true})).toHaveAttribute('aria-selected','true');
  const short=await glisser(page,surface,-20);expect(short.prevent).toBe(true);await stable(page);
  await expect(region.getByRole('tab',{name:'Avant',exact:true})).toHaveAttribute('aria-selected','true');
  const cancelled=await glisser(page,surface,-100,0,true);expect(cancelled.prevent).toBe(true);await stable(page);
  for(const motion of ['no-preference','reduce'] as const){
    await page.emulateMedia({reducedMotion:motion});
    const drag=await glisser(page,surface,-110);expect(drag.prevent).toBe(true);expect(drag.translation).not.toBe('none');await stable(page);
    await expect(region.getByRole('tab',{name:'Pendant',exact:true})).toHaveAttribute('aria-selected','true');
    await expect(region.getByRole('heading',{name:'J’expérimente',exact:true})).toBeVisible();
    await glisser(page,surface,-110);await stable(page);await expect(region.getByRole('tab',{name:'Après',exact:true})).toHaveAttribute('aria-selected','true');
    await glisser(page,surface,-110);await stable(page);await expect(region.getByRole('tab',{name:'Après',exact:true})).toHaveAttribute('aria-selected','true');
    await glisser(page,surface,110);await stable(page);await expect(region.getByRole('tab',{name:'Pendant',exact:true})).toHaveAttribute('aria-selected','true');
    await glisser(page,'#capsule-3 .moment-onglet[aria-selected="true"]',110);await stable(page);await expect(region.getByRole('tab',{name:'Avant',exact:true})).toHaveAttribute('aria-selected','true');
    await expect(note).toHaveValue('Une note fictive conservée après le swipe.');
    const field=await glisser(page,'#capsule-3 .continuite-panneau[data-active="true"] textarea',-110);expect(field.prevent).toBe(false);await stable(page);
    await expect(region.getByRole('tab',{name:'Avant',exact:true})).toHaveAttribute('aria-selected','true');
  }
  if(browserName==='chromium'){
    // Vrai flux tactile du moteur : défilement vertical natif, puis swipe horizontal.
    await page.emulateMedia({reducedMotion:'no-preference'});
    const client=await context.newCDPSession(page);
    await page.locator(surface).first().scrollIntoViewIfNeeded();
    const r=await page.locator(surface).first().boundingBox();const x=r!.x+r!.width/2,y=Math.max(230,Math.min(600,r!.y+35));
    const before=await page.evaluate(()=>scrollY);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let n=1;n<=6;n++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-n*22}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(before+30);
    await page.locator(surface).first().scrollIntoViewIfNeeded();const box=await page.locator(surface).first().boundingBox();
    const sx=box!.x+box!.width*.75,sy=Math.max(230,Math.min(600,box!.y+35));
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy}]});
    for(let n=1;n<=6;n++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx-n*22,y:sy}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await stable(page);await expect(region.getByRole('tab',{name:'Pendant',exact:true})).toHaveAttribute('aria-selected','true');await client.detach();
  }
  await context.close();
});
