# Exécution, publication et restauration

## Environnement réellement utilisé

Docker local isolé : `mon-carnet`, ports de boucle locale 3000 ; tests `mon-carnet-tests`, port 3001 et base distincte. SBCL, Hunchentoot, Ironclad, Postmodern, PostgreSQL 17 ; Node pour compilation uniquement. Les images Debian, PostgreSQL et Playwright sont verrouillées par digest dans les fichiers de build. npm et Elm possèdent des versions exactes. `docs/versions-systeme.txt` consigne les versions Lisp effectivement installées ; apt Bookworm peut évoluer malgré l’image de base figée. Une reproductibilité binaire à long terme nécessite une archive/snapshot apt ou une dérivation Nix verrouillée, à compléter avant production.

L’environnement Sites disponible héberge des assets/Workers et n’exécute pas le backend SBCL/PostgreSQL. La publication privée y contient exclusivement la démonstration navigateur : `CARNET_DEMO_ONLY=true npm run build`. Elle annonce explicitement l’absence de comptes dans cette prévisualisation. La version complète est exécutée et testée localement, et son code est livré. Aucun service VPS existant, domaine, compte payant ou donnée patient n’a été modifié.

Les scripts de workflow référencés par le plugin Sites n’étaient pas présents dans cet environnement portable (recherche filesystem et ressources du plugin). Le relais de livraison local reproduit les opérations natives autorisées : manifest de l’ID retourné, commit source exact, push avec credential en mémoire/stdin, archive limitée à `.openai/hosting.json` et `dist`, puis appel natif de publication privée et contrôle de statut. Aucun secret n’est écrit dans le dépôt ou passé comme argument de shell. Ce relais n’est pas présenté comme un script du plugin.

## NixOS / Nginx / systemd — exemple à adapter, non déployé

`deployment/carnet.nix` illustre l’intégration locale avec le même conteneur Lisp et PostgreSQL, reverse proxy HTTPS et volumes séparés. Les identités/domaines sont des placeholders explicites. L’image applicative doit être construite en CI, poussée dans un registre autorisé et figée par digest. Les secrets sont provisionnés hors Git via EnvironmentFile/root ou équivalent. La coordination et les contrats du VPS/style-mrjam doivent être relus avant une intégration effective ; seuls ses workflows autorisés feront le déploiement. Cet exemple n’autorise ni SSH ni remplacement de services existants.

Avant exposition : `CARNET_PUBLIC_URL` exact HTTPS, cookie Secure (automatique en HTTPS), reverse proxy sans journal des corps ni paramètres, limite 4 Mo, délais bornés, limite connexions/authentification, firewall, sauvegardes du volume SQL et journal indépendants, quotas disque, alertes techniques sans contenu sensible et revue de la chaîne de livraison.

## Sauvegarde et restauration

1. Définir une politique courte de backups chiffrés, hors répertoire public, protégés et contrôlés. Sauvegarder PostgreSQL et conserver séparément le journal **le plus récent** de `/var/lib/carnet/deletions.log`. Le journal contient uniquement les UUID techniques supprimés, pas le texte des carnets.
2. Faire une restauration en environnement isolé sans trafic entrant. Arrêter le service applicatif, restaurer SQL, monter le journal actuel conservé indépendamment. **Ne jamais restaurer uniquement un ancien journal de suppressions avec l’ancien dump.**
3. Démarrer l’API : migrations idempotentes et rejeu du journal précèdent l’ouverture du port applicatif. Si le journal manque et la base contient des comptes, le démarrage échoue. Une ligne invalide bloque aussi le démarrage, nécessitant une réparation administrative à partir d’une copie vérifiée.
4. Vérifier comptes supprimés absents, sessions caduques absentes, quotas et fixtures de récupération. Ouvrir le service seulement après ces contrôles.
5. Effacer anciennes sauvegardes suivant la durée définie. Purger le journal technique uniquement lorsque tous les supports qui pourraient restaurer ces comptes ont disparu, avec preuve et procédure contrôlée. Ne pas automatiser une purge prématurée.

`node --import tsx scripts/verify-restore.ts` réalise un exercice avec deux comptes fictifs dans la base de test : un compte est supprimé, réinjecté dans l’état SQL sans tombstone, puis éliminé au redémarrage via le journal indépendant. L’autre coffre et sa session restent utilisables. Ne jamais exécuter cet exercice contre une base réelle.

## Maintenance et publication

La CI prépare, compile, exerce une base isolée, les trois moteurs et les vecteurs, puis vérifie stockage et restauration. Elle n’a pas encore été exécutée sur un runner GitHub distant ; les commandes correspondantes ont été exécutées dans cet environnement. La livraison ne crée pas de PR. Les changements de style sont additifs et livrés comme paquet à intégrer après coordination ; ils ne sont pas publiés upstream.
