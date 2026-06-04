---
name: run-passcerfa
description: run, start, serve, test, screenshot, smoke-test the PassCerfa static site
---

PassCerfa est un site statique HTML/CSS/JS (sans build step). Il se sert via `python3 -m http.server`. Le driver est `.claude/skills/run-passcerfa/smoke.sh` — il démarre le serveur, vérifie 9 URLs, arrête le serveur.

## Prérequis

```bash
python3 --version   # >= 3.6 (standard sur Ubuntu 20+)
curl --version      # standard
```

Aucun `npm install`, aucune dépendance externe.

## Lancer le serveur (path agent)

```bash
bash .claude/skills/run-passcerfa/smoke.sh
```

Vérifie : `/`, `/tarifs.html`, `/cgu.html`, `/mentions-legales.html`, `/confidentialite.html`, `/accessibilite.html`, `/assets/style.css`, `/assets/a11y.js`, `/sitemap.xml`.

Sortie attendue : `✅ Smoke OK — http://localhost:8742`

Port custom :

```bash
bash .claude/skills/run-passcerfa/smoke.sh 9000
```

## Lancer le serveur (path humain)

```bash
python3 -m http.server 8742 --directory /tmp/passcerfa-site
# ouvrir http://localhost:8742 dans le navigateur
# Ctrl-C pour arrêter
```

## Vérifier une page spécifique

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8742/tarifs.html
# → 200
```

## Inspecter le contenu d'une page

```bash
curl -s http://localhost:8742/index.html | grep -o '<title>[^<]*</title>'
```

## Gotchas

- Le port 8742 peut être occupé — passer un port libre en argument.
- Le serveur Python tourne en foreground ; le smoke script le tue proprement via `kill $SERVER_PID`.
- Pas de build step : toute modification de `.html`/`.css`/`.js` est immédiatement visible sans redémarrage.
- Les pages démarches (`/demarches/`, `/aah-13750/`, etc.) sont des répertoires — vérifier avec un slash final si nécessaire.

## Troubleshooting

| Symptôme | Fix |
|---|---|
| `Address already in use` | `kill $(lsof -ti:8742)` puis relancer |
| `200` sur toutes les pages mais contenu vide | Vérifier que `--directory` pointe sur la racine du repo |
| `404` sur `/assets/style.css` | Le dossier `assets/` est manquant — vérifier `git status` |
