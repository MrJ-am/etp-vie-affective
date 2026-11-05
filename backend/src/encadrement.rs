//! Gestion des groupes et ressources pédagogiques. Aucun accès aux coffres.
use super::*;

pub(super) fn texte(v: &Value, cle: &str, max: usize) -> Result<String> {
    let s = strv(v, cle)?.trim();
    if s.is_empty() || s.chars().count() > max || s.chars().any(char::is_control) {
        return Err(Failure(400, "Champ manquant, trop long ou invalide."));
    }
    Ok(s.into())
}
pub(super) fn email(v: &Value) -> Result<String> {
    let s = texte(v, "email", 254)?.to_lowercase();
    let parts: Vec<_> = s.split('@').collect();
    if parts.len() != 2
        || parts[0].is_empty()
        || !parts[1].contains('.')
        || parts[1].starts_with('.')
        || parts[1].ends_with('.')
        || s.chars().any(char::is_whitespace)
        || !parts[1].is_ascii()
    {
        return Err(Failure(400, "Adresse mail invalide."));
    }
    Ok(s)
}
pub(super) async fn initialiser(db: &PgPool) -> std::result::Result<(), sqlx::Error> {
    sqlx::raw_sql(include_str!("../migrations/002-encadrement.sql"))
        .execute(db)
        .await?;
    let catalogue: Value = serde_json::from_str(include_str!("../../content/parcours.json"))
        .expect("catalogue versionné");
    for chapitre in catalogue["chapitres"].as_array().expect("chapitres") {
        sqlx::query("INSERT INTO seances(id,contenu) VALUES($1,$2) ON CONFLICT DO NOTHING")
            .bind(chapitre["id"].as_i64().expect("id") as i32)
            .bind(chapitre)
            .execute(db)
            .await?;
    }
    Ok(())
}
async fn encadrant(a: &App, id: Uuid) -> Result<()> {
    let autorise: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM comptes WHERE id=$1 AND actif AND role='encadrant')",
    )
    .bind(id)
    .fetch_one(&a.db)
    .await?;
    if !autorise {
        return Err(Failure(403, "Cet espace est réservé aux encadrant·es."));
    }
    Ok(())
}
async fn groupe(a: &App, acteur: Uuid, id: Uuid) -> Result<()> {
    encadrant(a, acteur).await?;
    let autorise: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM groupes WHERE id=$1 AND encadrant=$2)")
            .bind(id)
            .bind(acteur)
            .fetch_one(&a.db)
            .await?;
    if !autorise {
        return Err(Failure(404, "Groupe absent."));
    }
    Ok(())
}
async fn membre(a: &App, acteur: Uuid, cible: Uuid) -> Result<()> {
    encadrant(a, acteur).await?;
    let autorise: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM membres m JOIN groupes g ON g.id=m.groupe JOIN comptes c ON c.id=m.compte WHERE m.compte=$1 AND g.encadrant=$2 AND c.role='participant')")
        .bind(cible).bind(acteur).fetch_one(&a.db).await?;
    if !autorise {
        return Err(Failure(404, "Participant·e absent·e de vos groupes."));
    }
    Ok(())
}
fn invitation(v: &Value) -> Result<&str> {
    let token = strv(v, "invitation")?;
    if token.len() != 64 || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(bad());
    }
    Ok(token)
}
pub(super) async fn inscription(a: &App, v: &Value) -> Result<Response> {
    let token = invitation(v)?;
    let nom = texte(v, "nom", 100)?;
    let prenom = texte(v, "prenom", 100)?;
    let mail = email(v)?;
    let pw = password(v)?;
    payload(&v["payload"])?;
    let code = strv(v, "authRecovery")?;
    b64(code, Some(32))?;
    let hash = password_hash(a, pw, None).await?;
    let mut tx = a.db.begin().await?;
    // Le verrou sérialise inscription, archivage et rotation du lien.
    let gid: Uuid = sqlx::query_scalar("SELECT g.id FROM groupes g JOIN comptes c ON c.id=g.encadrant WHERE g.invitation=$1 AND NOT g.archive AND c.actif AND c.role='encadrant' FOR UPDATE OF g")
        .bind(token).fetch_optional(&mut *tx).await?.ok_or(Failure(410, "Cette invitation n’est plus disponible."))?;
    let id = Uuid::new_v4();
    let pseudo = format!("m_{}", id.simple());
    let result = sqlx::query("INSERT INTO comptes(id,pseudonyme,password_hash,auth_recovery_hash,nom,prenom,email) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING")
        .bind(id).bind(&pseudo).bind(&hash).bind(digest(code)).bind(nom).bind(prenom).bind(mail).execute(&mut *tx).await?;
    if result.rows_affected() == 0 {
        return Err(Failure(
            409,
            "Inscription impossible avec ces informations. Essayez de vous connecter.",
        ));
    }
    sqlx::query("INSERT INTO membres(compte,groupe) VALUES($1,$2)")
        .bind(id)
        .bind(gid)
        .execute(&mut *tx)
        .await?;
    sqlx::query("INSERT INTO coffres(compte,payload) VALUES($1,$2)")
        .bind(id)
        .bind(&v["payload"])
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    a.start(id, &pseudo, None, &hash).await
}
pub(super) async fn publique(a: &App, path: &str, v: &Value, peer: SocketAddr) -> Result<Response> {
    a.throttle(format!("invitation:{}", peer.ip()), 60)?;
    if path == "/api/inscription-groupe" {
        return inscription(a, v).await;
    }
    let row = sqlx::query("SELECT g.nom FROM groupes g JOIN comptes c ON c.id=g.encadrant WHERE g.invitation=$1 AND NOT g.archive AND c.actif AND c.role='encadrant'")
        .bind(invitation(v)?).fetch_optional(&a.db).await?.ok_or(Failure(410,"Cette invitation n’est plus disponible."))?;
    Ok(response(json!({"nom":row.get::<String,_>(0)})))
}
async fn parcours(a: &App, id: Uuid, apercu: Option<Uuid>) -> Result<Response> {
    let gid: Option<Uuid> = if let Some(gid) = apercu {
        groupe(a, id, gid).await?;
        Some(gid)
    } else {
        sqlx::query_scalar("SELECT groupe FROM membres WHERE compte=$1")
            .bind(id)
            .fetch_optional(&a.db)
            .await?
    };
    let rows = sqlx::query("SELECT s.id,s.contenu,s.revision FROM seances s WHERE $1::uuid IS NULL OR EXISTS(SELECT 1 FROM visibilites v WHERE v.groupe=$1 AND v.seance=s.id AND v.visible) ORDER BY s.id")
        .bind(gid).fetch_all(&a.db).await?;
    let mut seances = Vec::new();
    for r in rows {
        let sid: i32 = r.get(0);
        let pdfs = sqlx::query(
            "SELECT id,nom,octet_length(pdf) FROM supports WHERE seance=$1 ORDER BY nom,id",
        )
        .bind(sid)
        .fetch_all(&a.db)
        .await?;
        seances.push(json!({"id":sid,"contenu":r.get::<Value,_>(1),"revision":r.get::<i64,_>(2),"pdfs":pdfs.iter().map(|p|json!({"id":p.get::<Uuid,_>(0),"nom":p.get::<String,_>(1),"taille":p.get::<i32,_>(2)})).collect::<Vec<_>>()}));
    }
    let infos = if let Some(gid) = gid {
        let row = sqlx::query("SELECT nom,archive FROM groupes WHERE id=$1")
            .bind(gid)
            .fetch_one(&a.db)
            .await?;
        json!({"id":gid,"nom":row.get::<String,_>(0),"archive":row.get::<bool,_>(1)})
    } else {
        Value::Null
    };
    Ok(response(json!({"groupe":infos,"seances":seances})))
}
fn questions(v: &Value) -> Result<(Value, Value)> {
    let qs = v["questions"].as_array().ok_or_else(bad)?;
    if qs.is_empty() || qs.len() > 12 {
        return Err(Failure(
            400,
            "Un questionnaire contient de 1 à 12 questions.",
        ));
    }
    let mut checked = Vec::new();
    let mut counts = Vec::new();
    for q in qs {
        let titre = texte(q, "texte", 500)?;
        let options = q["options"].as_array().ok_or_else(bad)?;
        if options.len() < 2 || options.len() > 8 {
            return Err(Failure(400, "Chaque question propose de 2 à 8 choix."));
        }
        let mut labels = Vec::new();
        for opt in options {
            labels.push(texte(&json!({"option":opt}), "option", 200)?);
        }
        if labels
            .iter()
            .enumerate()
            .any(|(i, s)| labels[..i].contains(s))
        {
            return Err(Failure(400, "Les choix doivent être distincts."));
        }
        // Dernière case : abstention explicite, jamais une réponse libre identifiable.
        counts.push(json!(vec![0u64; labels.len() + 1]));
        checked.push(json!({"texte":titre,"options":labels}));
    }
    Ok((json!(checked), json!(counts)))
}
async fn repondre(a: &App, id: Uuid, qid: Uuid, v: &Value) -> Result<Response> {
    let choices = v["choix"].as_array().ok_or_else(bad)?;
    let mut tx = a.db.begin().await?;
    account_lock(&mut tx, id).await?;
    let row = sqlx::query("SELECT q.questions,q.compteurs,q.ouvert,g.archive FROM questionnaires q JOIN groupes g ON g.id=q.groupe JOIN membres m ON m.groupe=g.id WHERE q.id=$1 AND m.compte=$2 FOR UPDATE OF q,g")
        .bind(qid).bind(id).fetch_optional(&mut *tx).await?.ok_or(Failure(404,"Questionnaire absent."))?;
    if !row.get::<bool, _>(2) || row.get::<bool, _>(3) {
        return Err(Failure(409, "Ce questionnaire est fermé."));
    }
    let qs: Value = row.get(0);
    let mut counts: Value = row.get(1);
    if choices.len() != qs.as_array().ok_or_else(bad)?.len() {
        return Err(bad());
    }
    for (i, choice) in choices.iter().enumerate() {
        let n = qs[i]["options"].as_array().ok_or_else(bad)?.len();
        let c = if choice.is_null() {
            n
        } else {
            choice
                .as_u64()
                .filter(|c| *c < (n as u64))
                .ok_or_else(bad)? as usize
        };
        counts[i][c] = json!(counts[i][c].as_u64().ok_or_else(bad)? + 1);
    }
    let inserted = sqlx::query(
        "INSERT INTO participations(questionnaire,compte) VALUES($1,$2) ON CONFLICT DO NOTHING",
    )
    .bind(qid)
    .bind(id)
    .execute(&mut *tx)
    .await?;
    if inserted.rows_affected() == 0 {
        return Err(Failure(409, "Vous avez déjà participé à ce questionnaire."));
    }
    sqlx::query("UPDATE questionnaires SET compteurs=$1,reponses=reponses+1 WHERE id=$2")
        .bind(counts)
        .bind(qid)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(response(json!({"ok":true})))
}
pub(super) async fn api(
    a: &App,
    acteur: Uuid,
    path: &str,
    method: &str,
    h: &HeaderMap,
    v: &Value,
) -> Result<Response> {
    let parts: Vec<_> = path.trim_start_matches('/').split('/').collect();
    if path == "/api/parcours" && method == "GET" {
        return parcours(a, acteur, None).await;
    }
    if path == "/api/questionnaires" && method == "GET" {
        let rows=sqlx::query("SELECT q.id,q.titre,q.questions,EXISTS(SELECT 1 FROM participations p WHERE p.questionnaire=q.id AND p.compte=$1) FROM questionnaires q JOIN groupes g ON g.id=q.groupe JOIN membres m ON m.groupe=g.id WHERE m.compte=$1 AND q.ouvert AND NOT g.archive ORDER BY q.titre,q.id")
            .bind(acteur).fetch_all(&a.db).await?;
        return Ok(response(json!(rows.iter().map(|r|json!({"id":r.get::<Uuid,_>(0),"titre":r.get::<String,_>(1),"questions":r.get::<Value,_>(2),"participe":r.get::<bool,_>(3)})).collect::<Vec<_>>())));
    }
    if parts.len() == 4
        && parts[1] == "questionnaires"
        && parts[3] == "reponses"
        && method == "POST"
    {
        return repondre(a, acteur, uid(parts[2])?, v).await;
    }
    if parts.len() == 3 && parts[1] == "supports" && method == "GET" {
        let pdfid = uid(parts[2])?;
        let row=sqlx::query("SELECT p.pdf FROM supports p WHERE p.id=$1 AND (EXISTS(SELECT 1 FROM comptes c WHERE c.id=$2 AND c.role='encadrant') OR NOT EXISTS(SELECT 1 FROM membres m WHERE m.compte=$2) OR EXISTS(SELECT 1 FROM membres m JOIN visibilites v ON v.groupe=m.groupe WHERE m.compte=$2 AND v.seance=p.seance AND v.visible))")
            .bind(pdfid).bind(acteur).fetch_optional(&a.db).await?.ok_or(Failure(404,"Support absent ou séance masquée."))?;
        let bytes: Vec<u8> = row.get(0);
        let mut r = (
            [
                ("content-type", "application/pdf"),
                (
                    "content-disposition",
                    "attachment; filename=\"support.pdf\"",
                ),
            ],
            Body::from(bytes),
        )
            .into_response();
        r.headers_mut().insert(
            "content-security-policy",
            "sandbox; default-src 'none'".parse().unwrap(),
        );
        return Ok(r);
    }
    encadrant(a, acteur).await?;
    if path == "/api/groupes" {
        if method == "GET" {
            let rows=sqlx::query("SELECT g.id,g.nom,g.archive,g.invitation,(SELECT count(*) FROM membres m WHERE m.groupe=g.id) FROM groupes g WHERE g.encadrant=$1 ORDER BY g.archive,g.nom,g.id")
                .bind(acteur).fetch_all(&a.db).await?;
            return Ok(response(json!(rows.iter().map(|r|json!({"id":r.get::<Uuid,_>(0),"nom":r.get::<String,_>(1),"archive":r.get::<bool,_>(2),"invitation":format!("{}/espace.html#invitation={}",a.origin,r.get::<String,_>(3)),"effectif":r.get::<i64,_>(4)})).collect::<Vec<_>>())));
        }
        if method == "POST" {
            let nom = texte(v, "nom", 160)?;
            let id = Uuid::new_v4();
            let token = secret(32);
            let mut tx = a.db.begin().await?;
            account_lock(&mut tx, acteur).await?;
            sqlx::query("INSERT INTO groupes(id,encadrant,nom,invitation) VALUES($1,$2,$3,$4)")
                .bind(id)
                .bind(acteur)
                .bind(nom)
                .bind(&token)
                .execute(&mut *tx)
                .await?;
            sqlx::query("INSERT INTO visibilites(groupe,seance) SELECT $1,id FROM seances")
                .bind(id)
                .execute(&mut *tx)
                .await?;
            tx.commit().await?;
            return Ok(response(
                json!({"id":id,"invitation":format!("{}/espace.html#invitation={token}",a.origin)}),
            ));
        }
    }
    if parts.len() >= 3 && parts[1] == "groupes" {
        let gid = uid(parts[2])?;
        groupe(a, acteur, gid).await?;
        if parts.len() == 3 && method == "PATCH" {
            let nom = texte(v, "nom", 160)?;
            let archive = v["archive"].as_bool().ok_or_else(bad)?;
            sqlx::query("UPDATE groupes SET nom=$1,archive=$2 WHERE id=$3 AND encadrant=$4")
                .bind(nom)
                .bind(archive)
                .bind(gid)
                .bind(acteur)
                .execute(&a.db)
                .await?;
            return Ok(response(json!({"ok":true})));
        }
        if parts.len() == 4 {
            match (parts[3], method) {
                ("invitation", "POST") => {
                    let token = secret(32);
                    sqlx::query("UPDATE groupes SET invitation=$1 WHERE id=$2 AND encadrant=$3")
                        .bind(&token)
                        .bind(gid)
                        .bind(acteur)
                        .execute(&a.db)
                        .await?;
                    return Ok(response(
                        json!({"invitation":format!("{}/espace.html#invitation={token}",a.origin)}),
                    ));
                }
                ("apercu", "GET") => return parcours(a, acteur, Some(gid)).await,
                ("membres", "GET") => {
                    let rows=sqlx::query("SELECT c.id,c.nom,c.prenom,c.email,c.pseudonyme,c.actif FROM comptes c JOIN membres m ON m.compte=c.id WHERE m.groupe=$1 ORDER BY c.nom,c.prenom,c.id").bind(gid).fetch_all(&a.db).await?;
                    return Ok(response(json!(rows.iter().map(|r|json!({"id":r.get::<Uuid,_>(0),"nom":r.get::<Option<String>,_>(1),"prenom":r.get::<Option<String>,_>(2),"email":r.get::<Option<String>,_>(3),"pseudonyme":r.get::<String,_>(4),"actif":r.get::<bool,_>(5)})).collect::<Vec<_>>())));
                }
                ("seances", "GET") => {
                    let rows=sqlx::query("SELECT s.id,s.contenu,s.revision,v.visible,(SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nom',p.nom) ORDER BY p.nom,p.id),'[]'::jsonb) FROM supports p WHERE p.seance=s.id) FROM seances s JOIN visibilites v ON v.seance=s.id WHERE v.groupe=$1 ORDER BY s.id").bind(gid).fetch_all(&a.db).await?;
                    return Ok(response(json!(rows.iter().map(|r|json!({"id":r.get::<i32,_>(0),"contenu":r.get::<Value,_>(1),"revision":r.get::<i64,_>(2),"visible":r.get::<bool,_>(3),"pdfs":r.get::<Value,_>(4)})).collect::<Vec<_>>())));
                }
                ("questionnaires", "GET") => {
                    let rows=sqlx::query("SELECT id,titre,questions,ouvert,reponses,compteurs FROM questionnaires WHERE groupe=$1 ORDER BY titre,id").bind(gid).fetch_all(&a.db).await?;
                    return Ok(response(json!(rows.iter().map(|r|{
                        let ouvert:bool=r.get(3);let n:i32=r.get(4);
                        json!({"id":r.get::<Uuid,_>(0),"titre":r.get::<String,_>(1),"questions":r.get::<Value,_>(2),"ouvert":ouvert,"reponses":n,"compteurs":if !ouvert && n>=3 {r.get::<Value,_>(5)}else{Value::Null}})
                    }).collect::<Vec<_>>())));
                }
                ("questionnaires", "POST") => {
                    let titre = texte(v, "titre", 160)?;
                    let (qs, counts) = questions(v)?;
                    let qid = Uuid::new_v4();
                    let mut tx = a.db.begin().await?;
                    let archive: bool =
                        sqlx::query_scalar("SELECT archive FROM groupes WHERE id=$1 FOR UPDATE")
                            .bind(gid)
                            .fetch_one(&mut *tx)
                            .await?;
                    if archive {
                        return Err(Failure(
                            409,
                            "Réactivez le groupe avant de lancer un questionnaire.",
                        ));
                    }
                    sqlx::query("INSERT INTO questionnaires(id,groupe,titre,questions,compteurs) VALUES($1,$2,$3,$4,$5)").bind(qid).bind(gid).bind(titre).bind(qs).bind(counts).execute(&mut *tx).await?;
                    tx.commit().await?;
                    return Ok(response(json!({"id":qid})));
                }
                _ => {}
            }
        }
        if parts.len() == 5 && parts[3] == "seances" && method == "PUT" {
            let sid = parts[4].parse::<i32>().map_err(|_| bad())?;
            let visible = v["visible"].as_bool().ok_or_else(bad)?;
            let result =
                sqlx::query("UPDATE visibilites SET visible=$1 WHERE groupe=$2 AND seance=$3")
                    .bind(visible)
                    .bind(gid)
                    .bind(sid)
                    .execute(&a.db)
                    .await?;
            if result.rows_affected() == 0 {
                return Err(Failure(404, "Séance absente."));
            }
            return Ok(response(json!({"ok":true})));
        }
    }
    if parts.len() == 3 && parts[1] == "utilisatrices" {
        let cible = uid(parts[2])?;
        membre(a, acteur, cible).await?;
        if method == "PATCH" || method == "DELETE" {
            let mut tx = a.db.begin().await?;
            // Une cible désactivée doit pouvoir être réactivée ou supprimée.
            sqlx::query("SELECT id FROM comptes WHERE id=$1 FOR UPDATE")
                .bind(cible)
                .fetch_optional(&mut *tx)
                .await?
                .ok_or(Failure(404, "Compte absent."))?;
            // Revalidation sous verrou, y compris si un opérateur vient de changer le rôle.
            let allowed:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM comptes c JOIN membres m ON m.compte=c.id JOIN groupes g ON g.id=m.groupe WHERE c.id=$1 AND c.role='participant' AND g.encadrant=$2)").bind(cible).bind(acteur).fetch_one(&mut *tx).await?;
            if !allowed {
                return Err(Failure(404, "Participant·e absent·e de vos groupes."));
            }
            if method == "PATCH" {
                let actif = v["actif"].as_bool().ok_or_else(bad)?;
                sqlx::query("UPDATE comptes SET actif=$1 WHERE id=$2")
                    .bind(actif)
                    .bind(cible)
                    .execute(&mut *tx)
                    .await?;
                sqlx::query("DELETE FROM sessions WHERE compte=$1")
                    .bind(cible)
                    .execute(&mut *tx)
                    .await?;
            } else {
                if v["confirmation"] != "SUPPRIMER" {
                    return Err(Failure(400, "Confirmez la suppression définitive."));
                }
                a.deletion(cible)?;
                sqlx::query("INSERT INTO suppressions(compte) VALUES($1) ON CONFLICT DO NOTHING")
                    .bind(cible)
                    .execute(&mut *tx)
                    .await?;
                sqlx::query("DELETE FROM comptes WHERE id=$1")
                    .bind(cible)
                    .execute(&mut *tx)
                    .await?;
            }
            tx.commit().await?;
            return Ok(response(json!({"ok":true})));
        }
    }
    if parts.len() == 4 && parts[1] == "questionnaires" && parts[3] == "fermer" && method == "POST"
    {
        let qid = uid(parts[2])?;
        let result=sqlx::query("UPDATE questionnaires q SET ouvert=false FROM groupes g WHERE q.id=$1 AND q.groupe=g.id AND g.encadrant=$2").bind(qid).bind(acteur).execute(&a.db).await?;
        if result.rows_affected() == 0 {
            return Err(Failure(404, "Questionnaire absent."));
        }
        return Ok(response(json!({"ok":true})));
    }
    if parts.len() == 3 && parts[1] == "seances" && method == "PUT" {
        let sid = parts[2].parse::<i32>().map_err(|_| bad())?;
        let expected = revision(h)?;
        let mut tx = a.db.begin().await?;
        let row = sqlx::query("SELECT contenu,revision FROM seances WHERE id=$1 FOR UPDATE")
            .bind(sid)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(Failure(404, "Séance absente."))?;
        if row.get::<i64, _>(1) != expected {
            return Err(Failure(
                409,
                "Cette séance a changé. Rechargez-la avant de modifier.",
            ));
        }
        let mut contenu: Value = row.get(0);
        for key in [
            "titre",
            "sousTitre",
            "objectif",
            "intro",
            "approfondissement",
            "question",
            "petitPas",
        ] {
            let text = strv(v, key)?;
            if text.chars().count() > 10000
                || text.contains('\0')
                || (key == "titre" && text.trim().is_empty())
            {
                return Err(bad());
            }
            contenu[key] = json!(text);
        }
        let essentiel = v["essentiel"].as_array().ok_or_else(bad)?;
        if essentiel.is_empty()
            || essentiel.len() > 30
            || essentiel.iter().any(|x| {
                x.as_str().is_none_or(|s| {
                    s.trim().is_empty() || s.chars().count() > 2000 || s.contains('\0')
                })
            })
        {
            return Err(bad());
        }
        contenu["essentiel"] = json!(essentiel);
        sqlx::query("UPDATE seances SET contenu=$1,revision=revision+1 WHERE id=$2")
            .bind(contenu)
            .bind(sid)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        return Ok(etag(json!({"revision":expected+1}), expected + 1));
    }
    if path == "/api/supports" && method == "POST" {
        let sid = v["seance"]
            .as_i64()
            .filter(|s| (0..=14).contains(s))
            .ok_or_else(bad)? as i32;
        let nom = texte(v, "nom", 160)?;
        let encoded = strv(v, "pdf")?;
        if encoded.len() > 2_666_668 {
            return Err(Failure(413, "PDF limité à 2 Mo."));
        }
        let pdf = STANDARD.decode(encoded).map_err(|_| bad())?;
        if STANDARD.encode(&pdf) != encoded
            || pdf.len() < 12
            || pdf.len() > 2_000_000
            || !pdf.starts_with(b"%PDF-")
            || !pdf.windows(5).rev().take(1024).any(|w| w == b"%%EOF")
        {
            return Err(Failure(400, "Fichier PDF invalide (2 Mo maximum)."));
        }
        let id = Uuid::new_v4();
        let mut tx = a.db.begin().await?;
        let exists = sqlx::query("SELECT id FROM seances WHERE id=$1 FOR UPDATE")
            .bind(sid)
            .fetch_optional(&mut *tx)
            .await?;
        if exists.is_none() {
            return Err(Failure(404, "Séance absente."));
        }
        let n: i64 = sqlx::query_scalar("SELECT count(*) FROM supports WHERE seance=$1")
            .bind(sid)
            .fetch_one(&mut *tx)
            .await?;
        if n >= 20 {
            return Err(Failure(413, "Vingt PDF maximum par séance."));
        }
        sqlx::query("INSERT INTO supports(id,seance,nom,pdf) VALUES($1,$2,$3,$4)")
            .bind(id)
            .bind(sid)
            .bind(nom)
            .bind(pdf)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        return Ok(response(json!({"id":id})));
    }
    if parts.len() == 3 && parts[1] == "supports" && method == "DELETE" {
        sqlx::query("DELETE FROM supports WHERE id=$1")
            .bind(uid(parts[2])?)
            .execute(&a.db)
            .await?;
        return Ok(response(json!({"ok":true})));
    }
    Err(Failure(404, "Route absente."))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn identites_et_questions_bornees() {
        assert_eq!(
            email(&json!({"email":" LEA@example.test "})).unwrap(),
            "lea@example.test"
        );
        for mail in ["lea", "a@", "@b.test", "a@@b.test", "a b@c.test", "a@.test"] {
            assert!(email(&json!({"email":mail})).is_err());
        }
        assert!(texte(&json!({"nom":"\n"}), "nom", 100).is_err());
        let (_, counts) = questions(
            &json!({"questions":[{"texte":"Votre ressenti ?","options":["Bien","Moyen"]}]}),
        )
        .unwrap();
        assert_eq!(counts, json!([[0, 0, 0]]));
        assert!(questions(&json!({"questions":[]})).is_err());
        assert!(
            questions(&json!({"questions":[{"texte":"Question","options":["Oui","Oui"]}]}))
                .is_err()
        );
    }
}
