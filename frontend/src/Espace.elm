port module Espace exposing (main)

import Browser
import Contenu
import Dict exposing (Dict)
import Element as U exposing (Element, fill, width)
import Element.Background as Bg
import Element.Font as F
import Html.Attributes as A
import Json.Decode as D
import Json.Encode as E
import MrJam.Carnet as C


port commandeEspace : E.Value -> Cmd msg


port evenementEspace : (D.Value -> msg) -> Sub msg


type alias Compte =
    { pseudonyme : String, role : String }


type alias Groupe =
    { id : String, nom : String, archive : Bool, invitation : String, effectif : Int }


type alias Membre =
    { id : String, nom : String, prenom : String, email : String, actif : Bool }


type alias Pdf =
    { id : String, nom : String }


type alias Seance =
    { id : Int, contenu : Contenu.Chapitre, revision : Int, visible : Bool, pdfs : List Pdf }


type alias Question =
    { texte : String, options : List String }


type alias Questionnaire =
    { id : String, titre : String, questions : List Question, ouvert : Bool, reponses : Int, compteurs : Maybe (List (List Int)), participe : Bool }


type alias Modele =
    { compte : Maybe Compte
    , invitation : String
    , groupeInvite : String
    , groupes : List Groupe
    , selection : String
    , archives : Bool
    , membres : List Membre
    , seances : List Seance
    , parcours : List Seance
    , questionnaires : List Questionnaire
    , brouillon : Dict String String
    , questions : List Question
    , edition : Maybe Int
    , suppression : String
    , erreur : String
    , notice : String
    , busy : Bool
    , kit : Bool
    , charge : Bool
    }


type Msg
    = Evenement D.Value
    | Saisie String String
    | Action String
    | Selectionner String
    | Archives Bool
    | Requete String String E.Value (Maybe Int)
    | Editer Seance
    | Visibilite Seance
    | Archiver Groupe
    | Acces Membre
    | Supprimer String
    | Annuler


main =
    Browser.element { init = init, update = update, view = view, subscriptions = \_ -> evenementEspace Evenement }


init flags =
    ( { compte = Nothing, invitation = lire (D.field "invitation" D.string) "" flags, groupeInvite = "", groupes = [], selection = "", archives = False, membres = [], seances = [], parcours = [], questionnaires = [], brouillon = Dict.empty, questions = [], edition = Nothing, suppression = "", erreur = "", notice = "", busy = False, kit = False, charge = False }
    , Cmd.none
    )


lire decoder defaut valeur =
    D.decodeValue decoder valeur |> Result.withDefault defaut


champ cle modele =
    Dict.get cle modele.brouillon |> Maybe.withDefault ""


envoyer action data =
    commandeEspace (E.object [ ( "action", E.string action ), ( "data", data ) ])


requete tag path method body revision =
    envoyer "api"
        (E.object [ ( "tag", E.string tag ), ( "path", E.string path ), ( "method", E.string method ), ( "body", body ), ( "revision", Maybe.map E.int revision |> Maybe.withDefault E.null ) ])


get tag path =
    requete tag path "GET" E.null Nothing


changer path method body revision =
    requete "modifie" path method body revision


base modele =
    "/api/groupes/" ++ modele.selection


charger modele =
    case modele.compte of
        Just compte ->
            if compte.role == "encadrant" then
                Cmd.batch
                    ([ get "groupes" "/api/groupes" ]
                        ++ (if modele.selection /= "" then
                                [ get "membres" (base modele ++ "/membres"), get "seances" (base modele ++ "/seances"), get "questionnaires" (base modele ++ "/questionnaires"), get "parcours" (base modele ++ "/apercu") ]

                            else
                                []
                           )
                    )

            else
                Cmd.batch [ get "parcours" "/api/parcours", get "questionnaires" "/api/questionnaires" ]

        Nothing ->
            Cmd.none


compteDecoder =
    D.map2 Compte (D.field "pseudonyme" D.string) (D.field "role" D.string)


