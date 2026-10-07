# Un classeur, des feuilles et des capsules

La refonte d’orientation distingue deux gestes : **changer de plan conceptuel** avec un onglet, et **se rapprocher d’un chapitre** sur sa feuille. Elle conserve **mdgriffith/elm-animator 2.0.0**, figé dans `elm.json`, ElmUI et le thème partagé.

## Les feuilles du classeur

| Onglet | Rôle de la feuille |
|---|---|
| Mon parcours | Les douze capsules de chapitre sur un même plan, avec les bilans avant et après |
| Mes objectifs | Directions, formulations successives et défis persistants |
| Mes repères | Traces, étapes personnelles et sélection choisie à partager |

Les trois onglets forment le bord supérieur de la feuille : leurs contours et celui du papier se rejoignent, et le bord inférieur de l’onglet sélectionné s’efface dans le fond de sa feuille. Ils occupent une seule ligne à toutes les largeurs, avec les libellés courts « Parcours », « Objectifs », « Repères » sur téléphone. Les noms accessibles restent complets. Les onglets restent visibles pendant la lecture. Changer d’onglet amène une autre feuille au premier plan par un fondu d’opacité, sans rotation ni déformation du texte.

La démo, la reprise et l’ouverture du coffre montrent directement le parcours et ses trois onglets. Il n’existe pas de vue `Accueil`. Le bandeau fixe porte « ETP TSA vie amoureuse », selon le titre du document source, sans baseline ni état technique visible. L’icône de compte possède le nom accessible « Mon espace ». Son menu contient les réglages, le verrouillage, À propos & sources, l’explication du classeur et la déconnexion. La vue d’ensemble a été supprimée : sa carte doublonnait la feuille du parcours. Les vues utilitaires ne portent pas d’onglet sélectionné ; « Revenir au carnet » retrouve la feuille et la capsule quittées. L’état de sauvegarde reste annoncé aux technologies d’assistance et se consulte visuellement dans les réglages.

## Les douze chapitres sur la même feuille

La feuille du parcours contient les douze chapitres 1–12, sans hiérarchie entre eux. Chaque chapitre est une capsule portant son numéro et son titre. Son objectif d’origine reste dans le contenu ouvert, ainsi que les états utiles et les intitulés propres aux bilans. Le bilan 0 précède ces capsules ; les bilans 13 et 14 les suivent et gardent leurs gabarits particuliers. Les étapes 0 et 14 conservent le même titre fourni et leurs sous-titres distincts. Rien n’est à débloquer.

Appuyer sur l’en-tête d’une capsule garde la taille de son titre, rapproche son contenu par un zoom continu et le déploie **à son emplacement dans la feuille**. Sa hauteur augmente progressivement ; les capsules suivantes sont repoussées dans le flux réel de la page. Le titre conserve le même élément DOM et l’onglet « Mon parcours » reste sélectionné. Refermer rétracte cette même capsule et rapproche ses voisines. Aucun déplacement vers un écran de chapitre séparé n’intervient. Cette déformation locale matérialise la « feuille en caoutchouc » : on se rapproche d’un contenu encapsulé, puis on retrouve l’ensemble du parcours en le refermant.

Une capsule est développée à la fois. Les en-têtes et les contenus des quinze étapes sont construits dès l’affichage de la feuille du parcours : ouvrir ne monte plus l’éditeur au milieu du geste. L’en-tête entier est une cible, avec le titre comme nom de commande et un chevron indiquant l’état ; aucun bouton supplémentaire « Ouvrir » n’occupe une ligne. Les corps fermés restent à hauteur zéro, masqués et `inert`. Leurs contrôles sont absents du parcours clavier et de l’arbre accessible. Le contenu choisi grandit de 88 % à 100 % pendant que sa hauteur augmente. Avant, Pendant et Après restent trois moments internes de la capsule, dans leur ordre horizontal. Les phases du paysage restent internes à l’activité. Ces mouvements ne changent pas de feuille.

Le titre activé est un repère de lecture. `bridge/continuite.ts` capture sa position avant que le clic atteigne Elm. `requestAnimationFrame` et `ResizeObserver` compensent, avant peinture, le changement de hauteur au-dessus de ce repère. L’ancrage natif du navigateur est suspendu pendant ce geste pour éviter une double compensation. Les indicateurs de mouvement Elm déterminent la fin réelle, y compris après interruption ou réduction des mouvements. En fin de feuille, une réserve de papier minimale rend la position atteignable sans heurter la borne du défilement. Une nouvelle activation, la molette, un déplacement tactile, les touches de lecture, un changement de fenêtre ou le verrouillage retirent immédiatement la compensation, sans repositionner le repère précédent.

