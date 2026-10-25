# Examen des licences — 25 octobre 2026

Le travail propre de ce dépôt est placé sous **GNU LGPL version 3 ou toute version
ultérieure**, identifiant SPDX `LGPL-3.0-or-later`. `LICENSE` contient la LGPL 3 ;
`COPYING` contient la GPL 3 incorporée par ses termes. Les dépendances conservent
leurs licences et avis. Cette attribution suppose que le titulaire du projet
possède les droits sur ses contributions ; elle ne relicencie aucun contenu tiers.

LGPL 3 est la dernière version publiée de la LGPL à cette date. Un usage médical
ne nécessite pas une licence logicielle particulière : la licence n’apporte ni
validation clinique ni garantie de sécurité. Aucun motif technique constaté ne
justifie de remplacer le choix demandé. L’AGPL serait à envisager seulement si
l’objectif était d’imposer la remise des modifications aux utilisateurs d’un
service réseau ; elle imposerait des obligations différentes.

## Périmètre vérifié

- L’ancienne compilation téléchargeait `style-mrjam`, dont le README indiquait
  qu’aucune licence de réutilisation du code n’avait été choisie. Cette dépendance
  a été retirée ; les boutons utilisent directement ElmUI. Aucune modification
  ni relicence de cet autre projet, aucun logo/signature réservé importé.
- Elm core/browser/html/json/time/url/virtual-dom : BSD-3-Clause ; ElmUI et Animator :
  BSD-3-Clause dans les métadonnées des paquets. Conserver leurs avis lors de
  distribution des dépendances.
- Rust : Axum, Tokio, SQLx, scrypt, sha2, rand, uuid, serde_json, base64, hex,
  subtle et leurs dépendances sont résolus par Cargo.lock. La liste exhaustive
  et les expressions SPDX sont produites par `scripts/licenses.sh` via cargo metadata.
  Les dépendances principales utilisent des licences permissives MIT/Apache/BSD.
- QR : `qrcode` MIT ; `jsqr` Apache-2.0.
  PDF : `pdfkit` MIT, utilisé à la construction des supports. Versions exactes
  et transitives dans package-lock.json ; métadonnées via `npm ls --all --json`.
- Nginx et PostgreSQL restent des logiciels externes avec leurs propres licences.
- Les originaux pédagogiques privés restent hors dépôt. Les supports générés
  reprennent uniquement les adaptations du catalogue présent. Vérifier les droits
  éditoriaux avant d’ajouter un cours original, un PDF ou une illustration tiers.

Cet examen de dépôt ne constitue pas un avis juridique ni une attestation de
conformité de toute distribution binaire. Avant diffusion clinique, conserver
inventaire de l’artefact final, avis/licences transitives et sources correspondantes,
et faire vérifier les droits éditoriaux et obligations de distribution applicables.

## Contrôle de vulnérabilités des dépendances

`docs/audit-dependances.json` consigne npm audit et les requêtes OSV du
25 octobre 2026. Aucun avis trouvé pour les 154 paquets de l’arbre Cargo
actif sur Linux ni pour l’arbre npm audité. Le lock complet contient
`rsa 0.9.10`, signalé RUSTSEC-2023-0071 : cette dépendance optionnelle
de SQLx/MySQL n’est pas compilée dans ce serveur PostgreSQL
(`cargo tree --locked -i rsa` ne retourne aucune chaîne active).
Ne pas activer le pilote MySQL sans réévaluation. Ce contrôle dépend de
la couverture des bases d’avis et ne prouve pas l’absence de vulnérabilité.
