# Déploiement et migration portables

Le frontend compilé et le serveur Rust sont livrés ensemble. PostgreSQL et Nginx
restent des services d’infrastructure. Aucun autre projet n’est nécessaire.
Le déploiement Compose fournit un PostgreSQL isolé ; le serveur écoute en boucle
locale sur le port 3000 publié. En production, placer Nginx en HTTPS devant lui.

Pour utiliser le PostgreSQL existant, créer une base et un rôle dédiés, sans
superuser, et renseigner `CARNET_DB_HOST`, `CARNET_DB_PORT`, `CARNET_DB_NAME`,
`CARNET_DB_USER`, `CARNET_DB_PASSWORD`. Le rôle possède uniquement ses tables
et applique les migrations versionnées au démarrage. Ne pas utiliser le rôle
métier commun. Une base distante exige transport réseau privé/chiffré et contrôle
d’accès PostgreSQL ; aucune ouverture publique de 5432.

L’environnement contient aussi `CARNET_PUBLIC_URL` (origine HTTPS exacte),
`CARNET_SECURE_COOKIE=true`, `CARNET_RETENTION_DAYS` (90 par défaut ; politique
à valider), `CARNET_BIND`, `CARNET_DIST`, `CARNET_DELETION_LEDGER`.
Le fichier de secrets reste hors Git et hors image, lecture uniquement par
l’utilisateur du service. Voir les exemples systemd/Nginx dans `deployment/`.

Le serveur ne fait confiance à aucun X-Forwarded-For : derrière Nginx la limite
applicative d’authentification par IP s’applique collectivement au proxy (60
requêtes par route/15 min), plus une limite par pseudonyme (30/15 min). Ajuster
une protection réseau au vhost après mesure ; ne pas contourner la limite par
un en-tête fourni par le client. Deux calculs scrypt concurrents maximum.

## Ancienne API Lisp → Rust

1. Sauvegarder SQL et le journal courant des suppressions ; vérifier leur
   restauration isolée avant bascule. Le format SQL, les enveloppes v1 et les
   hashes scrypt-v1 restent compatibles. Ne jamais réinitialiser les volumes.
2. Arrêter l’ancien serveur avant de démarrer Rust : un seul écrivain de journal.
   Déployer le binaire avec les mêmes paramètres de base, origine, cookie et
   chemin du journal. Le démarrage applique la migration idempotente existante.
3. Vérifier santé, connexion fictive, coffre déchiffrable côté client, conflit,
   export/import et suppression. Une session existante reste compatible.
4. Au besoin revenir au code antérieur avec la base **actuelle**, sans restaurer
   une sauvegarde sur des écritures récentes. Les modifications de schéma futures
   devront conserver cette possibilité ou annoncer une procédure différente.

## Sauvegarde et restauration

Sauvegarder PostgreSQL chiffré côté infrastructure et conserver séparément le
journal le plus récent `deletions.log`. Celui-ci ne contient que les UUID supprimés.
Les clés du coffre restent sur les appareils ; aucune clé n’est à sauvegarder côté serveur.

Restaurer hors trafic, application arrêtée, avec le journal actuel. Au démarrage,
les comptes supprimés sont retirés avant ouverture du port. Un journal absent
sur base contenant des comptes, illisible ou malformé bloque le démarrage.
Ne jamais remplacer le journal actuel par un ancien journal issu du dump.
Ne purger ses lignes qu’après disparition de toutes les sauvegardes susceptibles
de réintroduire ces comptes. L’exercice `scripts/verify-restore.ts` est réservé
à la base de test de `compose.test.yaml`.

## Reproductibilité et exploitation

Cargo.lock et package-lock.json verrouillent les dépendances ; Elm verrouille
ses versions. Construire l’image une fois, relever son digest et promouvoir cet
artefact exact. Les images Rust/Debian du Dockerfile sont figées par digest ;
leur mise à jour nécessite une nouvelle qualification et un nouvel artefact.
Les migrations et l’entretien périodique sont exécutés par le service ; aucune
connexion n’est ouverte par le frontend vers PostgreSQL.

Le contrat de raccordement est dans `deployment/CONTRAT-VPS.md`. ViSe a été déployé le 27 octobre 2026 sur le VPS par le workflow central
`vise-deploiement.yml` de vps-infrastructure (run40456207396). Le binaire musl
autonome tourne sans Docker ; sa base et son rôle séparés utilisent le PostgreSQL
général existant par socket Unix. HTTPS, sauvegarde chiffrée et démarrage
persistant ont été vérifiés. Les ressources publiques correspondent par SHA256
à l’artefact qualifié. Voir `vps-infrastructure/assemblage/vise/production.json`. Une future migration emporte le dump,
le journal, le binaire/les assets et les secrets d’exploitation ; aucune modification
métier n’est nécessaire. Vérifier HDS/AIPD et audit avant données réelles.
