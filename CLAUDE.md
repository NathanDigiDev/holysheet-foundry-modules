# Espace de travail — Modules FoundryVTT v14 (HolySheet)

Ce dossier regroupe **tous les modules FoundryVTT** de HolySheet, dans un seul
espace de travail pour simplifier le développement. **Cible : FoundryVTT v14.**

## Modules présents

| Dossier | ID | Rôle |
| --- | --- | --- |
| `holysheet-quest-system/` | `holysheet-quest-system` | Gestionnaire de quêtes (éditeur MJ, journal joueur, objectifs, récompenses). `.mjs` |
| `holysheet-custom-calendar/` | `holysheet-custom-calendar` | Calendrier custom + widget jour/nuit. `.js` |
| `holysheet-lockpicking/` | `holysheet-lockpicking` | Mini-jeux de crochetage/cadenas, onglet sidebar « Mini-Jeux ». `.js` |

Chaque module est **autonome** (son propre `module.json`, `git`, `README`). On
ne mélange jamais le code d'un module avec un autre.

## Structure standard d'un module

```
mon-module/
├── module.json          # Manifeste (voir règles v14 ci-dessous)
├── scripts/             # Code ES Module (.mjs ou .js)
│   └── main.js          # Point d'entrée unique (importe le reste)
├── styles/              # CSS
├── templates/           # Handlebars (.hbs)
├── lang/                # i18n : en.json + fr.json
└── README.md
```

## Règles FoundryVTT v14 — À RESPECTER

