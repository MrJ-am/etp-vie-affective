# Conventions du carnet autonome

Vocabulaire métier français, Elm/ElmUI/Animator côté interface, Rust/PostgreSQL
côté serveur. Lire README et docs/SECURITE.md puis ARCHITECTURE-CRYPTO.md avant
modification des contrats. Préserver le format cryptographique v1 et les comptes.
Aucune donnée privée ni document source médical original dans les ressources servies.

Ce projet est indépendant : aucun raccordement au monolithe, au SSO,
au thème ou aux données des autres projets. Le VPS fournit uniquement Nginx,
une base et un rôle PostgreSQL dédiés, ainsi que le lancement du service autonome.
Respecter les procédures du dépôt d’infrastructure pour tout déploiement effectif.
Les ressources d’identité d’autres projets restent réservées.

Les tests utilisent des fixtures inventées. verify-restore.ts cible uniquement
compose.test.yaml. Ne pas revendiquer certification, validation clinique,
audit externe ou essai sur appareils réels inexistant. Pas de publication de
données patient ni de bascule du VPS sans sauvegarde et retour vérifiés.

La préparation Rust/Elm du 28 octobre 2026 gèle tous les déploiements.
L'assemblage applicatif est dans [mrjam-plateforme](https://github.com/MrJ-am/mrjam-plateforme),
les propositions de règles indépendantes dans [mrjam-validation](https://github.com/MrJ-am/mrjam-validation),
et l'environnement de développement dans [vps-infrastructure/environment](https://github.com/MrJ-am/vps-infrastructure/tree/main/environment).
La forge cible est https://forge.mrj.am ; son raccordement et les ACL restent à établir.
Ne créer ni workflow, ni déclencheur de déploiement dans ce dépôt.
Une vérification locale ne vaut ni qualification complète ni autorisation de production.
Conserver les révisions exactes des dépendances, les licences et les ressources réservées.
Aucune donnée personnelle, aucun accès de production, aucun secret dans le dépôt.
L'historique Git conserve les versions antérieures ; aucune réécriture forcée.

La préparation actuelle conserve le code Rust/Elm autonome. Elle ne qualifie
pas à nouveau ViSe ; les anciens rapports sont dans l'historique Git.
