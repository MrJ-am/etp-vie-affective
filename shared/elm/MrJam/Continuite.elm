module MrJam.Continuite exposing (Onglet, Panneau, Point, capsule, feuilles, moments, onglets, plan, repere, ruban, titreCapsule)

{-| Feuilles de classeur, capsules et fenêtres internes, sans état métier. Elm Animator produit les transitions
CSS natives ; le navigateur conserve les positions intermédiaires lors d'un
nouveau choix. Une seule mise en page ElmUI inclut les panneaux. Les propriétés
finales sont explicites, y compris sans mouvement.
-}

import Animator
import Element as U exposing (Element)
import Element.Region as R
import Html
import Html.Attributes as A
import Html.Events as Events
import Json.Decode as D


type alias Onglet msg =
    { id : String, libelle : String, court : String, selectionne : Bool, choisir : msg, clavier : msg }


{-| Les onglets appartiennent au classeur ; le clavier conserve le focus sur
l'onglet choisi. Une activation par clic conduit à sa feuille.
-}
onglets : List (Onglet msg) -> Element msg
onglets liste =
    let
        nombre =
            List.length liste

        bouton index onglet =
            let
                touche =
                    D.field "key" D.string
                        |> D.andThen
                            (\key ->
                                let
                                    suivant =
                                        case key of
                                            "ArrowRight" ->
                                                Just (modBy nombre (index + 1))

                                            "ArrowLeft" ->
                                                Just (modBy nombre (index - 1))

                                            "Home" ->
                                                Just 0

                                            "End" ->
                                                Just (nombre - 1)

                                            _ ->
                                                Nothing
                                in
                                case suivant |> Maybe.andThen (\i -> List.drop i liste |> List.head) of
                                    Just destination ->
                                        D.succeed ( destination.clavier, True )

                                    Nothing ->
                                        D.fail "Touche native de cet onglet."
                            )
            in
            Html.button
                [ A.class "classeur-onglet"
                , A.id ("onglet-" ++ onglet.id)
                , A.attribute "role" "tab"
                , A.attribute "aria-controls" ("feuille-" ++ onglet.id)
                , A.attribute "aria-label" onglet.libelle
                , A.attribute "aria-selected" (bool onglet.selectionne)
                , A.tabindex
                    (if onglet.selectionne then
                        0

                     else
                        -1
                    )
                , Events.onClick onglet.choisir
                , Events.preventDefaultOn "keydown" touche
                ]
                [ Html.span [ A.class "onglet-complet" ] [ Html.text onglet.libelle ]
                , Html.span [ A.class "onglet-court", A.attribute "aria-hidden" "true" ] [ Html.text onglet.court ]
                ]
    in
    U.el [ U.width U.fill, U.htmlAttribute (A.class "classeur-navigation") ] <|
        U.html <|
            Html.div
                [ A.class "classeur-onglets", A.id "plan-carnet", A.tabindex -1, A.attribute "role" "tablist", A.attribute "aria-label" "Les feuilles de mon classeur" ]
                (List.indexedMap bouton liste)


{-| Navigation horizontale : trois textes sur la même ligne, avec un seul
indicateur animé en dessous. Les touches fléchées déplacent aussi le focus.
-}
moments : { id : String } -> List { libelle : String, selectionne : Bool, choisir : msg } -> Element msg
moments config liste =
    let
        bouton index item =
            let
                touche =
                    D.field "key" D.string
                        |> D.andThen
                            (\key ->
                                let
                                    suivant =
                                        case key of
                                            "ArrowRight" ->
                                                Just (modBy 3 (index + 1))

                                            "ArrowLeft" ->
                                                Just (modBy 3 (index - 1))

                                            "Home" ->
                                                Just 0

                                            "End" ->
                                                Just 2

                                            _ ->
                                                Nothing
                                in
                                case suivant |> Maybe.andThen (\i -> List.drop i liste |> List.head) of
                                    Just destination ->
                                        D.succeed ( destination.choisir, True )

                                    Nothing ->
                                        D.fail "Touche native de ce moment."
                            )
            in
            Html.button
                [ A.class "moment-onglet"
                , A.id (config.id ++ "-onglet-" ++ String.fromInt index)
                , A.attribute "role" "tab"
                , A.attribute "aria-controls" config.id
                , A.attribute "aria-selected" (bool item.selectionne)
                , A.tabindex
                    (if item.selectionne then
                        0

                     else
                        -1
                    )
                , Events.onClick item.choisir
                , Events.preventDefaultOn "keydown" touche
                ]
                [ Html.text item.libelle ]
    in
    U.html <|
        Html.div [ A.class "moments-ligne", A.attribute "role" "tablist", A.attribute "aria-label" "Les moments de cette séance" ]
            (List.indexedMap bouton liste)


