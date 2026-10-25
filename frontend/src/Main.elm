port module Main exposing (main)

import Browser
import Browser.Events
import Carnet as K exposing (Carnet)
import Contenu exposing (Chapitre)
import Dict exposing (Dict)
import Element as U exposing (Element, fill, px, shrink, width)
import Element.Background as Bg
import Element.Border as B
import Element.Font as F
import Element.Input as Input
import Element.Region as R
import Html
import Html.Attributes as A
import Html.Events as Events
import Json.Decode as D
import Json.Encode as E
import MrJam.Carnet as C
import MrJam.Continuite as Continuite


port commande : E.Value -> Cmd msg


port evenement : (D.Value -> msg) -> Sub msg


type Ecran
    = Entree
    | Inscription
    | Connexion
    | RecuperationCompte
    | Verrouille
    | Ouvert


type Moment
    = Avant
    | Pendant
    | Entre


type GesteNavigation
    = OngletPointe
    | OngletAuClavier
    | DestinationChoisie
    | MomentGlisse


type Vue
    = Parcours
    | ChapitreVue Int Moment
    | Objectifs
    | Reperes
    | Reglages
    | Apropos
    | Presentation


type alias Modele =
    { ecran : Ecran
    , vue : Vue
    , camera : Continuite.Point
    , momentCamera : Float
    , preparation : Int
    , mouvementVersion : Int
    , sortie : Maybe Vue
    , momentSortie : Maybe Moment
    , retourSeance : Maybe Vue
    , parcoursVue : Vue
    , carnetVue : Vue
    , capsule : Maybe Int
    , capsuleSortie : Maybe ( Int, Moment )
    , capsulesMouvement : List Int
    , carnet : Carnet
    , chapitres : List Chapitre
    , largeur : Int
    , demo : Bool
    , demoOnly : Bool
    , reducedMotion : Bool
    , formulaires : Dict String String
    , menu : Bool
    , compteMenu : Bool
    , erreur : String
    , notice : String
    , busy : Bool
    , sauvegarde : String
    , sauvegardeMessage : String
    , approfondi : Bool
    , sources : Bool
    , paysageEtape : Int
    , carteSelectionnee : Maybe Int
    , objectifEdition : Maybe Int
    , defiEdition : Maybe Int
    , selection : List String
    , photosUrls : Dict String String
    , confirmation : String
    , kit : Maybe ( String, String, String )
    , coffreRecupere : String
    , authRecupere : String
    , avertissement : Bool
    }


type Msg
    = Evenement D.Value
    | TransitionTerminee String
    | PreparerMouvement Float
    | CapsuleTerminee Int
    | OngletClavier Vue
    | Taille Int Int
    | Naviguer Vue
    | ChangerFeuille Vue
    | OuvrirCompte Ecran
    | Saisie String String
    | Action String
    | Demander String
    | Annuler
    | AfficherMenu
    | AfficherCompte
    | FermerCompte
    | RetrouverPlan
    | ToggleApprofondissement
    | ToggleSources
    | Noter String String
    | EffacerNote String
    | ChoisirEtape Int
    | ConsultationTerminee Int
    | ObjectifCreer
    | ObjectifEditer Int
    | ObjectifReformuler Int
    | ObjectifSupprimer Int
    | ObjectifHistoriqueEffacer Int
    | DefiCreer
    | DefiEditer Int
    | DefiAjuster Int
    | DefiStatut Int String
    | DefiSupprimer Int
    | ExperienceCreer Int Bool
    | ExperienceChamp Int String String
    | ExperienceSupprimer Int
    | AjouterCarte String
    | ChoisirCarte Int
    | CarteChamp Int String String
    | CarteSupprimer Int
    | PaysagePhase Int
    | GarderTrace Int
    | TraceSupprimer Int
    | EtapeCreer
    | EtapeSupprimer Int
    | PhotoSupprimer String
    | Selectionner String Bool


main : Program D.Value Modele Msg
main =
    Browser.element { init = init, update = update, view = view, subscriptions = subscriptions }


init : D.Value -> ( Modele, Cmd Msg )
init flags =
    ( { ecran = Entree
      , vue = Parcours
      , camera = position Parcours
      , momentCamera = 0
      , preparation = 0
      , mouvementVersion = 0
      , sortie = Nothing
      , momentSortie = Nothing
      , retourSeance = Nothing
      , parcoursVue = Parcours
      , carnetVue = Parcours
      , capsule = Nothing
      , capsuleSortie = Nothing
      , capsulesMouvement = []
      , carnet = K.vide
      , chapitres = lire (D.field "chapitres" (D.list Contenu.decoder)) [] flags
      , largeur = lire (D.field "largeur" D.int) 1440 flags
      , demo = False
      , demoOnly = lire (D.field "demoOnly" D.bool) False flags
      , reducedMotion = lire (D.field "reducedMotion" D.bool) False flags
      , formulaires = Dict.empty
      , menu = False
      , compteMenu = False
      , erreur = ""
      , notice = ""
      , busy = False
      , sauvegarde = ""
      , sauvegardeMessage = ""
      , approfondi = False
      , sources = False
      , paysageEtape = 1
      , carteSelectionnee = Nothing
      , objectifEdition = Nothing
      , defiEdition = Nothing
      , selection = []
      , photosUrls = Dict.empty
      , confirmation = ""
      , kit = Nothing
      , coffreRecupere = ""
      , authRecupere = ""
      , avertissement = False
      }
    , Cmd.none
    )


lire : D.Decoder a -> a -> D.Value -> a
lire decoder defaut valeur =
    D.decodeValue decoder valeur |> Result.withDefault defaut


envoyer : String -> E.Value -> Cmd Msg
envoyer action donnees =
    commande (E.object [ ( "action", E.string action ), ( "data", donnees ) ])


surveillerMouvement : Int -> Cmd Msg
surveillerMouvement version =
    envoyer "settleMotion" (E.object [ ( "version", E.int version ) ])


focus : Cmd Msg
focus =
    envoyer "focus" (E.object [ ( "id", E.string "titre-page" ), ( "scroll", E.bool True ) ])


rejoindreDebut : Modele -> String -> Cmd Msg
rejoindreDebut modele id =
    envoyer "focus" (E.object [ ( "id", E.string id ), ( "scroll", E.bool True ), ( "smooth", E.bool (animations modele) ) ])


form : String -> Modele -> String
form cle modele =
    Dict.get cle modele.formulaires |> Maybe.withDefault ""


seanceCourante : Modele -> Int
seanceCourante modele =
    case modele.vue of
        ChapitreVue id _ ->
            id

        _ ->
            modele.carnet.etape


modifier : Carnet -> Modele -> ( Modele, Cmd Msg )
modifier carnet modele =
    ( { modele | carnet = carnet, erreur = "", sauvegarde = "saving", sauvegardeMessage = "" }, envoyer "save" (K.encoder carnet) )


avecNotice : String -> ( Modele, Cmd Msg ) -> ( Modele, Cmd Msg )
avecNotice texte ( modele, cmd ) =
    ( { modele | notice = texte }, cmd )


