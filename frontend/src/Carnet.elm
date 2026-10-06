module Carnet exposing (..)

{-| Données privées : sérialisées en un seul document, chiffrées avant stockage.
Les identifiants locaux ne quittent le navigateur qu'à l'intérieur du coffre.
-}

import Dict exposing (Dict)
import Json.Decode as D
import Json.Encode as E


type alias Objectif =
    { id : Int, texte : String, origine : Int, historique : List String }


type alias Defi =
    { id : Int, texte : String, objectif : Int, statut : String, origine : Int, historique : List String }


type alias Experience =
    { id : Int, seance : Int, defi : Int, principale : Bool, quoi : String, quand : String, comment : String, obstacle : String, observer : String, statut : String, essaye : String, marque : String, appris : String, suite : String }


type alias Carte =
    { id : Int, mot : String, sens : String, zone : String, hesitation : String }


type alias Trace =
    { id : Int, seance : Int, titre : String, texte : String, cartes : List Carte }


type alias Etape =
    { id : Int, seance : Int, quand : String, texte : String, montre : String }


type alias Photo =
    { id : String, nom : String, seance : Int }


type alias Carnet =
    { version : Int, etape : Int, nextId : Int, notes : Dict String String, objectifs : List Objectif, defis : List Defi, experiences : List Experience, cartes : List Carte, traces : List Trace, etapes : List Etape, photos : List Photo, consultations : List Int }


vide : Carnet
vide =
    { version = 1, etape = 0, nextId = 100, notes = Dict.empty, objectifs = [], defis = [], experiences = [], cartes = [], traces = [], etapes = [], photos = [], consultations = [] }


note : String -> Carnet -> String
note cle carnet =
    Dict.get cle carnet.notes |> Maybe.withDefault ""


noter : String -> String -> Carnet -> Carnet
noter cle valeur carnet =
    { carnet | notes = Dict.insert cle valeur carnet.notes }


suivante : Carnet -> Carnet
suivante carnet =
    { carnet | nextId = carnet.nextId + 1 }


actifs : Carnet -> List Defi
actifs carnet =
    List.filter (\defi -> defi.statut == "actif") carnet.defis


nouvelleExperience : Int -> Int -> Bool -> Experience
nouvelleExperience identifiant seance principale =
    { id = identifiant, seance = seance, defi = 0, principale = principale, quoi = "", quand = "", comment = "", obstacle = "", observer = "", statut = "préparée", essaye = "", marque = "", appris = "", suite = "" }


zones : List ( String, String )
zones =
    [ ( "coeur", "Au cœur · essentiel" ), ( "autour", "Autour · important" ), ( "horizon", "À l’horizon · appréciable" ), ( "explorer", "Terres à explorer · je ne sais pas encore" ), ( "limites", "Au-delà de mes limites · pas pour moi" ) ]


nomZone : String -> String
nomZone identifiant =
    zones |> List.filter (\( id, _ ) -> id == identifiant) |> List.head |> Maybe.map Tuple.second |> Maybe.withDefault "À placer"


decodeObjectif : D.Decoder Objectif
decodeObjectif =
    D.map4 Objectif (D.field "id" D.int) (D.field "texte" D.string) (D.field "origine" D.int) (D.field "historique" (D.list D.string))


decodeDefi : D.Decoder Defi
decodeDefi =
    D.map6 Defi (D.field "id" D.int) (D.field "texte" D.string) (D.field "objectif" D.int) (D.field "statut" D.string) (D.field "origine" D.int) (D.field "historique" (D.list D.string))


andMap : D.Decoder a -> D.Decoder (a -> b) -> D.Decoder b
andMap argument fonction =
    D.map2 (|>) argument fonction


decodeExperience : D.Decoder Experience
decodeExperience =
    D.succeed Experience
        |> andMap (D.field "id" D.int)
        |> andMap (D.field "seance" D.int)
        |> andMap (D.field "defi" D.int)
        |> andMap (D.field "principale" D.bool)
        |> andMap (D.field "quoi" D.string)
        |> andMap (D.field "quand" D.string)
        |> andMap (D.field "comment" D.string)
        |> andMap (D.field "obstacle" D.string)
        |> andMap (D.field "observer" D.string)
        |> andMap (D.field "statut" D.string)
        |> andMap (D.field "essaye" D.string)
        |> andMap (D.field "marque" D.string)
        |> andMap (D.field "appris" D.string)
        |> andMap (D.field "suite" D.string)


decodeCarte : D.Decoder Carte
decodeCarte =
    D.map5 Carte (D.field "id" D.int) (D.field "mot" D.string) (D.field "sens" D.string) (D.field "zone" D.string) (D.field "hesitation" D.string)