bool : Bool -> String
bool valeur =
    if valeur then
        "true"

    else
        "false"


natif : Bool -> Float -> List Animator.Attribute -> List (Html.Attribute msg)
natif anime duree proprietes =
    if anime then
        Animator.transition (Animator.ms duree) proprietes
            |> Animator.toCss
            |> .props
            |> List.filter (\( nom, _ ) -> nom == "transition")
            |> List.map (\( nom, valeur ) -> A.style nom valeur)

    else
        [ A.style "transition" "none" ]


{-| Les feuilles partagent la même reliure. Leur mouvement fait apparaître une
autre feuille ; il ne fait pas voyager les chapitres vers un autre emplacement.
-}
feuilles : { camera : Point, mouvement : Bool, anime : Bool, termine : msg } -> List (Panneau msg) -> Element msg
feuilles config panneaux =
    let
        fin =
            D.map2 Tuple.pair (D.field "propertyName" D.string) (D.at [ "target", "id" ] D.string)
                |> D.andThen
                    (\( propriete, id ) ->
                        if propriete == "opacity" && id == "titre-page" then
                            D.succeed config.termine

                        else
                            D.fail "Autre mouvement de feuille."
                    )

        panneau p =
            let
                id =
                    String.fromInt (round p.position.x)

                visible =
                    p.position.x == config.camera.x

                attrs =
                    [ A.class "classeur-feuille"
                    , A.attribute "data-panel" p.cle
                    , A.attribute "data-active" (bool p.ouvert)
                    , A.style "opacity" (boolFloat visible)
                    ]
                        ++ natif config.anime 320 [ Animator.opacity 1 ]
                        ++ (if p.ouvert then
                                [ A.id "titre-page", A.tabindex -1, Events.on "transitionend" fin ]

                            else
                                [ A.attribute "inert" "", A.attribute "aria-hidden" "true" ]
                           )
            in
            U.el ([ U.width U.fill ] ++ List.map U.htmlAttribute attrs)
                (U.column
                    [ U.width U.fill
                    , U.htmlAttribute
                        (A.attribute "role"
                            (if List.member id [ "1", "2", "3" ] then
                                "tabpanel"

                             else
                                "region"
                            )
                        )
                    , U.htmlAttribute (A.id ("feuille-" ++ id))
                    , U.htmlAttribute
                        (if List.member id [ "1", "2", "3" ] then
                            A.attribute "aria-labelledby" ("onglet-" ++ id)

                         else
                            A.attribute "aria-label" p.cle
                        )
                    ]
                    [ p.contenu ]
                )
    in
    U.column
        [ U.width U.fill, U.spacing 0, U.htmlAttribute (A.class "classeur-feuilles"), U.htmlAttribute (A.attribute "data-moving" (bool config.mouvement)) ]
        (List.map panneau panneaux)


boolFloat : Bool -> String
boolFloat valeur =
    if valeur then
        "1"

    else
        "0"


titreCapsule : { id : Int, ouverte : Bool, lisible : Bool, anime : Bool, choisir : msg } -> String -> Element msg
titreCapsule config titre =
    U.paragraph
        ([ U.width U.fill, R.heading 2 ]
            ++ List.map U.htmlAttribute
                [ A.class "capsule-titre"
                , A.id ("titre-capsule-" ++ String.fromInt config.id)
                , A.tabindex -1
                , A.style "font-size" "1.2rem"
                ]
        )
        [ U.html <|
            Html.button
                [ A.class "capsule-ouvrir"
                , A.attribute "aria-expanded" (bool config.lisible)
                , A.attribute "aria-controls" ("corps-capsule-" ++ String.fromInt config.id)
                , Events.onClick config.choisir
                ]
                [ Html.text titre ]
        ]


{-| La piste intrinsèque se déploie dans le flux de la feuille : les capsules
suivantes sont repoussées à chaque image, sans positions absolues ni nouvelle page.
Animator fournit les propriétés et la courbe de transition native.
-}
capsule : { id : Int, ouverte : Bool, lisible : Bool, anime : Bool, mouvement : Bool, termine : msg } -> Element msg -> Element msg
capsule config contenu =
    let
        id =
            "corps-capsule-" ++ String.fromInt config.id

        fin =
            D.map2 Tuple.pair (D.field "propertyName" D.string) (D.at [ "target", "id" ] D.string)
                |> D.andThen
                    (\( propriete, cible ) ->
                        if propriete == "grid-template-rows" && cible == id then
                            D.succeed config.termine

                        else
                            D.fail "Autre mouvement dans cette capsule."
                    )
    in
    U.el
        ([ U.width U.fill ]
            ++ List.map U.htmlAttribute
                ([ A.class "capsule-corps"
                 , A.id id
                 , A.attribute "data-moving" (bool config.mouvement)
                 , A.style "grid-template-rows"
                    (if config.ouverte then
                        "1fr"

                     else
                        "0fr"
                    )
                 , Events.on "transitionend" fin
                 ]
                    ++ natif config.anime 520 [ Animator.float "grid-template-rows" 1 ]
                    ++ (if config.lisible then
                            []

                        else
                            [ A.attribute "inert" "", A.attribute "aria-hidden" "true" ]
                       )
                )
        )
        (U.el [ U.width U.fill, U.htmlAttribute (A.class "capsule-interieur") ]
            (U.el
                ([ U.width U.fill ]
                    ++ List.map U.htmlAttribute
                        ([ A.class "capsule-zoom"
                         , A.style "scale"
                            (if config.ouverte then
                                "1"

                             else
                                "0.88"
                            )
                         ]
                            ++ natif config.anime 520 [ Animator.float "scale" 1 ]
                        )
                )
                contenu
            )
        )