update : Msg -> Modele -> ( Modele, Cmd Msg )
update msg modele =
    let
        carnet =
            modele.carnet
    in
    case msg of
        Evenement valeur ->
            let
                kind =
                    lire (D.field "kind" D.string) "" valeur

                data =
                    lire (D.field "data" D.value) E.null valeur

                texte =
                    lire (D.field "message" D.string) "" data
            in
            case kind of
                "opened" ->
                    case D.decodeValue (D.field "journal" K.decoder) data of
                        Ok doc ->
                            ( { modele | ecran = Ouvert, vue = Parcours, camera = position Parcours, momentCamera = 0, preparation = 0, sortie = Nothing, momentSortie = Nothing, retourSeance = Nothing, parcoursVue = Parcours, carnetVue = Parcours, compteMenu = False, capsule = Nothing, capsuleSortie = Nothing, capsulesMouvement = [], carnet = doc, demo = lire (D.field "demo" D.bool) False data, formulaires = Dict.empty, erreur = "", notice = "", busy = False, photosUrls = Dict.empty, confirmation = "", menu = False }, focus )

                        Err _ ->
                            ( { modele | ecran = Verrouille, vue = Parcours, camera = position Parcours, momentCamera = 0, preparation = 0, sortie = Nothing, momentSortie = Nothing, retourSeance = Nothing, parcoursVue = Parcours, carnetVue = Parcours, compteMenu = False, capsule = Nothing, capsuleSortie = Nothing, capsulesMouvement = [], carnet = K.vide, busy = False, erreur = "Le carnet a un format non pris en charge. Il reste conservé chiffré." }, envoyer "lock" E.null )

                "swipeMoment" ->
                    case modele.vue of
                        ChapitreVue id moment ->
                            if modele.ecran == Ouvert && lire (D.field "id" D.int) -1 data == id then
                                let
                                    index =
                                        clamp 0 1 (round (momentPosition moment) + lire (D.field "direction" D.int) 0 data)

                                    destination =
                                        if index == 0 then
                                            Avant

                                        else if index == 1 then
                                            Pendant

                                        else
                                            Entre
                                in
                                naviguer MomentGlisse (ChapitreVue id destination) modele

                            else
                                ( modele, Cmd.none )

                        _ ->
                            ( modele, Cmd.none )

                "motionPreference" ->
                    let
                        suivant =
                            { modele | reducedMotion = lire (D.field "reduce" D.bool) False data }
                    in
                    ( stabiliserSiNecessaire suivant, Cmd.none )

                "locked" ->
                    ( { modele | ecran = Verrouille, vue = Parcours, camera = position Parcours, momentCamera = 0, preparation = 0, sortie = Nothing, momentSortie = Nothing, retourSeance = Nothing, parcoursVue = Parcours, carnetVue = Parcours, compteMenu = False, capsule = Nothing, capsuleSortie = Nothing, capsulesMouvement = [], carnet = K.vide, demo = lire (D.field "demo" D.bool) False data, formulaires = Dict.empty, photosUrls = Dict.empty, selection = [], kit = Nothing, coffreRecupere = "", authRecupere = "", busy = False, confirmation = "", menu = False, notice = "" }, Cmd.none )

                "entry" ->
                    ( { modele | ecran = Entree, vue = Parcours, camera = position Parcours, momentCamera = 0, preparation = 0, sortie = Nothing, momentSortie = Nothing, retourSeance = Nothing, parcoursVue = Parcours, carnetVue = Parcours, compteMenu = False, capsule = Nothing, capsuleSortie = Nothing, capsulesMouvement = [], carnet = K.vide, formulaires = Dict.empty, photosUrls = Dict.empty, selection = [], kit = Nothing, busy = False, erreur = "", notice = "", confirmation = "", demo = False }, focus )

                "busy" ->
                    ( { modele | busy = True, erreur = "", notice = texte }, Cmd.none )

                "idle" ->
                    ( { modele | busy = False }, Cmd.none )

                "status" ->
                    ( { modele | sauvegarde = lire (D.field "state" D.string) "" data, sauvegardeMessage = texte }, Cmd.none )

                "motionSettled" ->
                    ( if modele.ecran == Ouvert && modele.preparation == 0 && lire (D.field "version" D.int) -1 data == modele.mouvementVersion then
                        { modele | sortie = Nothing, momentSortie = Nothing, capsuleSortie = Nothing, capsulesMouvement = [] }

                      else
                        modele
                    , Cmd.none
                    )

                "error" ->
                    ( { modele | erreur = texte, busy = False }, Cmd.none )

                "notice" ->
                    ( { modele | notice = texte, busy = False }, Cmd.none )

                "kit" ->
                    ( { modele | kit = Just ( lire (D.field "account" D.string) "" data, lire (D.field "auth" D.string) "" data, lire (D.field "vault" D.string) "" data ) }, Cmd.none )

                "kitDismissed" ->
                    ( { modele | kit = Nothing }, Cmd.none )

                "vaultRecovery" ->
                    ( { modele | coffreRecupere = lire (D.field "secret" D.string) "" data }, Cmd.none )

                "authReset" ->
                    ( { modele | authRecupere = lire (D.field "code" D.string) "" data, notice = "Le mot de passe de connexion a changé. Il faut encore ouvrir le coffre avec sa phrase ou son secret de récupération." }, Cmd.none )

                "photoAdded" ->
                    let
                        id =
                            lire (D.field "id" D.string) "" data

                        photo =
                            { id = id, nom = lire (D.field "nom" D.string) "" data, seance = seanceCourante modele }
                    in
                    modifier { carnet | photos = carnet.photos ++ [ photo ] } { modele | photosUrls = Dict.insert id (lire (D.field "url" D.string) "" data) modele.photosUrls, notice = "Photo réduite, nettoyée et chiffrée sur cet appareil." }

                "photoPreview" ->
                    ( { modele | photosUrls = Dict.insert (lire (D.field "id" D.string) "" data) (lire (D.field "url" D.string) "" data) modele.photosUrls }, Cmd.none )

                "lockWarning" ->
                    ( { modele | avertissement = lire (D.field "show" D.bool) False data }, Cmd.none )

                "sessionExpired" ->
                    ( { modele | notice = "Votre connexion a expiré. Votre brouillon reste chiffré sur cet appareil. Verrouillez puis reconnectez-vous pour le synchroniser." }, Cmd.none )

                _ ->
                    ( modele, Cmd.none )

        Taille largeur _ ->
            ( { modele | largeur = largeur }, Cmd.none )

        PreparerMouvement _ ->
            ( if modele.preparation <= 1 then
                { modele
                    | preparation = 0
                    , camera = position modele.vue
                    , momentCamera = momentDe modele.parcoursVue
                    , capsule = capsuleDe modele.parcoursVue
                    , capsulesMouvement =
                        if modele.capsule /= capsuleDe modele.parcoursVue then
                            List.filterMap identity [ modele.capsule, capsuleDe modele.parcoursVue ]

                        else
                            modele.capsulesMouvement
                }

              else
                { modele | preparation = modele.preparation - 1 }
            , if modele.preparation <= 1 then
                surveillerMouvement modele.mouvementVersion

              else
                Cmd.none
            )

        CapsuleTerminee id ->
            ( { modele
                | capsulesMouvement = List.filter ((/=) id) modele.capsulesMouvement
                , capsuleSortie =
                    if Maybe.map Tuple.first modele.capsuleSortie == Just id && (modele.preparation == 0 || modele.capsule /= Just id) then
                        Nothing

                    else
                        modele.capsuleSortie
              }
            , Cmd.none
            )

        TransitionTerminee fenetre ->
            ( if modele.preparation > 0 then
                modele

              else if fenetre == "moment" then
                { modele | momentSortie = Nothing }

              else
                { modele
                    | sortie = Nothing
                    , capsulesMouvement =
                        if feuille modele.vue == Parcours then
                            modele.capsulesMouvement

                        else
                            []
                    , capsuleSortie =
                        if feuille modele.vue == Parcours then
                            modele.capsuleSortie

                        else
                            Nothing
                }
            , Cmd.none
            )

        OngletClavier vue ->
            naviguer OngletAuClavier vue modele

        ChangerFeuille vue ->
            naviguer OngletPointe vue modele

        Naviguer vue ->
            naviguer DestinationChoisie vue modele

        OuvrirCompte ecran ->
            ( { modele | ecran = ecran, vue = Parcours, compteMenu = False, formulaires = Dict.empty, erreur = "", notice = "", confirmation = "" }, focus )

        Saisie cle valeur ->
            ( { modele | formulaires = Dict.insert cle valeur modele.formulaires }, Cmd.none )

        Action action ->
            if modele.busy && action /= "lock" && action /= "logout" then
                ( modele, Cmd.none )

            else
                actionTechnique action { modele | confirmation = "", erreur = "" }

        Demander action ->
            ( { modele | confirmation = action, erreur = "", notice = "" }, Cmd.none )

        Annuler ->
            ( { modele | confirmation = "" }, Cmd.none )

        RetrouverPlan ->
            ( modele, rejoindreDebut modele "plan-carnet" )

        AfficherMenu ->
            ( { modele | menu = not modele.menu, compteMenu = False }, Cmd.none )

        AfficherCompte ->
            ( { modele | compteMenu = not modele.compteMenu }, Cmd.none )

        FermerCompte ->
            ( { modele | compteMenu = False }, envoyer "focus" (E.object [ ( "id", E.string "compte-commande" ), ( "scroll", E.bool False ) ]) )

        ToggleApprofondissement ->
            ( { modele | approfondi = not modele.approfondi }, Cmd.none )

        ToggleSources ->
            ( { modele | sources = not modele.sources }, Cmd.none )

        Noter cle texte ->
            modifier (K.noter cle texte carnet) modele
                |> (\( suivant, cmd ) -> ( stabiliserSiNecessaire suivant, cmd ))

        EffacerNote cle ->
            modifier { carnet | notes = Dict.remove cle carnet.notes } modele |> avecNotice "Cette entrée a été effacée du carnet actif."

        ChoisirEtape id ->
            if id == carnet.etape + 1 then
                modifier { carnet | etape = id } modele |> avecNotice "La séance est ouverte. Sa préparation et son contenu restent disponibles."

            else
                ( modele, Cmd.none )

        ConsultationTerminee id ->
            modifier { carnet | consultations = id :: List.filter ((/=) id) carnet.consultations } modele |> avecNotice "Consultation terminée à votre demande. Vous pourrez y revenir à tout moment."

        ObjectifCreer ->
            if String.trim (form "objectif" modele) == "" then
                ( { modele | erreur = "Écrivez quelques mots pour cet objectif." }, Cmd.none )

            else
                modifier (K.suivante { carnet | objectifs = carnet.objectifs ++ [ { id = carnet.nextId, texte = String.trim (form "objectif" modele), origine = seanceCourante modele, historique = [] } ] }) { modele | formulaires = Dict.remove "objectif" modele.formulaires } |> avecNotice "Objectif conservé. Vous pourrez le reformuler."

        ObjectifEditer id ->
            let
                actuel =
                    List.filter (\o -> o.id == id) carnet.objectifs |> List.head |> Maybe.map .texte |> Maybe.withDefault ""
            in
            ( { modele | objectifEdition = Just id, formulaires = Dict.insert "objectif-edition" actuel modele.formulaires }, Cmd.none )

        ObjectifReformuler id ->
            let
                nouvelle =
                    String.trim (form "objectif-edition" modele)

                ajuster o =
                    if o.id == id && o.texte /= nouvelle then
                        { o | texte = nouvelle, historique = o.historique ++ [ o.texte ] }

                    else
                        o
            in
            if nouvelle == "" then
                ( { modele | erreur = "Écrivez la nouvelle formulation." }, Cmd.none )

            else
                modifier { carnet | objectifs = List.map ajuster carnet.objectifs } { modele | objectifEdition = Nothing, formulaires = Dict.remove "objectif-edition" modele.formulaires } |> avecNotice "Nouvelle formulation conservée avec les précédentes."

        ObjectifSupprimer id ->
            modifier
                { carnet
                    | objectifs = List.filter (\o -> o.id /= id) carnet.objectifs
                    , defis =
                        List.map
                            (\d ->
                                if d.objectif == id then
                                    { d | objectif = 0 }

                                else
                                    d
                            )
                            carnet.defis
                }
                modele

        ObjectifHistoriqueEffacer id ->
            modifier
                { carnet
                    | objectifs =
                        List.map
                            (\o ->
                                if o.id == id then
                                    { o | historique = [] }

                                else
                                    o
                            )
                            carnet.objectifs
                }
                modele

        DefiCreer ->
            if List.length (K.actifs carnet) >= 3 then
                ( { modele | erreur = "Trois défis sont déjà actifs. Vous pouvez en mettre un de côté ci-dessous, puis ajouter celui-ci." }, Cmd.none )

            else if String.trim (form "defi" modele) == "" then
                ( { modele | erreur = "Écrivez quelques mots pour ce défi." }, Cmd.none )

            else
                modifier (K.suivante { carnet | defis = carnet.defis ++ [ { id = carnet.nextId, texte = String.trim (form "defi" modele), objectif = String.toInt (form "defi-objectif" modele) |> Maybe.withDefault 0, statut = "actif", origine = seanceCourante modele, historique = [] } ] }) { modele | formulaires = Dict.remove "defi" modele.formulaires } |> avecNotice "Ce défi restera disponible aux séances suivantes."

        DefiEditer id ->
            let
                texte =
                    List.filter (\d -> d.id == id) carnet.defis |> List.head |> Maybe.map .texte |> Maybe.withDefault ""
            in
            ( { modele | defiEdition = Just id, formulaires = Dict.insert "defi-edition" texte modele.formulaires }, Cmd.none )

        DefiAjuster id ->
            let
                texte =
                    String.trim (form "defi-edition" modele)
            in
            if texte == "" then
                ( { modele | erreur = "Écrivez la nouvelle formulation du défi." }, Cmd.none )

            else
                modifier
                    { carnet
                        | defis =
                            List.map
                                (\d ->
                                    if d.id == id && d.texte /= texte then
                                        { d | texte = texte, historique = d.historique ++ [ d.texte ] }

                                    else
                                        d
                                )
                                carnet.defis
                    }
                    { modele | defiEdition = Nothing }
                    |> avecNotice "Défi ajusté ; sa formulation précédente reste conservée."

        DefiStatut id statut ->
            if statut == "actif" && List.length (K.actifs carnet) >= 3 && not (List.any (\d -> d.id == id && d.statut == "actif") carnet.defis) then
                ( { modele | erreur = "Trois défis sont déjà actifs. Mettez-en un de côté avant de reprendre celui-ci." }, Cmd.none )

            else
                modifier
                    { carnet
                        | defis =
                            List.map
                                (\d ->
                                    if d.id == id then
                                        { d | statut = statut }

                                    else
                                        d
                                )
                                carnet.defis
                    }
                    modele

        DefiSupprimer id ->
            modifier
                { carnet
                    | defis = List.filter (\d -> d.id /= id) carnet.defis
                    , experiences =
                        List.map
                            (\x ->
                                if x.defi == id then
                                    { x | defi = 0 }

                                else
                                    x
                            )
                            carnet.experiences
                }
                modele

        ExperienceCreer seance principale ->
            let
                existantes =
                    List.filter (\x -> x.seance == seance) carnet.experiences
            in
            if List.length existantes >= 2 || List.any (\x -> x.principale == principale) existantes then
                ( { modele | erreur = "Une expérimentation principale et une seconde facultative suffisent entre deux séances." }, Cmd.none )

            else
                modifier (K.suivante { carnet | experiences = carnet.experiences ++ [ K.nouvelleExperience carnet.nextId seance principale ] }) modele

        ExperienceChamp id cle texte ->
            let
                ajuster x =
                    if x.id /= id then
                        x

                    else
                        case cle of
                            "quoi" ->
                                { x | quoi = texte }

                            "quand" ->
                                { x | quand = texte }

                            "comment" ->
                                { x | comment = texte }

                            "obstacle" ->
                                { x | obstacle = texte }

                            "observer" ->
                                { x | observer = texte }

                            "statut" ->
                                { x | statut = texte }

                            "essaye" ->
                                { x | essaye = texte }

                            "marque" ->
                                { x | marque = texte }

                            "appris" ->
                                { x | appris = texte }

                            "suite" ->
                                { x | suite = texte }

                            "defi" ->
                                { x | defi = String.toInt texte |> Maybe.withDefault 0 }

                            _ ->
                                x
            in
            modifier { carnet | experiences = List.map ajuster carnet.experiences } modele

        ExperienceSupprimer id ->
            modifier { carnet | experiences = List.filter (\x -> x.id /= id) carnet.experiences } modele

        AjouterCarte mot ->
            let
                texte =
                    if mot == "" then
                        String.trim (form "carte-mot" modele)

                    else
                        mot
            in
            if texte == "" then
                ( { modele | erreur = "Écrivez un mot pour votre carte." }, Cmd.none )

            else
                modifier (K.suivante { carnet | cartes = carnet.cartes ++ [ { id = carnet.nextId, mot = texte, sens = "", zone = "explorer", hesitation = "" } ] }) { modele | carteSelectionnee = Just carnet.nextId, formulaires = Dict.remove "carte-mot" modele.formulaires }

        ChoisirCarte id ->
            ( { modele | carteSelectionnee = Just id }, Cmd.none )

        CarteChamp id cle texte ->
            let
                ajuster carte =
                    if carte.id /= id then
                        carte

                    else
                        case cle of
                            "mot" ->
                                { carte | mot = texte }

                            "sens" ->
                                { carte | sens = texte }

                            "zone" ->
                                { carte
                                    | zone = texte
                                    , hesitation =
                                        if carte.hesitation == texte then
                                            ""

                                        else
                                            carte.hesitation
                                }

                            "hesitation" ->
                                { carte
                                    | hesitation =
                                        if texte == carte.zone then
                                            ""

                                        else
                                            texte
                                }

                            _ ->
                                carte
            in
            modifier { carnet | cartes = List.map ajuster carnet.cartes } modele

        CarteSupprimer id ->
            modifier { carnet | cartes = List.filter (\c -> c.id /= id) carnet.cartes } { modele | carteSelectionnee = Nothing }

        PaysagePhase phase ->
            ( { modele | paysageEtape = phase }, Cmd.none )

        GarderTrace seance ->
            let
                texte =
                    K.note (String.fromInt seance ++ "-activite") carnet

                trace =
                    { id = carnet.nextId
                    , seance = seance
                    , titre =
                        if seance == 1 then
                            "Mon paysage · version " ++ String.fromInt (1 + List.length (List.filter (\t -> t.seance == 1) carnet.traces))

                        else
                            "Ma trace de séance " ++ String.fromInt seance
                    , texte = texte
                    , cartes =
                        if seance == 1 then
                            carnet.cartes

                        else
                            []
                    }
            in
            modifier (K.suivante { carnet | traces = carnet.traces ++ [ trace ] }) modele |> avecNotice "Cette version est conservée dans Mes repères. Vous pouvez continuer à modifier votre production."

        TraceSupprimer id ->
            modifier { carnet | traces = List.filter (\t -> t.id /= id) carnet.traces } modele

        EtapeCreer ->
            if String.trim (form "etape-texte" modele) == "" then
                ( { modele | erreur = "Écrivez ce dont vous voulez vous souvenir." }, Cmd.none )

            else
                modifier (K.suivante { carnet | etapes = carnet.etapes ++ [ { id = carnet.nextId, seance = seanceCourante modele, quand = form "etape-quand" modele, texte = form "etape-texte" modele, montre = form "etape-montre" modele } ] }) { modele | formulaires = Dict.empty } |> avecNotice "Étape importante conservée."

        EtapeSupprimer id ->
            modifier { carnet | etapes = List.filter (\e -> e.id /= id) carnet.etapes } modele

        PhotoSupprimer id ->
            let
                ( nouveau, cmd ) =
                    modifier { carnet | photos = List.filter (\p -> p.id /= id) carnet.photos } { modele | photosUrls = Dict.remove id modele.photosUrls }
            in
            ( nouveau, Cmd.batch [ cmd, envoyer "photoDelete" (E.object [ ( "id", E.string id ) ]) ] )

        Selectionner id choisi ->
            ( { modele
                | selection =
                    if choisi then
                        id :: List.filter ((/=) id) modele.selection

                    else
                        List.filter ((/=) id) modele.selection
              }
            , Cmd.none
            )