- **Manifeste** : `module.json` utilise **`id`** (jamais l'ancien `name`).
- **Compatibilité** : champ `compatibility` (`{ minimum, verified, maximum }`),
  pas les anciens `minimumCoreVersion` / `compatibleCoreVersion`.
- **Point d'entrée** : `esmodules` (ES Modules). Pas de `scripts` classiques.
  Un seul point d'entrée qui importe le reste.
- **Applications** : toujours **`ApplicationV2`** +
  `HandlebarsApplicationMixin` (`foundry.applications.api`). Pas l'ancien
  `Application`/`FormApplication`. Utiliser `static DEFAULT_OPTIONS`,
  `static PARTS`, `_onRender(context, options)`.
- **i18n** : toute chaîne visible passe par `game.i18n.localize(...)`, présente
  dans `lang/en.json` ET `lang/fr.json`.
- **Templates** : chemin absolu `modules/<id>/templates/xxx.hbs`.
- **Socket** : `"socket": true` dès qu'un joueur déclenche une action que seul
  le MJ peut appliquer (canal `module.<id>`).

## Documentation : utiliser Context7 (OBLIGATOIRE)

Avant de coder contre l'API Foundry (hooks, ApplicationV2, document API, etc.),
**récupérer la doc à jour via Context7** plutôt que de se fier à la mémoire —
l'API v14 évolue vite. Voir le skill `foundry-docs-context7`.

## Habillage visuel : design HolySheet (OBLIGATOIRE)

Tout module (et toute refonte de CSS) reprend le langage visuel **HolySheet**
(med-fan sombre, verre dépoli, accent émeraude, laiton, polices Cinzel/Spectral).
La **source de vérité** est [`HOLYSHEET-DESIGN.md`](./HOLYSHEET-DESIGN.md) à la
racine. Le skill `foundry-holysheet-design` fournit le socle CSS prêt à poser
(`holysheet.css`) + les recettes de composants. Ne jamais coder un hex en dur :
toujours passer par les jetons `var(--hs-*)`.

## Skills disponibles (`.claude/skills/`)

| Skill | Quand l'utiliser |
| --- | --- |
| **`foundry-docs-context7`** | Récupérer la doc à jour de l'API FoundryVTT v14 via Context7 (ID résolu : `/websites/foundryvtt_api_v14`). |
| **`foundry-module-scaffold`** | Créer la structure complète d'un nouveau module v14 (module.json, scripts, styles, lang, templates). |
| **`foundry-holysheet-design`** | Appliquer l'habillage visuel HolySheet (socle CSS + recettes). Voir `HOLYSHEET-DESIGN.md`. |
| **`foundry-applicationv2`** | Construire une UI (fenêtre, formulaire, onglets) en `ApplicationV2` + `HandlebarsApplicationMixin`. |
| **`foundry-settings-hooks`** | Enregistrer des settings et brancher les hooks de cycle de vie (init/setup/ready). |
| **`foundry-socket-flags`** | Communication joueur→MJ via sockets (`module.<id>`) et persistance via flags (`get/setFlag`). |
| **`foundry-sidebar-tab`** | Ajouter un onglet/bouton dans la sidebar Foundry (fix v13/v14 du double-icône et du mauvais alignement). |

> `AGENTS.md` (pour Codex) pointe vers ces mêmes skills — **source unique de
> vérité = `.claude/skills/`**. Mettre à jour les skills, pas les copies.

## Conventions de code observées

- Commentaires en français, explicites sur le « pourquoi » (cf. les modules
  existants qui documentent les pièges v14 directement dans le code).
- Identifiants de module en kebab-case, préfixe `holysheet-`.
- Namespace des flags = l'ID du module.

## Releases et auto-update Foundry

Chaque module/systeme publie doit pouvoir s'auto-mettre a jour via Foundry.
Pour cela, son manifest (`module.json` ou `system.json`) doit contenir :

```json
"url": "https://github.com/NathanDigiDev/holysheet-foundry-modules",
"manifest": "https://raw.githubusercontent.com/NathanDigiDev/holysheet-foundry-modules/main/<dossier>/module.json",
"download": "https://github.com/NathanDigiDev/holysheet-foundry-modules/releases/latest/download/<asset>.zip"
```

Pour le systeme HolySheet, utiliser `system.json` dans l'URL `manifest` et
`holysheet.zip` comme asset `download`.

Quand un module change, augmenter uniquement le `version` du module concerne.
Les modules inchanges gardent leur version. La release peut regenerer tous les
zips : Foundry ne proposera une mise a jour que pour les packages dont la
version a augmente.

Ordre obligatoire pour livrer une mise a jour :

1. Modifier le code du ou des modules.
2. Incrementer `version` dans chaque manifest concerne.
3. Commit + push sur `main`.
4. Creer une GitHub Release, par exemple :

```powershell
gh release create v0.1.1 --repo NathanDigiDev/holysheet-foundry-modules --target main --title "v0.1.1" --notes "Update <module>"
```

5. Attendre que le workflow `Package Foundry releases` termine avec succes.

Pour ajouter un nouveau module, creer un dossier racine `holysheet-.../`, ajouter
ses champs `url`/`manifest`/`download`, puis ajouter son entree dans
`.github/workflows/release-packages.yml` sous la forme :

```bash
"holysheet-mon-module:holysheet-mon-module.zip"
```

Ne pas placer un module autonome sous le dossier d'un autre module ou du
systeme. Un module installable Foundry doit vivre dans son propre dossier
racine.

## Messages GitHub

Pour les messages lies aux commits, releases, PR ou push GitHub, utiliser ce
format :

```text
New/Fix/Update {Nom du module ou systeme}: commentaire en francais sur ce qui a ete fait - {utilisateur}
```

Regles :

- `New` pour une creation de module, fonctionnalite ou asset majeur.
- `Fix` pour une correction de bug, de manifest, de packaging ou de compatibilite.
- `Update` pour une evolution, une maintenance ou une mise a jour de version.
- `{Nom du module ou systeme}` doit etre le dossier ou l'ID Foundry concerne,
  par exemple `holysheet-lockpicking`, `holysheet-dnd-compendiums` ou
  `holysheet`.
- Le commentaire doit etre en francais et resumer ce qui a ete fait.
- `{utilisateur}` doit identifier la personne ou l'agent qui a fait le
  changement.

Exemples :

```text
Fix holysheet-lockpicking: correction du manifest et du packaging release - Codex
Update holysheet-item-storage: ajout de la synchronisation des conteneurs - Hal
New holysheet-calendar-tools: creation du nouveau module calendrier - Claude
```