groupeDecoder =
    D.map5 Groupe (D.field "id" D.string) (D.field "nom" D.string) (D.field "archive" D.bool) (D.field "invitation" D.string) (D.field "effectif" D.int)


membreDecoder =
    D.map5 Membre (D.field "id" D.string) (D.field "nom" (D.nullable D.string) |> D.map (Maybe.withDefault "")) (D.field "prenom" (D.nullable D.string) |> D.map (Maybe.withDefault "")) (D.field "email" (D.nullable D.string) |> D.map (Maybe.withDefault "")) (D.field "actif" D.bool)


seanceDecoder =
    D.map5 Seance (D.field "id" D.int) (D.field "contenu" Contenu.decoder) (D.field "revision" D.int) (D.oneOf [ D.field "visible" D.bool, D.succeed True ]) (D.oneOf [ D.field "pdfs" (D.list (D.map2 Pdf (D.field "id" D.string) (D.field "nom" D.string))), D.succeed [] ])


questionDecoder =
    D.map2 Question (D.field "texte" D.string) (D.field "options" (D.list D.string))


questionnaireDecoder =
    D.map7 Questionnaire (D.field "id" D.string) (D.field "titre" D.string) (D.field "questions" (D.list questionDecoder)) (D.oneOf [ D.field "ouvert" D.bool, D.succeed True ]) (D.oneOf [ D.field "reponses" D.int, D.succeed 0 ]) (D.oneOf [ D.field "compteurs" (D.nullable (D.list (D.list D.int))), D.succeed Nothing ]) (D.oneOf [ D.field "participe" D.bool, D.succeed False ])


update msg modele =
    case msg of
        Saisie cle valeur ->
            ( { modele | brouillon = Dict.insert cle valeur modele.brouillon }, Cmd.none )

        Selectionner id ->
            let
                suivant =
                    { modele | selection = id, membres = [], seances = [], parcours = [], questionnaires = [], edition = Nothing, suppression = "", erreur = "", brouillon = Dict.empty, questions = [] }
            in
            ( suivant, charger suivant )

        Archives oui ->
            ( { modele | archives = oui, selection = "", membres = [], seances = [], parcours = [], questionnaires = [], edition = Nothing, questions = [], brouillon = Dict.empty }, Cmd.none )

        Requete path method body revision ->
            ( { modele | busy = True, erreur = "", notice = "" }, changer path method body revision )

        Archiver g ->
            update (Requete ("/api/groupes/" ++ g.id) "PATCH" (E.object [ ( "nom", E.string g.nom ), ( "archive", E.bool (not g.archive) ) ]) Nothing) modele

        Visibilite s ->
            update (Requete (base modele ++ "/seances/" ++ String.fromInt s.id) "PUT" (E.object [ ( "visible", E.bool (not s.visible) ) ]) Nothing) modele

        Acces m ->
            update (Requete ("/api/utilisatrices/" ++ m.id) "PATCH" (E.object [ ( "actif", E.bool (not m.actif) ) ]) Nothing) modele

        Supprimer id ->
            ( { modele | suppression = id, brouillon = Dict.remove "confirmation" modele.brouillon }, Cmd.none )

        Annuler ->
            ( { modele | suppression = "", edition = Nothing }, Cmd.none )

        Editer s ->
            let
                c =
                    s.contenu
            in
            ( { modele | edition = Just s.id, brouillon = Dict.fromList [ ( "titre", c.titre ), ( "sousTitre", c.sousTitre ), ( "objectif", c.objectif ), ( "intro", c.intro ), ( "essentiel", String.join "\n" c.essentiel ), ( "approfondissement", c.approfondissement ), ( "question", c.question ), ( "petitPas", c.petitPas ) ] }, Cmd.none )

        Action action ->
            agir action modele

        Evenement valeur ->
            let
                tag =
                    lire (D.field "kind" D.string) "" valeur

                data =
                    lire (D.field "data" D.value) E.null valeur
            in
            case tag of
                "compte" ->
                    let
                        suivant =
                            { modele | compte = D.decodeValue compteDecoder data |> Result.toMaybe, charge = True, brouillon = Dict.empty, erreur = "", busy = False }
                    in
                    ( suivant, charger suivant )

                "anonyme" ->
                    ( { modele | compte = Nothing, charge = True, busy = False, groupes = [], membres = [], seances = [], parcours = [], questionnaires = [], selection = "", brouillon = Dict.empty }, Cmd.none )

                "invitation" ->
                    ( { modele | groupeInvite = lire (D.field "nom" D.string) "" data, charge = True }, Cmd.none )

                "groupes" ->
                    ( { modele | groupes = lire (D.list groupeDecoder) [] data }, Cmd.none )

                "membres" ->
                    ( { modele | membres = lire (D.list membreDecoder) [] data }, Cmd.none )

                "seances" ->
                    ( { modele | seances = lire (D.list seanceDecoder) [] data }, Cmd.none )

                "parcours" ->
                    ( { modele | parcours = lire (D.field "seances" (D.list seanceDecoder)) [] data, groupeInvite = lire (D.at [ "groupe", "nom" ] D.string) "" data }, Cmd.none )

                "questionnaires" ->
                    ( { modele | questionnaires = lire (D.list questionnaireDecoder) [] data }, Cmd.none )

                "modifie" ->
                    let
                        suivant =
                            { modele | busy = False, notice = "Modification enregistrée.", erreur = "", edition = Nothing, suppression = "", questions = [] }
                    in
                    ( suivant, charger suivant )

                "kit" ->
                    ( { modele | kit = True, busy = False, brouillon = Dict.empty }, Cmd.none )

                "notice" ->
                    ( { modele | notice = lire (D.field "message" D.string) "" data, busy = False }, Cmd.none )

                "error" ->
                    ( { modele | erreur = lire (D.field "message" D.string) "Opération impossible." data, busy = False }, Cmd.none )

                _ ->
                    ( modele, Cmd.none )


