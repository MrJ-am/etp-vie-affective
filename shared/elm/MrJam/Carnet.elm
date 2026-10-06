module MrJam.Carnet exposing (..)

{-| Extension additive proposée au paquet partagé style-mrjam.
Le moteur de contrôle historique est réutilisé ; la variante Carnet est isolée.
Elle ne contient aucune donnée métier ni ressource d'identité réservée.
-}

import Element as U exposing (Attribute, Element, fill, px, width)
import Element.Background as Bg
import Element.Border as B
import Element.Font as F
import Element.Input as Input
import Element.Region as R
import Html
import Html.Attributes as A
import Html.Events as Events
import MrJam.Controles as Controle


couleurs =
    { encre = U.rgb255 48 40 47, prune = U.rgb255 98 52 81, pruneSurvol = U.rgb255 77 38 61, papier = U.rgb255 250 247 241, blanc = U.rgb255 255 255 253, discret = U.rgb255 104 93 101, ligne = U.rgb255 224 215 207, doux = U.rgb255 242 233 235, vert = U.rgb255 46 92 77, corail = U.rgb255 175 73 48 }


classe : String -> Attribute msg
classe =
    A.class >> U.htmlAttribute


bouton : String -> msg -> Element msg
bouton libelle action =
    Controle.action Controle.Principale
        [ Bg.color couleurs.prune, B.color couleurs.prune, F.color couleurs.blanc, U.mouseOver [ Bg.color couleurs.pruneSurvol ], U.height (U.minimum 44 U.shrink), U.paddingXY 18 12, B.rounded 8, F.size 16, classe "carnet-bouton" ]
        libelle
        (Just action)


secondaire : String -> msg -> Element msg
secondaire libelle action =
    Controle.action Controle.Secondaire
        [ F.color couleurs.prune, B.color couleurs.ligne, U.height (U.minimum 44 U.shrink), U.paddingXY 16 11, B.rounded 8, F.size 16, classe "carnet-bouton" ]
        libelle
        (Just action)


discret : String -> msg -> Element msg
discret libelle action =
    Controle.action Controle.Discrete
        [ F.color couleurs.prune, U.height (U.minimum 44 U.shrink), U.paddingXY 8 10, F.size 14, classe "carnet-bouton" ]
        libelle
        (Just action)


destructif : String -> msg -> Element msg
destructif libelle action =
    Controle.action Controle.Destructive
        [ U.height (U.minimum 44 U.shrink), U.paddingXY 16 11, B.rounded 8, F.size 16, classe "carnet-bouton" ]
        libelle
        (Just action)


onglet : Bool -> String -> msg -> Element msg
onglet actif libelle action =
    Controle.action (Controle.Selection actif)
        [ U.height (U.minimum 44 U.shrink)
        , U.paddingXY 16 12
        , B.rounded 8
        , F.size 16
        , F.color couleurs.prune
        , Bg.color
            (if actif then
                couleurs.doux

             else
                couleurs.blanc
            )
        , B.color
            (if actif then
                couleurs.prune

             else
                couleurs.ligne
            )
        , classe "carnet-onglet"
        ]
        libelle
        (Just action)


champ : String -> String -> (String -> msg) -> Element msg
champ libelle valeur changer =
    Input.text
        [ width fill, U.height (U.minimum 46 U.shrink), U.padding 13, B.rounded 8, B.width 1, B.color couleurs.ligne, Bg.color couleurs.blanc, F.color couleurs.encre, classe "carnet-champ", U.htmlAttribute (A.attribute "aria-label" libelle) ]
        { onChange = changer, text = valeur, placeholder = Nothing, label = Input.labelAbove [ F.size 15, F.semiBold, U.paddingEach { top = 0, bottom = 6, left = 0, right = 0 } ] (U.text libelle) }


