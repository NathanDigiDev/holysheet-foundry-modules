---
name: foundry-applicationv2
description: Construire une interface (fenêtre, éditeur, formulaire, onglets) avec ApplicationV2 + HandlebarsApplicationMixin en FoundryVTT v14. Couvre DEFAULT_OPTIONS, PARTS, actions, _prepareContext, _onRender, gestion de formulaire et onglets, render/close. Utiliser dès qu'un module doit afficher une UI.
---

# ApplicationV2 + HandlebarsApplicationMixin (FoundryVTT v14)

> Doc à jour : Context7 `/websites/foundryvtt_api_v14` (skill `foundry-docs-context7`).
> En v14 on N'UTILISE PLUS `Application`/`FormApplication` (déprécié). Toute UI
> passe par `foundry.applications.api.ApplicationV2`.

## Squelette de base

```javascript
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = "mon-module";

export class MyApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "mon-module-app",                 // id DOM (unique)
    classes: ["mon-module"],              // classes CSS racine
    tag: "div",                           // ou "form" pour un formulaire (voir + bas)
    window: {
      title: "MONMODULE.Title",           // clé i18n (localisée par le core)
      icon: "fa-solid fa-scroll",
      resizable: true,
      contentClasses: ["standard-form"]   // styling natif des formulaires
    },
    position: { width: 480, height: "auto" },
    actions: {                            // mappe data-action -> méthode
      addRow: MyApp.#onAddRow,
      delete: MyApp.#onDelete
    }
  };

  // Un ou plusieurs "parts" Handlebars. Chemin ABSOLU modules/<id>/templates.
  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/my-app.hbs` }
  };

  // Titre dynamique optionnel (sinon window.title suffit).
  get title() { return game.i18n.localize("MONMODULE.Title"); }

  // Données passées au(x) template(s).
  async _prepareContext(options) {
    return {
      items: this.#getItems(),
      buttons: [{ type: "submit", icon: "fa-solid fa-save", label: "MONMODULE.Save" }]
    };
  }

  // Listeners DOM après chaque rendu (this.element = racine HTMLElement).
  _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelector("[data-mg-host]")?.addEventListener(/* ... */);
  }
}
```

## Cycle de vie (méthodes utiles, ordre logique)

- `_preFirstRender` / `_onFirstRender` — une seule fois (premier rendu).
- `_prepareContext(options)` — fournit les données du template.
- `_preparePartContext(partId, context)` — données par part (multi-parts).
- `_renderHTML` / `_replaceHTML` — rendu (rarement surchargé).
- `_onRender(context, options)` — **brancher les listeners ici**.
- `_onClickAction(event, target)` — dispatch des `data-action`.
- `_preClose` / `_onClose` — nettoyage.

## Ouvrir / fermer / re-render

```javascript
const app = new MyApp();
app.render(true);          // ouvre (force le rendu)
app.render();              // re-render si déjà ouvert
app.close();               // ferme
// Singleton fréquent :
let _app;
export function openMyApp() { (_app ??= new MyApp()).render(true); return _app; }
```

## Actions (boutons déclaratifs) — préféré aux addEventListener

Dans le template :
```hbs
<button type="button" data-action="addRow">{{localize "MONMODULE.Add"}}</button>
<button type="button" data-action="delete" data-id="{{item.id}}">x</button>
```
Dans la classe, déclarer dans `DEFAULT_OPTIONS.actions` et implémenter en
méthode statique privée (signature `(event, target)`, `this` = l'app) :
```javascript
static async #onAddRow(event, target) { /* ... */ this.render(); }
static async #onDelete(event, target) { const id = target.dataset.id; /* ... */ }
```

## Formulaires

Mettre `tag: "form"` + déclarer `form` dans `DEFAULT_OPTIONS` :
```javascript
static DEFAULT_OPTIONS = {
  tag: "form",
  form: {
    handler: MyApp.#onSubmit,   // (event, form, formData) => ...
    submitOnChange: false,
    closeOnSubmit: true
  },
  // ...
};
static async #onSubmit(event, form, formData) {
  const data = foundry.utils.expandObject(formData.object);
  // valider + persister (settings, flags, document...)
}
```
Le template contient un `<button type="submit">`. Le core appelle `handler`
avec un `FormDataExtended` (`formData.object`).

## Onglets (tabs)

```javascript
static PARTS = {
  tabs: { template: "templates/generic/tab-navigation.hbs" },
  details: { template: `modules/${MODULE_ID}/templates/tab-details.hbs` },
  config:  { template: `modules/${MODULE_ID}/templates/tab-config.hbs` }
};
// définir les onglets (voir _prepareTabs / _getTabsConfig dans la doc v14)
// changer d'onglet par programme : this.changeTab("config", "primary");
```
Pour les détails (groupes d'onglets, état actif), interroger la doc v14 :
méthodes `_prepareTabs`, `_getTabsConfig`, `changeTab`.

## Pièges v14 à retenir

- **Templates en chemin absolu** : `modules/<id>/templates/x.hbs` — et `<id>`
  doit être l'ID réel du module (celui de `module.json`), sinon 404.
- `this.element` est un **HTMLElement** (pas du jQuery).
- Préférer les **actions déclaratives** (`data-action`) aux listeners manuels.
- `window.title` accepte une **clé i18n** (le core la localise).
- Ne pas surcharger `_renderHTML`/`_replaceHTML` sauf besoin réel.

## Checklist

- [ ] Étend `HandlebarsApplicationMixin(ApplicationV2)`.
- [ ] `DEFAULT_OPTIONS` (id, classes, window, position) + `PARTS` valides.
- [ ] Données via `_prepareContext`, listeners via `_onRender`.
- [ ] Chemins de templates avec l'ID réel du module.
- [ ] Chaînes localisées (fr + en).
- [ ] Formulaire : `tag: "form"` + `form.handler` (pas d'ancien `_updateObject`).