agir action modele =
    let
        valeurs cles =
            E.object (List.map (\cle -> ( cle, E.string (champ cle modele) )) cles)

        actif commande =
            ( { modele | busy = True, erreur = "", notice = "" }, commande )

        erreur texte =
            ( { modele | erreur = texte }, Cmd.none )
    in
    case action of
        "login" ->
            actif (envoyer "login" (valeurs [ "pseudonyme", "password" ]))

        "logout" ->
            actif (envoyer "logout" E.null)

        "register" ->
            if champ "phrase" modele /= champ "confirmationPhrase" modele then
                erreur "Les deux phrases du coffre doivent être identiques."

            else if champ "fictif" modele /= "oui" then
                erreur "Confirmez que vous utilisez uniquement des informations fictives."

            else
                actif (envoyer "register" (E.object (List.map (\cle -> ( cle, E.string (champ cle modele) )) [ "nom", "prenom", "email", "password", "phrase" ] ++ [ ( "invitation", E.string modele.invitation ) ])))

        "kit" ->
            ( modele, envoyer "kit" E.null )

        "continuer" ->
            ( { modele | kit = False, invitation = "", groupeInvite = "" }, envoyer "continuer" E.null )

        "groupe" ->
            actif (changer "/api/groupes" "POST" (E.object [ ( "nom", E.string (champ "nouveauGroupe" modele) ) ]) Nothing)

        "copier" ->
            case List.filter (\g -> g.id == modele.selection) modele.groupes |> List.head of
                Just g ->
                    ( modele, envoyer "copier" (E.string g.invitation) )

                Nothing ->
                    ( modele, Cmd.none )

        "enregistrerSeance" ->
            case List.filter (\s -> Just s.id == modele.edition) modele.seances |> List.head of
                Just s ->
                    actif
                        (changer ("/api/seances/" ++ String.fromInt s.id)
                            "PUT"
                            (E.object (List.map (\cle -> ( cle, E.string (champ cle modele) )) [ "titre", "sousTitre", "objectif", "intro", "approfondissement", "question", "petitPas" ] ++ [ ( "essentiel", E.list E.string (String.lines (champ "essentiel" modele) |> List.filter (\x -> String.trim x /= "")) ) ]))
                            (Just s.revision)
                        )

                Nothing ->
                    ( modele, Cmd.none )

        "ajouterQuestion" ->
            let
                q =
                    Question (String.trim (champ "nouvelleQuestion" modele)) (String.lines (champ "choixQuestion" modele) |> List.map String.trim |> List.filter ((/=) ""))
            in
            if q.texte == "" || List.length q.options < 2 || List.length q.options > 8 || List.length modele.questions >= 12 then
                erreur "Saisissez une question et 2 à 8 choix, un par ligne. Maximum : 12 questions."

            else
                ( { modele | questions = modele.questions ++ [ q ], brouillon = modele.brouillon |> Dict.remove "nouvelleQuestion" |> Dict.remove "choixQuestion", erreur = "" }, Cmd.none )

        "viderQuestions" ->
            ( { modele | questions = [] }, Cmd.none )

        "lancer" ->
            if List.isEmpty modele.questions then
                erreur "Ajoutez au moins une question avant de lancer le questionnaire."

            else
                actif (changer (base modele ++ "/questionnaires") "POST" (E.object [ ( "titre", E.string (champ "titreQuestionnaire" modele) ), ( "questions", E.list (\q -> E.object [ ( "texte", E.string q.texte ), ( "options", E.list E.string q.options ) ]) modele.questions ) ]) Nothing)

        _ ->
            if String.startsWith "pdf:" action then
                actif (envoyer "pdf" (E.int (String.dropLeft 4 action |> String.toInt |> Maybe.withDefault -1)))

            else if String.startsWith "repondre:" action then
                let
                    id =
                        String.dropLeft 9 action
                in
                case List.filter (\q -> q.id == id) modele.questionnaires |> List.head of
                    Just q ->
                        let
                            choix =
                                List.indexedMap (\i _ -> champ (id ++ ":" ++ String.fromInt i) modele) q.questions
                        in
                        if List.any ((==) "") choix then
                            erreur "Pour chaque question, choisissez une réponse ou « Je préfère ne pas répondre »."

                        else
                            actif (changer ("/api/questionnaires/" ++ id ++ "/reponses") "POST" (E.object [ ( "choix", E.list (\c -> String.toInt c |> Maybe.map E.int |> Maybe.withDefault E.null) choix ) ]) Nothing)

                    Nothing ->
                        ( modele, Cmd.none )

            else
                ( modele, Cmd.none )


