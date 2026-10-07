# Vérifications de la livraison du 7 octobre 2026

Cette livraison supprime la vue d’ensemble redondante, réduit le bandeau au nom du programme et à l’icône du compte, déplace le verrouillage dans ce menu et maintient le bandeau en haut pendant la lecture. Les capsules fermées portent leur numéro et leur titre ; les objectifs source restent dans leur contenu ouvert. Le titre garde sa taille et sa position à l’écran pendant le mouvement. Avant / Pendant / Après sont trois textes alignés au-dessus d’un seul soulignement mobile. Les douze chapitres, les trois bilans et les sept rubriques sont conservés.

**72 cas navigateur ont passé dans une exécution complète, sans échec, cas ignoré ou retry : 24 sur chacun des trois moteurs.**

Les 13 tests unitaires et 9 cas API réels ont passé dans la livraison du 6 octobre ; leurs fichiers métier, crypto et backend sont identiques par SHA-256. Ces 22 preuves sont conservées sans nouvelle exécution. Les exercices de restauration, d’inspection du stockage et de retrait des métadonnées proviennent également de la livraison initiale, sur les mêmes contrats. Les cas des rapports de développement ou des livraisons précédentes ne sont pas additionnés aux résultats actuels. Tous les comptes, notes et photos d’essai sont inventés.

## Couverture actuelle

| Groupe | Vérifications |
|---|---|
| Contenu et fonctions | Quinze étapes et bilans, sept rubriques, objectifs et historique, trois défis actifs, expérimentation reprise sans duplication, paysage au clavier, hésitation, trace et rechargement |
| Comptes et persistance | Inscription réelle, isolation entre comptes et navigateurs, phrase et récupération, hors connexion et conflit, export/réimport, images et suppression, import altéré, XSS inerte, sentinelle réseau/IndexedDB, retour navigateur verrouillé, récupération de connexion et nouveau coffre, verrouillage automatique |
| Structure et continuité | Trois onglets joints au papier sur une seule ligne ; ouverture locale avec même titre et champ DOM ; croissance réelle et déplacement proportionnel de la capsule suivante ; fermeture, interruption, annulation native ; fondu d’opacité ; retour au même moment et brouillons conservés |
| Ancrage du titre | Ouverture de 3 puis 4, fermeture de 4, ouverture et fermeture du dernier bilan 14 ; chaque image native observée après layout à 390 et 1440 CSS px, avec et sans mouvement réduit ; même titre DOM, écart inférieur à 1,5 CSS px, taille de police exactement constante |
| Bandeau et moments | Bandeau accessible après défilement ; nom du programme et icône avec nom accessible ; verrouillage dans le menu, vue d’ensemble absente ; Avant / Pendant / Après sur une même ligne, hauteurs et largeurs égales, fond transparent et absence de contour, à 360, 390 et 1440 px avec texte normal et agrandi ; flèches et focus clavier |
| Onglets du carnet | Position de la barre et `scrollY` observés pendant chaque image du fondu ; aucune commande de défilement pour parcours/repères/objectifs à 390 et 1440 px, depuis 0 et 60 px de lecture, avec et sans mouvement réduit |
| Accessibilité | Axe sur parcours, objectifs, repères, réglages et paysage ; noms, rôles d’onglets et clavier, réduction dynamique, mode sobre et reflow à 360 px ; le statut de sauvegarde reste annoncé et se consulte dans les réglages |
| Visuel | Quinze références à 360, 390, 430, 768 et 1440 px, pour Chromium, WebKit et Firefox ; mise à jour explicite pour cette interface, inspection puis comparaison complète sans mise à jour ; captures complémentaires du bandeau, des onglets, du menu et des moments |

Les tests navigateur utilisent un relais localhost vers le vrai backend Lisp/PostgreSQL isolé, sans mock d’API, retry ou cas ignoré. Les trois moteurs sont exécutés en parallèle, avec les tests d’un fichier en série. La base ne contient que des fixtures fictives.

