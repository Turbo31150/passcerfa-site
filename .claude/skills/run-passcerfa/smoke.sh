#!/usr/bin/env bash
# smoke.sh — Lance le serveur PassCerfa et vérifie les pages clés
# Usage: bash .claude/skills/run-passcerfa/smoke.sh [PORT]
set -euo pipefail

PORT=${1:-8742}
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

echo "[passcerfa] Démarrage serveur sur :$PORT (root: $ROOT)"
python3 -m http.server "$PORT" --directory "$ROOT" &>/tmp/passcerfa-server.log &
SERVER_PID=$!
sleep 1

BASE="http://localhost:$PORT"
FAILS=0

check() {
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$1")
  if [ "$code" = "200" ]; then
    echo "  ✅ $1"
  else
    echo "  ❌ $1 → HTTP $code"
    FAILS=$((FAILS+1))
  fi
}

check /
check /tarifs.html
check /cgu.html
check /mentions-legales.html
check /confidentialite.html
check /accessibilite.html
check /assets/style.css
check /assets/a11y.js
check /sitemap.xml

kill $SERVER_PID 2>/dev/null || true

if [ "$FAILS" -eq 0 ]; then
  echo "[passcerfa] ✅ Smoke OK — $BASE"
else
  echo "[passcerfa] ❌ $FAILS page(s) en erreur"
  exit 1
fi