lien libelle url =
    U.link [ F.color C.couleurs.prune, U.paddingXY 0 10 ] { url = url, label = U.paragraph [ width fill ] [ U.text libelle ] }


champVue modele cle libelle =
    C.champ libelle (champ cle modele) (Saisie cle)


zoneVue modele cle libelle =
    C.zone libelle (champ cle modele) (Saisie cle)


actions enfants =
    U.wrappedRow [ width fill, U.spacing 12 ] enfants


view modele =
    U.layout [ C.classe "theme-carnet", Bg.color C.couleurs.papier, F.color C.couleurs.encre, F.size 17 ]
        (U.column [ width (U.maximum 1100 fill), U.centerX, U.padding 24, U.spacing 24 ]
            [ U.row [ width fill, U.spacing 16 ]
                [ lien "ViSe · Mon carnet" "/"
                , case modele.compte of
                    Just c ->
                        U.el [ U.alignRight ] (C.discret "Me déconnecter" (Action "logout"))

                    Nothing ->
                        U.none
                ]
            , if modele.erreur /= "" then
                U.el [ width fill, U.htmlAttribute (A.attribute "role" "alert") ] (C.notice modele.erreur)

              else
                U.none
            , if modele.notice /= "" then
                U.el [ width fill, U.htmlAttribute (A.attribute "role" "status") ] (C.notice modele.notice)

              else
                U.none
            , if modele.busy then
                C.petit "Enregistrement en cours…"

              else
                U.none
            , if modele.kit then
                C.panneau [ C.titre 1 "Votre carnet est créé", C.paragraphe "Conservez votre kit privé de récupération. Votre phrase de coffre reste distincte du mot de passe de connexion.", C.bouton "Télécharger mon kit privé" (Action "kit"), C.secondaire "Continuer vers mon groupe" (Action "continuer") ]

              else if not modele.charge then
                C.paragraphe "Chargement de votre espace…"

              else if modele.invitation /= "" then
                inscriptionVue modele

              else
                case modele.compte of
                    Nothing ->
                        connexionVue modele

                    Just c ->
                        if c.role == "encadrant" then
                            encadrementVue modele

                        else
                            participantVue modele
            ]
        )