actionTechnique : String -> Modele -> ( Modele, Cmd Msg )
actionTechnique action modele =
    let
        valeurs cles =
            E.object (List.map (\( cle, champ ) -> ( cle, E.string (form champ modele) )) cles)

        exec nom data =
            ( { modele | busy = List.member nom [ "register", "login", "unlock", "changePhrase", "resetAuth", "newVault", "import", "deleteAccount" ] }, envoyer nom data )
    in
    case action of
        "register" ->
            if form "fictif" modele /= "oui" then
                ( { modele | erreur = "Ce prototype se teste uniquement avec des informations fictives. Confirmez que vous utilisez des données fictives." }, Cmd.none )

            else if form "phrase" modele /= form "phrase-confirm" modele then
                ( { modele | erreur = "Les deux phrases de coffre ne sont pas identiques." }, Cmd.none )

            else
                exec "register" (valeurs [ ( "pseudonyme", "pseudo" ), ( "password", "password" ), ( "phrase", "phrase" ) ])

        "login" ->
            exec "login" (valeurs [ ( "pseudonyme", "pseudo" ), ( "password", "password" ) ])

        "unlock" ->
            exec "unlock" (E.object [ ( "secret", E.string (form "secret" modele) ), ( "recovery", E.bool (form "recovery" modele == "oui") ) ])

        "changePhrase" ->
            exec "changePhrase" (E.object [ ( "secret", E.string (form "ancienne-phrase" modele) ), ( "phrase", E.string (form "nouvelle-phrase" modele) ), ( "recovery", E.bool (form "change-recovery" modele == "oui") ) ])

        "resetAuth" ->
            exec "resetAuth" (valeurs [ ( "pseudonyme", "pseudo" ), ( "password", "password" ), ( "code", "auth-code" ) ])

        "newVault" ->
            exec "newVault" (E.object [ ( "phrase", E.string (form "new-vault-phrase" modele) ) ])

        "import" ->
            exec "import" (E.object [ ( "secret", E.string (form "import-secret" modele) ), ( "recovery", E.bool (form "import-recovery" modele == "oui") ) ])

        "deleteAccount" ->
            exec "deleteAccount" (E.object [ ( "password", E.string (form "delete-password" modele) ) ])

        "readableExport" ->
            exec "readableExport" (E.list (\item -> E.object [ ( "titre", E.string item.titre ), ( "texte", E.string item.texte ), ( "source", E.string item.source ) ]) (selectionLisible modele))

        _ ->
            exec action E.null


{-| Un onglet conserve la lecture de l’objet carnet. Seule une destination
explicitement choisie peut révéler une capsule ou rejoindre le début.
-}
naviguer : GesteNavigation -> Vue -> Modele -> ( Modele, Cmd Msg )
naviguer geste destination modele =
    let
        vue =
            case destination of
                ChapitreVue id moment ->
                    if id > modele.carnet.etape + 1 then
                        Parcours

                    else if id == modele.carnet.etape + 1 || moment == Entre then
                        ChapitreVue id Avant

                    else
                        destination

                _ ->
                    destination

        anime =
            animations modele && modele.ecran == Ouvert && vue /= Presentation && modele.vue /= Presentation

        parcours =
            case vue of
                ChapitreVue _ _ ->
                    vue

                Parcours ->
                    Parcours

                _ ->
                    modele.parcoursVue

        memeSeance =
            case ( modele.parcoursVue, parcours ) of
                ( ChapitreVue avant _, ChapitreVue apres _ ) ->
                    avant == apres

                _ ->
                    False

        animeMoment =
            anime && feuille vue == Parcours && memeSeance && momentDe parcours /= modele.momentCamera

        cibleCapsule =
            capsuleDe parcours

        animeCapsule =
            anime && feuille vue == Parcours && cibleCapsule /= modele.capsule

        changeFeuille =
            position vue /= modele.camera

        ancienneCapsule =
            modele.capsule
                |> Maybe.map
                    (\id ->
                        ( id
                        , case modele.parcoursVue of
                            ChapitreVue _ m ->
                                m

                            _ ->
                                Avant
                        )
                    )

        ancienMoment =
            case modele.parcoursVue of
                ChapitreVue _ moment ->
                    Just moment

                _ ->
                    Nothing

        retour =
            case ( modele.vue, vue ) of
                ( ChapitreVue _ _, Objectifs ) ->
                    Just modele.vue

                ( ChapitreVue _ _, Reperes ) ->
                    Just modele.vue

                ( _, ChapitreVue _ _ ) ->
                    Nothing

                _ ->
                    modele.retourSeance

        suivant =
            { modele
                | vue = vue
                , mouvementVersion = modele.mouvementVersion + 1
                , parcoursVue = parcours
                , carnetVue =
                    if estFeuille vue then
                        vue

                    else
                        modele.carnetVue
                , camera =
                    if anime then
                        modele.camera

                    else
                        position vue
                , momentCamera =
                    if anime && memeSeance then
                        modele.momentCamera

                    else
                        momentDe parcours
                , capsule =
                    if animeCapsule then
                        modele.capsule

                    else
                        cibleCapsule
                , preparation =
                    if anime && (changeFeuille || animeMoment || animeCapsule) then
                        2

                    else
                        0
                , sortie =
                    if anime && changeFeuille then
                        if modele.preparation > 0 then
                            modele.sortie

                        else
                            Just modele.vue

                    else
                        Nothing
                , momentSortie =
                    if animeMoment then
                        if modele.preparation > 0 then
                            modele.momentSortie

                        else
                            ancienMoment

                    else
                        Nothing
                , capsuleSortie =
                    if animeCapsule then
                        ancienneCapsule

                    else if anime && cibleCapsule /= Maybe.map Tuple.first modele.capsuleSortie then
                        modele.capsuleSortie

                    else
                        Nothing
                , capsulesMouvement =
                    if animeCapsule then
                        List.filter (\id -> List.member (Just id) [ modele.capsule, cibleCapsule ]) modele.capsulesMouvement

                    else if anime then
                        modele.capsulesMouvement

                    else
                        []
                , menu = False
                , compteMenu = False
                , erreur = ""
                , notice = ""
                , confirmation = ""
                , retourSeance = retour
                , approfondi =
                    if memeSeance then
                        modele.approfondi

                    else
                        False
                , sources =
                    if memeSeance then
                        modele.sources

                    else
                        False
            }

        focaliser =
            case geste of
                OngletPointe ->
                    envoyer "focus" (E.object [ ( "id", E.string "titre-page" ), ( "scroll", E.bool False ) ])

                OngletAuClavier ->
                    envoyer "focus" (E.object [ ( "id", E.string ("onglet-" ++ String.fromInt (round (position vue).x)) ), ( "scroll", E.bool False ) ])

                MomentGlisse ->
                    case vue of
                        ChapitreVue id moment ->
                            envoyer "focus" (E.object [ ( "id", E.string ("moment-capsule-" ++ String.fromInt id ++ "-onglet-" ++ String.fromInt (round (momentPosition moment))) ), ( "scroll", E.bool False ) ])

                        _ ->
                            Cmd.none

                DestinationChoisie ->
                    case vue of
                        ChapitreVue id _ ->
                            envoyer "focus" (E.object [ ( "id", E.string ("titre-capsule-" ++ String.fromInt id) ), ( "scroll", E.bool False ), ( "reveal", E.bool changeFeuille ), ( "smooth", E.bool (animations modele) ) ])

                        Parcours ->
                            case capsuleDe modele.parcoursVue of
                                Just id ->
                                    envoyer "focus" (E.object [ ( "id", E.string ("titre-capsule-" ++ String.fromInt id) ), ( "scroll", E.bool False ) ])

                                Nothing ->
                                    rejoindreDebut modele "titre-page"

                        _ ->
                            rejoindreDebut modele "titre-page"
    in
    ( suivant
    , Cmd.batch
        [ focaliser
        , if suivant.preparation == 0 && anime then
            surveillerMouvement suivant.mouvementVersion

          else
            Cmd.none
        ]
    )


feuille : Vue -> Vue
feuille vue =
    case vue of
        ChapitreVue _ _ ->
            Parcours

        Presentation ->
            Reperes

        _ ->
            vue


estFeuille : Vue -> Bool
estFeuille vue =
    List.member (feuille vue) [ Parcours, Objectifs, Reperes ]


capsuleDe : Vue -> Maybe Int
capsuleDe vue =
    case vue of
        ChapitreVue id _ ->
            Just id

        _ ->
            Nothing


momentDe : Vue -> Float
momentDe vue =
    case vue of
        ChapitreVue _ moment ->
            momentPosition moment

        _ ->
            0


position : Vue -> Continuite.Point
position vue =
    { x =
        case feuille vue of
            Parcours ->
                1

            Objectifs ->
                2

            Reperes ->
                3

            Reglages ->
                4

            Apropos ->
                5

            _ ->
                0
    , y = 0
    }


momentPosition : Moment -> Float
momentPosition moment =
    case moment of
        Avant ->
            0

        Pendant ->
            1

        Entre ->
            2


animations : Modele -> Bool
animations modele =
    not modele.reducedMotion && K.note "reglage-animations" modele.carnet /= "non"


stabiliserSiNecessaire : Modele -> Modele
stabiliserSiNecessaire modele =
    if animations modele then
        modele

    else
        { modele
            | camera = position modele.vue
            , momentCamera =
                case modele.parcoursVue of
                    ChapitreVue _ moment ->
                        momentPosition moment

                    _ ->
                        0
            , preparation = 0
            , sortie = Nothing
            , momentSortie = Nothing
            , capsule = capsuleDe modele.parcoursVue
            , capsuleSortie = Nothing
            , capsulesMouvement = []
        }


subscriptions : Modele -> Sub Msg
subscriptions modele =
    Sub.batch
        [ evenement Evenement
        , Browser.Events.onResize Taille
        , if modele.compteMenu then
            Browser.Events.onKeyDown
                (D.field "key" D.string
                    |> D.andThen
                        (\key ->
                            if key == "Escape" then
                                D.succeed FermerCompte

                            else
                                D.fail "Autre touche du compte."
                        )
                )

          else
            Sub.none
        , if modele.ecran == Ouvert && animations modele && modele.preparation > 0 then
            Browser.Events.onAnimationFrameDelta PreparerMouvement

          else
            Sub.none
        ]


type alias Repere =
    { id : String, titre : String, texte : String, source : String, seance : Int }


reperes : Modele -> List Repere
reperes modele =
    let
        carnet =
            modele.carnet

        origine id =
            "Séance " ++ String.fromInt id ++ " · " ++ (Contenu.trouver id modele.chapitres).titre

        carteTexte carte =
            carte.mot
                ++ " — "
                ++ K.nomZone carte.zone
                ++ (if carte.hesitation == "" then
                        ""

                    else
                        " ; hésitation : " ++ K.nomZone carte.hesitation
                   )
                ++ (if carte.sens == "" then
                        ""

                    else
                        "\nPour moi : " ++ carte.sens
                   )

        notes =
            Dict.toList carnet.notes
                |> List.filterMap
                    (\( cle, texte ) ->
                        case String.split "-" cle of
                            id :: suite ->
                                case String.toInt id of
                                    Just numero ->
                                        if texte == "" then
                                            Nothing

                                        else
                                            Just { id = "note-" ++ cle, titre = "Séance " ++ id ++ " · " ++ String.join " " suite, texte = texte, source = origine numero, seance = numero }

                                    Nothing ->
                                        Nothing

                            _ ->
                                Nothing
                    )
    in
    List.map
        (\o ->
            { id = "objectif-" ++ String.fromInt o.id
            , titre = "Mon objectif"
            , texte =
                o.texte
                    ++ (if List.isEmpty o.historique then
                            ""

                        else
                            "\nFormulations précédentes :\n" ++ String.join "\n" o.historique
                       )
            , source = origine o.origine
            , seance = o.origine
            }
        )
        carnet.objectifs
        ++ List.map (\t -> { id = "trace-" ++ String.fromInt t.id, titre = t.titre, texte = t.texte ++ "\n" ++ String.join "\n" (List.map carteTexte t.cartes), source = origine t.seance, seance = t.seance }) carnet.traces
        ++ List.map (\e -> { id = "etape-" ++ String.fromInt e.id, titre = "Une étape dont je veux me souvenir", texte = e.quand ++ "\n" ++ e.texte ++ "\n" ++ e.montre, source = origine e.seance, seance = e.seance }) carnet.etapes
        ++ notes


selectionLisible : Modele -> List Repere
selectionLisible modele =
    List.filter (\r -> List.member r.id modele.selection) (reperes modele)


view : Modele -> Html.Html Msg
view modele =
    U.layoutWith
        { options = [ U.focusStyle { borderColor = Just C.couleurs.prune, backgroundColor = Nothing, shadow = Just { color = U.rgba255 98 52 81 0.25, offset = ( 0, 0 ), blur = 0, size = 3 } } ] }
        [ C.classe "theme-carnet", F.family [ F.typeface "-apple-system", F.typeface "BlinkMacSystemFont", F.typeface "Segoe UI", F.sansSerif ], F.size 17, F.color C.couleurs.encre, Bg.color C.couleurs.papier, width fill ]
        (U.column [ width fill, U.spacing 0 ]
            [ U.link [ C.classe "skip-link", U.htmlAttribute (A.attribute "aria-label" "Aller au contenu") ] { url = "#titre-page", label = U.text "Aller au contenu" }
            , U.el [ width fill, U.paddingXY 22 9, Bg.color C.couleurs.doux, C.classe "prototype-banner" ]
                (U.paragraph [ F.size 13, F.color C.couleurs.prune ]
                    [ U.text "PROTOTYPE · Données fictives uniquement"
                    , U.text
                        (if modele.demo then
                            "  ·  Démonstration sur cet appareil"

                         else
                            ""
                        )
                    ]
                )
            , if modele.ecran == Ouvert then
                if modele.vue == Presentation then
                    U.el [ width fill, R.mainContent, U.htmlAttribute (A.id "titre-page"), U.htmlAttribute (A.tabindex -1) ] (presentation modele)

                else
                    shell modele

              else
                U.column [ width fill, U.spacing 24 ]
                    [ enTetePublic modele
                    , U.el
                        [ width (U.maximum 1100 fill)
                        , U.htmlAttribute (A.id "titre-page")
                        , U.htmlAttribute (A.tabindex -1)
                        , U.centerX
                        , U.paddingXY
                            (if modele.largeur < 600 then
                                20

                             else
                                40
                            )
                            24
                        ]
                        (if modele.vue == Apropos then
                            pageApropos modele

                         else
                            case modele.ecran of
                                Entree ->
                                    entree modele

                                Inscription ->
                                    compteVue modele

                                Connexion ->
                                    compteVue modele

                                RecuperationCompte ->
                                    compteVue modele

                                Verrouille ->
                                    verrouVue modele

                                Ouvert ->
                                    U.none
                        )
                    ]
            ]
        )


enTetePublic : Modele -> Element Msg
enTetePublic modele =
    U.row
        [ width fill
        , U.paddingXY
            (if modele.largeur < 600 then
                20

             else
                48
            )
            22
        , U.spacing 18
        ]
        [ marque
        , U.el [ U.alignRight ] (menuCompte modele)
        ]


