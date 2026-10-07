# Un classeur, des feuilles et des capsules

La refonte d’orientation distingue deux gestes : **changer de plan conceptuel** avec un onglet, et **se rapprocher d’un chapitre** sur sa feuille. Elle conserve **mdgriffith/elm-animator 2.0.0**, figé dans `elm.json`, ElmUI et le thème partagé.

## Les feuilles du classeur

| Onglet | Rôle de la feuille |
|---|---|
| Mon parcours | Les douze capsules de chapitre sur un même plan, avec les bilans avant et après |
| Mes objectifs | Directions, formulations successives et défis persistants |
| Mes repères | Traces, étapes personnelles et sélection choisie à partager |

Les trois onglets forment le bord supérieur de la feuille : leurs contours et celui du papier se rejoignent, et le bord inférieur de l’onglet sélectionné s’efface dans le fond de sa feuille. Ils occupent une seule ligne à toutes les largeurs, avec les libellés courts « Parcours », « Objectifs », « Repères » sur téléphone. Les noms accessibles restent complets. Les onglets restent visibles pendant la lecture. Changer d’onglet amène une autre feuille au premier plan par un fondu d’opacité, sans rotation ni déformation du texte.

La démo, la reprise et l’ouverture du coffre montrent directement la feuille du parcours et ses trois onglets. Il n’existe plus de vue `Accueil` dans le type Elm de navigation. En haut à droite, « Mon espace » regroupe la vue d’ensemble, les réglages, À propos & sources, l’explication du classeur et la déconnexion. Avant connexion dans la version complète, le même emplacement propose « Connexion » et « Me connecter ». Sur Sites, il indique « Le prototype » et rappelle le mode démonstration, sans proposer de faux comptes. Les vues utilitaires ne portent ni onglet sélectionné ni rôle `tabpanel` ; « Revenir au carnet » retrouve la feuille et la capsule quittées. Le masquage du coffre reste directement accessible.

La vue d’ensemble est un dialogue natif superposé au carnet. Elle garde le classeur et ses éditeurs dans le DOM, sans changer l’onglet sélectionné. Sa carte montre les quinze étapes, les trois groupes avant/chapitres/après, la séance actuelle et les consultations terminées ; ce statut n’est ni un score ni une condition d’accès. La reprise, le prochain petit pas, les objectifs et le repère personnel de l’ancienne page d’accueil restent disponibles. Échap, le bouton Fermer et le fond ferment le dialogue et rendent le focus au compte sans déplacement. Le navigateur assure la modalité et le confinement du clavier. Choisir une étape ferme la carte et rejoint sa capsule sur la feuille du parcours.

## Les douze chapitres sur la même feuille

La feuille du parcours contient les douze chapitres 1–12, sans hiérarchie entre eux. Chaque chapitre est une capsule portant son numéro, son titre, son sous-titre et son objectif d’origine. Le bilan 0 précède ces capsules ; les bilans 13 et 14 les suivent et gardent leurs gabarits particuliers. Les étapes 0 et 14 conservent le même titre fourni et leurs sous-titres distincts. Rien n’est à débloquer.

Appuyer sur l’en-tête d’une capsule agrandit son titre, rapproche son contenu par un zoom continu et le déploie **à son emplacement dans la feuille**. Sa hauteur augmente progressivement ; les capsules suivantes sont repoussées dans le flux réel de la page. Le titre conserve le même élément DOM et l’onglet « Mon parcours » reste sélectionné. Refermer rétracte cette même capsule et rapproche ses voisines. Aucun déplacement vers un écran de chapitre séparé n’intervient. Cette déformation locale matérialise la « feuille en caoutchouc » : on se rapproche d’un contenu encapsulé, puis on retrouve la vue d’ensemble en le refermant.

