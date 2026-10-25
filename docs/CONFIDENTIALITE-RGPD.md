# Dossier préparatoire — données fictives uniquement

Cette fiche organise les décisions nécessaires avant un usage réel. Elle ne détermine pas une base légale ni ne certifie un hébergement. Les contenus de vie intime, sexuelle et de santé peuvent relever de l’article 9 même chiffrés et pseudonymisés.

| Élément | POC actuel | À confirmer avec responsable et DPO |
|---|---|---|
| Finalité | Essai d’un carnet personnel compagnon des séances, sans surveillance | Finalité du service réel, contexte sanitaire ou éducatif, nécessité/proportionnalité |
| Responsable et contact | Aucun établissement ni DPO inventé | Organisme responsable, adresse de contact, responsable sécurité et procédure de droits |
| Article 6 / Article 9 | Non choisis pour un service clinique | Base juridique et condition des données sensibles adaptées au contexte ; information compréhensible |
| Données minimales | Pseudonyme, hash de mot de passe/code de compte, UUID, sessions, dates techniques, ciphertext et révisions | Registre, données collectées par hébergeur/reverse proxy, preuve de minimisation |
| Données privées | Notes, objectifs, défis, situations, photos, préférences et calendrier libre dans l’enveloppe | Analyse de sensibilité et participation de personnes concernées |
| Destinataires | Personne qui ouvre son coffre ; serveur reçoit uniquement ciphertext | Accès techniques et sous-traitants, contrats article 28, support sans lecture du carnet |
| Sous-traitance/transferts | Docker local pour comptes ; démonstration privée Sites sans API de comptes | Localisation, hébergeur choisi, clauses, transferts, accès légaux, HDS selon champ applicable |
| Recherche et partage | Désactivés ; retour POC privé, présentation locale choisie | Toute recherche doit faire l’objet d’un projet distinct et de ses autorisations |

## Flux, durée et droits

Navigateur → même origine HTTPS : authentification, enveloppes et pièces scellées. Pas de tracker, CDN de police, analytics, IA, partage automatique ou lecture par professionnel. Connexion IP et volume restent visibles à l’infrastructure réseau. L’app ne journalise pas les corps ni les accès ; les prestataires et Nginx peuvent journaliser des métadonnées et doivent être configurés séparément.

Sessions : maximum 24 h, inactivité serveur 2 h ; purge au démarrage puis chaque minute. Carnets : paramètre `CARNET_RETENTION_DAYS`, 90 jours d’inactivité dans le POC, purge serveur périodique avec cascade. Ce choix technique n’est pas une recommandation de durée pour un soin. Les copies IndexedDB restent sur le navigateur tant que la personne ne les supprime pas ; logout ferme le coffre, conserve la copie chiffrée pour éviter une perte et révoque la session. Suppression de compte retire ses copies locales dans ce navigateur, sessions, objets et archives serveur. Les copies d’autres appareils et téléchargements restent sous contrôle de leurs détenteurs ; documenter cette limite dans l’information réelle.

Rectification et effacement d’entrées sont locaux puis synchronisés. Export scellé pour portabilité et sélection lisible volontaire pour accès. Sans secrets, l’opérateur peut supprimer un compte après vérification appropriée mais ne peut pas produire le contenu déchiffré. La méthode hors connexion pour vérifier l’identité et traiter les demandes doit être définie avant un service réel.

Backups : aucune sauvegarde externe automatique activée dans cette démonstration. Politique proposée à valider : backup quotidien chiffré côté infrastructure, accès restreint, conservation glissante courte (ex. 30 jours), effacement vérifié, exercices de restauration. Le chiffrement des carnets ne remplace pas la protection des comptes/métadonnées. Journal des UUID supprimés indépendant des backups de base, fsync avant suppression. Toujours le rejouer dans sa version la plus récente avant remise en service. Les identifiants du journal restent personnels/pseudonymes : purge contrôlée seulement après disparition de toutes les sauvegardes susceptibles de contenir ces comptes. Aucune purge automatique de ce journal n’est activée dans le POC.

## Analyse d’impact et HDS à préparer

Cartographier traitement et sous-traitants ; examiner contexte, population vulnérable, données sensibles, volumes, usages imprévus, dépendance numérique, confidentialité sur appareils partagés, récupération et perte de données. Pour chaque menace de `MENACES.md`, apprécier gravité/vraisemblance et mesures avec le DPO ; associer les personnes concernées ; arrêter critères d’acceptation et risques résiduels. Valider nécessité de l’AIPD et éventuelle consultation avant mise en service.

L’[ANS](https://esante.gouv.fr/faq/si-jheberge-des-donnees-de-sante-chiffrees-suis-je-soumis-lobligation-de-certification-hds), consultée le 6 octobre 2026, indique que chiffrer ne change pas à lui seul l’obligation HDS. Déterminer le champ du traitement envisagé, la certification de chaque acteur, les contrats, la localisation, les procédures d’incident et les possibilités de sortie. Aucun VPS, Sites ou dispositif présent n’est déclaré qualifié pour ce service clinique.

Avant usage réel : responsable et DPO nommés, notices/droits validés, AIPD/HDS tranchés, hébergement contractualisé, audit crypto et client indépendant, configuration HTTPS/proxy, intégrité des builds, tests de restauration/deletion, accompagnement du kit et tests avec adultes autistes. Une case à l’inscription ne résout pas ces points. La bannière actuelle impose uniquement l’usage fictif du prototype.

## Partage local ajouté

Les sondages sont un partage volontaire vers l’animateur, distinct du carnet.
Question/choix publics dans le QR ; réponses chiffrées en transit optique, résultats
lisibles seulement sur l’appareil animateur. Pas de serveur, pas de persistance
automatique, aucune promesse d’anonymat. Le rôle et l’information du groupe doivent
être validés avant usage réel. Le mode PWA hors ligne conserve les copies chiffrées
sur chaque appareil ; déconnexion hors ligne ne révoque pas la session serveur.
