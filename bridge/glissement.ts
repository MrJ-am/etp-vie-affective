/** Geste de lecture local. Elm garde le moment choisi et ses contenus métier. */
export function installerGlissement(choisir: (id: number, direction: number) => void): () => void {
  type Geste = {region: HTMLElement; fenetre: HTMLElement; panneaux: HTMLElement[]; index: number; x: number; y: number; debut: number; dx: number; horizontal: boolean};
  let geste: Geste | undefined;
  let nettoyage: (() => void) | undefined;
  let clicIgnore: {region: HTMLElement; jusque: number} | undefined;
  const reduit = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
  const annuler = () => {
    geste = undefined; nettoyage?.(); nettoyage = undefined; clicIgnore = undefined;
  };
  const relacher = (g: Geste, direction: number) => {
    const avant = g.panneaux.map(p => p.style.translate);
    let observateur: MutationObserver | undefined;
    let fini = false;
    const restaurer = () => {
      if (fini) return;
      fini = true; observateur?.disconnect();
      const duree = reduit() ? 0 : parseFloat(getComputedStyle(g.panneaux[g.index]).transitionDuration) * 1000;
      const courbe = getComputedStyle(g.panneaux[g.index]).transitionTimingFunction;
      const animations = g.panneaux.map(p => {
        p.style.removeProperty('transform');
        return duree > 0 ? p.animate([{transform:`translateX(${g.dx}px)`},{transform:'translateX(0px)'}],{duration:duree,easing:courbe}) : undefined;
      });
      let nettoye = false;
      const fin = () => {
        if (nettoye) return;
        nettoye = true;
        delete g.fenetre.dataset.glissement;
        g.panneaux.forEach(p=>p.style.removeProperty('transform'));
        animations.forEach(a=>a?.cancel());
        if (nettoyage === fin) nettoyage = undefined;
      };
      nettoyage = fin;
      void Promise.allSettled(animations.filter((a):a is Animation=>!!a).map(a=>a.finished)).then(fin);
    };
    nettoyage = () => { fini = true; observateur?.disconnect(); delete g.fenetre.dataset.glissement; g.panneaux.forEach(p=>p.style.removeProperty('transform')); };
    if (direction) {
      // Le relâchement commence avec le changement de position d'Elm Animator,
      // après ses images de préparation : aucun retour préalable à l'origine.
      observateur = new MutationObserver(() => {
        if (!g.fenetre.isConnected || g.panneaux.some((p,i)=>p.style.translate!==avant[i])) restaurer();
      });
      observateur.observe(g.fenetre,{attributes:true,childList:true,subtree:true,attributeFilter:['style']});
      choisir(Number(g.region.dataset.swipeMoment),direction);
    } else restaurer();
  };
  document.addEventListener('touchstart',event=>{
    annuler();
    if (event.touches.length!==1 || !(event.target instanceof Element)) return;
    const cible=event.target,region=cible.closest<HTMLElement>('[data-swipe-moment]');
    if (!region || cible.closest('input,textarea,select,label,[contenteditable="true"],a') || (cible.closest('button') && !cible.closest('.moment-onglet'))) return;
    const fenetre=region.querySelector<HTMLElement>('.continuite-fenetre');
    const panneaux=fenetre ? Array.from(fenetre.children).filter((e):e is HTMLElement=>e instanceof HTMLElement) : [];
    const index=panneaux.findIndex(p=>p.dataset.active==='true');
    if (!fenetre || index<0 || region.closest('.capsule-corps')?.hasAttribute('inert')) return;
    const point=event.touches[0];
    geste={region,fenetre,panneaux,index,x:point.clientX,y:point.clientY,debut:performance.now(),dx:0,horizontal:false};
  },{passive:true});
  document.addEventListener('touchmove',event=>{
    const g=geste;
    if (!g) return;
    if (event.touches.length!==1 || !g.region.isConnected) {annuler();return;}
    const dx=event.touches[0].clientX-g.x,dy=event.touches[0].clientY-g.y;
    if (!g.horizontal) {
      if (Math.max(Math.abs(dx),Math.abs(dy))<12) return;
      if (Math.abs(dx)<Math.abs(dy)*1.4 || performance.now()-g.debut>500) {geste=undefined;return;}
      g.horizontal=true;g.fenetre.dataset.glissement='true';
      nettoyage=()=>{delete g.fenetre.dataset.glissement;g.panneaux.forEach(p=>p.style.removeProperty('transform'));};
    }
    if (event.cancelable) event.preventDefault();
    g.dx=((g.index===0 && dx>0)||(g.index===2 && dx<0)) ? dx*.25 : dx;
    g.panneaux.forEach(p=>p.style.transform=`translateX(${g.dx}px)`);
  },{passive:false});
  document.addEventListener('touchend',()=>{
    const g=geste;geste=undefined;
    if (!g?.horizontal) return;
    clicIgnore={region:g.region,jusque:performance.now()+450};
    const seuil=Math.max(45,Math.min(100,g.fenetre.clientWidth*.18));
    const direction=Math.abs(g.dx)>=seuil ? (g.dx<0?1:-1) : 0;
    relacher(g,(g.index+direction>=0 && g.index+direction<=2)?direction:0);
  },{passive:true});
  document.addEventListener('touchcancel',annuler,{passive:true});
  document.addEventListener('click',event=>{
    if (clicIgnore && performance.now()<clicIgnore.jusque && event.detail>0 && event.target instanceof Node && clicIgnore.region.contains(event.target)) {
      event.preventDefault();event.stopImmediatePropagation();
    }
  },true);
  addEventListener('resize',annuler);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',annuler);
  return annuler;
}