marque : Element Msg
marque =
    U.paragraph [ width fill, C.classe "programme-nom", F.family [ F.typeface "Georgia", F.serif ] ]
        [ U.text "ETP TSA vie amoureuse" ]


pageTitre : String -> String -> Element Msg
pageTitre sur titre =
    U.column [ width fill, U.spacing 13 ]
        [ C.surTitre sur, C.titre 1 titre ]


messages : Modele -> Element Msg
messages modele =
    U.column [ width fill, U.spacing 10 ]
        [ if modele.erreur /= "" then
            U.el [ width fill, U.padding 16, Bg.color (U.rgb255 255 237 230), B.rounded 8, U.htmlAttribute (A.attribute "role" "alert") ] (C.paragraphe modele.erreur)

          else
            U.none
        , if modele.notice /= "" then
            C.notice modele.notice

          else
            U.none
        , if modele.busy then
            C.petit "Un instant… Les calculs de protection se font sur cet appareil."

          else
            U.none
        ]


actions : List (Element Msg) -> Element Msg
actions =
    U.wrappedRow [ width fill, U.spacing 10 ]


colonnes : Modele -> Element Msg -> Element Msg -> Element Msg
colonnes modele gauche droite =
    if modele.largeur < 850 then
        U.column [ width fill, U.spacing 24 ] [ gauche, droite ]

    else
        U.row [ width fill, U.spacing 26, U.alignTop ]
            [ U.el [ width (U.fillPortion 3), U.alignTop ] gauche
            , U.el [ width (U.fillPortion 2), U.alignTop ] droite
            ]


entree : Modele -> Element Msg
entree modele =
    U.column [ width fill, U.spacing 26 ]
        [ messages modele
        , colonnes modele
            (U.column [ width fill, U.spacing 26, U.paddingXY 4 12 ]
                [ pageTitre "VOTRE COMPAGNON ENTRE LES SÉANCES" "Des relations qui me ressemblent"
                , C.paragraphe "Prendre un moment pour comprendre ce qui compte pour vous. Préparer une séance, garder vos repères, choisir un petit pas."
                , C.bouton "Ouvrir la démonstration" (Action "demo")
                , C.petit "Essayez avec le carnet fictif de Camille. Vos modifications restent dans ce navigateur et vous pouvez tout réinitialiser."
                , C.separateur
                , if modele.demoOnly then
                    C.notice "Cette prévisualisation propose la démonstration. La version complète avec comptes et synchronisation est livrée avec le projet, à lancer avec son serveur."

                  else
                    U.column [ width fill, U.spacing 14 ]
                        [ actions [ C.secondaire "Créer mon compte" (OuvrirCompte Inscription), C.discret "Me connecter" (OuvrirCompte Connexion) ]
                        , C.petit "Un identifiant suffit. Le mot de passe de compte et la phrase du coffre ont deux rôles distincts."
                        ]
                ]
            )
            (U.el [ width fill, U.paddingXY 15 8 ]
                (U.column
                    [ width fill, U.paddingXY 34 45, U.spacing 26, Bg.color C.couleurs.prune, F.color C.couleurs.blanc, B.rounded 6, C.classe "carnet-couverture" ]
                    [ U.row [ width fill ] [ U.el [ F.size 13, F.letterSpacing 3 ] (U.text "MON CARNET"), U.el [ U.alignRight, U.htmlAttribute (A.attribute "aria-hidden" "true"), F.size 28 ] (U.text "◇") ]
                    , U.el [ width fill, U.height (px 1), Bg.color (U.rgba255 255 255 255 0.35) ] U.none
                    , U.paragraph [ width fill, F.family [ F.typeface "Georgia", F.serif ], F.size 43, U.spacing 10 ] [ U.text "Ce qui compte.", U.text " Ce que j’essaie.", U.text " Ce que je garde." ]
                    , U.el [ U.paddingXY 0 24, F.size 16 ] (U.text "À mon rythme, à ma façon.")
                    , U.row [ width fill, U.spacing 10 ] [ U.el [ F.size 13, F.letterSpacing 1 ] (U.text "VIE AFFECTIVE & RELATIONNELLE"), U.el [ U.alignRight, U.htmlAttribute (A.attribute "aria-hidden" "true") ] (U.text "▤") ]
                    ]
                )
            )
        , U.column [ width fill, U.spacing 8, U.paddingXY 0 15 ]
            [ C.petit "Vos écrits ne sont pas lus par une équipe d’assistance. Vous choisissez ce que vous souhaitez montrer en séance."
            , C.petit "Ce prototype n’est pas cliniquement validé. Aucune donnée réelle de santé ou donnée intime réelle ne doit y être saisie."
            ]
        ]


compteVue : Modele -> Element Msg
compteVue modele =
    let
        inscription =
            modele.ecran == Inscription

        recuperation =
            modele.ecran == RecuperationCompte
    in
    U.column [ width (U.maximum 640 fill), U.centerX, U.spacing 22 ]
        [ C.discret "Retour à l’entrée" (OuvrirCompte Entree)
        , pageTitre "MON COMPTE"
            (if inscription then
                "Créer mon carnet"

             else if recuperation then
                "Récupérer ma connexion"

             else
                "Retrouver mon carnet"
            )
        , messages modele
        , C.panneau
            ([ C.champ "Identifiant pseudonyme" (form "pseudo" modele) (Saisie "pseudo")
             , C.petit "3 à 40 lettres, chiffres, tirets ou underscores. Aucune adresse e-mail n’est demandée."
             , C.secret
                (if recuperation then
                    "Nouveau mot de passe de connexion"

                 else
                    "Mot de passe de connexion"
                )
                (form "password" modele)
                (Saisie "password")
             , C.petit "12 caractères minimum. Ce mot de passe se vérifie sur le serveur et ne déchiffre pas le carnet."
             ]
                ++ (if inscription then
                        [ C.separateur
                        , C.titre 2 "La phrase de mon coffre"
                        , C.paragraphe "Choisissez une phrase différente du mot de passe. Elle reste sur votre appareil et permet d’ouvrir votre carnet."
                        , C.secret "Phrase de coffre · 12 caractères minimum" (form "phrase" modele) (Saisie "phrase")
                        , C.secret "Confirmer la phrase de coffre" (form "phrase-confirm" modele) (Saisie "phrase-confirm")
                        , C.petit "Un kit de récupération sera généré sur cet appareil. Sans la phrase ni le secret du kit, personne ne pourra récupérer vos textes."
                        , C.coche "Je n’utilise que des données fictives pour ce prototype."
                            (form "fictif" modele == "oui")
                            (\v ->
                                Saisie "fictif"
                                    (if v then
                                        "oui"

                                     else
                                        "non"
                                    )
                            )
                        ]

                    else if recuperation then
                        [ C.secret "Code de récupération du compte · partie 1 du kit" (form "auth-code" modele) (Saisie "auth-code")
                        , C.petit "Utilisez uniquement le code de compte. Le secret du coffre ne doit jamais être saisi ici. Modifier la connexion ne rend pas le carnet lisible."
                        ]

                    else
                        []
                   )
                ++ [ C.bouton
                        (if inscription then
                            "Créer mon compte et mon coffre"

                         else if recuperation then
                            "Changer le mot de passe de connexion"

                         else
                            "Me connecter"
                        )
                        (Action
                            (if inscription then
                                "register"

                             else if recuperation then
                                "resetAuth"

                             else
                                "login"
                            )
                        )
                   , if not inscription && not recuperation then
                        C.discret "J’ai oublié mon mot de passe de connexion" (OuvrirCompte RecuperationCompte)

                     else
                        U.none
                   ]
            )
        , C.petit "La création d’un compte ne constitue pas un consentement à une recherche ou à un suivi clinique. Ce carnet ne transmet aucun texte à une équipe."
        ]


verrouVue : Modele -> Element Msg
verrouVue modele =
    U.column [ width (U.maximum 650 fill), U.centerX, U.spacing 23 ]
        [ pageTitre "COFFRE VERROUILLÉ" "Votre carnet est fermé"
        , C.paragraphe "Les notes, cartes et objectifs ont été retirés de l’écran."
        , messages modele
        , if modele.demo then
            C.panneau
                [ C.titre 2 "Reprendre l’essai"
                , C.paragraphe "La démo utilise une clé propre à ce navigateur. Son verrouillage masque les données fictives ; il ne demande pas une phrase."
                , C.bouton "Reprendre la démonstration" (Action "demo")
                ]

          else
            C.panneau
                [ C.coche "Utiliser le secret de récupération du coffre"
                    (form "recovery" modele == "oui")
                    (\v ->
                        Saisie "recovery"
                            (if v then
                                "oui"

                             else
                                "non"
                            )
                    )
                , C.secret
                    (if form "recovery" modele == "oui" then
                        "Secret du coffre · partie 2 du kit"

                     else
                        "Phrase de coffre"
                    )
                    (form "secret" modele)
                    (Saisie "secret")
                , C.bouton "Ouvrir mon coffre" (Action "unlock")
                , C.petit "Ce secret est utilisé seulement sur cet appareil. Il n’est pas envoyé au serveur."
                , C.discret "Je n’ai plus ma phrase ni mon kit" (Demander "newVault")
                , C.secondaire "Exporter la copie chiffrée disponible" (Action "encryptedExport")
                ]
        , if modele.authRecupere /= "" then
            C.panneau [ C.titre 2 "Nouveau code de compte", C.paragraphe "Conservez ce nouveau code : l’ancien a été révoqué.", codeSecret modele.authRecupere ]

          else
            U.none
        , if modele.confirmation == "newVault" then
            C.panneau
                [ C.titre 2 "Commencer un autre coffre"
                , C.paragraphe "Sans phrase ni secret de récupération, le contenu ancien ne peut pas être déchiffré. Il restera conservé sous forme chiffrée et pourra être exporté."
                , C.secret "Phrase du nouveau coffre" (form "new-vault-phrase" modele) (Saisie "new-vault-phrase")
                , actions [ C.bouton "Créer un nouveau coffre sans effacer l’ancien" (Action "newVault"), C.secondaire "Annuler" Annuler ]
                ]

          else
            U.none
        , C.petit "Masquer ne supprime pas l’historique du navigateur, le presse-papiers ou les captures déjà prises."
        ]


codeSecret : String -> Element Msg
codeSecret texte =
    U.paragraph [ width fill, F.family [ F.monospace ], F.size 15, U.padding 14, Bg.color C.couleurs.papier, B.rounded 6, C.classe "secret-code" ] [ U.text texte ]


shell : Modele -> Element Msg
shell modele =
    U.column [ width fill, U.spacing 0 ]
        [ enTeteCarnet modele
        , U.column
            [ width (U.maximum 1220 fill)
            , U.centerX
            , U.paddingXY
                (if modele.largeur < 600 then
                    12

                 else
                    38
                )
                26
            , U.spacing 0
            , C.classe "classeur"
            ]
            [ if estFeuille modele.vue then
                navigation modele

              else
                U.none
            , U.column
                [ width fill
                , U.padding
                    (if modele.largeur < 600 then
                        16

                     else
                        32
                    )
                , U.spacing 22
                , C.classe
                    (if estFeuille modele.vue then
                        "classeur-papier"

                     else
                        "carnet-annexe"
                    )
                , R.mainContent
                ]
                [ messages modele
                , if modele.avertissement then
                    C.notice "Le carnet se verrouillera dans moins de 30 secondes. Une touche ou un clic prolonge ce temps ; votre brouillon est conservé chiffré."

                  else
                    U.none
                , kitVue modele
                , conflitVue modele
                , chemin modele
                , fenetreCarnet modele
                , U.el [ width fill, U.paddingXY 0 18 ] (C.petit "Tout est facultatif. Vous pouvez laisser une rubrique vide, la reprendre ou la mettre de côté.")
                , if estFeuille modele.vue then
                    C.discret "Retrouver les onglets" RetrouverPlan

                  else
                    U.none
                , U.el [ C.classe "ancrage-reserve", U.htmlAttribute (A.attribute "aria-hidden" "true") ] U.none
                ]
            ]
        ]


nomEspace : Vue -> String
nomEspace vue =
    case vue of
        Parcours ->
            "Mon parcours"

        ChapitreVue id _ ->
            "Séance " ++ String.fromInt id

        Objectifs ->
            "Mes objectifs"

        Reperes ->
            "Mes repères"

        Reglages ->
            "Mes réglages"

        Apropos ->
            "À propos & sources"

        Presentation ->
            "Ma sélection"


roleEspace : Vue -> String
roleEspace vue =
    case vue of
        Parcours ->
            "Choisir parmi les 15 étapes"

        ChapitreVue _ _ ->
            "Préparer, expérimenter, reprendre"

        Objectifs ->
            "Ce qui me guide dans la durée"

        Reperes ->
            "Ce que je garde et choisis de partager"

        Reglages ->
            "Mon confort et ma confidentialité"

        Apropos ->
            "Les contenus, les sources et les limites"

        Presentation ->
            "Ce que je choisis de montrer"


memeEspace : Vue -> Vue -> Bool
memeEspace a b =
    feuille a == feuille b


navigation : Modele -> Element Msg
navigation modele =
    Continuite.onglets
        (List.map
            (\vue ->
                let
                    destination =
                        if vue == Parcours then
                            modele.parcoursVue

                        else
                            vue
                in
                { id = String.fromInt (round (position vue).x)
                , libelle = nomEspace vue
                , court =
                    case vue of
                        Parcours ->
                            "Parcours"

                        Objectifs ->
                            "Objectifs"

                        _ ->
                            "Repères"
                , selectionne = feuille modele.vue == vue
                , choisir = ChangerFeuille destination
                , clavier = OngletClavier destination
                }
            )
            [ Parcours, Objectifs, Reperes ]
        )


nomMoment : Moment -> String
nomMoment moment =
    case moment of
        Avant ->
            "Se préparer"

        Pendant ->
            "Pendant la séance"

        Entre ->
            "Se préparer"


roleMoment : Moment -> String
roleMoment moment =
    case moment of
        Avant ->
            "Je me prépare"

        Pendant ->
            "J’expérimente et je retiens"

        Entre ->
            "Je comprends, je poursuis, je fais le point"


