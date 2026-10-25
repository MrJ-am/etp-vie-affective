# Qualification locale — 25 octobre 2026

Cette qualification utilise exclusivement des identités et contenus fictifs.
Elle ne remplace ni un audit indépendant, ni les essais en établissement, ni
la validation clinique. Les résultats détaillés sont dans `verification-rust-pwa/`
et `browser-results.json`.

## Contrôles exécutés

- TypeScript : `npm run typecheck` ; Elm optimisé et assets PWA : `npm run build`.
- Rust : formatage et Clippy sans avertissement ; compilation native de contrôle
  et image de production construite avec Rust 1.90, base Debian figée par digest.
- 15 tests unitaires : AES-GCM NIST et Node/OpenSSL, PBKDF2, récupération,
  substitution, nonce, validation, padding au-delà de 64 Kio, catalogue et images,
  confidentialité et intégrité des réponses de sondage, décodage de douze QR aléatoires.
- 9 tests de la vraie API Rust avec PostgreSQL 17 : comptes et isolation,
  authentification, CSRF/Origin, bornes, révisions et conflits, récupération,
  archives, quotas et suppression.
- 12 scénarios navigateur : les quatre mêmes parcours sur Chromium, Firefox et
  WebKit. Séances grisées et accessibles, clavier et deux temps, supports,
  rechargement sans origine disponible, coffre local et reprise de synchronisation,
  absence de données API dans le cache public, décodage des QR produits et
  échange par fichiers chiffrés, rejeu refusé, aucun appel API de sondage.
- Restauration isolée : refus de démarrer sans journal sur base existante,
  compte supprimé réinjecté puis éliminé par rejeu ; coffre survivant déchiffrable
  côté client après redémarrage.
- Stockage : recherche de sentinelles fictives dans les tables/les logs et
  comparaison indépendante du hash scrypt Rust avec Node/OpenSSL.
- Dépendances : npm audit et OSV, périmètre et avis inactif détaillés dans
  `audit-dependances.json` et `LICENCES.md`.

## Portée des essais navigateur

Chromium et Firefox utilisent la coupure réseau du contexte Playwright.
WebKit Playwright rencontre une erreur interne lors d’un rechargement avec
`setOffline(true)` ; son contrôle utilise une panne de l’origine simulée par le
relais HTTP de test (toutes les requêtes réseau sont refusées avec 503).
Le cache de la PWA sert alors l’application et les supports ; les réponses API
échouent et le coffre local s’ouvre. Cette différence est explicite et limitée
au relais de test : aucun mécanisme de simulation n’est dans l’application.

Les QR affichés sont réellement décodés dans les moteurs puis comparés aux
fichiers d’échange. Les caméras physiques, la distance, la luminosité, iOS/Safari
installé et les appareils hospitaliers n’ont pas été testés. Aucun test n’établit
un anonymat ou une authentification des participants.

Les anciens scénarios à trois moments et leurs captures sont conservés dans
`tests/historique-browser-v1/` avec une explication : ils ne représentent plus
le parcours demandé. Les gestes complexes, les anciennes captures multi-écrans
et l’accessibilité complète restent à requalifier pour cette nouvelle interface.

## Déploiement

La qualification est locale, sur des conteneurs de test dédiés. Aucun service
ni domaine du VPS, aucune base réelle, aucun autre projet ni déploiement Sites
n’ont été modifiés. `deployment/` prépare le raccordement autonome à Nginx et
PostgreSQL. La publication d’un artefact de production sur un domaine précis
reste distincte de ces contrôles locaux.