connexionVue modele =
    C.panneau
        [ C.titre 1 "Mon groupe · Encadrement"
        , champVue modele "pseudonyme" "Adresse mail ou identifiant"
        , C.secret "Mot de passe" (champ "password" modele) (Saisie "password")
        , C.bouton "Me connecter" (Action "login")
        , lien "Récupérer ma connexion ou ouvrir mon carnet" "/"
        ]


inscriptionVue modele =
    if modele.groupeInvite == "" then
        C.panneau [ C.titre 1 "Invitation indisponible", C.paragraphe "Vérifiez le lien auprès de l’équipe d’encadrement." ]

    else
        C.panneau
            [ C.titre 1 ("Rejoindre « " ++ modele.groupeInvite ++ " »")
            , C.paragraphe "L’équipe verra votre nom et votre adresse mail pour gérer le groupe. Elle ne pourra pas lire votre carnet personnel. Aucun mail n’est envoyé."
            , champVue modele "nom" "Nom"
            , champVue modele "prenom" "Prénom"
            , champVue modele "email" "Adresse mail"
            , C.secret "Mot de passe · 12 caractères minimum" (champ "password" modele) (Saisie "password")
            , C.secret "Phrase du coffre · distincte, 12 caractères minimum" (champ "phrase" modele) (Saisie "phrase")
            , C.secret "Confirmer la phrase du coffre" (champ "confirmationPhrase" modele) (Saisie "confirmationPhrase")
            , C.petit "La phrase et le secret de récupération ne sont pas transmis au serveur. Sans l’un des deux, votre carnet est irrécupérable."
            , C.coche "J’utilise uniquement des informations fictives pour ce prototype."
                (champ "fictif" modele == "oui")
                (\oui ->
                    Saisie "fictif"
                        (if oui then
                            "oui"

                         else
                            "non"
                        )
                )
            , C.bouton "Créer mon compte et rejoindre le groupe" (Action "register")
            , lien "J’ai déjà un compte : me connecter" "/espace.html"
            ]


encadrementVue modele =
    U.column [ width fill, U.spacing 22 ]
        [ C.titre 1 "Espace d’encadrement"
        , C.paragraphe "Gérez vos groupes et les supports communs. Les carnets, écrits et progressions personnelles ne sont jamais accessibles ici."
        , C.panneau [ C.titre 2 "Créer un groupe", champVue modele "nouveauGroupe" "Nom du nouveau groupe", C.bouton "Créer le groupe et son lien" (Action "groupe") ]
        , actions [ C.onglet (not modele.archives) "Groupes actifs" (Archives False), C.onglet modele.archives "Groupes archivés" (Archives True) ]
        , U.column [ width fill, U.spacing 10 ]
            (modele.groupes |> List.filter (\g -> g.archive == modele.archives) |> List.map (\g -> C.secondaire (g.nom ++ " · " ++ String.fromInt g.effectif ++ " participant·es") (Selectionner g.id)))
        , case List.filter (\g -> g.id == modele.selection) modele.groupes |> List.head of
            Just g ->
                groupeVue modele g

            Nothing ->
                C.petit "Sélectionnez un groupe pour le gérer."
        ]


