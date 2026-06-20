---
name: foundry-socket-flags
description: Communiquer entre clients FoundryVTT v14 via sockets (game.socket sur le canal module.<id>) pour les actions joueur→MJ, et persister des données sur les documents via flags (getFlag/setFlag). Utiliser quand un joueur déclenche une action que seul le MJ a le droit d'appliquer, ou pour stocker des données arbitraires sur un document.
---

# Sockets & Flags (FoundryVTT v14)

> Doc à jour : Context7 `/websites/foundryvtt_api_v14` (skill `foundry-docs-context7`).

## Sockets — pourquoi

Un joueur n'a pas la permission de modifier ce qui ne lui appartient pas
(murs, portes, documents d'un autre, etc.). Le pattern standard : le **joueur
émet** un message socket, le **MJ l'écoute** et applique l'action avec ses
droits. Nécessite `"socket": true` dans `module.json`.

## Canal & enregistrement du listener

Le canal d'un module est **`module.<id>`** où `<id>` = l'ID exact du
`module.json`. Brancher le listener tôt (dès `init`/`ready`).

```javascript
const MODULE_ID = "mon-module";
const SOCKET = `module.${MODULE_ID}`;     // ex: "module.holysheet-lockpicking"

Hooks.once("ready", () => {
  game.socket.on(SOCKET, (payload) => onSocket(payload));
});

function onSocket(payload) {
  switch (payload?.type) {
    case "unlock":
      // ⚠️ seul le MJ doit APPLIQUER l'action
      if (!game.user.isGM) return;
      // un seul MJ applique si plusieurs sont connectés :
      if (game.users.activeGM?.id !== game.user.id) return;
      applyUnlock(payload.data);
      break;
  }
}
```

> `game.users.activeGM` = le MJ « désigné » actif → évite que **plusieurs** MJ
> appliquent la même action en double.

## Émettre (côté joueur)

```javascript
function requestUnlock(doorId) {
  game.socket.emit(SOCKET, { type: "unlock", data: { doorId }, userId: game.user.id });
}
```

`emit` n'envoie **qu'aux autres** clients (pas à soi). Si l'émetteur doit aussi
réagir, appeler la logique locale en plus de l'émission.

## Pattern joueur→MJ complet

```javascript
// Joueur réussit le mini-jeu → demande au MJ d'ouvrir la porte.
function onMinigameSuccess(doorId) {
  if (game.user.isGM) return applyUnlock({ doorId });   // le MJ agit direct
  game.socket.emit(SOCKET, { type: "unlock", data: { doorId } });
}

// Côté MJ (dans onSocket) : applyUnlock fait l'update privilégié.
async function applyUnlock({ doorId }) {
  const wall = canvas.walls.get(doorId);
  await wall?.document.update({ ds: CONST.WALL_DOOR_STATES.OPEN });
}
```

Pour des besoins avancés (réponses, callbacks fiables), envisager la lib
**socketlib** (passer par `resolve-library-id` dans Context7).

## Flags — persister des données sur un document

Les flags stockent des données arbitraires clé/valeur sur un document, dans un
**scope** (namespace). Pour un module, **scope = ID du module**.

```javascript
// Écrire (Promise) — mettre à null supprime le flag.
await actor.setFlag(MODULE_ID, "questProgress", { step: 2, done: false });

// Lire (synchrone).
const progress = actor.getFlag(MODULE_ID, "questProgress");

// Supprimer.
await actor.unsetFlag(MODULE_ID, "questProgress");
```

- Scope `core` = réservé au logiciel ; un module DOIT utiliser son **ID**.
- Les valeurs peuvent être de presque n'importe quel type (objets inclus).
- `setFlag`/`unsetFlag` déclenchent une mise à jour du document (réseau + hooks).

## Settings vs Flags — lequel choisir ?

- **Setting** (`game.settings`) : configuration/état **global au monde** ou
  préférence **par poste** (pas lié à un document précis). Cf. skill
  `foundry-settings-hooks`.
- **Flag** : données attachées à **un document précis** (un acteur, un mur, un
  journal…).

## Checklist

- [ ] `"socket": true` dans `module.json`.
- [ ] Canal = `module.<id>` avec l'ID réel du module.
- [ ] Le listener vérifie `game.user.isGM` (et idéalement `activeGM`) avant
      d'appliquer une action privilégiée.
- [ ] Émetteur gère le cas « je suis déjà MJ » (pas besoin de socket).
- [ ] Flags : scope = ID du module (jamais `core`).
