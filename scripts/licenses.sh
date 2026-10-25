#!/bin/sh
set -eu
cargo metadata --manifest-path backend/Cargo.toml --locked --format-version 1 |
python3 -c 'import json,sys; d=json.load(sys.stdin); print("Nom\tVersion\tLicence"); [print(p["name"]+"\t"+p["version"]+"\t"+str(p.get("license"))) for p in sorted(d["packages"], key=lambda p:p["name"])]'
