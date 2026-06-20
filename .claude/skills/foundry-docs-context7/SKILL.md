---
name: foundry-docs-context7
description: Récupérer la documentation à jour de l'API FoundryVTT v14 (ApplicationV2, hooks, document API, settings, sockets, etc.) via Context7 MCP avant de coder. Utiliser dès qu'on touche à l'API Foundry ou à une librairie, au lieu de se fier à la mémoire du modèle.
---

# Documentation FoundryVTT v14 via Context7

## Pourquoi

L'API FoundryVTT évolue vite (v13 → v14 a cassé pas mal de choses :
`ApplicationV2`, manifeste `id`/`compatibility`, namespaces `foundry.*`).
**Ne pas se fier à la mémoire du modèle** : récupérer la doc à jour via
**Context7 MCP** avant de coder contre l'API.

## ID de librairie déjà résolu (raccourci)

Pour FoundryVTT v14, l'ID Context7 est **`/websites/foundryvtt_api_v14`**
(réputation High, ~19k snippets). On peut donc appeler **directement**
`query-docs` avec cet ID, sans repasser par `resolve-library-id`.

- v13 (rétrocompat) : `/websites/foundryvtt_api_v13`
- Pour une autre librairie (socketlib, etc.) : passer par `resolve-library-id`.

## Procédure

1. **(Optionnel) Résoudre l'ID** : pour FoundryVTT, utiliser directement
   `/websites/foundryvtt_api_v14`. Pour une autre lib, appeler
   `resolve-library-id` (correspondance exacte, ID versionné si version donnée).
2. **Interroger la doc** : appeler `query-docs` avec l'ID et la question
   précise (ex. « ApplicationV2 PARTS et _onRender en v14 »,
   « game.settings.register options v14 », « socket emit listener v14 »).
   ⚠️ Max 3 appels `query-docs` par sujet — grouper les questions.
3. **Répondre à partir des docs récupérées** : inclure des exemples de code et
   **citer la version** (v14).

## Quand l'utiliser

- Avant d'utiliser/expliquer un hook, une classe `ApplicationV2`, le Document
  API, les `game.settings`, les sockets, les DataModels, etc.
- Pour une question de migration v13 → v14.
- Pour toute librairie tierce (socketlib, lib-wrapper, etc.).

## À ne PAS utiliser pour

Refactor, écriture de scripts from scratch, debug de logique métier, revue de
code, concepts de programmation généraux.

## Sujets v14 fréquents à vérifier dans la doc

- `foundry.applications.api.ApplicationV2` + `HandlebarsApplicationMixin`
  (`DEFAULT_OPTIONS`, `PARTS`, `_onRender`, `_prepareContext`, actions).
- Manifeste `module.json` : `id`, `compatibility`, `esmodules`, `relationships`.
- Hooks de cycle de vie (`init`, `setup`, `ready`, `renderSidebar`, …).
- `game.settings.register` / `registerMenu` (scope, config, type).
- Sockets : `game.socket.emit("module.<id>", ...)` et bonnes pratiques.
- Document API & DataModels (`foundry.abstract.DataModel`).

> Voir aussi le skill `utils-save-docs` / `save-docs` pour persister la doc
> récupérée dans `.claude/output/docs/` si on veut la réutiliser hors-ligne.