chemin : Modele -> Element Msg
chemin modele =
    U.column [ width fill, U.spacing 10, C.classe "carnet-chemin" ]
        [ U.wrappedRow [ width fill, U.spacing 6, R.navigation, U.htmlAttribute (A.attribute "aria-label" "Ma position dans le carnet") ]
            ([ C.discret
                (if not (estFeuille modele.vue) then
                    "Revenir au carnet"

                 else
                    "Classeur"
                )
                (Naviguer
                    (if not (estFeuille modele.vue) then
                        modele.carnetVue

                     else
                        Parcours
                    )
                )
             ]
                ++ (case modele.vue of
                        ChapitreVue _ _ ->
                            [ C.petit "› Mon parcours" ]

                        _ ->
                            [ C.petit ("› " ++ nomEspace modele.vue) ]
                   )
            )
        , case modele.retourSeance of
            Just (ChapitreVue id moment) ->
                C.secondaire ("Revenir à la séance " ++ String.fromInt id ++ " · " ++ nomMoment moment) (Naviguer (ChapitreVue id moment))

            _ ->
                U.none
        ]


vueContenu : Modele -> Vue -> Element Msg
vueContenu modele vue =
    case vue of
        Parcours ->
            pageParcours modele

        ChapitreVue _ _ ->
            pageParcours modele

        Objectifs ->
            pageObjectifs modele

        Reperes ->
            pageReperes modele

        Reglages ->
            pageReglages modele

        Apropos ->
            pageApropos modele

        Presentation ->
            U.none


fenetreCarnet : Modele -> Element Msg
fenetreCarnet modele =
    let
        panneau vue =
            { cle = nomEspace vue
            , position = position vue
            , ouvert = feuille modele.vue == vue
            , contenu =
                if feuille modele.vue == vue || Maybe.map feuille modele.sortie == Just vue then
                    vueContenu modele vue

                else
                    C.panneau [ C.titre 1 (nomEspace vue), C.paragraphe (roleEspace vue) ]
            }
    in
    Continuite.feuilles
        { camera = modele.camera, mouvement = animations modele && modele.sortie /= Nothing, anime = animations modele && modele.sortie /= Nothing, termine = TransitionTerminee "feuille" }
        (List.map panneau [ Parcours, Objectifs, Reperes, Reglages, Apropos ])


enTeteCarnet : Modele -> Element Msg
enTeteCarnet modele =
    U.column [ width fill, U.spacing 0, C.classe "bandeau-carnet", Bg.color C.couleurs.blanc, B.widthEach { top = 0, bottom = 1, left = 0, right = 0 }, B.color C.couleurs.ligne ]
        [ U.row [ width fill, U.paddingXY 20 14, U.spacing 16 ]
            [ U.el [ width fill, C.classe "marque-carnet" ] marque
            , U.el [ U.alignRight ] (menuCompte modele)
            ]
        , U.el [ C.classe "save-status statut-discret", U.htmlAttribute (A.attribute "role" "status"), U.htmlAttribute (A.attribute "aria-live" "polite") ] (C.petit (sauvegardeTexte modele))
        , if modele.menu then
            U.column [ width fill, U.padding 24, U.spacing 12, C.classe "explication-classeur" ]
                [ C.titre 2 "Les feuilles de mon classeur"
                , C.paragraphe "Chaque onglet ouvre une autre feuille. Le parcours réunit les douze capsules de chapitre et les trois bilans. Ouvrir une capsule l’agrandit sur cette même feuille ; les autres restent autour. Je peux la refermer pour retrouver l’ensemble."
                , C.paragraphe "La feuille des objectifs donne une direction et garde les défis disponibles dans la durée. Les expérimentations restent liées aux séances. La feuille des repères réunit les traces, les formulations et les étapes que je souhaite garder. Je choisis ce que je partage."
                , C.petit "Je peux changer de feuille puis retrouver la capsule et son moment. Les mêmes feuilles et les mêmes contenus sont disponibles sans animation dans Mes réglages. Les séances suivantes deviennent disponibles au fil du parcours."
                , C.discret "Refermer l’explication" AfficherMenu
                ]

          else
            U.none
        ]


menuCompte : Modele -> Element Msg
menuCompte modele =
    U.column [ C.classe "compte-zone", U.spacing 0 ]
        [ U.html <|
            Html.button
                [ A.id "compte-commande"
                , A.class "compte-commande"
                , A.attribute "aria-label" "Mon espace"
                , A.title "Mon espace"
                , A.attribute "aria-expanded"
                    (if modele.compteMenu then
                        "true"

                     else
                        "false"
                    )
                , A.attribute "aria-controls" "compte-options"
                , Events.onClick AfficherCompte
                ]
                [ Html.span [ A.class "compte-avatar", A.attribute "aria-hidden" "true" ] [] ]
        , if modele.compteMenu then
            U.column [ C.classe "compte-options", U.spacing 0, width (px 280), U.padding 12, U.htmlAttribute (A.id "compte-options"), R.navigation, U.htmlAttribute (A.attribute "aria-label" "Compte et site") ]
                [ U.html (Html.button [ A.class "compte-fond", A.tabindex -1, A.attribute "aria-label" "Fermer le menu du compte", Events.onClick FermerCompte ] [])
                , if modele.ecran == Ouvert then
                    C.discret "Mes réglages" (Naviguer Reglages)

                  else if modele.ecran == Verrouille then
                    C.petit "Ouvrez votre coffre pour retrouver vos réglages."

                  else if modele.demoOnly then
                    C.petit "Cette version propose la démonstration sur cet appareil."

                  else
                    C.discret "Me connecter" (OuvrirCompte Connexion)
                , if modele.ecran == Ouvert then
                    C.discret "Masquer / verrouiller" (Action "lock")

                  else
                    U.none
                , C.discret "À propos & sources" (Naviguer Apropos)
                , if modele.ecran == Ouvert then
                    C.discret "Comprendre le classeur" AfficherMenu

                  else
                    U.none
                , if modele.ecran == Ouvert || modele.ecran == Verrouille then
                    C.discret "Me déconnecter" (Action "logout")

                  else
                    U.none
                ]

          else
            U.none
        ]


sauvegardeTexte : Modele -> String
sauvegardeTexte modele =
    case modele.sauvegarde of
        "saving" ->
            "Chiffrement en cours…"

        "device" ->
            "✓ Chiffré sur cet appareil · démo"

        "pending" ->
            "✓ Chiffré sur cet appareil · synchronisation en attente"

        "synced" ->
            "✓ Synchronisé · coffre ouvert"

        "conflict" ->
            "Deux versions à départager · copie locale conservée"

        "error" ->
            "Sauvegarde impossible · réessayer"

        _ ->
            "Coffre ouvert"


kitVue : Modele -> Element Msg
kitVue modele =
    case modele.kit of
        Just ( _, _, _ ) ->
            C.panneau
                [ C.surTitre "À CONSERVER MAINTENANT"
                , C.titre 2 "Votre kit de récupération"
                , C.paragraphe "Il contient deux secrets différents : un code pour retrouver la connexion et un secret pour ouvrir le coffre. Téléchargez-le et gardez-le en dehors de ce carnet, dans un endroit sûr."
                , actions [ C.bouton "Télécharger mon kit" (Action "kit"), C.secondaire "J’ai conservé mon kit" (Action "dismissKit") ]
                , C.petit "Le kit reste en mémoire jusqu’au verrouillage. Le serveur ne pourra pas vous redonner le secret du coffre."
                ]

        Nothing ->
            if modele.coffreRecupere /= "" then
                C.panneau [ C.titre 2 "Secret du nouveau coffre", C.paragraphe "Conservez ce secret dans un endroit sûr, hors du carnet.", codeSecret modele.coffreRecupere ]

            else
                U.none


conflitVue : Modele -> Element Msg
conflitVue modele =
    if modele.sauvegarde == "conflict" then
        C.panneau
            [ C.titre 2 "Deux versions de votre carnet"
            , C.paragraphe "Un autre onglet ou appareil a envoyé une modification. Votre version reste chiffrée sur cet appareil. Choisissez la version à poursuivre ; l’autre sera conservée comme copie chiffrée locale."
            , actions [ C.secondaire "Charger la version du serveur" (Action "loadRemote"), C.secondaire "Conserver ma version comme nouvelle version" (Demander "replaceRemote") ]
            , if modele.confirmation == "replaceRemote" then
                U.column [ width fill, U.spacing 12 ] [ C.paragraphe "La version du serveur sera conservée sur cet appareil avant son remplacement.", actions [ C.bouton "Remplacer explicitement la version serveur" (Action "replaceRemote"), C.discret "Annuler" Annuler ] ]

              else
                U.none
            ]

    else if modele.sauvegarde == "pending" || modele.sauvegarde == "error" then
        U.column [ width fill, U.spacing 10 ]
            [ if modele.sauvegardeMessage /= "" then
                C.notice modele.sauvegardeMessage

              else
                U.none
            , C.discret "Réessayer la synchronisation" (Action "sync")
            ]

    else
        U.none


pastille : String -> Element Msg
pastille texte =
    U.el [ width (px 48), U.height (px 48), Bg.color C.couleurs.doux, B.rounded 24, F.color C.couleurs.prune, F.size 22, F.family [ F.typeface "Georgia", F.serif ] ] (U.el [ U.centerX, U.centerY ] (U.text texte))


pageParcours : Modele -> Element Msg
pageParcours modele =
    let
        capsule chapitre =
            let
                actuel =
                    case modele.parcoursVue of
                        ChapitreVue id moment ->
                            if id == chapitre.id then
                                Just moment

                            else
                                Nothing

                        _ ->
                            Nothing

                sortant =
                    case modele.capsuleSortie of
                        Just ( id, moment ) ->
                            if id == chapitre.id then
                                Just moment

                            else
                                Nothing

                        _ ->
                            Nothing

                lisible =
                    actuel /= Nothing

                disponible =
                    chapitre.id <= modele.carnet.etape + 1

                ouverte =
                    disponible && modele.capsule == Just chapitre.id

                enPreparation =
                    modele.preparation
                        > 0
                        && modele.capsule
                        /= capsuleDe modele.parcoursVue
                        && List.member (Just chapitre.id) [ modele.capsule, capsuleDe modele.parcoursVue ]

                momentAffiche =
                    Maybe.withDefault Avant
                        (if lisible then
                            actuel

                         else
                            sortant
                        )

                contenu =
                    pageChapitre
                        (if lisible then
                            modele

                         else
                            { modele | vue = ChapitreVue chapitre.id momentAffiche, momentCamera = momentPosition momentAffiche, momentSortie = Nothing, approfondi = False, sources = False }
                        )
                        chapitre
                        momentAffiche

                ouvrir =
                    if lisible then
                        Parcours

                    else
                        ChapitreVue chapitre.id Avant
            in
            U.column [ width fill, U.spacing 0 ]
                [ U.column
                    [ width fill
                    , U.spacing 0
                    , C.classe
                        (if disponible then
                            "capsule"

                         else
                            "capsule capsule-indisponible"
                        )
                    , U.htmlAttribute (A.id ("capsule-" ++ String.fromInt chapitre.id))
                    , U.htmlAttribute
                        (A.attribute "data-open"
                            (if ouverte then
                                "true"

                             else
                                "false"
                            )
                        )
                    , U.htmlAttribute (A.attribute "data-nature" chapitre.nature)
                    ]
                    [ U.column
                        [ width fill
                        , U.padding
                            (if modele.largeur < 600 then
                                16

                             else
                                22
                            )
                        , U.spacing 12
                        , C.classe "capsule-entete"
                        ]
                        [ U.row [ width fill, U.spacing 14, U.alignTop ]
                            [ pastille (String.fromInt chapitre.id)
                            , U.column [ width fill, U.spacing 7 ]
                                [ if disponible then
                                    Continuite.titreCapsule { id = chapitre.id, ouverte = ouverte, lisible = lisible, anime = animations modele, choisir = Naviguer ouvrir } chapitre.titre

                                  else
                                    U.column [ U.spacing 6, U.htmlAttribute (A.attribute "aria-disabled" "true") ]
                                        [ C.titre 2 chapitre.titre, C.petit "Séance à venir · pas encore disponible" ]
                                ]
                            ]
                        ]
                    , Continuite.capsule { id = chapitre.id, ouverte = ouverte, lisible = lisible, anime = animations modele, mouvement = enPreparation || List.member chapitre.id modele.capsulesMouvement, termine = CapsuleTerminee chapitre.id }
                        (U.el
                            [ width fill
                            , U.paddingXY
                                (if modele.largeur < 600 then
                                    16

                                 else
                                    26
                                )
                                20
                            ]
                            contenu
                        )
                    ]
                ]
    in
    U.column [ width fill, U.spacing 18 ]
        [ C.titre 1 "Mon parcours"
        , U.column [ width fill, U.spacing 14, C.classe "feuille-parcours" ] (List.map capsule modele.chapitres)
        ]


