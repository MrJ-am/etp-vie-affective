//! The server authorizes opaque ciphertext. It has no vault decryption code or keys.
#![forbid(unsafe_code)]
use axum::{
    Router,
    body::{Body, to_bytes},
    extract::{ConnectInfo, Request, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::any,
};
use base64::{Engine, engine::general_purpose::STANDARD};
use rand::RngCore;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row, postgres::PgConnectOptions};
use std::{
    collections::HashMap,
    env,
    io::Write,
    net::SocketAddr,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use subtle::ConstantTimeEq;
use uuid::Uuid;

#[derive(Clone)]
struct App {
    db: PgPool,
    origin: String,
    secure: bool,
    ledger: String,
    ledger_lock: Arc<Mutex<()>>,
    rates: Arc<Mutex<HashMap<String, (Instant, u32)>>>,
    auth_jobs: Arc<tokio::sync::Semaphore>,
}
#[derive(Debug)]
struct Failure(u16, &'static str);
type Result<T> = std::result::Result<T, Failure>;
impl IntoResponse for Failure {
    fn into_response(self) -> Response {
        let mut r = (
            StatusCode::from_u16(self.0).unwrap(),
            axum::Json(json!({"error":self.1})),
        )
            .into_response();
        if self.0 == 429 {
            r.headers_mut()
                .insert("retry-after", "900".parse().unwrap());
        }
        r
    }
}
impl From<sqlx::Error> for Failure {
    fn from(_: sqlx::Error) -> Self {
        Self(
            503,
            "Service indisponible. La copie locale reste conservée.",
        )
    }
}
fn bad() -> Failure {
    Failure(400, "Requête ou enveloppe chiffrée invalide.")
}
fn setting(k: &str, default: &str) -> String {
    env::var(k).unwrap_or(default.into())
}
fn secret(n: usize) -> String {
    let mut b = vec![0; n];
    rand::rngs::OsRng.fill_bytes(&mut b);
    hex::encode(b)
}
fn digest(s: &str) -> String {
    hex::encode(Sha256::digest(s.as_bytes()))
}
fn equal(a: &str, b: &str) -> bool {
    bool::from(a.as_bytes().ct_eq(b.as_bytes()))
}
fn strv<'a>(v: &'a Value, k: &str) -> Result<&'a str> {
    v[k].as_str().ok_or_else(bad)
}
fn uid(s: &str) -> Result<Uuid> {
    let id = Uuid::parse_str(s).map_err(|_| bad())?;
    if id.to_string() != s {
        return Err(bad());
    }
    Ok(id)
}
fn exact(v: &Value, keys: &[&str]) -> Result<()> {
    let o = v.as_object().ok_or_else(bad)?;
    if o.len() != keys.len() || keys.iter().any(|k| !o.contains_key(*k)) {
        return Err(bad());
    }
    Ok(())
}
fn b64(s: &str, n: Option<usize>) -> Result<()> {
    if s.len() > 3_000_000 {
        return Err(bad());
    }
    let b = STANDARD.decode(s).map_err(|_| bad())?;
    if STANDARD.encode(&b) != s || n.is_some_and(|n| b.len() != n) || (n.is_none() && b.len() < 16)
    {
        return Err(bad());
    }
    Ok(())
}
fn envelope(v: &Value, vault: &str, object: &str, wrapped: bool) -> Result<()> {
    exact(
        v,
        if wrapped {
            &["v", "vault", "object", "iv", "ct", "salt", "rounds"]
        } else {
            &["v", "vault", "object", "iv", "ct"]
        },
    )?;
    if v["v"] != 1 || v["vault"] != vault || v["object"] != object {
        return Err(bad());
    }
    b64(strv(v, "iv")?, Some(12))?;
    b64(strv(v, "ct")?, None)?;
    if wrapped {
        b64(strv(v, "salt")?, Some(16))?;
        if v["rounds"] != 600000 {
            return Err(bad());
        }
    }
    Ok(())
}
fn payload(v: &Value) -> Result<()> {
    exact(v, &["keyring", "envelope"])?;
    let k = &v["keyring"];
    exact(k, &["v", "vault", "phrase", "recovery"])?;
    let vault = strv(k, "vault")?;
    uid(vault)?;
    if k["v"] != 1 {
        return Err(bad());
    }
    envelope(&v["envelope"], vault, "journal", false)?;
    envelope(&k["phrase"], vault, "phrase", true)?;
    envelope(&k["recovery"], vault, "recovery", false)
}
fn pseudo(v: &Value) -> Result<String> {
    let p = strv(v, "pseudonyme")?;
    if !(3..=40).contains(&p.len())
        || !p
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        return Err(bad());
    }
    Ok(p.to_ascii_lowercase())
}
fn password(v: &Value) -> Result<String> {
    let p = strv(v, "password")?;
    if !(12..=1024).contains(&p.chars().count()) {
        return Err(bad());
    }
    Ok(p.into())
}
async fn password_hash(a: &App, p: String, stored: Option<String>) -> Result<String> {
    let permit = a
        .auth_jobs
        .clone()
        .try_acquire_owned()
        .map_err(|_| Failure(429, "Trop de tentatives."))?;
    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        let salt = if let Some(ref s) = stored {
            s.split('$').nth(1).ok_or_else(bad)?.to_string()
        } else {
            secret(16)
        };
        let bytes = hex::decode(&salt).map_err(|_| bad())?;
        if bytes.len() != 16 {
            return Err(bad());
        }
        let mut output = [0; 32];
        scrypt::scrypt(
            p.as_bytes(),
            &bytes,
            &scrypt::Params::new(15, 8, 3, 32).map_err(|_| bad())?,
            &mut output,
        )
        .map_err(|_| bad())?;
        let computed = format!("scrypt-v1${salt}${}", hex::encode(output));
        if stored.as_ref().is_some_and(|s| !equal(s, &computed)) {
            return Err(Failure(401, "Identifiant ou mot de passe incorrect."));
        }
        Ok(computed)
    })
    .await
    .map_err(|_| bad())?
}
fn header<'a>(h: &'a HeaderMap, k: &str) -> &'a str {
    h.get(k).and_then(|v| v.to_str().ok()).unwrap_or("")
}
fn revision(h: &HeaderMap) -> Result<i64> {
    let s = header(h, "if-match");
    if s.len() < 3
        || !s.starts_with('"')
        || !s.ends_with('"')
        || !s[1..s.len() - 1].bytes().all(|b| b.is_ascii_digit())
    {
        return Err(Failure(428, "Révision If-Match requise."));
    }
    s[1..s.len() - 1].parse().map_err(|_| bad())
}
fn response(v: Value) -> Response {
    axum::Json(v).into_response()
}
fn etag(v: Value, r: i64) -> Response {
    let mut out = response(v);
    out.headers_mut()
        .insert("etag", format!("\"{r}\"").parse().unwrap());
    out
}
fn cookie(r: &mut Response, token: &str, secure: bool, expire: bool) {
    r.headers_mut().insert(
        "set-cookie",
        format!(
            "carnet-session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={}{}",
            if expire { 0 } else { 86400 },
            if secure { "; Secure" } else { "" }
        )
        .parse()
        .unwrap(),
    );
}
impl App {
    fn throttle(&self, key: String, limit: u32) -> Result<()> {
        let mut rates = self.rates.lock().map_err(|_| bad())?;
        rates.retain(|_, (t, _)| t.elapsed() < Duration::from_secs(900));
        if rates.len() >= 10000 && !rates.contains_key(&key) {
            return Err(Failure(429, "Trop de tentatives."));
        }
        let r = rates.entry(key).or_insert((Instant::now(), 0));
        r.1 += 1;
        if r.1 > limit {
            return Err(Failure(429, "Trop de tentatives. Réessayez plus tard."));
        }
        Ok(())
    }
    async fn session(&self, h: &HeaderMap) -> Result<(Uuid, String, String)> {
        let token = header(h, "cookie")
            .split(';')
            .find_map(|s| s.trim().strip_prefix("carnet-session="))
            .unwrap_or("");
        if token.len() != 64 {
            return Err(Failure(401, "Connectez-vous pour accéder à votre compte."));
        }
        let hash = digest(token);
        let row=sqlx::query("UPDATE sessions SET last_seen=now() WHERE token_hash=$1 AND expires_at>now() AND last_seen>now()-interval '2 hours' RETURNING compte,csrf").bind(&hash).fetch_optional(&self.db).await?.ok_or(Failure(401,"Session expirée."))?;
        let id: Uuid = row.get(0);
        sqlx::query("UPDATE comptes SET last_seen=now() WHERE id=$1")
            .bind(id)
            .execute(&self.db)
            .await?;
        Ok((id, row.get(1), hash))
    }
    async fn start(
        &self,
        id: Uuid,
        p: &str,
        recovery: Option<&str>,
        expected_hash: &str,
    ) -> Result<Response> {
        // A password reset and session creation serialize on the account row.
        let mut tx = self.db.begin().await?;
        let current: String =
            sqlx::query_scalar("SELECT password_hash FROM comptes WHERE id=$1 FOR UPDATE")
                .bind(id)
                .fetch_optional(&mut *tx)
                .await?
                .ok_or(Failure(401, "Compte absent."))?;
        if !equal(&current, expected_hash) {
            return Err(Failure(401, "Le compte a changé. Reconnectez-vous."));
        }
        let t = secret(32);
        let csrf = secret(32);
        sqlx::query("INSERT INTO sessions(token_hash,compte,csrf,expires_at) VALUES($1,$2,$3,now()+interval '24 hours')").bind(digest(&t)).bind(id).bind(&csrf).execute(&mut *tx).await?;
        tx.commit().await?;
        let mut r = response(json!({"id":id,"pseudonyme":p,"csrf":csrf,"authRecovery":recovery}));
        cookie(&mut r, &t, self.secure, false);
        Ok(r)
    }
    fn deletion(&self, id: Uuid) -> Result<()> {
        let _lock = self.ledger_lock.lock().map_err(|_| bad())?;
        let mut f = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.ledger)
            .map_err(|_| Failure(503, "Journal des suppressions indisponible."))?;
        writeln!(f, "{id}")
            .and_then(|_| f.sync_all())
            .map_err(|_| Failure(503, "Journal des suppressions indisponible."))?;
        Ok(())
    }
}
async fn quota(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    id: Uuid,
    add: i64,
    remove: i64,
) -> Result<()> {
    let used:i64=sqlx::query_scalar("SELECT coalesce((SELECT octet_length(payload::text) FROM coffres WHERE compte=$1),0)::bigint+coalesce((SELECT sum(octet_length(payload::text)) FROM objets WHERE compte=$1),0)::bigint+coalesce((SELECT sum(octet_length(payload::text)+octet_length(images::text)) FROM archives WHERE compte=$1),0)::bigint").bind(id).fetch_one(&mut **tx).await?;
    if used + add - remove > 64_000_000 {
        return Err(Failure(413, "Quota de 64 Mo atteint, archives comprises."));
    }
    Ok(())
}
async fn account_lock(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, id: Uuid) -> Result<()> {
    sqlx::query("SELECT id FROM comptes WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(Failure(401, "Compte absent."))?;
    Ok(())
}
async fn api(
    a: &App,
    path: &str,
    method: &str,
    h: &HeaderMap,
    v: Value,
    peer: SocketAddr,
) -> Result<Response> {
    if !matches!(method, "GET" | "HEAD") && header(h, "origin") != a.origin {
        return Err(Failure(403, "Origine non autorisée."));
    }
    if path == "/api/health" && method == "GET" {
        sqlx::query("SELECT 1").execute(&a.db).await?;
        return Ok(response(json!({"status":"ok","prototype":true})));
    }
    if matches!(path, "/api/register" | "/api/login" | "/api/reset-auth") && method == "POST" {
        a.throttle(format!("{path}:{}", peer.ip()), 60)?;
        let p = pseudo(&v)?;
        let pw = password(&v)?;
        a.throttle(format!("identity:{path}:{}", digest(&p)), 30)?;
        if path == "/api/register" {
            payload(&v["payload"])?;
            let code = strv(&v, "authRecovery")?;
            b64(code, Some(32))?;
            let hash = password_hash(a, pw, None).await?;
            let id = Uuid::new_v4();
            let mut tx = a.db.begin().await?;
            let inserted=sqlx::query("INSERT INTO comptes(id,pseudonyme,password_hash,auth_recovery_hash) VALUES($1,$2,$3,$4) ON CONFLICT(pseudonyme) DO NOTHING").bind(id).bind(&p).bind(&hash).bind(digest(code)).execute(&mut *tx).await?;
            if inserted.rows_affected() == 0 {
                return Err(Failure(409, "Cet identifiant n’est pas disponible."));
            }
            sqlx::query("INSERT INTO coffres(compte,payload) VALUES($1,$2)")
                .bind(id)
                .bind(&v["payload"])
                .execute(&mut *tx)
                .await?;
            tx.commit().await?;
            return a.start(id, &p, None, &hash).await;
        }
        if path == "/api/login" {
            let row = sqlx::query("SELECT id,password_hash FROM comptes WHERE pseudonyme=$1")
                .bind(&p)
                .fetch_optional(&a.db)
                .await?;
            let stored = row
                .as_ref()
                .map(|r| r.get::<String, _>(1))
                .unwrap_or(format!("scrypt-v1${}${}", "00".repeat(16), "00".repeat(32)));
            password_hash(a, pw, Some(stored.clone())).await?;
            return a
                .start(
                    row.ok_or(Failure(401, "Identifiant ou mot de passe incorrect."))?
                        .get(0),
                    &p,
                    None,
                    &stored,
                )
                .await;
        }
        let code = strv(&v, "code")?;
        let next = strv(&v, "newCode")?;
        b64(code, Some(32))?;
        b64(next, Some(32))?;
        let hash = password_hash(a, pw, None).await?;
        let mut tx = a.db.begin().await?;
        let row =
            sqlx::query("SELECT id,auth_recovery_hash FROM comptes WHERE pseudonyme=$1 FOR UPDATE")
                .bind(&p)
                .fetch_optional(&mut *tx)
                .await?
                .ok_or(Failure(401, "Récupération impossible."))?;
        if !equal(&row.get::<String, _>(1), &digest(code)) {
            return Err(Failure(401, "Récupération impossible."));
        }
        let id: Uuid = row.get(0);
        sqlx::query("UPDATE comptes SET password_hash=$1,auth_recovery_hash=$2 WHERE id=$3")
            .bind(&hash)
            .bind(digest(next))
            .bind(id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM sessions WHERE compte=$1")
            .bind(id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        return a.start(id, &p, Some(next), &hash).await;
    }
    let (id, csrf, token) = a.session(h).await?;
    if !matches!(method, "GET" | "HEAD") && !equal(&csrf, header(h, "x-carnet-csrf")) {
        return Err(Failure(403, "Protection de session refusée."));
    }
    match (path, method) {
        ("/api/me", "GET") => {
            let p: String = sqlx::query_scalar("SELECT pseudonyme FROM comptes WHERE id=$1")
                .bind(id)
                .fetch_one(&a.db)
                .await?;
            Ok(response(json!({"id":id,"pseudonyme":p,"csrf":csrf})))
        }
        ("/api/logout", "POST") => {
            sqlx::query("DELETE FROM sessions WHERE token_hash=$1")
                .bind(token)
                .execute(&a.db)
                .await?;
            let mut r = response(json!({"ok":true}));
            cookie(&mut r, "", a.secure, true);
            Ok(r)
        }
        ("/api/state", "GET") => {
            let row = sqlx::query("SELECT revision,payload FROM coffres WHERE compte=$1")
                .bind(id)
                .fetch_one(&a.db)
                .await?;
            let rev: i64 = row.get(0);
            Ok(etag(
                json!({"revision":rev,"payload":row.get::<Value,_>(1)}),
                rev,
            ))
        }
        ("/api/state", "PUT") | ("/api/new-vault", "POST") => {
            let expected = revision(h)?;
            payload(&v)?;
            let mut tx = a.db.begin().await?;
            account_lock(&mut tx, id).await?;
            let old=sqlx::query("SELECT revision,payload,octet_length(payload::text) FROM coffres WHERE compte=$1 FOR UPDATE").bind(id).fetch_one(&mut *tx).await?;
            let rev: i64 = old.get(0);
            if rev != expected {
                return Err(Failure(
                    409,
                    "Une autre version existe. Votre copie locale est conservée.",
                ));
            }
            let previous: Value = old.get(1);
            if path == "/api/state" {
                if previous["keyring"]["vault"] != v["keyring"]["vault"] {
                    return Err(bad());
                }
                quota(
                    &mut tx,
                    id,
                    v.to_string().len() as i64 + 128,
                    old.get::<i32, _>(2) as i64,
                )
                .await?;
            } else {
                // Conservatively budget the full archived state and images before replacement.
                quota(&mut tx, id, v.to_string().len() as i64 + 512, 0).await?;
                sqlx::query("INSERT INTO archives(id,compte,payload,images) VALUES($1,$2,$3,(SELECT coalesce(jsonb_agg(payload),'[]'::jsonb) FROM objets WHERE compte=$2))").bind(Uuid::new_v4()).bind(id).bind(previous).execute(&mut *tx).await?;
                sqlx::query("DELETE FROM objets WHERE compte=$1")
                    .bind(id)
                    .execute(&mut *tx)
                    .await?;
            }
            sqlx::query("UPDATE coffres SET payload=$1,revision=revision+1,updated_at=now() WHERE compte=$2").bind(&v).bind(id).execute(&mut *tx).await?;
            tx.commit().await?;
            Ok(etag(json!({"revision":rev+1}), rev + 1))
        }
        ("/api/objects", "GET") => {
            let rows: Vec<Value> =
                sqlx::query_scalar("SELECT payload FROM objets WHERE compte=$1 ORDER BY id")
                    .bind(id)
                    .fetch_all(&a.db)
                    .await?;
            Ok(response(json!(rows)))
        }
        ("/api/archives", "GET") => {
            let rows = sqlx::query(
                "SELECT payload,images FROM archives WHERE compte=$1 ORDER BY created_at",
            )
            .bind(id)
            .fetch_all(&a.db)
            .await?;
            Ok(response(json!(
                rows.iter()
                    .map(|r| json!({"payload":r.get::<Value,_>(0),"images":r.get::<Value,_>(1)}))
                    .collect::<Vec<_>>()
            )))
        }
        ("/api/archives", "DELETE") => {
            sqlx::query("DELETE FROM archives WHERE compte=$1")
                .bind(id)
                .execute(&a.db)
                .await?;
            Ok(response(json!({"ok":true})))
        }
        ("/api/account", "DELETE") => {
            let pw = password(&v)?;
            let stored: String =
                sqlx::query_scalar("SELECT password_hash FROM comptes WHERE id=$1")
                    .bind(id)
                    .fetch_one(&a.db)
                    .await?;
            password_hash(a, pw, Some(stored.clone())).await?;
            let mut tx = a.db.begin().await?;
            account_lock(&mut tx, id).await?;
            let current: String =
                sqlx::query_scalar("SELECT password_hash FROM comptes WHERE id=$1")
                    .bind(id)
                    .fetch_one(&mut *tx)
                    .await?;
            if current != stored {
                return Err(Failure(409, "Le compte a changé. Reconnectez-vous."));
            }
            a.deletion(id)?;
            sqlx::query("INSERT INTO suppressions(compte) VALUES($1) ON CONFLICT DO NOTHING")
                .bind(id)
                .execute(&mut *tx)
                .await?;
            sqlx::query("DELETE FROM comptes WHERE id=$1")
                .bind(id)
                .execute(&mut *tx)
                .await?;
            tx.commit().await?;
            let mut r = response(json!({"ok":true}));
            cookie(&mut r, "", a.secure, true);
            Ok(r)
        }
        _ if path.starts_with("/api/objects/") => {
            let object = uid(&path[13..])?;
            match method {
                "GET" => {
                    let v: Value =
                        sqlx::query_scalar("SELECT payload FROM objets WHERE compte=$1 AND id=$2")
                            .bind(id)
                            .bind(object)
                            .fetch_optional(&a.db)
                            .await?
                            .ok_or(Failure(404, "Objet absent."))?;
                    Ok(response(v))
                }
                "DELETE" => {
                    sqlx::query("DELETE FROM objets WHERE compte=$1 AND id=$2")
                        .bind(id)
                        .bind(object)
                        .execute(&a.db)
                        .await?;
                    Ok(response(json!({"ok":true})))
                }
                "PUT" => {
                    let mut tx = a.db.begin().await?;
                    account_lock(&mut tx, id).await?;
                    let vault: String = sqlx::query_scalar(
                        "SELECT payload->'keyring'->>'vault' FROM coffres WHERE compte=$1",
                    )
                    .bind(id)
                    .fetch_one(&mut *tx)
                    .await?;
                    envelope(&v, &vault, &object.to_string(), false)?;
                    let old: Option<i32> = sqlx::query_scalar(
                        "SELECT octet_length(payload::text) FROM objets WHERE compte=$1 AND id=$2",
                    )
                    .bind(id)
                    .bind(object)
                    .fetch_optional(&mut *tx)
                    .await?;
                    let count: i64 =
                        sqlx::query_scalar("SELECT count(*) FROM objets WHERE compte=$1")
                            .bind(id)
                            .fetch_one(&mut *tx)
                            .await?;
                    if old.is_none() && count >= 20 {
                        return Err(Failure(413, "Vingt photos maximum."));
                    }
                    quota(
                        &mut tx,
                        id,
                        v.to_string().len() as i64 + 128,
                        old.unwrap_or(0) as i64,
                    )
                    .await?;
                    sqlx::query("INSERT INTO objets(compte,id,payload) VALUES($1,$2,$3) ON CONFLICT(compte,id) DO UPDATE SET payload=excluded.payload").bind(id).bind(object).bind(v).execute(&mut *tx).await?;
                    tx.commit().await?;
                    Ok(response(json!({"ok":true})))
                }
                _ => Err(Failure(405, "Méthode non autorisée.")),
            }
        }
        _ => Err(Failure(404, "Route absente.")),
    }
}
async fn handle(
    State(a): State<App>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    req: Request,
) -> Response {
    let (parts, body) = req.into_parts();
    let path = parts.uri.path();
    let method = parts.method.as_str();
    let outcome = if path.starts_with("/api/") {
        match tokio::time::timeout(Duration::from_secs(15), to_bytes(body, 4_000_000)).await {
            Err(_) => Err(Failure(408, "Délai de lecture dépassé.")),
            Ok(Err(_)) => Err(Failure(413, "Requête trop grande.")),
            Ok(Ok(bytes)) => {
                let v = if bytes.is_empty() {
                    Ok(Value::Null)
                } else if header(&parts.headers, "content-type").split(';').next()
                    != Some("application/json")
                {
                    Err(Failure(415, "Format JSON requis."))
                } else {
                    serde_json::from_slice(&bytes).map_err(|_| bad())
                };
                match v {
                    Ok(v) => api(&a, path, method, &parts.headers, v, peer).await,
                    Err(e) => Err(e),
                }
            }
        }
    } else if method == "GET" && static_file(path) {
        let name = if path == "/" {
            "index.html"
        } else {
            &path[1..]
        };
        match tokio::fs::read(format!("{}/{name}", setting("CARNET_DIST", "dist"))).await {
            Ok(b) => {
                let mime = if name.ends_with(".html") {
                    "text/html; charset=utf-8"
                } else if name.ends_with(".js") {
                    "text/javascript"
                } else if name.ends_with(".css") {
                    "text/css"
                } else if name.ends_with(".svg") {
                    "image/svg+xml"
                } else if name.ends_with(".pdf") {
                    "application/pdf"
                } else {
                    "application/json"
                };
                Ok(([("content-type", mime)], Body::from(b)).into_response())
            }
            Err(_) => Err(Failure(404, "Page absente.")),
        }
    } else {
        Err(Failure(404, "Page absente."))
    };
    let mut r = outcome.unwrap_or_else(IntoResponse::into_response);
    for (k, v) in [
        ("cache-control", "no-store"),
        ("referrer-policy", "no-referrer"),
        ("x-content-type-options", "nosniff"),
        (
            "permissions-policy",
            "camera=(self), microphone=(), geolocation=()",
        ),
        (
            "content-security-policy",
            "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
        ),
    ] {
        r.headers_mut().insert(k, v.parse().unwrap());
    }
    if a.secure {
        r.headers_mut().insert(
            "strict-transport-security",
            "max-age=31536000".parse().unwrap(),
        );
    }
    r
}
fn static_file(path: &str) -> bool {
    matches!(
        path,
        "/" | "/index.html"
            | "/elm.js"
            | "/bridge.js"
            | "/worker.js"
            | "/sw.js"
            | "/manifest.webmanifest"
            | "/carnet.css"
            | "/catalogue.json"
            | "/favicon.svg"
            | "/icon-192.png"
            | "/icon-512.png"
            | "/sondage.html"
            | "/sondage.js"
    ) || (0..15).any(|i| path == format!("/cours/{i}.html") || path == format!("/cours/{i}.pdf"))
}
async fn maintain(a: &App) -> Result<()> {
    let mut tx = a.db.begin().await?;
    // Ledger is independent of SQL backups; fail closed on a malformed or unreadable file.
    let ledger = {
        let _guard = a.ledger_lock.lock().map_err(|_| bad())?;
        std::fs::read_to_string(&a.ledger).map_err(|_| Failure(503, "Journal illisible."))?
    };
    for line in ledger.lines() {
        let id = uid(line)?;
        sqlx::query("INSERT INTO suppressions(compte) VALUES($1) ON CONFLICT DO NOTHING")
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }
    let days: i32 = setting("CARNET_RETENTION_DAYS", "90")
        .parse()
        .map_err(|_| bad())?;
    if !(1..=3650).contains(&days) {
        return Err(bad());
    }
    let expired: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM comptes WHERE last_seen<now()-($1 * interval '1 day') FOR UPDATE",
    )
    .bind(days)
    .fetch_all(&mut *tx)
    .await?;
    for id in expired {
        a.deletion(id)?;
        sqlx::query("INSERT INTO suppressions(compte) VALUES($1) ON CONFLICT DO NOTHING")
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }
    sqlx::query("DELETE FROM comptes WHERE id IN (SELECT compte FROM suppressions)")
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "DELETE FROM sessions WHERE expires_at<now() OR last_seen<now()-interval '2 hours'",
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}
#[tokio::main]
async fn main() -> std::result::Result<(), Box<dyn std::error::Error>> {
    let origin = setting("CARNET_PUBLIC_URL", "http://localhost:3000");
    let secure =
        origin.starts_with("https://") || setting("CARNET_SECURE_COOKIE", "false") == "true";
    if !secure
        && !origin.starts_with("http://localhost:")
        && !origin.starts_with("http://127.0.0.1:")
    {
        return Err("HTTPS obligatoire hors localhost".into());
    }
    let options = PgConnectOptions::new()
        .host(&setting("CARNET_DB_HOST", "database"))
        .port(setting("CARNET_DB_PORT", "5432").parse()?)
        .database(&setting("CARNET_DB_NAME", "carnet"))
        .username(&setting("CARNET_DB_USER", "carnet"))
        .password(&env::var("CARNET_DB_PASSWORD")?);
    let db = sqlx::postgres::PgPoolOptions::new()
        .max_connections(8)
        .acquire_timeout(Duration::from_secs(10))
        .connect_with(options)
        .await?;
    let ledger = setting("CARNET_DELETION_LEDGER", "/var/lib/carnet/deletions.log");
    if !std::path::Path::new(&ledger).exists() {
        let exists: bool = sqlx::query_scalar("SELECT to_regclass('public.comptes') IS NOT NULL")
            .fetch_one(&db)
            .await?;
        if exists {
            let count: i64 = sqlx::query_scalar("SELECT count(*) FROM comptes")
                .fetch_one(&db)
                .await?;
            if count > 0 {
                return Err("Journal des suppressions manquant : restauration refusée".into());
            }
        }
    }
    let f = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&ledger)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        f.set_permissions(std::fs::Permissions::from_mode(0o600))?;
    }
    f.sync_all()?;
    let a = App {
        db,
        origin,
        secure,
        ledger,
        ledger_lock: Arc::new(Mutex::new(())),
        rates: Arc::new(Mutex::new(HashMap::new())),
        auth_jobs: Arc::new(tokio::sync::Semaphore::new(2)),
    };
    sqlx::raw_sql(include_str!("../migrations/001.sql"))
        .execute(&a.db)
        .await?;
    maintain(&a).await.map_err(|_| "Entretien initial refusé")?;
    let maintenance = a.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(60)).await;
            if maintain(&maintenance).await.is_err() {
                eprintln!("Entretien différé : vérifier base et journal.")
            }
        }
    });
    let listener = tokio::net::TcpListener::bind(setting("CARNET_BIND", "0.0.0.0:3000")).await?;
    axum::serve(
        listener,
        Router::new()
            .fallback(any(handle))
            .with_state(a)
            .into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(async {
        let _ = tokio::signal::ctrl_c().await;
    })
    .await?;
    Ok(())
}
