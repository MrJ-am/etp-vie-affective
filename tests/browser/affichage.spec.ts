import {test,expect} from '@playwright/test';

test('Commandes lisibles sur mobile et bureau, y compris les longs libellés',async({page})=>{
 for(const width of [320,390,583,850,1440]) {
  await page.setViewportSize({width,height:1000});
  await page.goto('/');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  for(const name of ['Créer mon compte','Me connecter']) {
   const button=page.getByRole('button',{name,exact:true});
   await expect(button).toBeVisible();
   const box=(await button.boundingBox())!;
   expect(box.width,`${name} à ${width}px`).toBeGreaterThan(110);
   expect(box.height,`${name} à ${width}px`).toBeLessThan(70);
   expect(box.x+box.width).toBeLessThanOrEqual(width);
  }
  await page.getByRole('button',{name:'Créer mon compte',exact:true}).click();
  const submit=page.getByRole('button',{name:'Créer mon compte et mon coffre',exact:true});
  await expect(submit).toBeVisible();
  const box=(await submit.boundingBox())!;
  expect(box.width).toBeGreaterThan(160);
  expect(box.height).toBeLessThan(100);
  expect(box.x+box.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 }
});
