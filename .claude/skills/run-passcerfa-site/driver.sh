#!/usr/bin/env bash
# driver.sh — agent harness pour run-passcerfa-site
# Usage:
#   ./driver.sh shot OUT.png [URL|relpath]   # screenshot 1 page
#   ./driver.sh smoke                        # 8 pages clés (live + 7 local)
#   ./driver.sh serve [PORT]                 # human path (bind 127.0.0.1)
#
# Sortie : PNG dans ./screenshots/
# Live : https://turbo31150.github.io/passcerfa-site/ (GitHub Pages)
#
# Hardening :
#   - $out validé (basename, regex [A-Za-z0-9._-]+\.png) → bloque traversal
#   - file:// cible canonicalisée, doit rester sous $SITE_DIR
#   - serve() bind 127.0.0.1 par défaut

set -euo pipefail
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_DIR="$(cd "$SKILL_DIR/../../.." && pwd)"
SHOTS="$SKILL_DIR/screenshots"
LIVE_BASE="${LIVE_BASE:-https://turbo31150.github.io/passcerfa-site}"
mkdir -p "$SHOTS"

CHROME="${CHROME:-google-chrome-stable}"
command -v "$CHROME" >/dev/null || CHROME=chromium-browser
command -v "$CHROME" >/dev/null || { echo "ERR: ni google-chrome-stable ni chromium-browser dans PATH" >&2; exit 1; }

# safe_out OUT → echo basename safe, exit 1 si invalide
safe_out() {
  local raw="$1" base
  base=$(basename -- "$raw")
  case "$base" in
    -*) echo "ERR: out name starts with '-' : $base" >&2; exit 1 ;;
  esac
  if ! [[ "$base" =~ ^[A-Za-z0-9._-]+\.png$ ]]; then
    echo "ERR: out name must match ^[A-Za-z0-9._-]+\.png\$ : $base" >&2
    exit 1
  fi
  echo "$base"
}

# safe_local_path REL → echo abs path canonicalisé, refusé si hors $SITE_DIR
safe_local_path() {
  local raw="$1" abs
  if [[ "$raw" = /* ]]; then abs="$raw"; else abs="$SITE_DIR/$raw"; fi
  abs=$(readlink -f -- "$abs" 2>/dev/null || true)
  if [ -z "$abs" ]; then echo "ERR: path inexistant : $raw" >&2; exit 1; fi
  case "$abs" in
    "$SITE_DIR"|"$SITE_DIR"/*) ;;
    *) echo "ERR: path hors SITE_DIR : $abs" >&2; exit 1 ;;
  esac
  echo "$abs"
}

shot() {
  local out target abs_path
  out=$(safe_out "$1")
  target="${2:-$LIVE_BASE/}"
  case "$target" in
    http://*|https://*) ;;
    file://*) echo "ERR: file:// direct refusé — utiliser un relpath ou /abs sous SITE_DIR" >&2; exit 1 ;;
    *) abs_path=$(safe_local_path "$target"); target="file://$abs_path" ;;
  esac
  timeout 30 "$CHROME" \
    --headless --disable-gpu --no-sandbox \
    --hide-scrollbars --window-size=1440,900 \
    --screenshot="$SHOTS/$out" \
    "$target" 2>/dev/null
  local size=$(stat -c%s "$SHOTS/$out")
  [ "$size" -lt 5000 ] && { echo "WARN: $out fait ${size}o (probablement blanc)" >&2; return 1; }
  echo "OK $out (${size}o) ← $target"
}

smoke() {
  shot index-live.png        "$LIVE_BASE/"
  shot index-local.png       index.html
  shot impots-local.png      impots-2042/index.html
  shot mdph-local.png        mdph-15692/index.html
  shot aah-local.png         aah-13750/index.html
  shot apl-local.png         apl-13754/index.html
  shot carte-grise-local.png carte-grise-14945/index.html
  shot 404-local.png         404.html
  echo "--- smoke OK ---"
  ls -la "$SHOTS"
}

serve() {
  local port="${1:-8000}" bind="${BIND:-127.0.0.1}"
  cd "$SITE_DIR" && python3 -m http.server --bind "$bind" "$port"
}

# app [OUT.png] — screenshot l'APP PWA rendue (JS exécuté).
# /app/ est un bundle Vite (ES modules + service worker) : file:// NE REND PAS,
# il faut un origin HTTP. Sert le repo en arrière-plan, attend, screenshote, nettoie.
app() {
  local out port srv
  out=$(safe_out "${1:-app-rendered.png}")
  port=$((8000 + RANDOM % 1000))
  ( cd "$SITE_DIR" && exec python3 -m http.server --bind 127.0.0.1 "$port" ) >/dev/null 2>&1 &
  srv=$!
  trap 'kill "$srv" 2>/dev/null || true' RETURN
  sleep 1.5
  # --virtual-time-budget laisse le JS peupler #app avant la capture
  timeout 40 "$CHROME" \
    --headless --disable-gpu --no-sandbox \
    --hide-scrollbars --window-size=1440,900 \
    --virtual-time-budget=6000 \
    --screenshot="$SHOTS/$out" \
    "http://127.0.0.1:$port/app/" 2>/dev/null
  local size; size=$(stat -c%s "$SHOTS/$out" 2>/dev/null || echo 0)
  [ "$size" -lt 5000 ] && { echo "WARN: $out fait ${size}o (probablement blanc — augmenter virtual-time-budget)" >&2; return 1; }
  echo "OK $out (${size}o) ← http://127.0.0.1:$port/app/ (PWA rendue)"
}

case "${1:-smoke}" in
  shot)  shift; shot "$@" ;;
  smoke) smoke ;;
  app)   shift; app "$@" ;;
  serve) shift; serve "$@" ;;
  *)     echo "Usage: $0 {shot OUT.png [URL|relpath]|smoke|app [OUT.png]|serve [PORT]}" >&2; exit 2 ;;
esac
