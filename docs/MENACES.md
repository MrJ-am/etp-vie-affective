# Modèle de menace du POC

Actifs : textes, photos, objectifs, étape personnelle, secrets, continuité du carnet. La limite de confiance se situe dans le navigateur et sa livraison de code. L’application ne dispose d’aucune clé serveur permettant de lire les carnets.

| Menace | Mesure implémentée | Limite restante |
|---|---|---|
| Fuite PostgreSQL, backup ou accès administrateur au stockage | Ciphertext AES-GCM et clés enveloppées ; aucun modèle métier en clair | Pseudonyme, timestamps, existence, volumes et trafic restent observables ; phrase faible attaquable hors ligne |
| Autre compte ou session usurpée | Autorisation par compte sur chaque requête, UUID opaque, cookies et CSRF, session expirante | Une session volée peut modifier/supprimer du ciphertext ; appareils et HTTPS doivent être protégés |
| Appareil laissé ouvert | Bouton masque réel, verrouillage réglable, avertissement, retrait du modèle/aperçus/clés | Aucun effacement physique garanti du tas JS, presse-papiers, historique, capture ou extension |
| Corruption/substitution | Tag GCM, AAD liant coffre/objet/version, validations profondes et taille bornée | Une version antérieure authentique peut être rejouée par un serveur actif ; pas de journal de transparence indépendant |
| Perte des secrets | Deux récupérations distinctes, kit local, anciens coffres préservés | Sans phrase et code de coffre, lecture impossible ; anciens exports ne sont pas révoqués par changement de phrase |
| Conflit/offline | Brouillon chiffré local, révision atomique, choix explicite, copies en conflit | Pas de fusion automatique ; fermeture pendant les 650 ms initiaux dépend de pagehide et du navigateur |
| XSS ou fichier malveillant | Elm échappe les textes, aucun innerHTML métier, CSP, imports authentifiés/validés, conversion image native bornée | style-src unsafe-inline nécessaire à ElmUI ; navigateur, décodeur et dependencies doivent être maintenus |
| Client livré par opérateur compromis | Versions verrouillées, source consultable, hashes de build, CI et absence de scripts tiers | **L’opérateur actif peut livrer un client qui vole le secret. Ce POC ne le protège pas contre ce scénario.** Audit, signatures, publication reproductible et éventuellement client indépendant restent à étudier |
| Résurrection après restauration | Journal fsync indépendant des backups SQL, rejoué avant démarrage ; démarrage refusé si absent sur une base existante | Restaurer un journal obsolète avec la base contourne cette garantie : conserver impérativement le plus récent |
| Saturation | Bornes body, image, paramètres crypto, quotas, rate limit authentification | Deux scrypt concurrents bornés ; débits réseau à compléter en reverse proxy avant exposition réelle ; un seul processus de journal supposé |

Aucune assertion « zero knowledge » absolue, anonymat ou sécurité auditée. Les tests sentinelles vérifient l’implémentation courante et complètent les vecteurs indépendants ; ils ne constituent pas une preuve générale contre un client malveillant.

## Nouveaux flux

Le mode hors ligne conserve le risque de vol d’un appareil et d’attaque de la
phrase ; une révocation distante ne supprime pas les copies téléchargées. Le
cache PWA est limité aux assets publics ; une mise à jour ne s’active pas pendant
un coffre ouvert. Les sondages ne sont pas anonymes ni authentifiés par personne :
scan direct pour confiance dans la clé, chiffrement au destinataire, dédoublonnage
d’un même QR, mais réponses multiples possibles. Voir SECURITE.md et
HORS-LIGNE-ET-SONDAGES.md pour les garanties exactes.
