# Sources et adaptation — vérification du 6 octobre 2026

Les originaux fournis ont été examinés par extraction DOCX/XML et XLSX/cellules dans un répertoire privé extérieur au projet. Ils ne sont pas distribués, ni servis, ni committés. Le catalogue contient exclusivement les titres, objectifs et contenus du prototype destinés à l’affichage. L’extraction intégrale et les métadonnées internes restent privées.

| Contenu | Source et emplacement | Statut / adaptation |
|---|---|---|
| Séquence et objectifs des quinze étapes | Module Sexo bilan.xlsx, Recapitulatif seances, A1:H16 ; référence D/G:H propre à chaque chapitre dans le JSON | Contenu équipe version de travail ; arbitrage 0–14 plutôt que calendrier définitif de 12–13 séances |
| Sept rubriques, objectifs successifs, défis et expérimentations | Principes pédagogiques Sexo.docx, « Le carnet de bord », paragraphes 305–374 (rubriques 307–313) | Structure équipe ; regroupement Avant/Pendant/Entre = adaptation numérique |
| Paysage, cinq espaces, hiérarchisation et confrontation | Module Sexo bilan.xlsx, Exo Séance 1, A1:H10 | Adaptation numérique ; carte personnalisable, hésitation et commandes clavier |
| Lectures, approfondissements, questions, situations et petits pas | `content/parcours.json`, champs de statut et provenance | Propositions POC à valider ; pas de décision scientifique ni d’activité sexuelle imposée |
| État « pas d’occasion », suspension, autonomie, sélection locale | Principes + brief | Adaptations POC permettant le contrôle de la personne, sans pénalité |
| Besoins | Questionnaire – V2.docx | Source de compréhension ; aucune conversion en inscription obligatoire ou télémétrie |
| Bibliographie de travail | Etudes scientifiques.xlsx | Pistes ; aucune efficacité du carnet déduite sans étude du carnet |

Les colonnes après H et feuilles BROUILLON ne sont pas traitées comme programme arrêté. Chaque chapitre conserve `source`, `statutObjectif`, `statutLecture`, `referencesRubriques`, `verifieLe` et `dateSession:null`. Titres 0 et 14 identiques à la source, sous-titres initial/final distincts. Aucune année ou date collective inventée.

## Références externes

Consultation directe le 6 octobre 2026. `verification-sources.json` conserve les contrôles HTTP initiaux ; un HTTP 200 ne garantit pas le contenu. Les pages ANS et PubMed ont été ensuite lues via navigateur de recherche parce que leurs premières réponses étaient partielles. La publication SAM a été ouverte sur PubMed et PMC (article PMC12417602, DOI 10.1177/13623613251346885), avec des accès intermittents CAPTCHA ; la notice, le résumé et la première partie de l’original étaient disponibles. Aucun chiffre clinique n’est repris dans l’interface.

| Référence | Utilisation et limite |
|---|---|
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Cible AA, contrôles clavier/nom/focus/reflow ; pas de certification par axe |
| [W3C compréhension](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o1-understandable/), [icônes](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p07-icons-used/), [personnalisation](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o8p04-interface/) | Mots explicites, hiérarchie stable, choix visuels ; pas de profil universel des adultes autistes |
| [MDN SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto), [AES-GCM](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams) | API native, contexte sécurisé, IV et AAD |
| [OWASP stockage crypto](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html), [mots de passe](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [sessions](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | Paramètres distincts KDF/scrypt, cookie, CSRF, borne et intégrité ; audit indépendant restant |
| [CNIL développement](https://www.cnil.fr/fr/guide-rgpd-du-developpeur), [AIPD](https://cnil.fr/fr/RGPD-analyse-impact-protection-des-donnees-aipd) | Minimisation, flux et dossier préparatoire, sans trancher bases légales |
| [ANS chiffrement/HDS](https://esante.gouv.fr/faq/si-jheberge-des-donnees-de-sante-chiffrees-suis-je-soumis-lobligation-de-certification-hds) | Le chiffrement n’exonère pas à lui seul de l’obligation HDS ; champ à analyser |
| [Playwright accessibilité](https://playwright.dev/docs/accessibility-testing) | Tests automatisés complétés par inspection ; limites explicitement conservées |
| [Spaargaren et al., 2025, SAM](https://pubmed.ncbi.nlm.nih.gov/40567128/), [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12417602/) | Étude sur le stress avec bénéfices moyens et charge d’usage chez une partie des personnes. Motive la vérification de la charge et du contrôle, sans valider le carnet ni le programme affectif |

Les choix graphiques, l’absence de scores et la réduction de notifications sont des hypothèses de ce prototype. Les tests utilisateurs sont à organiser selon `CHARTE-ET-TESTS-USAGERS.md`.
