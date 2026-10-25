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

Le raccordement réel n’est pas appliqué à ce stade : aucun domaine ETP ni digest
promu n’a été désigné. Les autres projets et leur infrastructure active sont préservés.
