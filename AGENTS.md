# Conventions du carnet

Vocabulaire métier en français, Elm/ElmUI pour le frontend, Common Lisp/PostgreSQL pour les comptes. Lire README et docs/ARCHITECTURE-CRYPTO.md avant de modifier les contrats. Les documents sources restent privés et hors du dépôt : ne pas les copier, servir ou publier.

Composants et thème centralisés dans shared/, extension additive destinée à MrJ-am/style-mrjam à la révision style.lock.json. Ne pas altérer les consommateurs ou les ressources d’identité du paquet partagé. Toute intégration upstream ou au VPS doit respecter ses instructions et la coordination actuelle, via ses workflows autorisés.

Une publication Sites de ce projet expose uniquement la démo navigateur, explicitement annoncée. Le backend Lisp/PostgreSQL reste dans la version complète locale. Ne pas simuler des comptes sur Sites ni remplacer la stack pour l’hébergement.

Tous les tests utilisent des données inventées. scripts/verify-restore.ts cible exclusivement compose.test.yaml : ne jamais l’adapter silencieusement à une base réelle. Ne pas augmenter le nombre de tests ou relancer sans raison après validation ; vérifier les changements pertinents. Ne pas revendiquer une certification de sécurité, une validation clinique ou des essais utilisateurs inexistants.
