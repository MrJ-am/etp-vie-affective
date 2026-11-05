#!/usr/bin/env bash
# Atelier éphémère, sans accès aux comptes ni à la configuration de production.
set -eu
cd "$(dirname "$0")/.."
export CARNET_API_TEST_URL=http://localhost:38139
export CARNET_API_TEST_ORIGIN=http://localhost:38139
export CARNET_TEST_URL=http://localhost:38139
export CARNET_DB_HOST=127.0.0.1
export CARNET_DB_PORT=55439
export CARNET_DB_NAME=vise_fictif_test
export CARNET_DB_USER=vise_fictif_test
export CARNET_DB_PASSWORD=synthetic-vise-only
export CARNET_PUBLIC_URL=http://localhost:38139
export CARNET_BIND=127.0.0.1:38139
export CARNET_DIST="$PWD/dist"
export CARNET_TEST_BIN="$PWD/backend/target/release/etp-carnet-server"
atelier="$(mktemp -d)"
export CARNET_DELETION_LEDGER="$atelier/deletions.log"
conteneur=""
serveur=""
docker_local() {
  env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"
}
nettoyer() {
  statut=$?
  if [ "$statut" -ne 0 ] && [ -f "$atelier/serveur.log" ]; then tail -n 30 "$atelier/serveur.log" >&2; fi
  if [ -n "$serveur" ]; then kill "$serveur" 2>/dev/null || true; wait "$serveur" 2>/dev/null || true; fi
  if [ -n "$conteneur" ]; then docker_local rm -f "$conteneur" >/dev/null; fi
  rm -rf "$atelier"
}
trap nettoyer EXIT
# Refuser les collisions avant de démarrer un service ou d'envoyer des requêtes.
node --input-type=module -e 'import net from "node:net"; for (const port of [38139,55439]) { const s=net.createServer(); s.on("error",()=>{console.error("Port de test occupé : "+port);process.exitCode=1}); s.listen(port,"127.0.0.1",()=>s.close()); }'
cargo build --locked --release --manifest-path backend/Cargo.toml
conteneur="$(docker_local run -d --name "vise-encadrement-tests-$$" --label mrjam.task=vise-encadrement-tests -e POSTGRES_DB=vise_fictif_test -e POSTGRES_USER=vise_fictif_test -e POSTGRES_PASSWORD=synthetic-vise-only -p 127.0.0.1:55439:5432 --tmpfs /var/lib/postgresql/data postgres:17-bookworm@sha256:04ea508c0ea323b679fbab075463b800b33337253768ad3feccfbc8005c644aa)"
for _ in $(seq 1 50); do
  if docker_local exec "$conteneur" pg_isready -h 127.0.0.1 -U vise_fictif_test -d vise_fictif_test >/dev/null; then break; fi
  sleep 0.2
done
"$CARNET_TEST_BIN" >"$atelier/serveur.log" 2>&1 &
serveur=$!
node --input-type=module -e 'for(let i=0;i<50;i++){try{if((await fetch(process.env.CARNET_API_TEST_URL+"/api/health")).ok)process.exit(0)}catch{}await new Promise(r=>setTimeout(r,200))}throw Error("Serveur de test indisponible")'
node --import tsx --test tests/encadrement.test.ts
if [ "${CARNET_TEST_BROWSER:-0}" = "1" ]; then
  npm run build
  node_modules/.bin/playwright test tests/browser/encadrement.spec.ts --project chromium --reporter list
fi
# La vérification de débit du test historique doit passer en dernier.
node --import tsx --test tests/api.test.ts
