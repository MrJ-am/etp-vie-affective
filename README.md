# ETP vie affective · Mon carnet

Compagnon de séances : carnet personnel chiffré, interface Elm, serveur Rust,
PostgreSQL et raccordement Nginx. **Prototype réservé aux données fictives**,
sans certification de sécurité ni validation clinique.

Le projet est autonome : aucun serveur commun, SSO, base métier, SDK ou paquet
visuel d’un autre projet n’est requis. Node sert uniquement à construire et tester
le frontend. Le service déployé est un binaire Rust et des fichiers statiques.

La clarification utilisateur du 5 novembre 2026 remplace le gel historique :
une demande de déploiement autorise sa réalisation via la chaîne Forgejo native
de `vps-infrastructure`, depuis son main testé. Préparer le candidat, sa migration
et son retour, puis vérifier la bascule ; les protections de branches restent
en place. Aucune ancienne chaîne ni aucun accès SSH n’est réactivé.
Les anciennes preuves de publication restent dans l’historique Git et ne
qualifient pas automatiquement une nouvelle version.

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

## Groupes et encadrement

L’entrée **Mon groupe · Encadrement** ouvre `/espace.html`. Une personne
encadrante crée ses groupes, copie leur lien d’invitation et consulte les
inscriptions (nom, prénom, adresse mail). Le lien est commun au groupe : aucun
mail n’est envoyé. Il peut être remplacé ; archiver le groupe suspend les
inscriptions et les questionnaires sans retirer les carnets aux membres.
Une inscription par invitation crée un compte participant ; le formulaire ne
permet jamais de s’attribuer un rôle d’encadrement.

L’équipe peut désactiver/réactiver l’accès d’une personne de ses groupes ou
supprimer son compte après confirmation. Désactiver révoque toutes ses sessions.
La réactivation demande une nouvelle connexion. Les copies déjà téléchargées
restent sur les appareils, y compris un carnet chiffré ouvrable hors ligne.
Les comptes autonomes existants gardent leur identifiant et leur coffre v1.
Les nouveaux comptes peuvent se connecter avec leur adresse mail ou l’identifiant
du kit ; la phrase de coffre reste distincte du mot de passe.

L’encadrant·e édite les textes communs et dépose des PDF pédagogiques
(2 Mo maximum, 20 par séance). Ces modifications concernent tous les groupes ;
la visibilité d’une séance se règle séparément pour chaque groupe. Les nouveaux
supports passent par l’API authentifiée, jamais le cache public PWA. Les supports
initiaux de démonstration restent des références publiques, indépendantes des
textes édités. Dans un carnet de groupe, les liens proposés sont ceux des PDF
déposés par l’équipe. L’aperçu participant utilise le vrai classeur avec un carnet
fictif local séparé, sans demander le carnet d’un compte participant.

Un questionnaire comporte 1 à 12 questions, chacune avec 2 à 8 choix et une
abstention possible. Les compteurs sont agrégés à l’envoi, sans conserver de
réponse individuelle. Une table distincte empêche de répondre deux fois avec le
même compte. Les résultats restent masqués avant fermeture et en dessous de
trois participations ; un questionnaire fermé ne peut pas être rouvert. Ce
mécanisme protège contre la consultation nominative par l’équipe, pas contre
toute déduction dans un petit groupe ou une analyse de l’infrastructure.

Le rôle initial s’attribue **hors interface**, à un compte déjà créé, avec le
binaire et la configuration de l’environnement concerné :

```sh
# Exemple de procédure ; ne pas exécuter en production sans autorisation.
backend/target/release/etp-carnet-server --encadrant identifiant_existant
```

Cette commande ne démarre pas de serveur. Elle applique les migrations additives
et attribue uniquement le rôle indiqué. Aucun rôle n’est attribué automatiquement
au premier compte. La purge d’inactivité ne supprime pas un compte responsable
de groupes ; sa suppression nécessite leur transfert préalable par l’opérateur.
Aucun compte existant n’est promu automatiquement ; l’attribution des rôles
reste une opération distincte. **Le déploiement demandé par l’utilisateur est
autorisé ; sa qualification et son intégration à la livraison restent nécessaires.**

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

Pour les nouvelles API, `npm run test:encadrement` construit le serveur Rust,
crée un PostgreSQL éphémère dédié sur `127.0.0.1:55439`, lance l’application sur
`http://localhost:38139`, exécute les scénarios d’encadrement puis les tests API
historiques et arrête ses propres processus. Il refuse les ports occupés. Aucun
volume ni configuration de production n’est utilisé. Les scénarios navigateur
supplémentaires sont dans `tests/browser/encadrement.spec.ts` ; ils exigent cette
même cible locale et sa configuration de base fictive. Préparer le frontend avec
`npm run build` avant de les exécuter sur un atelier local maintenu ouvert.
Avec Chromium de Playwright installé, `CARNET_TEST_BROWSER=1 npm run
test:encadrement` inclut leur exécution dans l’atelier éphémère, avant les tests
historiques de limitation de débit.
Un navigateur Chromium déjà installé peut être sélectionné explicitement avec
`CARNET_TEST_CHROMIUM_EXECUTABLE=/chemin/vers/chromium`, sans modifier les
dépendances verrouillées.

La base de test est isolée et éphémère. Ne jamais diriger les scripts de
restauration vers des données réelles. Les anciennes captures et preuves restent dans l'historique Git et la
référence de retour du chantier ; elles ne qualifient pas un nouveau candidat.

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
