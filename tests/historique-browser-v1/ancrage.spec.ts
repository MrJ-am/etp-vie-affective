import {test,expect} from '@playwright/test';

test('capsules : le titre activé reste ancré à chaque image, sans grossir',async({page})=>{
  test.setTimeout(90000);
  await page.goto('/');await page.getByRole('button',{name:'Ouvrir la démonstration',exact:true}).click();
  await expect(page.getByRole('tab')).toHaveCount(3);
  for(const reducedMotion of ['no-preference','reduce'] as const){
    await page.emulateMedia({reducedMotion});
    for(const width of [390,1440]){
      await page.setViewportSize({width,height:900});
      await expect(page.locator('.classeur')).toHaveCSS('padding-left',width<600?'12px':'38px');
      await expect(page.locator('html')).not.toHaveAttribute('data-ancrage','true');
      for(const id of [3,4,4,14,14]){
        // Le vrai clic vient d'un titre visible, à une position confortable.
        await page.locator('#titre-capsule-'+id).evaluate(el=>window.scrollTo({top:scrollY+el.getBoundingClientRect().top-250,behavior:'instant'}));
        const sample=await page.evaluate(id=>new Promise<{positions:number[],fonts:string[],baseline:number,font:string,expanded:boolean,same:boolean}>(resolve=>{
          const title=document.getElementById('titre-capsule-'+id)!;
          const button=title.querySelector<HTMLButtonElement>('button')!;
          const baseline=title.getBoundingClientRect().top,font=getComputedStyle(title).fontSize;
          const positions:number[]=[],fonts:string[]=[];
          button.click();
          function observe(){
            // Après les callbacks et le layout de l'image native : on mesure
            // la géométrie affichée, y compris la fermeture de la capsule au-dessus.
            setTimeout(()=>{
              positions.push(title.getBoundingClientRect().top);fonts.push(getComputedStyle(title).fontSize);
              if(positions.length>8&&!document.querySelector('[data-moving="true"]')){
                resolve({positions,fonts,baseline,font,expanded:button.getAttribute('aria-expanded')==='true',same:title===document.getElementById('titre-capsule-'+id)});
              }else requestAnimationFrame(observe);
            },0);
          }
          requestAnimationFrame(observe);
        }),id);
        expect(sample.same).toBe(true);expect(sample.positions.length).toBeGreaterThan(8);
        expect(Math.max(...sample.positions.map(y=>Math.abs(y-sample.baseline))),JSON.stringify({id,width,reducedMotion,baseline:sample.baseline,positions:sample.positions})).toBeLessThan(1.5);
        expect(new Set(sample.fonts)).toEqual(new Set([sample.font]));
        await expect(page.locator('#capsule-'+id+' .capsule-ouvrir')).toHaveAttribute('aria-expanded',String(sample.expanded));
        await expect(page.locator('html')).not.toHaveAttribute('data-ancrage','true');
      }
    }
  }
});
