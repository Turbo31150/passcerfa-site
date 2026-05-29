---
name: run-passcerfa-site
description: Run, start, build, screenshot, or smoke-test the passcerfa-site static landing + 5 micro-sites (impots/MDPH/AAH/APL/carte-grise). Use when asked to launch the site, take screenshots, audit pages, or verify the GitHub Pages deploy.
---

# run-passcerfa-site

Site statique HTML/CSS/JS — landing **PassCerfa** + 5 micro-sites SEO
(impots-2042, mdph-15692, aah-13750, apl-13754, carte-grise-14945) +
section `demarches/`.

**Live** : https://turbo31150.github.io/passcerfa-site/ (GitHub Pages).
**Pas de build** : ce qui est dans le repo = ce qui est servi.

**Driver agent** : `.claude/skills/run-passcerfa-site/driver.sh` —
wrapper `google-chrome-stable --headless` ; sous-commandes
`shot | smoke | serve`.

**Paths** dans ce document : relatifs à la racine du repo
(`passcerfa-site/`).

## Prerequisites

```bash
which google-chrome-stable || sudo apt-get install -y google-chrome-stable
# fallback (sans Google) :
which chromium-browser || sudo apt-get install -y chromium-browser
```

Aucun npm/pnpm/yarn requis. Aucun build step.

## Run (agent path)

```bash
cd <repo-root>
./.claude/skills/run-passcerfa-site/driver.sh smoke
```

Sortie attendue (8 PNG entre ~90 et ~110 KB chacun) :

```
OK index-live.png (~104500o) ← https://turbo31150.github.io/passcerfa-site/
OK index-local.png (~104500o) ← file://<repo>/index.html
OK impots-local.png (~96000o) ← file://<repo>/impots-2042/index.html
OK mdph-local.png (~101000o) ← file://<repo>/mdph-15692/index.html
OK aah-local.png (...) ← file://<repo>/aah-13750/index.html
OK apl-local.png (...) ← file://<repo>/apl-13754/index.html
OK carte-grise-local.png (...) ← file://<repo>/carte-grise-14945/index.html
OK 404-local.png (...) ← file://<repo>/404.html
--- smoke OK ---
```

PNG dans `.claude/skills/run-passcerfa-site/screenshots/`. Driver détecte
les PNG <5KB et lève une erreur.

### Sous-commandes

| Commande | Effet |
|---|---|
| `driver.sh smoke` | 8 pages (1 live + 7 local) |
| `driver.sh shot OUT.png URL_OR_PATH` | 1 page — `https://…`, `/abs/path`, ou `relpath` depuis racine |
| `driver.sh serve [PORT]` | sert le repo via `python3 -m http.server` (défaut 8000) |

Variables :
- `CHROME` = binaire chrome (défaut `google-chrome-stable`)
- `LIVE_BASE` = URL live (défaut `https://turbo31150.github.io/passcerfa-site`)

Exemples :

```bash
./driver.sh shot demarches.png demarches/index.html
./driver.sh shot impots-live.png https://turbo31150.github.io/passcerfa-site/impots-2042/
CHROME=chromium-browser ./driver.sh smoke
LIVE_BASE=https://passcerfa.fr ./driver.sh shot index-prod.png /
```

## Run (human path)

```bash
cd <repo-root>
python3 -m http.server 8000
# ouvrir http://localhost:8000/ dans un navigateur
```

## Build / deploy

Pas de build. Push `main` → GitHub Pages re-déploie sur
`https://turbo31150.github.io/passcerfa-site/`. Ce skill ne push pas.

Custom domain (`passcerfa.fr`) n'est PAS encore résolu (NXDOMAIN au
2026-05-29) ; le live est uniquement sur github.io pour l'instant.

## Gotchas

| Symptôme | Cause | Fix |
|---|---|---|
| `Error code: 401 wrong_secret` dans stderr | GCM tentant login chrome headless container | inoffensif, screenshot réussit. `driver.sh` filtre déjà stderr. |
| `passcerfa.fr` → HTTP 000 / NXDOMAIN | DNS pas encore configuré | utiliser le `LIVE_BASE` par défaut (github.io) tant que le custom domain n'est pas live |
| `passcerfa-site.netlify.app` → 404 | site PAS sur Netlify (≠ jarvis-delmas-site) | hébergement = GitHub Pages, pas Netlify |
| Le micro-site `<key>/` n'a pas d'`index.html` | nouvelle démarche ajoutée sans page | mettre à jour `smoke()` dans `driver.sh` |
| PNG ~5KB blanc | rare ici (site statique sans JS bloquant) | si occure : ajouter `--virtual-time-budget=5000` au flag chrome |

## Troubleshooting

| Erreur | Fix |
|---|---|
| `command not found: google-chrome-stable` | `sudo apt-get install google-chrome-stable` ou `CHROME=chromium-browser ./driver.sh …` |
| `timeout` sur le live | GitHub Pages parfois lent ; relancer ou tester local : `./driver.sh shot index-local.png index.html` |
| Variable `LIVE_BASE` incorrecte | vérifier `sitemap.xml` pour l'URL canonique |

## Driver source

`./.claude/skills/run-passcerfa-site/driver.sh` (committé). Sous-commandes
`shot | smoke | serve`. Aucune dépendance hors `bash` + `chrome|chromium`.

## Pour aller plus loin

- Ajouter pages dans `smoke()` quand de nouvelles démarches sont créées (`xxx-NNNNN/`).
- Pour test a11y : ajouter `lighthouse_audit` via chrome-devtools-mcp (skill séparé).
- Pour interactivité (clic FranceConnect+, fill form), bascule vers Playwright/CDP.
