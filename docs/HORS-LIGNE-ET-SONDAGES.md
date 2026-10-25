# Utilisation hors ligne et sondages locaux

## Avant d’aller à l’hôpital

1. Ouvrir le site en HTTPS avec une connexion. Installer la PWA depuis le navigateur
   si souhaité ; l’installation n’est pas obligatoire pour le cache hors ligne.
2. Ouvrir une fois le compte et son coffre sur cet appareil. Attendre la confirmation
   de disponibilité hors ligne et celle de la sauvegarde chiffrée.
3. Conserver kit et export chiffré séparément. Tester le mode avion avant la session.
   Les supports HTML et les PDF sont tous préchargés : aucune consultation n’est
   signalée au serveur selon le chapitre ouvert.

Sans réseau, un rechargement présente le dernier coffre local. Sa phrase est
nécessaire ; aucune connexion distante fictive n’est créée. Les autres appareils
ne reçoivent pas les changements avant synchronisation. Quand le réseau revient,
la session doit appartenir au même compte ; si elle a expiré, se reconnecter.
Une révision concurrente déclenche le choix explicite entre copies conservées.

Le cache PWA est versionné par hash du contenu. Aucune API ni réponse de sondage
n’y est enregistrée. Une mise à jour attend la fermeture de toutes les fenêtres
avant activation ; elle ne remplace pas le programme au milieu d’un coffre ouvert.
Le navigateur peut retirer les données d’un site en cas de manque d’espace ou de
suppression utilisateur : la PWA ne remplace pas les sauvegardes.

## Sans Wi-Fi, sans Internet : QR codes chiffrés

Ouvrir « Pendant la séance → Participer à un sondage local ou en animer un ».
On peut aussi ouvrir `/sondage.html` depuis l’application déjà téléchargée.

**Animateur :** saisir une question courte et 2 à 5 choix sans données personnelles,
créer le sondage, présenter le QR directement sur son écran. Chaque participant
scanne ce QR, choisit ce qu’il souhaite partager et affiche un QR de réponse.
L’animateur scanne les réponses successivement et voit les compteurs sur son appareil.
Une même réponse rescannée n’est pas comptée deux fois.

**Participant :** scanner l’écran de l’animateur, vérifier la question, puis choisir
« Partager : … ». La réponse est chiffrée pour ce sondage ; ni le QR du sondage ni
les autres participants ne permettent de la déchiffrer. Présenter son écran à
l’animateur. L’application n’ajoute pas ce choix au carnet.

Le transfert est optique : **aucune liaison réseau n’est nécessaire**, même entre
les appareils. La caméra demande une permission au navigateur. Un lecteur QR
JavaScript local assure la compatibilité sans dépendre d’un service externe.
Si la caméra ne fonctionne pas, le même échange peut se faire par fichiers JSON
bornés via câble ou partage de proximité disponible sur l’appareil. L’échange par
fichier n’établit pas lui-même de réseau et ne garantit pas AirDrop/Nearby Share.

## Protocole précis

- L’animateur génère une paire ECDH P-256 éphémère, clé privée non exportable.
  Le QR public contient UUID du sondage, question, choix et clé publique.
- Le participant génère une paire ECDH éphémère distincte. ECDH puis
  HKDF-SHA256 (sel = UUID, info = `etp-poll|1|answer`) donnent une clé AES-256-GCM.
- La réponse contient UUID aléatoire de réponse et indice du choix, dans un bloc
  aléatoirement complété à 128 octets. IV aléatoire 96 bits ; AAD `etp-poll|1|UUID`.
  Le QR de réponse contient seulement clé publique du participant, UUID de sondage,
  IV et ciphertext. Il ne contient aucun identifiant de compte.
- Seule la clé privée de l’animateur permet de déchiffrer. La page valide formats,
  tailles, courbe, absence de clé privée importée et indice de réponse.
- Les compteurs et UUID déjà reçus restent en mémoire ; « Terminer et effacer »
  retire les références aux clés et les résultats. Fermer/recharger perd la clé :
  les anciens QR de réponse deviennent inutilisables. Aucun export de clé privée.

Le scan direct de l’écran est le canal de confiance pour la clé publique. Un QR
substitué par un tiers peut adresser les réponses à un autre destinataire : éviter
les images relayées et vérifier physiquement l’appareil animateur. Un QR public
n’authentifie pas l’identité civile de son créateur.

## Limites à expliquer au groupe

Ce mécanisme collecte des réponses une par une ; ce n’est pas un vote instantané
simultané. Il évite une dépendance au Wi-Fi hospitalier, au Bluetooth du navigateur
ou à un serveur de signalisation WebRTC.

Il n’y a pas d’authentification des participants ni de garantie « une personne,
une voix » : une personne peut générer plusieurs réponses nouvelles. Le dédoublonnage
empêche seulement le rejeu du même QR. L’animateur qui scanne voit qui présente son
écran ; de petits effectifs et l’ordre de collecte peuvent révéler un choix.
**Ne pas présenter ce dispositif comme un sondage anonyme.**

La confidentialité suppose les appareils sains et la clé de l’animateur en mémoire
protégée. Les résultats lisibles lui sont volontairement confiés. Cette exception
de partage est séparée du carnet, qui reste exclusivement lisible par son propriétaire.
Une fermeture accidentelle perd les compteurs ; les participants peuvent soumettre
à nouveau après création d’un nouveau sondage. Tester les caméras et la lisibilité
des QR sur les appareils réels avant utilisation en groupe.

Un routeur local autonome ou un point d’accès pourrait permettre une collecte
simultanée sans Internet, mais il faudrait valider isolation des clients, HTTPS
local et autorisations de l’établissement. Cela reste une option future ; le mode
QR implémenté n’exige aucun de ces équipements.
