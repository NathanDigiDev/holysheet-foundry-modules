---
name: foundry-settings-hooks
description: Enregistrer des réglages de module (game.settings.register / registerMenu) et brancher le code aux bons hooks de cycle de vie FoundryVTT v14 (init, i18nInit, setup, ready). Couvre scope/config/type/choices/onChange/requiresReload et l'ordre des hooks. Utiliser pour les settings et l'initialisation d'un module.
---

# Settings & hooks de cycle de vie (FoundryVTT v14)

> Doc à jour : Context7 `/websites/foundryvtt_api_v14` (skill `foundry-docs-context7`).

## Ordre des hooks « once » (au chargement client)

D'après la doc v14, à chaque connexion/refresh, ces hooks se déclenchent **une
fois, dans cet ordre** :

```
init → i18nInit → setup → (initializeDynamicTokenRingConfig,
initializeCombatConfiguration, canvasConfig) → ready
```

Conséquences pratiques :

- **`init`** : enregistrer les settings (`game.settings.register`), modifier
  `CONFIG`, enregistrer les sheets (`DocumentSheetConfig.registerSheet`). C'est
  l'endroit normal pour l'enregistrement des packages.
- **`i18nInit`** : les traductions sont prêtes.
- **`setup`** : tous les Documents (dont **Settings**) sont initialisés —
  ⚠️ on **ne peut pas lire** un setting (`game.settings.get`) avant `setup`.
  L'UI et le Canvas ne sont pas encore prêts.
- **`ready`** : le jeu est entièrement prêt (UI, canvas, monde). Brancher ici
  l'UI, l'injection sidebar, l'API du module, etc.

```javascript
const MODULE_ID = "mon-module";

Hooks.once("init",  () => registerSettings());      // register settings/CONFIG
Hooks.once("ready", () => { /* UI, sidebar, api */ });

// Hook récurrent (chaque rendu de la sidebar) :
Hooks.on("renderSidebar", (app, html) => { /* cf. skill foundry-sidebar-tab */ });
```

## Enregistrer un setting

```javascript
function registerSettings() {
  // Setting "monde" (un seul réglage partagé, modifiable par le MJ)
  game.settings.register(MODULE_ID, "difficulty", {
    name: "MONMODULE.Settings.Difficulty.Name",   // clé i18n
    hint: "MONMODULE.Settings.Difficulty.Hint",
    scope: "world",          // "world" (par monde, MJ) | "client" (par poste)
    config: true,            // true => visible dans le menu Réglages
    type: String,            // String | Number | Boolean | Object | DataField
    choices: { easy: "MONMODULE.Easy", hard: "MONMODULE.Hard" }, // -> menu select
    default: "easy",
    requiresReload: false,   // true => Foundry propose de recharger
    onChange: (value) => { console.log(`${MODULE_ID} | difficulty =`, value); }
  });

  // Setting caché (état interne, non affiché)
  game.settings.register(MODULE_ID, "store", {
    scope: "world", config: false, type: Object, default: {}
  });
}
```

Lire / écrire (⚠️ seulement à partir de `setup`, en pratique dans `ready`) :
```javascript
const diff = game.settings.get(MODULE_ID, "difficulty");
await game.settings.set(MODULE_ID, "store", { ...data });
```

## Menu de réglages (sous-fenêtre dédiée)

Pour des réglages complexes, ouvrir une ApplicationV2 dédiée (cf. skill
`foundry-applicationv2`) :
```javascript
game.settings.registerMenu(MODULE_ID, "configMenu", {
  name: "MONMODULE.Settings.Menu.Name",
  label: "MONMODULE.Settings.Menu.Label",
  hint: "MONMODULE.Settings.Menu.Hint",
  icon: "fa-solid fa-gears",
  type: MyConfigApp,        // une classe ApplicationV2 (FormApplication-like)
  restricted: true          // MJ uniquement
});
```

## Bonnes pratiques

- **Namespace = ID du module** : `game.settings.register("<id>", ...)`. Le
  premier argument DOIT correspondre à l'`id` du `module.json`, sinon les
  réglages ne sont pas reliés au module (et `game.modules.get` échoue ailleurs).
- Toujours fournir `name`/`hint` localisés (fr + en) pour les settings `config:true`.
- `scope: "world"` pour un réglage partagé (MJ), `"client"` pour une préférence
  locale par poste.
- Settings d'état interne : `config: false`, `type: Object`.

## Checklist

- [ ] `register` dans `Hooks.once("init")`.
- [ ] Lecture des settings seulement à partir de `ready` (jamais avant `setup`).
- [ ] 1er argument = ID réel du module.
- [ ] `name`/`hint` localisés pour les settings visibles.
- [ ] `requiresReload: true` si le changement impacte l'init.