groupeVue modele g =
    U.column [ width fill, U.spacing 24 ]
        [ C.panneau
            [ C.titre 2 g.nom
            , actions
                [ C.secondaire
                    (if g.archive then
                        "Réactiver le groupe"

                     else
                        "Archiver le groupe"
                    )
                    (Archiver g)
                , lien "Voir en mode participant·e" ("/?apercu=" ++ g.id)
                ]
            , if g.archive then
                C.petit "Le lien d’invitation et les questionnaires sont suspendus. Les membres conservent leur accès au carnet et aux supports visibles."

              else
                U.column [ width fill, U.spacing 10 ]
                    [ C.champ "Lien d’invitation du groupe · à copier-coller" g.invitation (\_ -> Saisie "sansEffet" "")
                    , C.secondaire "Copier le lien d’invitation" (Action "copier")
                    , C.discret "Remplacer le lien (invalide l’ancien)" (Requete (base modele ++ "/invitation") "POST" (E.object []) Nothing)
                    ]
            ]
        , C.titre 2 "Participant·es"
        , if List.isEmpty modele.membres then
            C.petit "Aucune inscription pour le moment. Partagez le lien du groupe."

          else
            U.column [ width fill, U.spacing 12 ] (List.map (membreVue modele) modele.membres)
        , C.titre 2 "Séances et visibilité du groupe"
        , C.petit "Le contenu et les PDF sont communs à tous les groupes. La visibilité se règle séparément pour ce groupe. Un document déjà téléchargé reste sur l’appareil."
        , U.column [ width fill, U.spacing 12 ] (List.map (seanceVue modele) modele.seances)
        , C.titre 2 "Questionnaires anonymes"
        , C.petit "Aucun texte libre ni réponse nominative. Les résultats sont regroupés après fermeture, à partir de trois participations. La fermeture est définitive."
        , U.column [ width fill, U.spacing 12 ] (List.map (questionnaireVue True modele) modele.questionnaires)
        , if g.archive then
            U.none

          else
            questionnaireCreation modele
        ]


membreVue modele m =
    C.panneau
        [ C.titre 3 (m.prenom ++ " " ++ m.nom)
        , C.paragraphe m.email
        , C.petit
            (if m.actif then
                "Accès actif"

             else
                "Accès désactivé"
            )
        , actions
            [ C.secondaire
                (if m.actif then
                    "Désactiver l’accès"

                 else
                    "Réactiver l’accès"
                )
                (Acces m)
            , C.destructif "Supprimer le compte…" (Supprimer m.id)
            ]
        , if modele.suppression == m.id then
            U.column [ width fill, U.spacing 12 ]
                [ C.paragraphe "Cette suppression efface le compte et ses données chiffrées du serveur. Les copies déjà téléchargées restent sur les appareils."
                , champVue modele "confirmation" "Écrivez SUPPRIMER pour confirmer"
                , C.destructif "Confirmer la suppression définitive" (Requete ("/api/utilisatrices/" ++ m.id) "DELETE" (E.object [ ( "confirmation", E.string (champ "confirmation" modele) ) ]) Nothing)
                , C.discret "Annuler" Annuler
                ]

          else
            U.none
        ]


seanceVue modele s =
    C.panneau
        [ C.titre 3 (String.fromInt s.id ++ " · " ++ s.contenu.titre)
        , actions
            [ C.secondaire
                (if s.visible then
                    "Masquer pour ce groupe"

                 else
                    "Rendre visible pour ce groupe"
                )
                (Visibilite s)
            , C.discret "Modifier le contenu commun" (Editer s)
            , C.discret "Déposer un PDF" (Action ("pdf:" ++ String.fromInt s.id))
            ]
        , C.petit "PDF de 2 Mo maximum, 20 documents par séance. Déposez seulement des supports pédagogiques fictifs ou publiables."
        , U.column [ width fill, U.spacing 8 ]
            (s.pdfs |> List.map (\p -> actions [ lien p.nom ("/api/supports/" ++ p.id), C.destructif "Retirer ce PDF" (Requete ("/api/supports/" ++ p.id) "DELETE" (E.object []) Nothing) ]))
        , if modele.edition == Just s.id then
            U.column [ width fill, U.spacing 12 ]
                [ champVue modele "titre" "Titre"
                , champVue modele "sousTitre" "Sous-titre"
                , zoneVue modele "objectif" "Objectif"
                , zoneVue modele "intro" "Introduction"
                , zoneVue modele "essentiel" "À retenir · un point par ligne"
                , zoneVue modele "approfondissement" "Approfondissement"
                , zoneVue modele "question" "Question de réflexion"
                , zoneVue modele "petitPas" "Petit pas proposé"
                , C.bouton "Enregistrer le contenu commun" (Action "enregistrerSeance")
                , C.discret "Annuler l’édition" Annuler
                ]

          else
            U.none
        ]


