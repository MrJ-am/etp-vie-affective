# Un classeur, des feuilles et des capsules

La refonte d’orientation distingue deux gestes : **changer de plan conceptuel** avec un onglet, et **se rapprocher d’un chapitre** sur sa feuille. Elle conserve **mdgriffith/elm-animator 2.0.0**, figé dans `elm.json`, ElmUI et le thème partagé.

## Les feuilles du classeur

| Onglet | Rôle de la feuille |
|---|---|
| Mon accueil | Retrouver la séance actuelle et les éléments à reprendre |
| Mon parcours | Les douze capsules de chapitre sur un même plan, avec les bilans avant et après |
| Mes objectifs | Directions, formulations successives et défis persistants |
| Mes repères | Traces, étapes personnelles et sélection choisie à partager |
| Mes réglages | Confort de lecture, confidentialité et gestion du coffre |
| À propos & sources | Provenance, limites et code complet |

Les onglets sont attachés au bord de la feuille, avec une reliure et des bords de papier. Ils restent visibles pendant la lecture, y compris sur téléphone où les six choix occupent deux rangées. Changer d’onglet fait apparaître une autre feuille autour de la même reliure. Les objectifs et les repères accompagnent le parcours dans la durée et ont leurs propres feuilles.

## Les douze chapitres sur la même feuille

La feuille du parcours contient les douze chapitres 1–12, sans hiérarchie entre eux. Chaque chapitre est une capsule portant son numéro, son titre, son sous-titre et son objectif d’origine. Le bilan 0 précède ces capsules ; les bilans 13 et 14 les suivent et gardent leurs gabarits particuliers. Les étapes 0 et 14 conservent le même titre fourni et leurs sous-titres distincts. Rien n’est à débloquer.

Ouvrir une capsule agrandit son titre et déploie son contenu **à son emplacement dans la feuille**. Sa hauteur augmente progressivement ; les capsules suivantes sont repoussées dans le flux réel de la page. Le titre conserve le même élément DOM et l’onglet « Mon parcours » reste sélectionné. Refermer rétracte cette même capsule et rapproche ses voisines. Aucun déplacement vers un écran de chapitre séparé n’intervient. Cette déformation locale matérialise la « feuille en caoutchouc » : on se rapproche d’un contenu encapsulé, puis on retrouve la vue d’ensemble en le refermant.

Une capsule est développée à la fois. Les en-têtes des quinze étapes restent présents, dans leur ordre initial ; seules la capsule choisie et, pendant une fermeture, son contenu sortant construisent les éditeurs. Avant, Pendant et Entre les séances restent trois moments internes de la capsule, dans leur ordre horizontal. Les phases du paysage restent internes à l’activité. Ces mouvements ne changent pas de feuille.

Quitter le parcours par un onglet puis y revenir retrouve la capsule et le moment ouverts. Depuis une séance, les objectifs et les repères proposent aussi le bouton de retour au même moment. Le titre de la capsule est révélé lors d’un retour depuis une autre feuille ; ouvrir ou refermer sur la feuille du parcours garde la position de lecture. Le chemin « Classeur › Mon parcours » reste stable pendant l’ouverture pour ne pas déplacer les capsules par un changement d’en-tête. « Comprendre le classeur » explique les relations ; « Retrouver les onglets » ramène à la navigation.

## Le fond conservé

| Moment | Rubriques conservées |
|---|---|
| Avant | Je me prépare |
| Pendant | J’expérimente ; Ce que j’en retiens |
| Entre les séances | Je comprends mieux ; Ma progression ; Ma prochaine expérimentation ; Je fais le point |

Les quinze étapes 0–14 et leurs contenus, les bilans 0/13/14, les objectifs avec leur histoire, les trois défis actifs au maximum, les essais facultatifs et leurs retours, les cinq espaces du paysage, l’hésitation entre deux zones, la confrontation, les versions de traces, les photos, les étapes personnelles et la sélection à partager restent opérationnels. Titres, sous-titres, objectifs et provenance sont conservés. L’expérimentation d’une séance reste distincte d’un défi dans la durée.

Le catalogue, `Carnet.elm`, `Contenu.elm`, les primitives de chiffrement, le Worker, les fichiers du backend et la révision de style-mrjam sont comparés par SHA-256 à l’état avant cette refonte : voir `integrite-classeur.json`. Le format privé v1, les enveloppes et les contrats d’API restent identiques. La mémoire de capsule est un état de présentation en mémoire ; elle n’introduit aucun nouveau format privé, stockage ou endpoint.

