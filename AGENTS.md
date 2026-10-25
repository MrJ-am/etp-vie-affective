# Conventions du carnet autonome

Vocabulaire métier français, Elm/ElmUI/Animator côté interface, Rust/PostgreSQL
côté serveur. Lire README et docs/SECURITE.md puis ARCHITECTURE-CRYPTO.md avant
modification des contrats. Préserver le format cryptographique v1 et les comptes.
Aucune donnée privée ni document source médical original dans les ressources servies.

Ce projet est indépendant : aucun raccordement à l’image Common Lisp, au SSO,
au thème ou aux données des autres projets. Le VPS fournit uniquement Nginx,
une base et un rôle PostgreSQL dédiés, ainsi que le lancement du service autonome.
Respecter les procédures du dépôt d’infrastructure pour tout déploiement effectif.
Les ressources d’identité d’autres projets restent réservées.

Les tests utilisent des fixtures inventées. verify-restore.ts cible uniquement
compose.test.yaml. Ne pas revendiquer certification, validation clinique,
audit externe ou essai sur appareils réels inexistant. Pas de publication de
données patient ni de bascule du VPS sans sauvegarde et retour vérifiés.