Une capsule est développée à la fois. Les en-têtes et les contenus des quinze étapes sont construits dès l’affichage de la feuille du parcours : ouvrir ne monte plus l’éditeur au milieu du geste. L’en-tête entier est une cible, avec le titre comme nom de commande et un chevron indiquant l’état ; aucun bouton supplémentaire « Ouvrir » n’occupe une ligne. Les corps fermés restent à hauteur zéro, masqués et `inert`. Leurs contrôles sont absents du parcours clavier et de l’arbre accessible. Le contenu choisi grandit de 88 % à 100 % pendant que sa hauteur augmente. Avant, Pendant et Entre les séances restent trois moments internes de la capsule, dans leur ordre horizontal. Les phases du paysage restent internes à l’activité. Ces mouvements ne changent pas de feuille.

Quitter le parcours par un onglet puis y revenir retrouve la capsule et le moment ouverts, sans révélation automatique de son titre ni position de défilement mémorisée par feuille. Les gestes `OngletPointe`, `OngletAuClavier` et `DestinationChoisie` sont distincts dans le type Elm. Les deux gestes d’onglet assurent le focus avec `preventScroll` et n’envoient aucune demande de défilement. Depuis une séance, les objectifs et les repères proposent aussi un bouton de retour au même moment : cette destination explicitement demandée peut révéler son titre, après la fin native du déploiement, par un défilement progressif si les animations sont actives. Ouvrir ou refermer une capsule sur sa feuille garde la position de lecture. Le chemin « Classeur › Mon parcours » reste stable pendant l’ouverture pour ne pas déplacer les capsules par un changement d’en-tête. « Comprendre le classeur » explique les relations ; « Retrouver les onglets » ramène progressivement à la navigation.

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
| Fondu entre les feuilles superposées | Un onglet ouvre une autre feuille | 320 ms |
| Zoom du contenu, agrandissement du titre et déploiement du corps dans le flux | On se rapproche d’une capsule sur sa feuille ; les voisines s’écartent | 520 ms |
| Fenêtre interne et soulignement des moments | Trois moments d’une même capsule | 380 ms |
| Soulignement des phases du paysage | Construire, hiérarchiser, confronter et garder une trace dans la même activité | 320 ms |

Elm Animator produit les déclarations et la courbe des transitions CSS natives : `opacity` pour les feuilles, `scale`, `font-size` et `grid-template-rows` pour les capsules, `translate` pour les fenêtres et les soulignements internes. Le corps d’une capsule passe de `0fr` à `1fr`, sans hauteur fixe ; le navigateur redistribue réellement la place entre les capsules. Une nouvelle destination peut interrompre le mouvement selon les règles natives de transition du navigateur.

Deux images préparent la destination avant le départ. Les contenus des capsules sont déjà présents sous leurs en-têtes. Après cette préparation, aucun calcul par image ne reconstruit la page pendant le mouvement. La fin d’une transition retire la feuille sortante et les indicateurs de mouvement. Le pont TypeScript attend trois images pour laisser le navigateur appliquer les styles, puis observe les promesses `Animation.finished` des transitions natives effectivement présentes. Leur annulation, ou l’absence de départ, libère également les indicateurs ; aucun minuteur ne suppose leur durée. Une version de navigation et l’époque de session empêchent une ancienne fin de modifier une navigation récente ou un coffre rouvert. Les éditeurs des capsules refermées restent présents, masqués et inertes, pour la prochaine ouverture. Les panneaux inactifs au repos sont masqués. La navigation reste disponible pendant les transitions ; il n’y a ni boucle décorative ni attente imposée pour choisir.

L’extension additive `shared/elm/MrJam/Continuite.elm` centralise onglets, feuilles, capsules, fenêtres et rubans ; la feuille de thème reste dans `shared/assets/carnet.css`. Une seule mise en page ElmUI racine est utilisée. Les conteneurs conservent leur hauteur naturelle, notamment sur WebKit et Firefox. Le paquet partagé historique et ses autres consommateurs sont inchangés.

