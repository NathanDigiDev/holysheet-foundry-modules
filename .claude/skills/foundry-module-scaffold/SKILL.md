---
name: foundry-module-scaffold
description: Créer la structure complète d'un nouveau module FoundryVTT v14 (module.json conforme v14, point d'entrée esmodule, styles, lang fr/en, templates Handlebars, README). Utiliser pour démarrer un nouveau module HolySheet ou ajouter les pièces manquantes à un module existant.
---

# Scaffold d'un module FoundryVTT v14

## Objectif

Générer rapidement un module **conforme v14** dans ce workspace, en suivant les
conventions HolySheet. Pour la doc API à jour, combiner avec le skill
`foundry-docs-context7`.

## Avant de commencer

Demander (ou déduire) :
- **ID** du module (kebab-case, préfixe `holysheet-`, ex. `holysheet-shop`).
- **Titre** lisible et **description** courte.
- Besoin de **socket** ? (action joueur → MJ)
- Besoin d'une **entrée sidebar** ? → enchaîner avec `foundry-sidebar-tab`.

## Structure à créer

```
<id>/
├── module.json
├── README.md
├── scripts/
│   └── main.js              # point d'entrée unique (esmodule)
├── styles/
│   ├── holysheet.css        # socle HolySheet (drop-in, cf. foundry-holysheet-design)
│   └── <id>.css             # habillage spécifique du module
├── templates/
│   └── .gitkeep             # + .hbs au fur et à mesure
└── lang/
    ├── en.json
    └── fr.json
```

## 1. `module.json` (gabarit v14)

```json
{
  "id": "<id>",
  "title": "<Titre lisible>",
  "description": "<Description courte>",
  "version": "0.1.0",
  "compatibility": {
    "minimum": "14",
    "verified": "14",
    "maximum": "14"
  },
  "authors": [{ "name": "HolySheet" }],
  "esmodules": ["scripts/main.js"],
  "styles": ["styles/holysheet.css", "styles/<id>.css"],
  "languages": [
    { "lang": "en", "name": "English", "path": "lang/en.json" },
    { "lang": "fr", "name": "Français", "path": "lang/fr.json" }
  ],
  "socket": false,
  "url": "",
  "manifest": "",
  "download": "",
  "license": "MIT",
  "flags": { "<id>": {} }
}
```

Règles v14 NON négociables :
- **`id`** (jamais `name`).
- **`compatibility`** (jamais `minimumCoreVersion`/`compatibleCoreVersion`).
- **`esmodules`** (un seul point d'entrée qui importe le reste).
- Mettre `"socket": true` seulement si une action joueur doit être appliquée
  par le MJ via le canal `module.<id>`.

## 2. `scripts/main.js` (point d'entrée)

```javascript
const MODULE_ID = "<id>";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);
  // game.settings.register(MODULE_ID, ...) ;  importer les sous-modules ici
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | ready`);
  // setupSidebarTab(), brancher l'UI, etc.
});
```

## 3. Application UI (si besoin) — ApplicationV2 v14

```javascript
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class MyApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "<id>-app",
    classes: ["holysheet", "hs-theme-lueur", "<id>"],   // habillage HolySheet
    position: { width: 480, height: 600 },
    window: { title: "<ID>.Title", icon: "fa-solid fa-scroll", resizable: true }
  };
  static PARTS = { main: { template: `modules/<id>/templates/main.hbs` } };

  get title() { return game.i18n.localize("<ID>.Title"); }

  async _prepareContext(options) {
    return { /* données pour le template */ };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    // listeners sur this.element
  }
}
```

## 4. i18n — `lang/en.json` et `lang/fr.json`

Mêmes clés dans les deux fichiers. Préfixer par l'ID en MAJ.

```json
{ "<ID>.Title": "My Module", "<ID>.Tab": "My Tab" }
```
```json
{ "<ID>.Title": "Mon Module", "<ID>.Tab": "Mon Onglet" }
```

## 5. Styles — habillage HolySheet (OBLIGATOIRE)

Tout nouveau module reprend le langage visuel HolySheet. Voir le skill
**`foundry-holysheet-design`** :

1. Copier le socle `foundry-holysheet-design/assets/holysheet-base.css`
   → `styles/holysheet.css` (jetons `--hs-*`, polices, atomes verre dépoli, thèmes).
2. Déclarer `"styles": ["styles/holysheet.css", "styles/<id>.css"]` (socle d'abord).
3. Mettre `classes: ["holysheet", "hs-theme-lueur", "<id>"]` sur chaque app.
4. Écrire `styles/<id>.css` avec les recettes de composants (fenêtre, boutons,
   badges, progress, statuts…), **uniquement via `var(--hs-*)`** — zéro hex en dur.

Préfixer les sélecteurs du module (BEM-ish, ex. `<pfx>-`) pour éviter les
collisions avec le core ou d'autres modules.

## Checklist finale

- [ ] `module.json` valide (JSON parsable), `id` + `compatibility` v14.
- [ ] `esmodules` pointe vers un fichier existant.
- [ ] `lang/en.json` et `lang/fr.json` présents, mêmes clés.
- [ ] UI en `ApplicationV2` (pas l'ancien `Application`).
- [ ] Habillage HolySheet posé (socle `holysheet.css` + classe `holysheet` sur
      l'app + recettes via `var(--hs-*)`) — cf. `foundry-holysheet-design`.
- [ ] Chemins de templates en `modules/<id>/templates/...`.
- [ ] Doc API vérifiée via `foundry-docs-context7` pour tout appel non trivial.
- [ ] README minimal (titre, install, compatibilité v14).
