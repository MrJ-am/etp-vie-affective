# Mon carnet

Prototype fonctionnel du compagnon de séances pour adultes autistes. Quinze étapes, sept rubriques regroupées en Avant / Pendant / Après, objectifs et formulations successives, défis persistants, expérimentations et paysage personnel. Usage réservé aux **données fictives**. Aucune validation clinique ou certification de sécurité n’est revendiquée.

La navigation prend la forme d’un classeur avec trois onglets sur une seule ligne : parcours, objectifs et repères. La démo et l’ouverture du coffre montrent directement la feuille du parcours. Le contour de l’onglet sélectionné se prolonge dans celui de la feuille. Un changement d’onglet ne commande aucun déplacement du carnet et ne restaure aucune position propre à une feuille. Le bandeau fixe porte le nom source « ETP TSA vie amoureuse » ; une icône de compte donne accès au verrouillage, aux réglages, aux informations du site et à la déconnexion. La vue d’ensemble a été supprimée parce qu’elle doublonnait le parcours. Les douze chapitres sont des capsules sur la même feuille, accompagnées des trois bilans. Une capsule fermée porte son numéro et son titre ; l’objectif pédagogique reste dans le contenu ouvert. Son titre garde sa taille et sa position à l’écran pendant l’ouverture, même quand une autre capsule se referme au-dessus. Son contenu déjà présent s’agrandit et repousse les suivantes. Avant / Pendant / Après sont trois textes alignés avec un soulignement mobile, accessibles au clavier. Elm Animator 2.0.0 anime ces relations. Lire `docs/CONTINUITE.md` pour le modèle de navigation et la conservation du fond. La réduction des mouvements du navigateur et le réglage sans animation conservent les mêmes feuilles, capsules et fonctions.

La démonstration privée publiée utilise uniquement le stockage du navigateur. « Ouvrir la démonstration » conduit directement au carnet et à ses trois onglets. La version complète ci-dessous possède de vrais comptes, une API Common Lisp et PostgreSQL. Les fichiers internes ayant servi au travail ne sont pas inclus.

## Lancer la version complète

Pré-requis : Node.js 22 ou plus, npm, Git et Docker Compose. La compilation récupère la révision exacte de style-mrjam si elle manque. Un accès réseau initial aux registres npm, Elm, GitHub et Docker est nécessaire.

```sh
npm ci
npm run typecheck
npm run build
docker compose up --build -d
```

Ouvrir **http://localhost:3000** sur la machine où Docker tourne. Web Crypto fonctionne sur localhost ; toute exposition extérieure exige HTTPS. Ce serveur écoute uniquement sur l’interface de boucle locale. La valeur de mot de passe PostgreSQL par défaut sert au développement isolé. Pour une autre installation, copier `.env.example` en `.env`, utiliser un secret aléatoire et consulter `docs/DEPLOIEMENT.md`.

L’entrée propose « Créer mon compte » : identifiant pseudonyme, mot de passe de connexion, phrase distincte de coffre et confirmation d’utilisation fictive. Télécharger le kit de récupération. Le questionnaire de besoins ne conditionne pas l’inscription. Les comptes démarrent avec un carnet vide ; la démonstration contient les exemples de Camille.

```sh
docker compose down
```

Cette commande arrête l’application et conserve les volumes. **Ne pas supprimer les volumes de données ni le journal indépendant des suppressions** pour une installation à conserver.

## Organisation

| Chemin | Responsabilité |
|---|---|
| `frontend/src/Main.elm` | Interface Elm/ElmUI, navigation, commandes métier |
| `frontend/src/Carnet.elm` | Modèle privé, sérialisation et vues transversales locales |
| `content/parcours.json` | Catalogue éditorial versionné, provenance, quinze étapes |
| `shared/elm/MrJam/Carnet.elm`, `shared/elm/MrJam/Continuite.elm`, `shared/assets/carnet.css` | Extension additive destinée à style-mrjam, thème centralisé |
| `style.lock.json` | Révision vérifiée de style-mrjam |
| `bridge/` | Web Crypto en Worker, transport, IndexedDB et APIs natives |
| `backend/` | API Lisp, migration PostgreSQL, image reproductible |
| `tests/`, `compose.test.yaml` | Tests unitaires, vraie API et trois navigateurs |
| `docs/` | Architecture, confidentialité préparatoire, sources, démonstration et preuves |

## Vérifier

```sh
docker compose -p mon-carnet-tests -f compose.test.yaml up -d backend
node --import tsx --test tests/crypto.test.ts tests/contenu.test.ts tests/image.test.ts
node --import tsx --test tests/api.test.ts
docker compose -p mon-carnet-tests -f compose.test.yaml run --rm browser
node scripts/verify-storage.mjs
```

Le navigateur utilise un relais HTTP local vers le vrai backend Lisp de test, sans simulation des réponses. La base de test est distincte, éphémère et ne contient que des fixtures. Les références visuelles sont comparées ; leur mise à jour est une action explicite de maintenance après inspection. La CI utilise les mêmes commandes.

Lire `docs/RESULTATS.md` pour les résultats exécutés et les limites des contrôles, `docs/DEMONSTRATION.md` pour le parcours d’essai. Ce POC n’inclut ni recherche sur les utilisateurs, ni télémétrie, ni consultation des carnets par une équipe.
