# AGENTS.md — Modules FoundryVTT v14 (HolySheet)

> Destiné à Codex (et tout agent compatible AGENTS.md). La **source unique de
> vérité** des conventions et des skills est `CLAUDE.md` + `.claude/skills/`.
> Ce fichier en est un résumé + des pointeurs. En cas de divergence, suivre
> `CLAUDE.md`.

## Contexte

Dossier regroupant **tous les modules FoundryVTT de HolySheet**. **Cible :
FoundryVTT v14.** Chaque sous-dossier `holysheet-*` est un module autonome
(`module.json`, scripts, styles, templates, lang fr/en).

Modules : `holysheet-quest-system` (.mjs), `holysheet-custom-calendar` (.js),
`holysheet-lockpicking` (.js).

## Règles v14 essentielles

- `module.json` : utiliser **`id`** (pas `name`) et **`compatibility`**
  (`{ minimum, verified, maximum }`).
- Point d'entrée via **`esmodules`** (un seul, qui importe le reste).
- UI : **`ApplicationV2` + `HandlebarsApplicationMixin`**
  (`foundry.applications.api`) — jamais l'ancien `Application`.
- i18n obligatoire (`game.i18n.localize`), `lang/en.json` + `lang/fr.json`.
- Templates : `modules/<id>/templates/xxx.hbs`.
- `"socket": true` pour les actions joueur→MJ (canal `module.<id>`).

## Documentation : Context7 obligatoire

Avant de coder contre l'API Foundry, récupérer la doc à jour via **Context7**
(MCP) au lieu de se fier à la mémoire. Détails : `.claude/skills/foundry-docs-context7/SKILL.md`.

## Habillage : design HolySheet obligatoire

Tout module reprend le langage visuel **HolySheet**. Source de vérité :
`HOLYSHEET-DESIGN.md` (racine). Mode d'emploi + socle CSS prêt à poser :
`.claude/skills/foundry-holysheet-design/SKILL.md`. Jamais d'hex en dur →
jetons `var(--hs-*)`.

## Skills (référence — fichiers dans `.claude/skills/`)

- **Docs Foundry** → `.claude/skills/foundry-docs-context7/SKILL.md`
  Récupérer la doc v14 à jour via Context7 (ID : `/websites/foundryvtt_api_v14`).
- **Scaffold module** → `.claude/skills/foundry-module-scaffold/SKILL.md`
  Générer la structure d'un nouveau module v14.
- **Design HolySheet** → `.claude/skills/foundry-holysheet-design/SKILL.md`
  Habillage visuel (socle CSS + recettes). Source : `HOLYSHEET-DESIGN.md`.
- **ApplicationV2** → `.claude/skills/foundry-applicationv2/SKILL.md`
  Construire une UI (fenêtre, formulaire, onglets) en `ApplicationV2`.
- **Settings & hooks** → `.claude/skills/foundry-settings-hooks/SKILL.md`
  Enregistrer des settings et brancher init/setup/ready.
- **Sockets & flags** → `.claude/skills/foundry-socket-flags/SKILL.md`
  Communication joueur→MJ (`module.<id>`) et persistance via flags.
- **Onglet sidebar** → `.claude/skills/foundry-sidebar-tab/SKILL.md`
  Ajouter un bouton/onglet dans la sidebar sans casser l'alignement (fix v13/v14).

Lire le `SKILL.md` correspondant avant d'agir sur l'un de ces sujets.

## Releases et auto-update Foundry

- Chaque module/systeme publie doit contenir `url`, `manifest` et `download`
  dans son `module.json` ou `system.json`.
- Quand un module change, incrementer uniquement le `version` du module
  concerne avant commit/release. Les modules inchanges gardent leur version.
- Apres push sur `main`, publier une GitHub Release pour declencher
  `.github/workflows/release-packages.yml`, qui genere les zips utilises par
  Foundry.
- Un nouveau module installable doit vivre dans son propre dossier racine
  `holysheet-.../` et etre ajoute au workflow de packaging.
- Voir `CLAUDE.md` pour la procedure complete.