pageChapitre : Modele -> Chapitre -> Moment -> Element Msg
pageChapitre modele chapitre moment =
    U.column
        ([ width fill, U.spacing 23 ]
            ++ (if chapitre.nature == "chapitre" then
                    [ U.htmlAttribute (A.attribute "data-swipe-moment" (String.fromInt chapitre.id)) ]

                else
                    []
               )
        )
        [ if chapitre.nature == "bilan" then
            C.petit chapitre.sousTitre

          else
            U.none
        , C.paragraphe chapitre.objectif
        , if List.member chapitre.id modele.carnet.consultations then
            C.petit "Consultation terminée"

          else
            U.none
        , if chapitre.id == modele.carnet.etape + 1 then
            C.secondaire "Commencer cette séance" (ChoisirEtape chapitre.id)

          else
            C.petit
                (if chapitre.id == modele.carnet.etape then
                    "Ma séance actuelle"

                 else
                    "Séance passée"
                )
        , if chapitre.id == modele.carnet.etape + 1 then
            avantVue modele chapitre

          else if chapitre.nature == "bilan" then
            bilanVue modele chapitre

          else
            U.column [ width fill, U.spacing 24 ]
                [ U.column [ width fill, U.spacing 8, C.classe "moments-navigation", R.navigation, U.htmlAttribute (A.attribute "aria-label" "Les deux temps de cette séance") ]
                    [ Continuite.moments
                        { id = "moment-capsule-" ++ String.fromInt chapitre.id }
                        (List.map
                            (\m ->
                                { libelle = nomMoment m
                                , selectionne = moment == m
                                , choisir = Naviguer (ChapitreVue chapitre.id m)
                                }
                            )
                            [ Avant, Pendant ]
                        )
                    , Continuite.ruban modele.momentCamera 2 380 (animations modele)
                    ]
                , momentsVue modele chapitre moment
                ]
        , C.separateur
        , actions [ C.secondaire "Terminer ma consultation" (ConsultationTerminee chapitre.id), C.discret "Sources de cette séance" ToggleSources ]
        , if modele.sources then
            C.panneau [ C.titre 2 "D’où viennent ces contenus ?", C.petit ("Intitulé et objectif : " ++ chapitre.source ++ " · Contenu fourni par l’équipe, version de travail."), C.petit "Sept rubriques : Principes pédagogiques Sexo.docx · Le carnet de bord · paragraphes 307–313.", C.petit (chapitre.statutLecture ++ " · Les lectures, questions et petits pas sont des adaptations contextualisées, pas des résultats scientifiques."), C.petit "Pour la séance 1 : Module Sexo bilan.xlsx · Exo Séance 1 · C3:G4, C7:E10. Cartes-mots et situations : propositions du POC.", C.petit "Vérification des pièces originales : 6 octobre 2026. Les documents internes ne sont pas proposés en téléchargement." ]

          else
            U.none
        , actions
            [ if chapitre.id > 0 then
                C.discret "Séance précédente" (Naviguer (ChapitreVue (chapitre.id - 1) Avant))

              else
                U.none
            , if chapitre.id < 14 && chapitre.id <= modele.carnet.etape then
                C.discret "Préparer la séance suivante" (Naviguer (ChapitreVue (chapitre.id + 1) Avant))

              else
                U.none
            ]
        ]


momentsVue : Modele -> Chapitre -> Moment -> Element Msg
momentsVue modele chapitre actuel =
    let
        panneau moment =
            { cle = nomMoment moment
            , position = { x = momentPosition moment, y = 0 }
            , ouvert = moment == actuel
            , contenu =
                case moment of
                    Avant ->
                        avantVue modele chapitre

                    Pendant ->
                        pendantVue modele chapitre

                    Entre ->
                        entreVue modele chapitre
            }
    in
    Continuite.plan
        { camera =
            { x =
                if memeEspace modele.vue (ChapitreVue chapitre.id actuel) then
                    modele.momentCamera

                else
                    momentPosition actuel
            , y = 0
            }
        , largeur =
            toFloat
                (min 1220 modele.largeur
                    - (if modele.largeur < 600 then
                        88

                       else
                        192
                      )
                )
                + 48
        , hauteur = 0
        , mouvement = animations modele && modele.momentSortie /= Nothing
        , anime = animations modele && modele.momentSortie /= Nothing
        , duree = 380
        , termine = TransitionTerminee "moment"
        , identifiant = "moment-capsule-" ++ String.fromInt chapitre.id
        }
        (List.map panneau [ Avant, Pendant ])


noteChamp : Modele -> Int -> String -> String -> Element Msg
noteChamp modele seance cle libelle =
    let
        id =
            String.fromInt seance ++ "-" ++ cle
    in
    C.zone libelle (K.note id modele.carnet) (Noter id)


avantVue : Modele -> Chapitre -> Element Msg
avantVue modele chapitre =
    U.column [ width fill, U.spacing 24 ]
        [ colonnes modele
            (C.panneau
                [ C.titre 2 "Je me prépare"
                , C.paragraphe chapitre.intro
                , C.titre 3 "L’essentiel"
                , U.column [ width fill, U.spacing 16 ]
                    (List.indexedMap (\index texte -> U.row [ width fill, U.spacing 12, U.alignTop ] [ U.el [ F.color C.couleurs.prune, F.bold, U.alignTop ] (U.text (String.fromInt (index + 1) ++ ".")), C.paragraphe texte ]) chapitre.essentiel)
                , C.petit chapitre.statutLecture
                , C.discret
                    (if modele.approfondi then
                        "Refermer l’approfondissement"

                     else
                        "Pour aller plus loin · facultatif"
                    )
                    ToggleApprofondissement
                , if modele.approfondi then
                    C.notice chapitre.approfondissement

                  else
                    U.none
                ]
            )
            (U.column [ width fill, U.spacing 20 ]
                [ C.panneau
                    [ C.surTitre "À MA FAÇON"
                    , C.titre 2 "Une question à garder"
                    , C.paragraphe chapitre.question
                    , noteChamp modele chapitre.id "question" "Ma question pour la séance · facultatif"
                    , C.petit "Je choisis si je souhaite la partager."
                    ]
                , C.panneau [ C.titre 2 "Quelques mots pour moi", noteChamp modele chapitre.id "note" "Ma note personnelle · facultatif" ]
                ]
            )
        , U.link [] { url = "/cours/" ++ String.fromInt chapitre.id ++ ".html", label = C.paragraphe "Lire le support de préparation en HTML" }
        , U.link [] { url = "/cours/" ++ String.fromInt chapitre.id ++ ".pdf", label = C.paragraphe "Télécharger le support en PDF" }
        , if chapitre.id <= modele.carnet.etape then
            C.secondaire "Passer à Pendant la séance" (Naviguer (ChapitreVue chapitre.id Pendant))

          else
            C.petit "Le contenu Pendant la séance sera disponible lorsque vous commencerez cette séance."
        , if chapitre.id > 0 then
            U.column [ width fill, U.spacing 18 ]
                [ C.titre 2 "Depuis la séance précédente"
                , entreVue modele (Contenu.trouver (chapitre.id - 1) modele.chapitres)
                ]

          else
            U.none
        ]


pendantVue : Modele -> Chapitre -> Element Msg
pendantVue modele chapitre =
    U.column [ width fill, U.spacing 24 ]
        [ C.titre 2 "J’expérimente"
        , if chapitre.id == 1 then
            paysageVue modele

          else
            C.panneau
                [ C.titre 3 chapitre.intro
                , C.paragraphe ("Proposition numérique : partir d’une situation réelle ou imaginaire. " ++ chapitre.question)
                , C.petit "Cette activité contextualisée est une adaptation du POC à valider. Elle peut se faire seul·e et être laissée de côté."
                , noteChamp modele chapitre.id "activite" "La trace de mon activité · facultatif"
                , C.secondaire "Garder cette trace dans Mes repères" (GarderTrace chapitre.id)
                ]
        , C.panneau
            [ C.titre 2 "Ce que j’en retiens"
            , noteChamp modele chapitre.id "retiens" "Aujourd’hui, je retiens…"
            , noteChamp modele chapitre.id "capable" "Aujourd’hui, je me sens davantage capable de…"
            , C.petit "Je peux aussi laisser ces phrases ouvertes."
            ]
        , U.link [] { url = "/sondage.html", label = C.paragraphe "Participer à un sondage local ou en animer un" }
        , if chapitre.id < 14 then
            C.secondaire "Préparer la séance suivante" (Naviguer (ChapitreVue (chapitre.id + 1) Avant))

          else
            U.none
        ]


entreVue : Modele -> Chapitre -> Element Msg
entreVue modele chapitre =
    let
        experiences =
            List.filter (\x -> x.seance == chapitre.id || x.seance == chapitre.id - 1) modele.carnet.experiences

        actuelles =
            List.filter (\x -> x.seance == chapitre.id) modele.carnet.experiences
    in
    U.column [ width fill, U.spacing 24 ]
        [ C.panneau
            [ C.titre 2 "Je comprends mieux"
            , C.paragraphe (String.join " " chapitre.essentiel)
            , C.petit chapitre.statutLecture
            , noteChamp modele chapitre.id "comprendre" "Le repère que je souhaite garder · facultatif"
            , C.discret
                (if modele.approfondi then
                    "Refermer l’approfondissement"

                 else
                    "Pour aller plus loin · facultatif"
                )
                ToggleApprofondissement
            , if modele.approfondi then
                C.notice chapitre.approfondissement

              else
                U.none
            ]
        , C.panneau
            [ C.titre 2 "Ma progression"
            , C.paragraphe "Mes défis restent disponibles d’une séance à l’autre. Je peux les poursuivre, les ajuster ou les mettre de côté."
            , if List.isEmpty modele.carnet.defis then
                C.petit "Je peux commencer par un objectif, sans obligation de choisir un défi aujourd’hui."

              else
                U.column [ width fill, U.spacing 12 ] (List.map (\d -> U.column [ width fill, U.spacing 8 ] [ C.paragraphe d.texte, C.petit (statutDefi d.statut) ]) (K.actifs modele.carnet))
            , C.secondaire "Retrouver mes objectifs et mes défis" (Naviguer Objectifs)
            ]
        , U.column [ width fill, U.spacing 16 ]
            [ C.titre 2 "Ma prochaine expérimentation"
            , C.paragraphe chapitre.petitPas
            , C.petit "Proposition facultative du POC. Je peux choisir autre chose, imaginer une situation ou ne rien préparer."
            , actions
                [ if List.isEmpty actuelles then
                    C.bouton "Préparer mon petit pas" (ExperienceCreer chapitre.id True)

                  else
                    U.none
                , if List.length actuelles == 1 then
                    C.secondaire "Ajouter une seconde expérimentation · facultatif" (ExperienceCreer chapitre.id False)

                  else
                    U.none
                ]
            ]
        , U.column [ width fill, U.spacing 22 ] (List.map (experienceVue modele) experiences)
        , if List.isEmpty experiences then
            C.panneau [ C.titre 2 "Je fais le point", C.paragraphe "Le retour sur une expérimentation apparaîtra avec le petit pas que vous aurez choisi. Il n’est pas nécessaire d’en réaliser un pour consulter la séance suivante." ]

          else
            U.none
        ]


bilanVue : Modele -> Chapitre -> Element Msg
bilanVue modele chapitre =
    U.column [ width fill, U.spacing 24 ]
        [ C.panneau
            [ C.titre 2
                (if chapitre.id == 0 then
                    "Mon point de départ"

                 else if chapitre.id == 13 then
                    "Mes expériences récentes"

                 else
                    "Mon point d’arrivée"
                )
            , C.paragraphe (String.join " " chapitre.essentiel)
            , noteChamp modele chapitre.id "bilan-situation" "Ce qui me convient aujourd’hui"
            , noteChamp modele
                chapitre.id
                "bilan-envies"
                (if chapitre.id == 0 then
                    "Ce que j’aimerais voir évoluer"

                 else
                    "Ce qui a changé ou ce que je souhaite poursuivre"
                )
            , noteChamp modele chapitre.id "bilan-ressources" "Mes ressources, mes besoins ou mes questions"
            , C.petit "Ces questions sont une adaptation du POC. Les éventuelles échelles et le bilan professionnel restent en séance ; aucun questionnaire de besoins n’est obligatoire ici."
            ]
        , actions [ C.secondaire "Retrouver mes objectifs" (Naviguer Objectifs), C.secondaire "Retrouver mes étapes importantes" (Naviguer Reperes) ]
        ]


experienceVue : Modele -> K.Experience -> Element Msg
experienceVue modele x =
    let
        champ cle libelle valeur =
            C.zone libelle valeur (ExperienceChamp x.id cle)
    in
    C.panneau
        [ C.surTitre
            ((if x.principale then
                "MON PETIT PAS PRINCIPAL"

              else
                "MA SECONDE EXPÉRIMENTATION"
             )
                ++ " · PRÉPARÉ EN SÉANCE "
                ++ String.fromInt x.seance
            )
        , C.choix "Le défi que je souhaite explorer" (( "0", "Sans défi pour le moment" ) :: List.map (\d -> ( String.fromInt d.id, d.texte )) modele.carnet.defis) (String.fromInt x.defi) (ExperienceChamp x.id "defi")
        , champ "quoi" "Qu’est-ce que je vais essayer ?" x.quoi
        , C.champ "Quand et où ?" x.quand (ExperienceChamp x.id "quand")
        , champ "comment" "Comment, et avec quelles ressources ?" x.comment
        , champ "obstacle" "Un obstacle possible et une adaptation" x.obstacle
        , champ "observer" "Ce que je souhaite observer" x.observer
        , C.separateur
        , C.titre 2 "Je fais le point"
        , C.choix "Où j’en suis avec cet essai" [ ( "préparée", "Préparé · je n’ai pas encore fait le point" ), ( "réalisée", "J’ai essayé" ), ( "pas réalisé", "Pas réalisé" ), ( "pas d’occasion", "Pas d’occasion" ), ( "je ne souhaite plus le faire", "Je ne souhaite plus le faire" ), ( "je préfère ne pas répondre", "Je préfère ne pas répondre" ) ] x.statut (ExperienceChamp x.id "statut")
        , C.petit "Ces choix sont des adaptations du POC. Une absence de réalisation n’est pas un échec."
        , champ "essaye" "Ce que j’ai essayé · ou ce qui m’en a empêché" x.essaye
        , champ "marque" "Ce qui m’a marqué" x.marque
        , champ "appris" "Ce que j’en apprends" x.appris
        , champ "suite" "Ce que je souhaite poursuivre ou modifier" x.suite
        , C.discret "Effacer cette expérimentation" (ExperienceSupprimer x.id)
        ]


