# Décisions du prototype — 6 octobre 2026

Le parcours suit les quinze étapes 0–14 du récapitulatif A:H ; les 12–13 séances du document de principes ne sont pas un calendrier définitif. Aucun rendez-vous ou établissement n’est affiché. Les dates éventuelles sont personnelles et chiffrées.

Les sept rubriques restent distinctes dans les données et se regroupent en Avant / Pendant / Entre. Les bilans 0, 13 et 14 ont un gabarit libre. Les lectures courtes et situations sont des propositions du POC à valider, séparées des objectifs et titres fournis. Aucun conseil médical, score ou validation clinique.

Elm 0.19.1 + ElmUI, Common Lisp SBCL/Hunchentoot, PostgreSQL 17. Le pont TypeScript porte Web Crypto, IndexedDB, les API natives et le transport HTTP. Il n’héberge pas un second frontend. Navigation en mémoire ; chargement du catalogue entier sans requêtes par chapitre.

Style partagé figé sur `3691f0faa80cdcd03bdd7fc60418d0de331a945c`. Extension additive `MrJam.Carnet` et feuille de thème centralisées, destinées à l’intégration dans style-mrjam ; aucune modification de la palette historique, des consommateurs ou de la signature. Les contrats de coordination main ont été lus. Ce nouveau POC ne publie aucune modification d’un projet existant ni de l’infrastructure VPS.

Clé de données aléatoire 256 bits, AES-GCM avec IV 96 bits aléatoire par opération. AAD lie format, coffre et objet. Phrase distincte du mot de passe de compte ; PBKDF2-HMAC-SHA256 600 000 itérations en Worker (Web Crypto maintenu par le navigateur). C’est le choix interopérable sans dépendance crypto téléchargée, avec coût à mesurer sur téléphones réels. Salt 128 bits, bornes strictes avant calcul. Secret de récupération du coffre 256 bits ; autre code 256 bits pour récupérer l’authentification. Le serveur ne reçoit jamais phrase, clé de données ou secret de récupération du coffre.

Enveloppe globale pour le carnet et objets opaques pour les images. Padding de texte par paliers de 4 Kio puis 16 Kio ; debounce local et regroupement des synchronisations. Révision atomique avec If-Match : conflit visible, copie locale conservée, aucun remplacement automatique. La démo a un CryptoKey navigateur non exportable isolé par origine ; elle ne fournit pas la protection par phrase d’un compte réel et ne transmet aucune saisie au serveur.

Le serveur de comptes Lisp est lancé et testé localement. Sites n’exécute pas SBCL/PostgreSQL : une éventuelle publication Sites expose seulement la démo, avec un message explicite pour les comptes. Le POC complet reste reproductible avec Docker et prêt à intégrer via NixOS/Nginx/systemd, sans supposer un accès au VPS.

La refonte d’orientation adopte Elm Animator 2.0.0 avec des transitions natives interruptibles. Plan permanent en six positions, séance contenue dans le parcours et moments dans la séance, fenêtres déplacées dans un espace commun, retour au même contexte. Les espaces transversaux gardent leur rôle conceptuel. L’arrêt des animations garde la même architecture ; la préférence système est prioritaire et dynamique. Les contenus, modèle privé et backend sont conservés à l’identique. Voir `CONTINUITE.md`.