Les écrits sauvegardés restent dans le même modèle métier pendant les déplacements. Une reformulation en cours conserve aussi son formulaire lors d’une visite dans une autre feuille ; son bouton confirme l’enregistrement. Les formulaires temporaires, la mémoire de capsule et le contenu ouvert sont retirés au verrouillage selon le contrat existant. Aucun document source interne n’est servi.

## À quoi servent les mouvements

| Mouvement | Relation rendue visible | Durée |
|---|---|---|
| Apparition et rotation autour du bord de reliure | Un onglet ouvre une autre feuille | 320 ms |
| Agrandissement du titre et déploiement du corps dans le flux | On se rapproche d’une capsule sur sa feuille ; les voisines s’écartent | 520 ms |
| Fenêtre interne et soulignement des moments | Trois moments d’une même capsule | 380 ms |
| Soulignement des phases du paysage | Construire, hiérarchiser, confronter et garder une trace dans la même activité | 320 ms |

Elm Animator produit les déclarations et la courbe des transitions CSS natives : `opacity` et `rotate` pour les feuilles, `font-size` et `grid-template-rows` pour les capsules, `translate` pour les fenêtres et les soulignements internes. Le corps d’une capsule passe de `0fr` à `1fr`, sans hauteur fixe ; le navigateur redistribue réellement la place entre les capsules. Une nouvelle destination peut interrompre le mouvement selon les règles natives de transition du navigateur.

Deux images préparent les nouveaux contenus avant le départ. Après cette préparation, aucun calcul par image ne reconstruit la page pendant le mouvement. La fin d’une transition retire les éditeurs sortants et les indicateurs de mouvement. Les panneaux inactifs au repos sont masqués. La navigation reste disponible pendant les transitions ; il n’y a ni boucle décorative ni attente imposée pour choisir.

L’extension additive `shared/elm/MrJam/Continuite.elm` centralise onglets, feuilles, capsules, fenêtres et rubans ; la feuille de thème reste dans `shared/assets/carnet.css`. Une seule mise en page ElmUI racine est utilisée. Les conteneurs conservent leur hauteur naturelle, notamment sur WebKit et Firefox. Le paquet partagé historique et ses autres consommateurs sont inchangés.

## Même architecture sans mouvement

« Sans animations » garde les mêmes onglets, feuilles, capsules, chemins, titres et retours. Les tailles et destinations finales s’appliquent immédiatement ; aucune animation-frame n’est demandée dans ce mode. `prefers-reduced-motion` est prioritaire sur le réglage du carnet et réévalué pendant la lecture. TypeScript transmet cette préférence et assure le focus ; il ne pilote pas les animations.

Les onglets ont les rôles `tablist`, `tab` et `tabpanel`, un état sélectionné explicite et un seul onglet dans l’ordre de tabulation. Gauche/droite choisissent la feuille précédente/suivante, avec retour cyclique ; Début/Fin choisissent la première/dernière. Le focus clavier reste sur l’onglet choisi. L’activation par clic conduit au contenu. Les boutons de capsule indiquent leur état avec `aria-expanded` et leur cible avec `aria-controls`.

Une seule feuille est accessible à la fois. La feuille sortante et un corps de capsule qui se referme portent `inert` et `aria-hidden`, puis perdent leurs champs. Le focus rejoint le titre de la capsule sans défilement lors d’une ouverture locale. Le verrouillage remplace immédiatement tout l’espace privé, annule les mouvements et retire les données ouvertes ; il n’est pas animé.

## Preuves et références

Les contrôles de `tests/browser/carnet.spec.ts` vérifient notamment les feuilles distinctes, le maintien du même titre DOM, la croissance réelle d’une capsule et le déplacement proportionnel de sa voisine pendant la transition, sa fermeture, les onglets persistants, le clavier, le retour au même moment, les notes et les formulaires, la réduction dynamique et le verrouillage. Les quinze étapes et les sept rubriques sont exercées. Résultats et limites dans `RESULTATS.md`.

Consultées le 6 octobre 2026 : [documentation du package 2.0.0](https://package.elm-lang.org/packages/mdgriffith/elm-animator/2.0.0/), [README et philosophie de Continuous UI](https://github.com/mdgriffith/elm-animator/blob/2.0.0/README.md), [API Animator et transitions natives](https://github.com/mdgriffith/elm-animator/blob/2.0.0/src/Animator.elm). La continuité retenue rend visibles les relations entre les éléments. Son efficacité pour les personnes destinataires, et leur compréhension de la métaphore du classeur, restent à évaluer avec elles, avec et sans mouvement.