Avant / Pendant / Après sont des onglets textuels de même hauteur et largeur, au-dessus d’un seul ruban mobile. Ils ne portent ni fond rempli ni contour de bouton. Les flèches, Début et Fin choisissent un moment et gardent le focus sur son texte. Les rubriques détaillées restent dans le contenu ; leurs noms ne sont plus répétés sous cette navigation.

Quitter le parcours par un onglet puis y revenir retrouve la capsule et le moment ouverts, sans révélation automatique de son titre ni position de défilement mémorisée par feuille. Les gestes `OngletPointe`, `OngletAuClavier` et `DestinationChoisie` sont distincts dans le type Elm. Les deux gestes d’onglet assurent le focus avec `preventScroll` et n’envoient aucune demande de défilement. Depuis une séance, les objectifs et les repères proposent aussi un bouton de retour au même moment : cette destination explicitement demandée peut révéler son titre, après la fin native du déploiement, par un défilement progressif si les animations sont actives. Ouvrir ou refermer une capsule sur sa feuille garde la position de lecture. Le chemin « Classeur › Mon parcours » reste stable pendant l’ouverture pour ne pas déplacer les capsules par un changement d’en-tête. « Comprendre le classeur » explique les relations ; « Retrouver les onglets » ramène progressivement à la navigation.

## Le fond conservé

| Moment | Rubriques conservées |
|---|---|
| Avant | Je me prépare |
| Pendant | J’expérimente ; Ce que j’en retiens |
| Après | Je comprends mieux ; Ma progression ; Ma prochaine expérimentation ; Je fais le point |

Les quinze étapes 0–14 et leurs contenus, les bilans 0/13/14, les objectifs avec leur histoire, les trois défis actifs au maximum, les essais facultatifs et leurs retours, les cinq espaces du paysage, l’hésitation entre deux zones, la confrontation, les versions de traces, les photos, les étapes personnelles et la sélection à partager restent opérationnels. Titres, sous-titres, objectifs et provenance sont conservés. L’expérimentation d’une séance reste distincte d’un défi dans la durée.

Le catalogue, `Carnet.elm`, `Contenu.elm`, les primitives de chiffrement, le Worker, les fichiers du backend et la révision de style-mrjam sont comparés par SHA-256 à l’état avant cette refonte : voir `integrite-classeur.json`. Le format privé v1, les enveloppes et les contrats d’API restent identiques. La mémoire de capsule est un état de présentation en mémoire ; elle n’introduit aucun nouveau format privé, stockage ou endpoint.

Les écrits sauvegardés restent dans le même modèle métier pendant les déplacements. Une reformulation en cours conserve aussi son formulaire lors d’une visite dans une autre feuille ; son bouton confirme l’enregistrement. Les formulaires temporaires, la mémoire de capsule et le contenu ouvert sont retirés au verrouillage selon le contrat existant. Aucun document source interne n’est servi.

## À quoi servent les mouvements

| Mouvement | Relation rendue visible | Durée |
|---|---|---|
| Fondu entre les feuilles superposées | Un onglet ouvre une autre feuille | 320 ms |
| Zoom du contenu et déploiement du corps dans le flux | On se rapproche d’une capsule sur sa feuille ; les voisines s’écartent | 520 ms |
| Fenêtre interne et soulignement des moments | Trois moments d’une même capsule | 380 ms |
| Soulignement des phases du paysage | Construire, hiérarchiser, confronter et garder une trace dans la même activité | 320 ms |

Elm Animator produit les déclarations et la courbe des transitions CSS natives : `opacity` pour les feuilles, `scale` et `grid-template-rows` pour les capsules, `translate` pour les fenêtres et les soulignements internes. Le corps d’une capsule passe de `0fr` à `1fr`, sans hauteur fixe ; le navigateur redistribue réellement la place entre les capsules. Une nouvelle destination peut interrompre le mouvement selon les règles natives de transition du navigateur.

Deux images préparent la destination avant le départ. Les contenus des capsules sont déjà présents sous leurs en-têtes. Après cette préparation, aucune reconstruction Elm de la page n’est effectuée à chaque image du mouvement. Le pont de présentation ajuste seulement le défilement nécessaire à l’ancrage du titre. La fin d’une transition retire la feuille sortante et les indicateurs de mouvement. Le pont TypeScript attend trois images pour laisser le navigateur appliquer les styles, puis observe les promesses `Animation.finished` des transitions natives effectivement présentes. Leur annulation, ou l’absence de départ, libère également les indicateurs ; aucun minuteur ne suppose leur durée. Une version de navigation et l’époque de session empêchent une ancienne fin de modifier une navigation récente ou un coffre rouvert. Les éditeurs des capsules refermées restent présents, masqués et inertes, pour la prochaine ouverture. Les panneaux inactifs au repos sont masqués. La navigation reste disponible pendant les transitions ; il n’y a ni boucle décorative ni attente imposée pour choisir.

