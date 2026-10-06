# Vérifications exécutées le 6 octobre 2026

Les résultats bruts sont joints : `unit-results.txt`, `api-results.txt`, `browser-results.json`, `storage-results.txt`, `restore-results.txt` et `photo-metadata-results.txt`. Tous les comptes, notes et photos d’essai sont inventés. Les captures montrent le carnet fictif ; aucun participant, patient ou secret de récupération n’est enregistré dans ces artefacts.

**76 tests réussis, aucun ignoré : 13 unités, 9 cas API réels et 54 cas navigateur (18 par moteur).** Exercices de restauration, inspection du stockage et EXIF complémentaires réussis. Voir aussi `verification-final.json`.

## Couverture

| Groupe | Cas vérifiés |
|---|---|
| Unités crypto et contenu | Vecteur NIST AES-256-GCM, déchiffrement Node/OpenSSL indépendant avec AAD, PBKDF2 indépendant, mauvaise phrase, récupération, altération/substitution, nonces, version/KDF/base64/tailles, padding UTF-8, validation profonde, quinze étapes et sept rubriques, bornes images avant décodage |
| API réelle | Comptes et sessions, isolation de deux comptes/objets, CSRF/Origin, payload strict, taille, If-Match atomique, récupération de connexion/rotation/révocation, nouveau coffre/archives, cascade de suppression, quota vingt photos et 64 Mo archives comprises, limitation du débit |
| Parcours navigateur | Démo isolée/reset, paysage clavier/hésitation/trace/reload, quinze étapes, objectifs avec histoire, trois défis, reprise d’essai sans duplication, vrais comptes et deuxième navigateur, offline/conflit, export/réimport réel, sélection lisible et présentation, phrase et kit, images, suppression, XSS inerte, sentinelle réseau/IndexedDB, retour navigateur verrouillé, récupération du compte/nouveau coffre, import altéré/JSON malformé, verrouillage automatique averti |
| Accessibilité | Axe sur accueil, objectifs, repères, réglages et paysage ; clavier, noms stables, réduction des mouvements, mode sobre, texte agrandi/reflow à 360 px ; contrôle de débordement après changement de largeur |
| Visuel | Captures accueil/chapitre à 360, 390, 430, 768 et 1440 CSS px sur Chromium, WebKit et Firefox ; quinze comparaisons de références, inspectées ; couverture et paysage en plus |
| Persistance et stockage | Vrai redémarrage SBCL/PostgreSQL, déchiffrement du coffre survivant ; compte supprimé réinjecté dans SQL puis retiré au démarrage par journal indépendant ; sentinelle absente de coffres/objets/archives et logs Lisp ; scrypt Ironclad identique au vecteur Node indépendant |

Les tests navigateur passent par un relais localhost qui transmet les vraies requêtes au serveur de test, sans mocks d’API. Aucun retry automatique n’est configuré. La vérification de stabilité offline WebKit a été répétée explicitement trois fois après correction du statut de sauvegarde. Les premières exécutions ont révélé des défauts de libellés accessibles et de synchronisation des interactions ; ils ont été corrigés. Les rapports finaux doivent être utilisés, pas les exécutions initiales de mise au point.

L’artefact destiné à la publication privée a aussi été ouvert réellement sur localhost : entrée en mode démo uniquement, ouverture du carnet, activité paysage et lien du code vérifiés ; aucune requête `/api/` dans ce mode. Le statut natif de publication fournit séparément la vérification de l’URL. La version complète locale est servie réellement sur http://localhost:3000 dans cet environnement ; ce loopback distant n’est pas une URL publique accessible depuis l’ordinateur du destinataire.

Un contrôle complémentaire sur le vrai serveur local a inséré un segment EXIF valide et un marqueur fictif dans un JPEG généré. Après ajout via l’interface et déchiffrement de l’export, le JPEG nettoyé ne contient ni EXIF ni marqueur. La fixture de compte a été supprimée ; le résultat figure dans `photo-metadata-results.txt`.

## Limites des essais

Les largeurs, le paysage et le changement de taille sont des émulations navigateur, pas des essais sur smartphone ou écran pliable physique. Le clavier virtuel mobile, VoiceOver/TalkBack/NVDA avec une personne, le zoom natif sur plusieurs OS, la restitution des alertes par lecteur d’écran et les préférences d’adultes autistes n’ont pas été évalués humainement. Aucun persona simulé ne remplace ce travail. Les scans axe ciblés ne certifient pas la totalité WCAG 2.2 AA.

La CI est écrite mais n’a pas été exécutée sur GitHub Actions distant. Les commandes ont été exécutées localement. L’exemple NixOS/Nginx/systemd n’a pas été déployé ou évalué sur un VPS. Pas de test d’intrusion indépendant, audit cryptographique, certification HDS ou validation clinique. PBKDF2 doit être mesuré sur appareils mobiles réels ; les futures migrations et rotations de clé doivent être conçues avant introduction d’un nouveau format.

L’export et la suppression des copies sur d’autres appareils restent à charge de leurs détenteurs. Le rejeu du journal ne protège une restauration que si le journal **actuel** est conservé séparément ; l’exercice réalisé vérifie ce contrat précis. Les métadonnées temporelles et volumes subsistent. Un opérateur actif contrôlant le code livré demeure une menace explicitement ouverte.
