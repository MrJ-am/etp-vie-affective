# Rapports antérieurs et intermédiaires

Ces rapports bruts gardent la trace des essais. Le rapport de la version livrée est `../browser-results.json` ; ne pas additionner ces exécutions à ses cas.

- `continuite-regression-results.json` et `continuite-mesure-results.json` : ancienne interface continue en plan spatial, avant la refonte en classeur. La mesure de retournement avait été corrigée après un échec de protocole sur WebKit.
- `classeur-initial-interrompu.json` : première régression du classeur, interrompue après un échec de l’attente avant rechargement d’une trace. Le test a été corrigé pour attendre la confirmation de création puis la sauvegarde.
- `classeur-avant-annulation-rapide-interrompu.json` : régression interrompue pour corriger une annulation de fermeture avant le départ de son mouvement. Les cas déjà exécutés n’ont pas échoué.
- `classeur-annulation-cibles.json` : contrôle ciblé réussi sur Chromium, WebKit et Firefox après cette correction. Les mêmes cas sont aussi exécutés dans la régression finale.

- `classeur-six-feuilles-results.json` : version précédente à six onglets, avant la correction de leur structure et de la séparation des fonctions du site. Ses résultats ne décrivent pas l’interface actuelle.

- `classeur-reprise-apres-reset-interrompu.json` : régression interrompue après un défaut d’attente du contrôle de reprise après réinitialisation. Le contrôle choisissait encore le retour des réglages avant le remplacement par l’accueil. Il attend désormais la fin de la réinitialisation avant de reprendre. Six cas avaient passé ; un cas en cours a été interrompu.

- `classeur-menu-deconnexion-interrompu.json` : régression interrompue pour retirer la déconnexion encore présente dans le formulaire de coffre verrouillé et cibler explicitement celle du menu. Vingt et un cas avaient passé ; un cas WebKit en cours a été interrompu.

- `classeur-webkit-avant-fin-native.json` : exécution complète de 63 cas, avec 61 réussites et deux échecs WebKit. Le contrôle hors connexion attendait un état de chiffrement trop bref ; il attend désormais la sauvegarde durable avant de poursuivre son vrai scénario de conflit. Le contrôle des images a révélé une transition native terminée ou annulée sans événement de fin, laissant la feuille signalée en mouvement. Le pont observe désormais les promesses de fin des transitions réelles, avec garde de session et de navigation. Les neuf contrôles ciblés ont ensuite passé sur les trois moteurs, y compris une annulation explicite par le navigateur.
