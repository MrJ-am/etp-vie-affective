/** Géométrie de présentation uniquement. Aucun état métier, stockage ou réseau.
 * Le titre activé est notre repère pendant le déploiement natif d'Elm Animator.
 */
export function installerContinuite(attendreMouvement: () => Promise<void>): () => void {
  let terminer: (() => void) | undefined;
  const annuler = () => terminer?.();
  const racine = document.documentElement;
  const hauteur = new ResizeObserver(entries => {
    const bandeau = entries[0]?.target;
    if (bandeau) racine.style.setProperty('--hauteur-bandeau', bandeau.getBoundingClientRect().height + 'px');
  });
  let bandeau: Element | null = null;
  const structure = new MutationObserver(() => {
    const suivant = document.querySelector('.bandeau-carnet');
    if (suivant !== bandeau) {
      hauteur.disconnect(); bandeau = suivant;
      if (bandeau) hauteur.observe(bandeau);
      else { annuler(); racine.style.removeProperty('--hauteur-bandeau'); racine.style.removeProperty('--reserve-carnet'); }
    }
  });
  structure.observe(document.body, {childList: true, subtree: true});

  document.addEventListener('click', event => {
    annuler();
    const bouton = event.target instanceof Element ? event.target.closest('.capsule-ouvrir') : null;
    const titre = bouton?.closest<HTMLElement>('.capsule-titre');
    const feuille = titre?.closest('.feuille-parcours');
    if (!titre || !feuille) return;
    const top = titre.getBoundingClientRect().top;
    let actif = true, frame = 0;
    racine.dataset.ancrage = 'true';
    const compenser = () => {
      if (!actif || !titre.isConnected) return;
      const difference = titre.getBoundingClientRect().top - top;
      if (Math.abs(difference) < .1) return;
      const cible = Math.max(0, scrollY + difference);
      // En fin de feuille, conserver assez de papier sous le titre pour que
      // le navigateur puisse garder ce repère, aussi pendant une fermeture.
      const manque = cible + innerHeight - document.documentElement.scrollHeight;
      if (manque > 0) {
        const reserve = parseFloat(racine.style.getPropertyValue('--reserve-carnet')) || 0;
        racine.style.setProperty('--reserve-carnet', Math.ceil(reserve + manque) + 'px');
      }
      window.scrollTo({top: cible, behavior: 'instant'});
    };
    // ResizeObserver intervient après le layout et avant la peinture, même si
    // Elm a appliqué ses styles après notre callback requestAnimationFrame.
    const taille = new ResizeObserver(compenser);
    taille.observe(feuille);
    const observer = () => {
      compenser();
      if (actif) frame = requestAnimationFrame(observer);
    };
    frame = requestAnimationFrame(observer);
    const fin = () => {
      if (!actif) return;
      actif = false; cancelAnimationFrame(frame); taille.disconnect();
      delete racine.dataset.ancrage;
      if (terminer === fin) terminer = undefined;
    };
    terminer = fin;
    void attendreMouvement().then(() => {
      // La capture précède le rendu Elm et ses deux images de préparation.
      // Aucune transition ne peut encore exister lors de la première lecture.
      // Garder le repère jusqu'au retrait réel des indicateurs Elm, y compris
      // après une annulation native ou une préférence réduite en cours de geste.
      const verifier = () => {
        if (!actif) return;
        if (feuille.querySelector('[data-moving="true"]')) requestAnimationFrame(verifier);
        else requestAnimationFrame(() => {
          if (feuille.querySelector('[data-moving="true"]')) verifier();
          else { compenser(); fin(); }
        });
      };
      requestAnimationFrame(verifier);
    });
  }, true);
  // Un déplacement volontaire reprend immédiatement la main sur la lecture.
  addEventListener('wheel', annuler, {passive:true});
  addEventListener('touchmove', annuler, {passive:true});
  addEventListener('pointerdown', annuler, {passive:true});
  addEventListener('resize', annuler);
  addEventListener('keydown', event => {
    if (['PageUp','PageDown','Home','End','ArrowUp','ArrowDown','Escape','Tab'].includes(event.key)) annuler();
  }, true);
  return annuler;
}