paysageVue : Modele -> Element Msg
paysageVue modele =
    U.column [ width fill, U.spacing 22 ]
        [ C.panneau
            [ C.surTitre "ACTIVITÉ · MES REPÈRES RELATIONNELS"
            , C.titre 2 "Je compose mon paysage"
            , C.paragraphe "Des mots pour ce qui compte pour moi. Je peux les placer, préciser leur sens et hésiter entre deux espaces."
            , C.petit "Ce paysage explore mes propres repères. Il ne sert pas à noter des partenaires."
            , actions (List.map (\( id, texte ) -> C.onglet (modele.paysageEtape == id) (String.fromInt id ++ " · " ++ texte) (PaysagePhase id)) [ ( 1, "Construire" ), ( 2, "Hiérarchiser" ), ( 3, "Confronter" ), ( 4, "Garder une trace" ) ])
            , Continuite.ruban (toFloat (modele.paysageEtape - 1)) 4 320 (animations modele)
            ]
        , if modele.paysageEtape == 1 then
            C.panneau
                [ C.titre 3 "Choisir quelques cartes"
                , C.petit "Les cartes-mots sont des propositions numériques. Vous pouvez écrire les vôtres."
                , actions (List.map (\mot -> C.secondaire ("＋ " ++ mot) (AjouterCarte mot)) [ "La confiance", "Du temps pour moi", "Le calme", "La réciprocité", "L’humour", "La franchise", "La tendresse", "Des intérêts partagés", "Mon rythme", "La proximité" ])
                , C.champ "Un mot ou une expression à moi" (form "carte-mot" modele) (Saisie "carte-mot")
                , C.secondaire "Ajouter ma carte" (AjouterCarte "")
                ]

          else if modele.paysageEtape == 2 then
            C.notice "Je sélectionne une carte, puis je choisis « Placer dans… ». Je peux ajouter une seconde zone si j’hésite. Aucun glisser-déposer n’est nécessaire."

          else if modele.paysageEtape == 3 then
            confrontationVue modele

          else
            C.panneau
                [ C.titre 3 "Une photographie de mes repères du moment"
                , noteChamp modele 1 "activite" "Ce qui est essentiel, mes limites et ce qui reste à explorer"
                , C.bouton "Conserver cette version du paysage" (GarderTrace 1)
                , C.petit "Cette trace conserve les cartes et leurs positions. Elle reste liée à la séance 1."
                , C.secondaire "Ajouter une photo du support papier" (Action "photo")
                , C.petit "JPEG, PNG ou WebP · 10 Mo maximum à l’entrée. Réduction à 1 600 pixels, suppression des métadonnées et chiffrement sur cet appareil, avant l’envoi."
                , photosVue modele 1
                ]
        , U.column [ width fill, U.spacing 14, C.classe "landscape", U.htmlAttribute (A.attribute "aria-label" "Mon paysage et ses cinq espaces") ]
            (if modele.largeur >= 900 then
                [ U.row [ width fill, U.spacing 12, U.alignTop ] (List.map (\zone -> U.el [ width (U.fillPortion 1), U.alignTop ] (zonePaysage modele zone)) (List.take 3 K.zones))
                , U.row [ width fill, U.spacing 12, U.alignTop ] (List.map (\zone -> U.el [ width (U.fillPortion 1), U.alignTop ] (zonePaysage modele zone)) (List.drop 3 K.zones))
                ]

             else
                List.map (zonePaysage modele) K.zones
            )
        , case modele.carteSelectionnee |> Maybe.andThen (\id -> List.filter (\carte -> carte.id == id) modele.carnet.cartes |> List.head) of
            Just carte ->
                C.panneau
                    [ U.el [ U.htmlAttribute (A.id "carte-edition"), U.htmlAttribute (A.tabindex -1) ] (C.titre 3 ("Ma carte · " ++ carte.mot))
                    , C.champ "Mes mots" carte.mot (CarteChamp carte.id "mot")
                    , C.zone "Pour moi, cela signifie…" carte.sens (CarteChamp carte.id "sens")
                    , C.choix "Placer dans…" K.zones carte.zone (CarteChamp carte.id "zone")
                    , C.choix "J’hésite aussi avec… · facultatif" (( "", "Je ne choisis pas de seconde zone" ) :: List.filter (\( id, _ ) -> id /= carte.zone) K.zones) carte.hesitation (CarteChamp carte.id "hesitation")
                    , C.discret "Retirer cette carte" (CarteSupprimer carte.id)
                    ]

            Nothing ->
                C.petit "Je sélectionne une carte pour la déplacer ou préciser ce qu’elle signifie pour moi."
        ]


zonePaysage : Modele -> ( String, String ) -> Element Msg
zonePaysage modele ( id, libelle ) =
    let
        cartes =
            List.filter (\carte -> carte.zone == id) modele.carnet.cartes
    in
    U.column [ width fill, U.height (U.minimum 170 shrink), U.spacing 14, U.padding 20, B.rounded 12, C.classe ("landscape-zone zone-" ++ id) ]
        [ C.titre 3 libelle
        , if List.isEmpty cartes then
            C.petit "Un espace peut rester vide."

          else
            U.column [ width fill, U.spacing 8 ]
                (List.map
                    (\carte ->
                        U.column [ width fill, U.spacing 4 ]
                            [ C.onglet (modele.carteSelectionnee == Just carte.id) carte.mot (ChoisirCarte carte.id)
                            , if carte.hesitation /= "" then
                                C.petit ("J’hésite aussi : " ++ K.nomZone carte.hesitation)

                              else
                                U.none
                            ]
                    )
                    cartes
                )
        ]


confrontationVue : Modele -> Element Msg
confrontationVue modele =
    C.panneau
        [ C.titre 3 "Et si la situation changeait ?"
        , C.petit "Situations proposées par le prototype, à valider. Il n’y a pas de bonne réponse automatique."
        , U.column [ width fill, U.spacing 17 ]
            (List.map C.paragraphe
                [ "Une personne apprécie vous voir souvent. Vous aimez aussi garder des moments pour vous. Que voudriez-vous préciser ?"
                , "Une activité vous intéresse, mais le lieu est bruyant. Qu’est-ce qui pourrait vous convenir ?"
                , "Vous aimez partager des intérêts. L’autre personne en a aussi de différents. Que cela change-t-il pour vous ?"
                ]
            )
        , noteChamp modele 1 "confrontation" "Ce que ces situations changent ou précisent pour moi"
        , actions [ C.secondaire "Je conserve mes choix" (Noter "1-choix-confrontation" "Je conserve mes choix pour le moment."), C.secondaire "Je souhaite ajuster mon paysage" (PaysagePhase 2) ]
        , C.petit (K.note "1-choix-confrontation" modele.carnet)
        ]


photosVue : Modele -> Int -> Element Msg
photosVue modele seance =
    U.column [ width fill, U.spacing 16 ]
        (List.filter (\p -> p.seance == seance) modele.carnet.photos
            |> List.map
                (\photo ->
                    U.column [ width fill, U.spacing 10 ]
                        [ case Dict.get photo.id modele.photosUrls of
                            Just url ->
                                U.image [ width (U.maximum 500 fill) ] { src = url, description = "Photo de ma production personnelle" }

                            Nothing ->
                                C.petit "Photo conservée chiffrée · aperçu indisponible"
                        , C.petit photo.nom
                        , C.discret "Supprimer cette photo" (PhotoSupprimer photo.id)
                        ]
                )
        )


pageObjectifs : Modele -> Element Msg
pageObjectifs modele =
    U.column [ width fill, U.spacing 25 ]
        [ pageTitre "CE QUI ME GUIDE" "Mes objectifs, mes défis"
        , C.paragraphe "Mes objectifs donnent une direction. Mes défis sont des pistes que je peux reprendre au fil des séances."
        , C.titre 2 "Mes objectifs personnels"
        , if List.isEmpty modele.carnet.objectifs then
            C.petit "Je peux commencer par une envie ou une question, même encore floue."

          else
            U.none
        , U.column [ width fill, U.spacing 16 ] (List.map (objectifVue modele) modele.carnet.objectifs)
        , C.panneau
            [ C.titre 3 "Ajouter un objectif"
            , C.zone "Ce que j’aimerais voir évoluer" (form "objectif" modele) (Saisie "objectif")
            , C.bouton "Conserver mon objectif" ObjectifCreer
            ]
        , C.separateur
        , C.titre 2 "Mes défis dans la durée"
        , C.petit (String.fromInt (List.length (K.actifs modele.carnet)) ++ " défi(s) actif(s) · jusqu’à trois à la fois. Les défis mis de côté restent conservés.")
        , U.column [ width fill, U.spacing 16 ] (List.map (defiVue modele) modele.carnet.defis)
        , C.panneau
            [ C.titre 3 "Commencer un défi"
            , C.zone "Le défi que je souhaite explorer" (form "defi" modele) (Saisie "defi")
            , C.choix "À quel objectif est-il relié ?" (( "0", "Je préciserai le lien plus tard" ) :: List.map (\o -> ( String.fromInt o.id, o.texte )) modele.carnet.objectifs) (form "defi-objectif" modele) (Saisie "defi-objectif")
            , C.bouton "Ajouter ce défi" DefiCreer
            , if List.length (K.actifs modele.carnet) >= 3 then
                C.petit "Pour ajouter un défi actif, choisissez d’abord un défi à mettre de côté. Son contenu ne sera pas effacé."

              else
                U.none
            ]
        ]


objectifVue : Modele -> K.Objectif -> Element Msg
objectifVue modele o =
    C.panneau
        [ C.surTitre ("OBJECTIF PERSONNEL · ORIGINE : ÉTAPE " ++ String.fromInt o.origine)
        , C.paragraphe o.texte
        , if List.isEmpty o.historique then
            U.none

          else
            U.column [ width fill, U.spacing 9 ]
                [ C.petit "Mes formulations précédentes"
                , U.column [ width fill, U.spacing 9 ] (List.map C.petit o.historique)
                , C.discret "Effacer les formulations précédentes" (ObjectifHistoriqueEffacer o.id)
                ]
        , if modele.objectifEdition == Just o.id then
            U.column [ width fill, U.spacing 12 ]
                [ C.zone "Ma nouvelle formulation" (form "objectif-edition" modele) (Saisie "objectif-edition")
                , C.bouton "Conserver la reformulation" (ObjectifReformuler o.id)
                ]

          else
            C.secondaire "Reformuler cet objectif" (ObjectifEditer o.id)
        , C.discret "Effacer cet objectif et son historique" (ObjectifSupprimer o.id)
        ]


statutDefi : String -> String
statutDefi statut =
    case statut of
        "actif" ->
            "Je poursuis ce défi"

        "pause" ->
            "Mis de côté pour le moment"

        "autonomie" ->
            "Je le poursuis en autonomie"

        _ ->
            statut


defiVue : Modele -> K.Defi -> Element Msg
defiVue modele d =
    let
        objectif =
            List.filter (\o -> o.id == d.objectif) modele.carnet.objectifs |> List.head |> Maybe.map .texte |> Maybe.withDefault "Lien avec un objectif à préciser"
    in
    C.panneau
        [ C.surTitre (String.toUpper (statutDefi d.statut))
        , C.paragraphe d.texte
        , C.petit ("Objectif : " ++ objectif)
        , if List.isEmpty d.historique then
            U.none

          else
            C.petit ("Formulations précédentes : " ++ String.join " · " d.historique)
        , if modele.defiEdition == Just d.id then
            U.column [ width fill, U.spacing 12 ] [ C.zone "Mon défi ajusté" (form "defi-edition" modele) (Saisie "defi-edition"), C.bouton "Conserver cet ajustement" (DefiAjuster d.id) ]

          else
            C.discret "Ajuster ce défi" (DefiEditer d.id)
        , actions
            [ if d.statut /= "actif" then
                C.secondaire "Reprendre ce défi" (DefiStatut d.id "actif")

              else
                C.secondaire "Mettre de côté" (DefiStatut d.id "pause")
            , if d.statut /= "autonomie" then
                C.discret "Je le poursuis en autonomie" (DefiStatut d.id "autonomie")

              else
                U.none
            ]
        , C.discret "Effacer ce défi" (DefiSupprimer d.id)
        ]


pageReperes : Modele -> Element Msg
pageReperes modele =
    U.column [ width fill, U.spacing 24 ]
        [ pageTitre "CE QUE JE VEUX GARDER" "Mes repères"
        , C.paragraphe "Je retrouve mes productions, mes formulations et les moments que je choisis de conserver."
        , C.panneau
            [ C.titre 2 "Une sélection pour moi, ou pour la séance"
            , C.petit (String.fromInt (List.length (selectionLisible modele)) ++ " trace(s) choisie(s). La sélection se calcule sur cet appareil ; rien n’est envoyé à l’équipe.")
            , actions [ C.secondaire "Présenter ma sélection sur cet écran" (Naviguer Presentation), C.secondaire "Exporter ma sélection lisible" (Demander "readableExport") ]
            , if modele.confirmation == "readableExport" then
                U.column [ width fill, U.spacing 12 ]
                    [ C.paragraphe "Le fichier téléchargé ne sera pas chiffré. Toute personne qui l’ouvre pourra lire la sélection. Choisissez où le conserver et à qui le montrer."
                    , actions [ C.bouton "Générer le fichier lisible choisi" (Action "readableExport"), C.discret "Annuler" Annuler ]
                    ]

              else
                U.none
            ]
        , if List.isEmpty (reperes modele) then
            C.petit "Cet espace est encore libre. Une note, un objectif ou une version de votre paysage pourra y trouver sa place."

          else
            U.column [ width fill, U.spacing 15 ]
                (List.map
                    (\repere ->
                        C.panneau
                            [ C.coche ("Choisir : " ++ repere.titre) (List.member repere.id modele.selection) (Selectionner repere.id)
                            , C.paragraphe repere.texte
                            , C.petit repere.source
                            , C.discret "Retrouver la séance d’origine" (Naviguer (ChapitreVue repere.seance Avant))
                            , if String.startsWith "trace-" repere.id then
                                C.discret "Effacer cette trace conservée" (TraceSupprimer (String.dropLeft 6 repere.id |> String.toInt |> Maybe.withDefault 0))

                              else if String.startsWith "etape-" repere.id then
                                C.discret "Effacer cette étape importante" (EtapeSupprimer (String.dropLeft 6 repere.id |> String.toInt |> Maybe.withDefault 0))

                              else if String.startsWith "note-" repere.id then
                                C.discret "Effacer cette entrée" (EffacerNote (String.dropLeft 5 repere.id))

                              else
                                U.none
                            ]
                    )
                    (reperes modele)
                )
        , C.panneau
            [ C.titre 2 "Mes progrès : les étapes dont je veux me souvenir"
            , C.petit "Je choisis ce qui est important pour moi. Aucun score n’est attribué."
            , C.champ "Quand ? · facultatif" (form "etape-quand" modele) (Saisie "etape-quand")
            , C.zone "Qu’est-ce que j’ai fait ou qu’est-ce qui a changé ?" (form "etape-texte" modele) (Saisie "etape-texte")
            , C.zone "Qu’est-ce que cela me montre sur moi ou mes capacités ?" (form "etape-montre" modele) (Saisie "etape-montre")
            , C.bouton "Garder cette étape importante" EtapeCreer
            ]
        , C.petit "Une entrée supprimée disparaît du carnet actif après synchronisation. Les versions de paysage, exports et anciennes copies sont indépendants : vous pouvez les supprimer séparément."
        ]


