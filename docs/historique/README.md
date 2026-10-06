# Rapports antérieurs et intermédiaires

Ces rapports bruts gardent la trace des essais. Le rapport de la version livrée est `../browser-results.json` ; ne pas additionner ces exécutions à ses cas.

- `continuite-regression-results.json` et `continuite-mesure-results.json` : ancienne interface continue en plan spatial, avant la refonte en classeur. La mesure de retournement avait été corrigée après un échec de protocole sur WebKit.
- `classeur-initial-interrompu.json` : première régression du classeur, interrompue après un échec de l’attente avant rechargement d’une trace. Le test a été corrigé pour attendre la confirmation de création puis la sauvegarde.
- `classeur-avant-annulation-rapide-interrompu.json` : régression interrompue pour corriger une annulation de fermeture avant le départ de son mouvement. Les cas déjà exécutés n’ont pas échoué.
- `classeur-annulation-cibles.json` : contrôle ciblé réussi sur Chromium, WebKit et Firefox après cette correction. Les mêmes cas sont aussi exécutés dans la régression finale.