Le test d’ancrage a d’abord échoué sur la version précédente en détectant les variations de taille du titre. Le premier essai de compensation a ensuite détecté un déplacement supérieur à 1600 px : la capture du clic précédait le démarrage des transitions Elm. La compensation attend maintenant le retrait réel des indicateurs de mouvement. Une annulation volontaire retire le repère précédent sans le repositionner. Le protocole attend aussi le rendu après changement de largeur et la fin du repère avant de repositionner programmatiquement la lecture pour l’essai suivant. Les défauts détectés et les anciens résultats sont distincts dans `historique/` ; ils ne constituent pas la preuve finale.

La comparaison de position des capsules conserve les durées livrées et observe les images natives après leur layout. Le contrôle déjà présent sur le déploiement d’une capsule allonge seulement sa transition pour examiner un état intermédiaire ; il ne simule ni état Elm ni géométrie. Les durées livrées sont 320 ms pour les feuilles, 520 ms pour les capsules, 380 ms pour les moments et 320 ms pour le paysage.

La démo statique destinée à Sites est ouverte sur localhost avant publication : entrée directe dans le parcours, trois onglets, douze capsules et trois bilans, navigation Après et retour au même moment, compte et verrouillage dans le menu, absence de vue d’ensemble, liens vers les sources du projet, aucune requête API ni erreur JavaScript. `site-classeur-results.json` décrit cet artefact. Le statut natif de publication vérifie séparément l’URL livrée. Le serveur complet local sert les vrais comptes ; ce localhost distant n’est pas une URL publique.

## Conservation du fond

`integrite-classeur.json` compare neuf fichiers au commit livré avant cette modification : catalogue, modèle privé, décodeur de contenu, crypto, Worker, serveur Lisp, image backend, migration SQL et révision de style-mrjam. Le nouveau module `bridge/continuite.ts` ne traite que la géométrie : hauteur du bandeau, repère du titre cliqué et réserve de papier nécessaire à la fin de la feuille. Le pont conserve les contrats de chiffrement, de stockage et de réseau.

Les titres, objectifs et contenus pédagogiques restent dans le catalogue. Les sous-titres redondants des chapitres ne sont plus affichés dans les capsules fermées ; les intitulés distinctifs des bilans restent à l’intérieur. Les sept rubriques gardent leur contenu et leur provenance. Le renommage « Après » concerne la navigation ; l’expérimentation entre séances reste le même concept métier.

Les preuves antérieures couvrent les vecteurs indépendants NIST AES-GCM, Node/OpenSSL, PBKDF2 et scrypt, les formats et bornes, les autorisations API/CSRF/Origin/If-Match, la suppression et les quotas. L’exercice de restauration a réellement redémarré SBCL/PostgreSQL, retrouvé le coffre survivant et retiré au démarrage un compte supprimé réinjecté, grâce au journal indépendant actuel. Le contrôle EXIF a inséré un marqueur fictif dans un JPEG généré, ajouté l’image via le serveur et vérifié son absence après déchiffrement de l’export. Les fichiers de preuve sont référencés dans `verification-final.json`.

## Limites des essais

Les dimensions sont des émulations navigateur, sans essai sur téléphone physique. Le clavier virtuel, les lecteurs d’écran avec une personne, le zoom natif sur plusieurs OS et la compréhension de la métaphore du classeur restent à évaluer avec les personnes destinataires. Les contrôles d’ancrage couvrent les séquences et positions décrites ; ils ne prouvent pas tous les gestes sur tous les appareils. Les scans axe ne certifient pas l’ensemble WCAG.

La CI est écrite mais n’a pas été exécutée sur GitHub Actions distant. Les commandes ont passé localement. L’exemple de déploiement NixOS/Nginx/systemd n’a pas été déployé sur un VPS. Aucun audit indépendant, certification HDS ou validation clinique n’est revendiqué. PBKDF2 doit être mesuré sur des appareils mobiles réels. Les futures migrations et rotations de clé nécessitent un protocole distinct.

Les exports téléchargés restent sous le contrôle de leurs détenteurs. La restauration ne respecte les suppressions que si le journal actuel est conservé séparément. Les métadonnées temporelles et volumes subsistent ; le contrôle du code livré par un opérateur actif demeure une menace ouverte.