presentation : Modele -> Element Msg
presentation modele =
    U.column
        [ width (U.maximum 850 fill)
        , U.centerX
        , U.padding
            (if modele.largeur < 600 then
                20

             else
                40
            )
        , U.spacing 24
        ]
        [ actions [ C.secondaire "Quitter la présentation" (Naviguer Reperes), C.bouton "Masquer / verrouiller" (Action "lock") ]
        , pageTitre "PRÉSENTATION LOCALE" "Ma sélection"
        , C.petit "Ces éléments sont affichés sur cet écran. Aucune transmission à l’équipe n’est activée."
        , if List.isEmpty (selectionLisible modele) then
            C.notice "Aucune trace choisie. Revenez dans Mes repères pour préparer une sélection."

          else
            U.column [ width fill, U.spacing 22 ]
                (List.map (\r -> C.panneau [ C.titre 2 r.titre, C.paragraphe r.texte, C.petit r.source ]) (selectionLisible modele))
        ]


reglageValeur : Modele -> String -> String -> String
reglageValeur modele cle defaut =
    Dict.get cle modele.carnet.notes |> Maybe.withDefault defaut


pageReglages : Modele -> Element Msg
pageReglages modele =
    U.column [ width fill, U.spacing 24 ]
        [ pageTitre "MON ESPACE, MES CHOIX" "Réglages & confidentialité"
        , C.petit (sauvegardeTexte modele)
        , C.panneau
            [ C.titre 2 "Mon confort de lecture"
            , C.choix "Présentation" [ ( "non", "Carnet" ), ( "oui", "Mode sobre · mêmes contenus et fonctions" ) ] (reglageValeur modele "reglage-sobre" "non") (Noter "reglage-sobre")
            , C.choix "Animations"
                [ ( "oui", "Déplacements qui montrent les liens" ), ( "non", "Sans animations · mêmes repères et chemins" ) ]
                (reglageValeur modele
                    "reglage-animations"
                    (if modele.reducedMotion then
                        "non"

                     else
                        "oui"
                    )
                )
                (Noter "reglage-animations")
            , C.petit "La préférence de réduction des mouvements du navigateur est prioritaire, y compris si elle change pendant la lecture. Sans animation, les onglets, les capsules et les chemins restent disponibles."
            , C.choix "Taille du texte" [ ( "standard", "Standard" ), ( "grand", "Plus grand" ) ] (reglageValeur modele "reglage-texte" "standard") (Noter "reglage-texte")
            , C.choix "Verrouillage après une période sans action" [ ( "5", "5 minutes" ), ( "10", "10 minutes" ), ( "15", "15 minutes" ), ( "30", "30 minutes" ), ( "0", "Manuel uniquement" ) ] (reglageValeur modele "reglage-verrouillage" "10") (Noter "reglage-verrouillage")
            ]
        , C.panneau
            [ C.titre 2 "Ce qui reste privé"
            , C.paragraphe "Le contenu, les objectifs, les cartes, les étapes choisies et les noms des photos sont chiffrés avant leur envoi. Ils s’ouvrent sur votre appareil avec la phrase du coffre."
            , C.paragraphe "Le serveur voit encore le compte, les connexions, les heures, les volumes et les révisions de synchronisation. Ce fonctionnement n’est pas de l’anonymat."
            , C.petit "Le code vient du serveur. Un client modifié, une extension malveillante ou un appareil compromis pourrait voler un secret : le chiffrement du stockage ne protège pas absolument contre ces situations."
            , C.petit "Vos textes ne sont pas lus par une équipe d’assistance. Pour parler d’une difficulté, choisissez un interlocuteur adapté hors de ce carnet."
            , C.secondaire "Masquer / verrouiller maintenant" (Action "lock")
            ]
        , if modele.demo then
            C.panneau
                [ C.titre 2 "Cette démonstration"
                , C.paragraphe "Les saisies restent chiffrées dans ce navigateur avec une clé locale propre à la démo. Aucun compte partagé ne les reçoit."
                , C.petit "La démo n’utilise pas de phrase de coffre. Les parcours de compte, de récupération et de sauvegarde chiffrée se testent dans la version complète avec le serveur."
                , C.secondaire "Réinitialiser le carnet fictif" (Demander "resetDemo")
                , if modele.confirmation == "resetDemo" then
                    actions [ C.destructif "Effacer mes modifications de la démo" (Action "resetDemo"), C.discret "Annuler" Annuler ]

                  else
                    U.none
                ]

          else
            U.column [ width fill, U.spacing 24 ]
                [ C.panneau
                    [ C.titre 2 "Changer la phrase du coffre"
                    , C.coche "Utiliser le secret du kit à la place de l’ancienne phrase"
                        (form "change-recovery" modele == "oui")
                        (\v ->
                            Saisie "change-recovery"
                                (if v then
                                    "oui"

                                 else
                                    "non"
                                )
                        )
                    , C.secret "Ancienne phrase · ou secret du coffre si choisi" (form "ancienne-phrase" modele) (Saisie "ancienne-phrase")
                    , C.secret "Nouvelle phrase de coffre" (form "nouvelle-phrase" modele) (Saisie "nouvelle-phrase")
                    , C.bouton "Conserver la nouvelle phrase" (Action "changePhrase")
                    , C.petit "La clé des textes est réenveloppée ; elle n’est pas renouvelée. Une ancienne sauvegarde reste lisible avec le secret qui la protégeait à ce moment-là."
                    ]
                , C.panneau
                    [ C.titre 2 "Ma sauvegarde chiffrée"
                    , C.paragraphe "Un fichier réimportable contient le coffre et les photos chiffrés. Il faut la phrase ou le secret du kit correspondant pour l’ouvrir."
                    , C.bouton "Exporter mon carnet chiffré" (Action "encryptedExport")
                    , C.separateur
                    , C.secret "Phrase de la sauvegarde à importer" (form "import-secret" modele) (Saisie "import-secret")
                    , C.coche "Je saisis plutôt le secret du coffre de cette sauvegarde"
                        (form "import-recovery" modele == "oui")
                        (\v ->
                            Saisie "import-recovery"
                                (if v then
                                    "oui"

                                 else
                                    "non"
                                )
                        )
                    , C.secondaire "Réimporter une sauvegarde" (Demander "import")
                    , if modele.confirmation == "import" then
                        U.column [ width fill, U.spacing 12 ] [ C.paragraphe "L’import sera vérifié avant de remplacer le carnet actif. Une copie chiffrée de la version actuelle restera conservée sur cet appareil.", actions [ C.bouton "Choisir et vérifier mon fichier chiffré" (Action "import"), C.discret "Annuler" Annuler ] ]

                      else
                        U.none
                    ]
                , C.panneau
                    [ C.titre 2 "Anciennes copies"
                    , C.petit "Après un conflit, un import ou la création d’un nouveau coffre, des copies chiffrées peuvent rester conservées."
                    , actions [ C.secondaire "Exporter les copies en conflit" (Action "exportConflict"), C.discret "Effacer les anciennes copies locales" (Action "purgeLocal") ]
                    , actions [ C.secondaire "Exporter les anciens coffres verrouillés" (Action "exportArchives"), C.discret "Supprimer les anciens coffres du serveur" (Demander "purgeArchives") ]
                    , if modele.confirmation == "purgeArchives" then
                        U.column [ width fill, U.spacing 12 ] [ C.paragraphe "Cette action efface les anciens coffres conservés après une perte des secrets. Les fichiers déjà téléchargés restent sous votre contrôle.", actions [ C.destructif "Supprimer explicitement les anciens coffres" (Action "purgeArchives"), C.discret "Annuler" Annuler ] ]

                      else
                        U.none
                    ]
                , C.panneau
                    [ C.titre 2 "Supprimer mon compte"
                    , C.paragraphe "Le compte, les sessions, le coffre actif, les anciennes archives et les photos chiffrées seront supprimés du serveur. Les exports téléchargés restent sous votre contrôle."
                    , C.petit "Une conservation de 90 jours sans connexion est le réglage local du POC. L’exploitant doit définir la conservation et le sort des sauvegardes avant un usage réel."
                    , C.secret "Mot de passe de connexion pour supprimer le compte" (form "delete-password" modele) (Saisie "delete-password")
                    , C.destructif "Demander la suppression du compte" (Demander "deleteAccount")
                    , if modele.confirmation == "deleteAccount" then
                        actions [ C.destructif "Supprimer définitivement mon compte" (Action "deleteAccount"), C.discret "Annuler" Annuler ]

                      else
                        U.none
                    ]
                ]
        , C.panneau
            [ C.titre 2 "Mon retour sur ce prototype · facultatif"
            , C.paragraphe "Ce retour reste privé dans votre coffre. Il est distinct du questionnaire de besoins ; aucune collecte de recherche n’est active."
            , C.zone "Ce qui m’aide, ce qui me gêne ou ce que je souhaite changer" (K.note "retour-prototype" modele.carnet) (Noter "retour-prototype")
            , C.petit "Pour le transmettre, vous pouvez en préparer vous-même une copie lisible. Aucun envoi automatique n’est effectué."
            ]
        , C.discret "À propos, sources et limites" (Naviguer Apropos)
        ]


pageApropos : Modele -> Element Msg
pageApropos modele =
    U.column [ width fill, U.spacing 24 ]
        [ if modele.ecran == Ouvert then
            U.none

          else
            C.discret "Retour au carnet" (Naviguer Parcours)
        , pageTitre "À PROPOS & SOURCES" "Un prototype à explorer"
        , if modele.demoOnly then
            C.panneau
                [ C.titre 2 "La version complète du prototype"
                , C.paragraphe "Cette démonstration conserve les exemples sur cet appareil. Le code livré comprend aussi les comptes, le serveur Lisp, PostgreSQL, les tests et la documentation de lancement."
                , C.lien "Télécharger le code complet et sa documentation" "/mon-carnet-poc.zip"
                ]

          else
            U.none
        , C.panneau
            [ C.titre 2 "Le rôle de ce carnet"
            , C.paragraphe "Ce carnet personnel accompagne un programme présentiel de vie affective, relationnelle et intime destiné à des adultes autistes. Il permet de préparer, garder des traces et choisir ses propres expérimentations."
            , C.paragraphe "Il n’attribue aucun score, ne définit pas un modèle unique de relation et n’exige aucune expérience amoureuse ou sexuelle. Ce prototype n’est pas cliniquement validé."
            , C.petit "Les quinze étapes reprennent le récapitulatif fourni. Leur calendrier reste à confirmer. Aucune institution n’a validé cette application et aucun logo institutionnel n’est utilisé."
            ]
        , C.panneau
            [ C.titre 2 "Trois statuts pour les contenus"
            , C.paragraphe "Contenu fourni par l’équipe : intitulés, objectifs et organisation des rubriques, dans leur version de travail."
            , C.paragraphe "Adaptation numérique : regroupement Se préparer / Pendant la séance, cartes accessibles au clavier, choix de retour d’expérience et sauvegarde."
            , C.paragraphe "Proposition du POC à valider : lectures courtes, cartes-mots, situations et petits pas contextualisés."
            , C.petit "Sources privées consultées le 6 octobre 2026 : Principes pédagogiques Sexo.docx (« Le carnet de bord », paragraphes 305–374) ; Module Sexo bilan.xlsx (Recapitulatif seances, A1:H16 ; Exo Séance 1, A1:H10) ; Questionnaire – V2.docx ; Etudes scientifiques.xlsx. Ces documents ne sont pas proposés en téléchargement."
            , C.petit "Les couleurs, la forme du carnet et les transitions sont des hypothèses de design à tester avec les personnes concernées."
            ]
        , C.panneau
            [ C.titre 2 "Confidentialité et limites"
            , C.paragraphe "Pour les comptes, les textes sont chiffrés dans le navigateur, avec une phrase distincte de la connexion. Le serveur conserve des enveloppes chiffrées, des comptes minimaux et des métadonnées techniques."
            , C.paragraphe "Un opérateur qui contrôle le code livré pourrait le modifier pour voler un secret. Le stockage chiffré ne constitue pas une protection absolue contre un client malveillant ou un appareil compromis."
            , C.paragraphe "Le prototype est réservé aux données fictives. Le dossier RGPD, l’analyse d’impact, les responsabilités, les bases légales, les sauvegardes et l’éventuelle obligation HDS restent à confirmer avant tout usage réel."
            , C.petit "Aucune collecte de recherche, télémétrie, analyse par IA, lecture soignante ou alerte clinique n’est activée. Le chiffrement ne dispense pas à lui seul des règles sur les données sensibles."
            ]
        , C.panneau
            [ C.titre 2 "Références externes"
            , C.petit "Références de conception et de vérification, sans transmission du contenu du carnet."
            , C.lien "W3C · WCAG 2.2" "https://www.w3.org/TR/WCAG22/"
            , C.lien "W3C · compréhension et contrôle de l’interface" "https://www.w3.org/WAI/WCAG2/supplemental/objectives/o1-understandable/"
            , C.lien "W3C · personnalisation" "https://www.w3.org/WAI/WCAG2/supplemental/patterns/o8p04-interface/"
            , C.lien "MDN · Web Crypto" "https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto"
            , C.lien "OWASP · stockage cryptographique" "https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html"
            , C.lien "OWASP · mots de passe" "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html"
            , C.lien "CNIL · guide RGPD du développeur" "https://www.cnil.fr/fr/guide-rgpd-du-developpeur"
            , C.lien "CNIL · analyse d’impact" "https://cnil.fr/fr/RGPD-analyse-impact-protection-des-donnees-aipd"
            , C.lien "ANS · données chiffrées et obligation HDS" "https://esante.gouv.fr/faq/si-jheberge-des-donnees-de-sante-chiffrees-suis-je-soumis-lobligation-de-certification-hds"
            , C.lien "Spaargaren et al. · SAM, 2025 · DOI 10.1177/13623613251346885" "https://pubmed.ncbi.nlm.nih.gov/40567128/"
            , C.petit "L’étude SAM porte sur une application de gestion du stress. Elle invite à examiner la charge d’usage ; elle ne valide pas ce carnet ni un programme de vie affective. Aucun chiffre d’efficacité n’est transposé ici."
            ]
        ]