secret : String -> String -> (String -> msg) -> Element msg
secret libelle valeur changer =
    Input.currentPassword
        [ width fill, U.height (U.minimum 46 U.shrink), U.padding 13, B.rounded 8, B.width 1, B.color couleurs.ligne, Bg.color couleurs.blanc, F.color couleurs.encre, classe "carnet-champ", U.htmlAttribute (A.attribute "aria-label" libelle) ]
        { onChange = changer, text = valeur, placeholder = Nothing, label = Input.labelAbove [ F.size 15, F.semiBold, U.paddingEach { top = 0, bottom = 6, left = 0, right = 0 } ] (U.text libelle), show = False }


zone : String -> String -> (String -> msg) -> Element msg
zone libelle valeur changer =
    Input.multiline
        [ width fill, U.height (U.minimum 110 U.shrink), U.padding 14, B.rounded 8, B.width 1, B.color couleurs.ligne, Bg.color couleurs.blanc, F.color couleurs.encre, classe "carnet-champ", U.htmlAttribute (A.attribute "maxlength" "30000"), U.htmlAttribute (A.attribute "aria-label" libelle) ]
        { onChange = changer, text = valeur, placeholder = Nothing, label = Input.labelAbove [ F.size 15, F.semiBold, U.paddingEach { top = 0, bottom = 7, left = 0, right = 0 } ] (U.text libelle), spellcheck = False }


choix : String -> List ( String, String ) -> String -> (String -> msg) -> Element msg
choix libelle options valeur changer =
    U.html <|
        Html.label [ A.class "carnet-select" ]
            [ Html.span [] [ Html.text libelle ]
            , Html.select [ A.value valeur, A.attribute "aria-label" libelle, Events.onInput changer ]
                (List.map (\( cle, texte ) -> Html.option [ A.value cle, A.selected (cle == valeur) ] [ Html.text texte ]) options)
            ]


coche : String -> Bool -> (Bool -> msg) -> Element msg
coche libelle valeur changer =
    U.html <|
        Html.label [ A.class "carnet-checkbox" ]
            [ Html.input [ A.type_ "checkbox", A.checked valeur, Events.onCheck changer ] []
            , Html.span [] [ Html.text libelle ]
            ]


paragraphe : String -> Element msg
paragraphe texte =
    U.paragraph [ width fill, U.spacing 7, F.size 17, classe "carnet-texte" ] [ U.text texte ]


petit : String -> Element msg
petit texte =
    U.paragraph [ width fill, U.spacing 5, F.size 14, F.color couleurs.discret, classe "carnet-petit" ] [ U.text texte ]


surTitre : String -> Element msg
surTitre texte =
    U.paragraph [ width fill, F.size 13, F.bold, F.letterSpacing 1.5, F.color couleurs.prune, classe "carnet-surtitre" ] [ U.text texte ]


titre : Int -> String -> Element msg
titre niveau texte =
    U.paragraph
        [ width fill
        , R.heading niveau
        , F.family [ F.typeface "Georgia", F.serif ]
        , F.size
            (if niveau == 1 then
                42

             else
                27
            )
        , F.regular
        , U.spacing 5
        , classe
            (if niveau == 1 then
                "carnet-titre"

             else
                "carnet-soustitre"
            )
        ]
        [ U.text texte ]


panneau : List (Element msg) -> Element msg
panneau contenu =
    U.column [ width fill, U.spacing 18, U.padding 26, Bg.color couleurs.blanc, B.color couleurs.ligne, B.width 1, B.rounded 12, classe "carnet-panneau" ] contenu


notice : String -> Element msg
notice texte =
    U.el [ width fill, U.padding 16, Bg.color couleurs.doux, B.rounded 8, U.htmlAttribute (A.attribute "role" "status") ] (paragraphe texte)


lien : String -> String -> Element msg
lien libelle url =
    U.newTabLink [ U.height (U.minimum 44 U.shrink), U.paddingXY 0 12, F.color couleurs.prune, F.underline, U.htmlAttribute (A.rel "noopener noreferrer"), U.htmlAttribute (A.attribute "referrerpolicy" "no-referrer") ]
        { url = url, label = U.paragraph [ width fill ] [ U.text (libelle ++ " · nouvel onglet") ] }


separateur : Element msg
separateur =
    U.el [ width fill, U.height (px 1), Bg.color couleurs.ligne ] U.none