questionnaireCreation modele =
    C.panneau
        [ C.titre 3 "Préparer un questionnaire"
        , champVue modele "titreQuestionnaire" "Titre du questionnaire"
        , U.column [ width fill, U.spacing 8 ] (List.indexedMap (\i q -> C.paragraphe (String.fromInt (i + 1) ++ ". " ++ q.texte ++ " — " ++ String.join " / " q.options)) modele.questions)
        , champVue modele "nouvelleQuestion" "Question à ajouter"
        , zoneVue modele "choixQuestion" "Choix proposés · 2 à 8, un par ligne"
        , C.secondaire "Ajouter cette question" (Action "ajouterQuestion")
        , C.petit "L’option « Je préfère ne pas répondre » est toujours proposée. Maximum : 12 questions."
        , actions [ C.bouton "Lancer le questionnaire" (Action "lancer"), C.discret "Vider les questions préparées" (Action "viderQuestions") ]
        ]


questionnaireVue staff modele q =
    C.panneau
        ([ C.titre 3 q.titre ]
            ++ (if staff then
                    [ C.petit (String.fromInt q.reponses ++ " participation(s)")
                    , if q.ouvert then
                        C.secondaire "Fermer et afficher les résultats" (Requete ("/api/questionnaires/" ++ q.id ++ "/fermer") "POST" (E.object []) Nothing)

                      else
                        case q.compteurs of
                            Nothing ->
                                C.petit "Questionnaire fermé. Résultats masqués : moins de trois participations."

                            Just counts ->
                                U.column [ width fill, U.spacing 16 ]
                                    (List.map2 (\question ns -> U.column [ width fill, U.spacing 8 ] (C.paragraphe question.texte :: List.map2 (\label n -> C.petit (label ++ " : " ++ String.fromInt n)) (question.options ++ [ "Je préfère ne pas répondre" ]) ns)) q.questions counts)
                    ]

                else if q.participe then
                    [ C.petit "Votre participation a été enregistrée. Les choix sont comptés sans réponse nominative." ]

                else
                    List.indexedMap
                        (\i question ->
                            let
                                cle =
                                    q.id ++ ":" ++ String.fromInt i
                            in
                            C.choix question.texte (( "", "Choisir une réponse…" ) :: List.indexedMap (\n label -> ( String.fromInt n, label )) question.options ++ [ ( "abstention", "Je préfère ne pas répondre" ) ]) (champ cle modele) (Saisie cle)
                        )
                        q.questions
                        ++ [ C.bouton "Envoyer mes réponses anonymes" (Action ("repondre:" ++ q.id)) ]
               )
        )


participantVue modele =
    U.column [ width fill, U.spacing 20 ]
        [ C.titre 1
            (if modele.groupeInvite == "" then
                "Mes supports"

             else
                "Mon groupe · " ++ modele.groupeInvite
            )
        , C.paragraphe "Votre carnet reste privé. L’équipe gère les séances et les supports de votre groupe, sans consulter vos écrits."
        , lien "Ouvrir mon carnet personnel" "/"
        , C.titre 2 "Questionnaires proposés"
        , U.column [ width fill, U.spacing 12 ] (List.map (questionnaireVue False modele) modele.questionnaires)
        , C.titre 2 "Séances et PDF"
        , U.column [ width fill, U.spacing 12 ]
            (List.map (\s -> C.panneau [ C.titre 3 s.contenu.titre, C.paragraphe s.contenu.intro, U.column [ width fill, U.spacing 8 ] (List.map (\p -> lien p.nom ("/api/supports/" ++ p.id)) s.pdfs) ]) modele.parcours)
        ]
