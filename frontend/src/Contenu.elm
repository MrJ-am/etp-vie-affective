module Contenu exposing (..)

import Json.Decode as D


type alias Chapitre =
    { id : Int, titre : String, sousTitre : String, nature : String, objectif : String, intro : String, essentiel : List String, approfondissement : String, question : String, petitPas : String, source : String, statutLecture : String }


decoder : D.Decoder Chapitre
decoder =
    D.map8 (\id titre sousTitre nature objectif intro essentiel approfondissement -> \question petitPas source statutLecture -> Chapitre id titre sousTitre nature objectif intro essentiel approfondissement question petitPas source statutLecture)
        (D.field "id" D.int)
        (D.field "titre" D.string)
        (D.field "sousTitre" D.string)
        (D.field "nature" D.string)
        (D.field "objectif" D.string)
        (D.field "intro" D.string)
        (D.field "essentiel" (D.list D.string))
        (D.field "approfondissement" D.string)
        |> andMap (D.field "question" D.string)
        |> andMap (D.field "petitPas" D.string)
        |> andMap (D.field "source" D.string)
        |> andMap (D.field "statutLecture" D.string)


andMap : D.Decoder a -> D.Decoder (a -> b) -> D.Decoder b
andMap argument fonction =
    D.map2 (|>) argument fonction


trouver : Int -> List Chapitre -> Chapitre
trouver identifiant chapitres =
    List.filter (\c -> c.id == identifiant) chapitres
        |> List.head
        |> Maybe.withDefault { id = 0, titre = "Mon carnet", sousTitre = "", nature = "bilan", objectif = "", intro = "", essentiel = [], approfondissement = "", question = "", petitPas = "", source = "", statutLecture = "" }