decodeTrace : D.Decoder Trace
decodeTrace =
    D.map5 Trace (D.field "id" D.int) (D.field "seance" D.int) (D.field "titre" D.string) (D.field "texte" D.string) (D.field "cartes" (D.list decodeCarte))


decodeEtape : D.Decoder Etape
decodeEtape =
    D.map5 Etape (D.field "id" D.int) (D.field "seance" D.int) (D.field "quand" D.string) (D.field "texte" D.string) (D.field "montre" D.string)


decodePhoto : D.Decoder Photo
decodePhoto =
    D.map3 Photo (D.field "id" D.string) (D.field "nom" D.string) (D.field "seance" D.int)


decoder : D.Decoder Carnet
decoder =
    D.succeed Carnet
        |> andMap (D.field "version" D.int)
        |> andMap (D.field "etape" D.int)
        |> andMap (D.field "nextId" D.int)
        |> andMap (D.field "notes" (D.dict D.string))
        |> andMap (D.field "objectifs" (D.list decodeObjectif))
        |> andMap (D.field "defis" (D.list decodeDefi))
        |> andMap (D.field "experiences" (D.list decodeExperience))
        |> andMap (D.field "cartes" (D.list decodeCarte))
        |> andMap (D.field "traces" (D.list decodeTrace))
        |> andMap (D.field "etapes" (D.list decodeEtape))
        |> andMap (D.field "photos" (D.list decodePhoto))
        |> andMap (D.field "consultations" (D.list D.int))


encodeObjectif : Objectif -> E.Value
encodeObjectif o =
    E.object [ ( "id", E.int o.id ), ( "texte", E.string o.texte ), ( "origine", E.int o.origine ), ( "historique", E.list E.string o.historique ) ]


encodeDefi : Defi -> E.Value
encodeDefi d =
    E.object [ ( "id", E.int d.id ), ( "texte", E.string d.texte ), ( "objectif", E.int d.objectif ), ( "statut", E.string d.statut ), ( "origine", E.int d.origine ), ( "historique", E.list E.string d.historique ) ]


encodeExperience : Experience -> E.Value
encodeExperience x =
    E.object
        [ ( "id", E.int x.id )
        , ( "seance", E.int x.seance )
        , ( "defi", E.int x.defi )
        , ( "principale", E.bool x.principale )
        , ( "quoi", E.string x.quoi )
        , ( "quand", E.string x.quand )
        , ( "comment", E.string x.comment )
        , ( "obstacle", E.string x.obstacle )
        , ( "observer", E.string x.observer )
        , ( "statut", E.string x.statut )
        , ( "essaye", E.string x.essaye )
        , ( "marque", E.string x.marque )
        , ( "appris", E.string x.appris )
        , ( "suite", E.string x.suite )
        ]


encodeCarte : Carte -> E.Value
encodeCarte c =
    E.object [ ( "id", E.int c.id ), ( "mot", E.string c.mot ), ( "sens", E.string c.sens ), ( "zone", E.string c.zone ), ( "hesitation", E.string c.hesitation ) ]


encodeTrace : Trace -> E.Value
encodeTrace t =
    E.object [ ( "id", E.int t.id ), ( "seance", E.int t.seance ), ( "titre", E.string t.titre ), ( "texte", E.string t.texte ), ( "cartes", E.list encodeCarte t.cartes ) ]


encodeEtape : Etape -> E.Value
encodeEtape e =
    E.object [ ( "id", E.int e.id ), ( "seance", E.int e.seance ), ( "quand", E.string e.quand ), ( "texte", E.string e.texte ), ( "montre", E.string e.montre ) ]


encodePhoto : Photo -> E.Value
encodePhoto p =
    E.object [ ( "id", E.string p.id ), ( "nom", E.string p.nom ), ( "seance", E.int p.seance ) ]


encoder : Carnet -> E.Value
encoder c =
    E.object
        [ ( "version", E.int c.version )
        , ( "etape", E.int c.etape )
        , ( "nextId", E.int c.nextId )
        , ( "notes", E.dict identity E.string c.notes )
        , ( "objectifs", E.list encodeObjectif c.objectifs )
        , ( "defis", E.list encodeDefi c.defis )
        , ( "experiences", E.list encodeExperience c.experiences )
        , ( "cartes", E.list encodeCarte c.cartes )
        , ( "traces", E.list encodeTrace c.traces )
        , ( "etapes", E.list encodeEtape c.etapes )
        , ( "photos", E.list encodePhoto c.photos )
        , ( "consultations", E.list E.int c.consultations )
        ]