type alias Point =
    { x : Float, y : Float }


type alias Panneau msg =
    { cle : String, position : Point, ouvert : Bool, contenu : Element msg }


{-| Gabarit de mouvement natif généré par Animator. La propriété translate
est ensuite renseignée en pixels ou pourcentages selon le repère. Le gabarit
reste stable même pour une destination zéro, afin de permettre le retour animé.
-}
transition : Bool -> Float -> List (Html.Attribute msg)
transition anime duree =
    if anime then
        Animator.transition (Animator.ms duree) [ Animator.x 1, Animator.y 1 ]
            |> Animator.toCss
            |> .props
            |> List.filter (\( nom, _ ) -> nom == "transition")
            |> List.map (\( nom, valeur ) -> A.style nom valeur)

    else
        [ A.style "transition" "none" ]


plan : { camera : Point, largeur : Float, hauteur : Float, mouvement : Bool, anime : Bool, duree : Float, termine : msg, identifiant : String } -> List (Panneau msg) -> Element msg
plan config panneaux =
    let
        fin =
            D.map2 Tuple.pair (D.field "propertyName" D.string) (D.at [ "target", "id" ] D.string)
                |> D.andThen
                    (\( propriete, id ) ->
                        if propriete == "translate" && id == config.identifiant then
                            D.succeed config.termine

                        else
                            D.fail "Autre transition, sans effet sur cette fenêtre."
                    )

        panneau p =
            U.el
                ([ U.width U.fill ]
                    ++ List.map U.htmlAttribute
                        ([ A.class "continuite-panneau"
                         , A.attribute "data-panel" p.cle
                         , A.attribute "data-active"
                            (if p.ouvert then
                                "true"

                             else
                                "false"
                            )
                         , A.style "translate"
                            (String.fromFloat ((p.position.x - config.camera.x) * config.largeur)
                                ++ "px "
                                ++ String.fromFloat ((p.position.y - config.camera.y) * config.hauteur)
                                ++ "px"
                            )
                         ]
                            ++ transition config.anime config.duree
                            ++ (if p.ouvert then
                                    [ A.id config.identifiant, A.tabindex -1, Events.on "transitionend" fin ]
                                        ++ (if String.startsWith "moment-capsule-" config.identifiant then
                                                [ A.attribute "role" "tabpanel", A.attribute "aria-labelledby" (config.identifiant ++ "-onglet-" ++ String.fromInt (round p.position.x)) ]

                                            else
                                                []
                                           )

                                else
                                    [ A.attribute "inert" "", A.attribute "aria-hidden" "true" ]
                               )
                        )
                )
                p.contenu
    in
    U.column
        [ U.width U.fill
        , U.spacing 0
        , U.htmlAttribute (A.class "continuite-fenetre")
        , U.htmlAttribute
            (A.attribute "data-moving"
                (if config.mouvement then
                    "true"

                 else
                    "false"
                )
            )
        ]
        (List.map panneau panneaux)


repere : Point -> Bool -> Element msg
repere position anime =
    U.html <|
        Html.div
            ([ A.class "plan-repere"
             , A.attribute "aria-hidden" "true"
             , A.style "translate" (String.fromFloat (position.x * 100) ++ "% " ++ String.fromFloat (position.y * 100) ++ "%")
             ]
                ++ transition anime 460
            )
            []


ruban : Float -> Int -> Float -> Bool -> Element msg
ruban position nombre duree anime =
    U.el [ U.width U.fill ] <|
        U.html <|
            Html.div [ A.class "continuite-ruban", A.attribute "aria-hidden" "true" ]
                [ Html.div
                    ([ A.class "continuite-ruban-repere"
                     , A.style "width" (String.fromFloat (100 / toFloat nombre) ++ "%")
                     , A.style "translate" (String.fromFloat (position * 100) ++ "% 0")
                     ]
                        ++ transition anime duree
                    )
                    []
                ]
