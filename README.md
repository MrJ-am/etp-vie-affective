# ETP vie affective · Mon carnet

Compagnon de séances : carnet personnel chiffré, interface Elm, serveur Rust,
PostgreSQL et raccordement Nginx. **Prototype réservé aux données fictives**,
sans certification de sécurité ni validation clinique.

Le projet est autonome : aucun serveur commun, SSO, base métier, SDK ou paquet
visuel d’un autre projet n’est requis. Node sert uniquement à construire et tester
le frontend. Le service déployé est un binaire Rust et des fichiers statiques.

Le domaine retenu pour l’hébergement est **https://vise.mrj.am**.
Le raccordement utilise une base séparée dans le PostgreSQL général existant.

## Démarrer

```sh
npm ci
npm run typecheck
npm run build
cp .env.example .env
# Remplacer le mot de passe PostgreSQL dans .env.
docker compose up --build -d
```

Ouvrir `http://localhost:3000`. Hors localhost, HTTPS est obligatoire.
Le binaire peut aussi être construit avec `cargo build --locked --release
--manifest-path backend/Cargo.toml`. Les variables `CARNET_DB_*` sélectionnent
la base ; `CARNET_DIST`, `CARNET_BIND`, `CARNET_PUBLIC_URL` et
`CARNET_DELETION_LEDGER` sélectionnent les ressources locales.

## Usage

Créer un compte pseudonyme, choisir un mot de passe de connexion et une phrase
de coffre **différente**, puis conserver le kit privé de récupération.
Le serveur ne reçoit jamais la phrase, la clé du coffre ou son secret de récupération.
Une réinitialisation de connexion ne déchiffre pas le carnet.

La séance actuelle et les précédentes restent accessibles. La suivante n’ouvre
que « Se préparer » ; « Commencer cette séance » ouvre son contenu en séance.
Les autres sont grisées. Cette progression est choisie localement par la personne,
ce n’est pas une autorisation médicale ni un verrou imposé par l’équipe.
Les activités précédemment « Après » se retrouvent dans la préparation suivante.
Les supports de préparation existent en HTML et PDF téléchargeable. Ils reprennent
les adaptations du catalogue, **pas les cours originaux privés**.

La PWA télécharge l’application, le catalogue et les supports. Attendre
« Application et supports disponibles hors ligne » avant de quitter le réseau.
Sur un appareil déjà utilisé, un rechargement sans réseau propose le coffre local,
ouvrable avec sa phrase. Les modifications restent chiffrées sur l’appareil et
se synchronisent au retour d’une session du même compte. La démo reste fictive.

Le lien « sondage local » permet un partage volontaire sans réseau par QR codes
chiffrés, avec collecte successive par l’animateur. Lire
[le fonctionnement hors ligne](docs/HORS-LIGNE-ET-SONDAGES.md).

## Vérifier

```sh
npm run typecheck
npm run build
cargo fmt --manifest-path backend/Cargo.toml --check
cargo clippy --manifest-path backend/Cargo.toml --locked -- -D warnings
docker compose build app
docker compose -p mon-carnet-tests -f compose.test.yaml up -d backend
node --import tsx --test tests/crypto.test.ts tests/contenu.test.ts tests/image.test.ts tests/poll.test.ts
node --import tsx --test tests/api.test.ts
node --import tsx scripts/verify-restore.ts
```

La base de test est isolée et éphémère. Ne jamais diriger les scripts de
restauration vers des données réelles. Les anciennes captures et preuves dans
`docs/historique/` et les fichiers de résultats antérieurs décrivent le prototype
historique, pas la qualification de cette version. Voir [les résultats actuels](docs/VERIFICATION-RUST-PWA.md).

## Dossier de sécurité

Commencer par [le modèle de sécurité](docs/SECURITE.md), puis les
[contrats cryptographiques](docs/ARCHITECTURE-CRYPTO.md), les
[menaces](docs/MENACES.md) et le [dossier RGPD](docs/CONFIDENTIALITE-RGPD.md).
Le chiffrement protège une fuite du stockage ; un serveur qui distribue un client
malveillant reste une menace pour une PWA. Cette limite empêche de promettre une
confidentialité absolue face à tout administrateur actif.

[Déploiement portable](docs/DEPLOIEMENT.md) et
[contrat d’intégration VPS](deployment/CONTRAT-VPS.md).
Licence du travail propre : **LGPL-3.0-or-later**, textes dans `LICENSE` et
`COPYING`. Voir [l’examen des licences](docs/LICENCES.md).