L’extension additive `shared/elm/MrJam/Continuite.elm` centralise onglets, feuilles, capsules, fenêtres et rubans ; la feuille de thème reste dans `shared/assets/carnet.css`. Une seule mise en page ElmUI racine est utilisée. Les conteneurs conservent leur hauteur naturelle, notamment sur WebKit et Firefox. Le paquet partagé historique et ses autres consommateurs sont inchangés.

## Même architecture sans mouvement

« Sans animations » garde les mêmes onglets, feuilles, capsules, chemins, titres et retours. Les tailles et destinations finales s’appliquent immédiatement, sans boucle de reconstruction pendant un mouvement. Le focus et la lecture des styles attendent le rendu du navigateur. `prefers-reduced-motion` est prioritaire sur le réglage du carnet et réévalué pendant la lecture. TypeScript transmet cette préférence, assure le focus et révèle les destinations explicitement choisies. Il compense aussi la géométrie du titre pendant un geste local ; les positions intermédiaires des contenus restent calculées par les transitions natives. Une version de focus et l’époque de session annulent les révélations devenues périmées.

Les onglets ont les rôles `tablist`, `tab` et `tabpanel`, un état sélectionné explicite et un seul onglet dans l’ordre de tabulation. Gauche/droite choisissent la feuille précédente/suivante, avec retour cyclique ; Début/Fin choisissent la première/dernière. Le focus clavier reste sur l’onglet choisi. L’activation par clic conduit au contenu. Les titres commandent l’ouverture des capsules et indiquent leur état avec `aria-expanded` et leur cible avec `aria-controls`.

Une seule feuille est accessible à la fois. La feuille sortante et les corps fermés ou qui se referment portent `inert` et `aria-hidden`. Le contenu de la feuille sortante est retiré à la fin du fondu ; les corps refermés restent masqués. Le focus rejoint le titre de la capsule sans défilement lors d’une ouverture locale. Le verrouillage remplace immédiatement tout l’espace privé, annule les mouvements et retire les données ouvertes ; il n’est pas animé.

## Preuves et références

Les contrôles de `tests/browser/carnet.spec.ts` vérifient notamment les trois onglets sur une seule ligne, leur jonction à la feuille, les fonctions du compte en dehors des onglets, le fondu sans déformation, le maintien du titre et du champ DOM, la croissance réelle d’une capsule et le déplacement proportionnel de sa voisine pendant la transition, sa fermeture, les onglets persistants, le clavier, le retour au même moment, les notes et les formulaires, la réduction dynamique et le verrouillage. Les quinze étapes et les sept rubriques sont exercées. Résultats et limites dans `RESULTATS.md`.

Les contraintes observables sont testées dans le navigateur, plutôt que par Elm-review qui ne voit ni la géométrie ni le défilement. Le contrôle des onglets observe leur position et `scrollY` à chaque image pendant le fondu, à 390 et 1440 px, depuis 0 et 60 px, avec et sans mouvements. Le contrôle du bandeau et des moments vérifie l’accès au compte après défilement, l’absence de vue d’ensemble et de bouton de verrouillage dans le bandeau, les trois textes alignés et leurs largeurs égales à 360, 390 et 1440 px, avec taille normale et agrandie. Il exerce aussi la navigation au clavier des moments.

`tests/browser/ancrage.spec.ts` ouvre 3 puis 4, ferme 4, ouvre puis ferme le dernier bilan 14. Chaque image native est observée après son layout, à 390 et 1440 px, en mouvement normal puis réduit. Le même titre DOM doit rester à sa position initiale à moins de 1,5 CSS px, avec exactement la même taille de police. Ce test a d’abord détecté l’agrandissement du titre sur la version précédente, puis un déplacement de plus de 1600 px avant la compensation complète. Les tests utilisent uniquement des contenus fictifs ; ils ne prouvent pas tous les gestes possibles sur chaque appareil.

Consultées le 6 octobre 2026 : [documentation du package 2.0.0](https://package.elm-lang.org/packages/mdgriffith/elm-animator/2.0.0/), [README et philosophie de Continuous UI](https://github.com/mdgriffith/elm-animator/blob/2.0.0/README.md), [API Animator et transitions natives](https://github.com/mdgriffith/elm-animator/blob/2.0.0/src/Animator.elm). La continuité retenue rend visibles les relations entre les éléments. Son efficacité pour les personnes destinataires, et leur compréhension de la métaphore du classeur, restent à évaluer avec elles, avec et sans mouvement.
