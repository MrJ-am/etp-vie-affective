# Un carnet dans un espace continu

La refonte répond à une difficulté d’orientation : comprendre où se trouvent les séances, ce qui les accompagne dans la durée et comment revenir au contexte quitté. Elle utilise **mdgriffith/elm-animator 2.0.0**, figé dans `elm.json`, avec ElmUI et le thème partagé existants.

## Ce que le plan rend visible

| Position stable | À gauche | À droite |
|---|---|---|
| Point de départ | Mon accueil : retrouver où j’en suis | Mon parcours : choisir parmi les quinze étapes |
| Espaces transversaux | Mes objectifs : direction et défis dans la durée | Mes repères : traces, formulations, étapes et partage choisi |
| Moyens de gérer le carnet | Mes réglages : confort et confidentialité | À propos & sources : provenance, limites et code |

Une séance s’ouvre à droite du sommaire, dans le parcours. À l’intérieur de cette séance, Avant, Pendant et Entre les séances gardent leur ordre horizontal. Les bilans conservent leur gabarit spécifique. Le plan marque le parcours lorsqu’une séance est ouverte ; une branche précise la séance et son moment. Les lignes du plan organisent les espaces et ne prescrivent aucun ordre d’utilisation.

Le chemin « Carnet › Parcours › Séance › Moment » reste lisible. Un passage depuis une séance vers les objectifs ou les repères propose un retour à cette séance **au même moment**. Le bas des pages propose de retrouver le plan. Sur téléphone, le même plan précède le contenu ; il ne dépend plus de l’ouverture d’un menu. Le sommaire affiche les quinze étapes en cartes, avec leurs titres, sous-titres et objectifs. Aucun contenu n’est à débloquer.

« Comprendre le plan » explique les relations : les objectifs peuvent se reformuler, les défis sont persistants, les expérimentations sont liées à une séance et reprises à la suivante, les repères réunissent ce que la personne souhaite garder. Les réglages et les sources restent dans ce même carnet.

## Le fond conservé

| Moment | Rubriques conservées |
|---|---|
| Avant | Je me prépare |
| Pendant | J’expérimente ; Ce que j’en retiens |
| Entre les séances | Je comprends mieux ; Ma progression ; Ma prochaine expérimentation ; Je fais le point |

Les quinze étapes 0–14, les bilans 0/13/14, les objectifs avec leur histoire, les trois défis actifs au maximum, les essais facultatifs et leurs retours, les cinq espaces du paysage, l’hésitation entre deux zones, la confrontation, les versions de traces, les photos, les étapes personnelles et la sélection à partager restent opérationnels. Les contenus et les informations de provenance ne sont ni réécrits ni remplacés par le plan.

Le catalogue, `Carnet.elm`, `Contenu.elm`, le chiffrement, le Worker et tous les fichiers du backend ont été comparés par SHA-256 à l’état initial de cette refonte : ils sont identiques. Le format privé v1, les enveloppes, les contrats d’API et la révision de style-mrjam ne changent pas. Les tests parcourent les quinze étapes et les sept rubriques, ainsi que les opérations existantes sur comptes, notes, objectifs, défis, essais, traces, photos, sauvegardes, récupération et conflits.

Les écrits sauvegardés restent dans le même modèle métier pendant les déplacements. Une reformulation en cours conserve aussi son formulaire lors d’une visite dans un autre espace ; elle est enregistrée avec son bouton de confirmation. Les formulaires temporaires et le contenu ouvert sont retirés au verrouillage selon le contrat existant.

## À quoi servent les mouvements

| Mouvement | Relation rendue visible | Durée |
|---|---|---|
| Déplacement de la fenêtre de lecture et du repère du plan | Position des espaces dans le même carnet | 460 ms |
| Sommaire vers séance, et retour inverse | Une séance appartient au parcours | 460 ms |
| Fenêtre interne et soulignement des moments | Trois moments d’une même séance, avec un titre qui reste en place | 380 ms |
| Soulignement des phases du paysage | Construire, hiérarchiser, confronter, garder une trace dans la même activité | 320 ms |

Les panneaux ont des coordonnées stables. Elm Animator génère les transitions natives de la propriété `translate`, et la destination choisie déplace la fenêtre. Un nouveau choix interrompt le déplacement en cours à sa position intermédiaire, selon les règles de retournement des transitions du navigateur. Deux images préparent le nouveau contenu avant le départ, afin que son premier rendu ne consomme pas la durée du mouvement. Après cette préparation, aucun calcul d’image ne reconstruit la page pendant le déplacement ; une transition terminée retire son panneau sortant. La navigation reste disponible pendant le mouvement. Il n’y a pas de boucle décorative ni d’attente imposée pour cliquer. Les changements d’étape à l’intérieur du parcours réutilisent la fenêtre de séance ; ils ne construisent pas quinze éditeurs simultanés.

L’extension additive `shared/elm/MrJam/Continuite.elm` et la feuille de thème centralisent les fenêtres, repères et rubans. Tous les éléments ElmUI passent par une seule mise en page racine. Les règles de hauteur naturelle corrigent le cas des conteneurs `shrink` avec clipping et des grilles sur WebKit/Firefox. Le paquet partagé historique n’a pas été modifié.

## Même architecture sans mouvement

Le choix « Sans animations » garde le plan, les chemins, les titres, le repère sélectionné et le retour à la séance. Les coordonnées finales s’appliquent immédiatement ; aucune animation-frame n’est demandée dans ce mode. La préférence `prefers-reduced-motion` est prioritaire sur le réglage du carnet et est réévaluée lorsqu’elle change pendant la lecture. TypeScript ne pilote aucun mouvement : il transmet cette préférence native à Elm.

Un seul panneau est accessible à la fois. Le panneau sortant peut rester visible pendant le déplacement mais porte `inert` et `aria-hidden`, puis revient à un aperçu sans champs. Le focus va au titre du contenu ouvert sans défilement automatique induit par sa transformation. Les commandes sont utilisables au clavier. Le verrouillage remplace immédiatement tout l’espace privé, annule les sorties et retire les données ouvertes ; il n’est pas animé.

Les contrôles automatisés de cette refonte sont dans `tests/browser/carnet.spec.ts`, notamment les inversions en mouvement, la disposition du plan, le retour au contexte, les écrits et formulaires, la réduction dynamique, la persistance du choix et le verrouillage pendant une transition. Les résultats et les limites, notamment l’absence d’essais humains et sur appareils physiques, sont dans `RESULTATS.md`.

## Références de conception

Consultées le 6 octobre 2026 : [documentation du package 2.0.0](https://package.elm-lang.org/packages/mdgriffith/elm-animator/2.0.0/), [README et philosophie de Continuous UI](https://github.com/mdgriffith/elm-animator/blob/2.0.0/README.md), [API Animator et transitions natives](https://github.com/mdgriffith/elm-animator/blob/2.0.0/src/Animator.elm). La philosophie retenue réduit les changements de contexte en maintenant une représentation spatiale. L’efficacité de ce choix pour les personnes destinataires devra être évaluée avec elles, avec la possibilité d’essayer la même architecture sans mouvement.
