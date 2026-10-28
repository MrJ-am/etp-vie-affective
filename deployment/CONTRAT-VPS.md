# Frontière avec vps-infrastructure

ETP est un service autonome, extérieur au manifeste des composants métier communs.
La demande du 25 octobre 2026 autorise ce raccordement restreint, sans l’intégrer
au monolithe, au SSO ni aux bibliothèques des autres projets.

| Ressource | Contrat |
|---|---|
| Application | Un binaire Rust/image immuable, utilisateur système dédié, port de boucle locale réservé |
| Entrée | Vhost Nginx propre, HTTPS, proxy vers ce port, corps ≤ 4 000 000 octets, logs d’accès désactivés |
| PostgreSQL | Base `etp_carnet`, rôle dédié `etp_carnet` non superuser, SCRAM/TLS ou socket local protégé ; aucune lecture des autres bases |
| Secrets | EnvironmentFile hors dépôt/store, droits 0600, même origine publique exacte |
| Persistance | Base SQL et journal indépendant actuel des suppressions ; aucun secret de coffre serveur |
| Santé | GET `/api/health` : disponibilité réelle de la base, aucune donnée de carnet |
| Mise à jour | Sauvegarde récupérable, restauration isolée, même artefact qualifié, retour code avec données actuelles |
| Sortie | Arrêt écritures, dump SQL + journal actuel, fichiers statiques/binaire et configuration ; changement du vhost/DNS |

Le nom de domaine, le port et le digest d’image sont fournis par l’hébergeur.
`carnet.nix`, `etp-carnet.service` et `nginx.conf` sont des exemples à instancier.
Aucun endpoint MCP ni accès aux identités communes. Aucun secret en fichier image.
L’application se déplace sans modification du code vers un autre hébergeur.

État initial du 25 octobre : raccordement préparé, non appliqué. La section
ViSe ci-dessous précise le choix d’hébergement du 27 octobre ; les autres
projets conservent leur propre infrastructure et leur cycle de vie.

## ViSe — hébergement choisi le 27 octobre 2026

Domaine : `https://vise.mrj.am`. Une base `etp_carnet` et un rôle Unix/PostgreSQL
`etp_carnet` sont réservés dans **l’instance PostgreSQL générale existante**.
Il n’y a pas de second serveur PostgreSQL ni de nouveau conteneur de base.
La connexion se fait par socket local `/run/postgresql`, authentification peer,
sans mot de passe stocké ni ouverture TCP. Les règles HBA ne permettent à ce
rôle que sa base propre.

Le serveur Rust statique musl est qualifié localement sur le même protocole Unix.
L’adaptateur conservé sous `reference-nixos/assemblage/vise/` dans vps-infrastructure ne possède que
le service systemd, le vhost Nginx, la déclaration de base/rôle et la sauvegarde
chiffrée indépendante. Pas de Docker sur le VPS, ni de SSO/monolithe partagé.
Les paquets conteneurisés restent une option de développement et de portabilité.

Le chantier Rust/Elm du 28 octobre gèle les déploiements. Cette référence
d'intégration décrit la cible historique, pas une activation effectuée ici.
