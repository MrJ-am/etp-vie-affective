# Correction de l’affichage mobile — 28 octobre 2026

Le composant ElmUI `wrappedRow` appliquait une base flex nulle aux boutons
`shrink`. À 390px, « Créer mon compte » mesurait environ47×293px et son
libellé se coupait lettre par lettre. Une base flex `auto` rend aux commandes
leur largeur intrinsèque tout en conservant le retour à la ligne de la rangée.
Le même bouton mesure maintenant166,5×44px dans Chromium.

Les libellés des champs, de la case à cocher et de la couverture peuvent aussi
revenir à la ligne, pour éviter un débordement horizontal à320px.

Qualification locale sur les ressources effectivement construites :

- `npm run build`, `npm run typecheck`, elm-format et `git diff --check` : succès.
- `tests/browser/affichage.spec.ts` : 3/3 succès, Chromium/Firefox/WebKit1.55.1
  de l’image Playwright verrouillée du projet. Chaque test exerce320,390,583,
  850 et1440px : accueil, boutons et formulaire d’inscription, sans compte créé.
- Vérification visuelle de [l’accueil à390px](apres-390.png).

Ce sont des navigateurs automatisés, pas un essai sur téléphone physique.
La qualification porte sur l’affichage ; les API et le format de coffre ne changent pas.

Publication en attente : le workflow central `ViSe — service autonome` est
`disabled_manually`. Le dispatch de diagnostic a été refusé par GitHub avec
HTTP422. Aucun workflow n’a été réactivé, aucune mutation VPS n’a été effectuée.
La publication devra conserver les sauvegardes et le retour ciblé de l’infrastructure.
