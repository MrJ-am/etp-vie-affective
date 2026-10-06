module MrJam.Continuite exposing (Panneau, Point, plan, repere, ruban)

{-| Fenêtres dans un plan, sans état métier. Elm Animator produit les transitions
CSS natives ; le navigateur conserve les positions intermédiaires lors d'un
nouveau choix. Une seule mise en page ElmUI inclut les panneaux. Les propriétés
finales sont explicites, y compris sans mouvement.
-}

import Animator
import Element as U exposing (Element)
import Html
import Html.Attributes as A
import Html.Events as Events
import Json.Decode as D


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