## Même architecture sans mouvement

« Sans animations » garde les mêmes onglets, feuilles, capsules, chemins, titres et retours. Les tailles et destinations finales s’appliquent immédiatement, sans boucle de reconstruction pendant un mouvement. Le focus et la lecture des styles attendent le rendu du navigateur. `prefers-reduced-motion` est prioritaire sur le réglage du carnet et réévalué pendant la lecture. TypeScript transmet cette préférence, assure le focus et demande un défilement natif seulement pour une destination explicite ; il ne calcule pas les positions intermédiaires des animations. Une version de focus et l’époque de session annulent les révélations devenues périmées ; ouvrir la vue d’ensemble invalide aussi une demande encore en attente.

Les onglets ont les rôles `tablist`, `tab` et `tabpanel`, un état sélectionné explicite et un seul onglet dans l’ordre de tabulation. Gauche/droite choisissent la feuille précédente/suivante, avec retour cyclique ; Début/Fin choisissent la première/dernière. Le focus clavier reste sur l’onglet choisi. L’activation par clic conduit au contenu. Les titres commandent l’ouverture des capsules et indiquent leur état avec `aria-expanded` et leur cible avec `aria-controls`.

Une seule feuille est accessible à la fois. La feuille sortante et les corps fermés ou qui se referment portent `inert` et `aria-hidden`. Le contenu de la feuille sortante est retiré à la fin du fondu ; les corps refermés restent masqués. Le focus rejoint le titre de la capsule sans défilement lors d’une ouverture locale. Le verrouillage remplace immédiatement tout l’espace privé, annule les mouvements et retire les données ouvertes ; il n’est pas animé.

## Preuves et références

Les contrôles de `tests/browser/carnet.spec.ts` vérifient notamment les trois onglets sur une seule ligne, leur jonction à la feuille, les fonctions du compte en dehors des onglets, le fondu sans déformation, le maintien du titre et du champ DOM, la croissance réelle d’une capsule et le déplacement proportionnel de sa voisine pendant la transition, sa fermeture, les onglets persistants, le clavier, le retour au même moment, les notes et les formulaires, la réduction dynamique et le verrouillage. Les quinze étapes et les sept rubriques sont exercées. Résultats et limites dans `RESULTATS.md`.

Deux scénarios supplémentaires protègent l’intégrité du carnet. Le premier ouvre directement les trois onglets, utilise la carte, vérifie le même classeur et les brouillons au retour, le confinement du clavier, Échap, le scan axe du dialogue et le choix d’une capsule éloignée. Le second observe à chaque image réelle la position des onglets et `scrollY`, puis intercepte les appels de défilement en les transmettant au navigateur : parcours/repères/objectifs sont exercés à 390 et 1440 px, depuis 0 et 60 px de lecture, avec et sans mouvements. Il a reproduit le défaut précédent avant correction. Ces contraintes observables nécessitent un navigateur ; ajouter Elm-review n’aurait pas permis de vérifier la géométrie ou le défilement réels. Le contrôle de la vue d’ensemble vérifie aussi que les titres, objectifs et cartes ne débordent pas à 360, 390 et 1440 px, avec les deux tailles de texte. Le dialogue rétablit explicitement le retour à la ligne, afin de ne pas hériter du texte préformaté du conteneur ElmUI.

Consultées le 6 octobre 2026 : [documentation du package 2.0.0](https://package.elm-lang.org/packages/mdgriffith/elm-animator/2.0.0/), [README et philosophie de Continuous UI](https://github.com/mdgriffith/elm-animator/blob/2.0.0/README.md), [API Animator et transitions natives](https://github.com/mdgriffith/elm-animator/blob/2.0.0/src/Animator.elm). La continuité retenue rend visibles les relations entre les éléments. Son efficacité pour les personnes destinataires, et leur compréhension de la métaphore du classeur, restent à évaluer avec elles, avec et sans mouvement.
