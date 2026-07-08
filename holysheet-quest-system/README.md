# Quest System — Foundry VTT v14

A **system-agnostic** quest manager for Foundry VTT. It relies only on core Foundry
concepts (Actors, Items, Users), so it works in any game system.

> Built on the **ApplicationV2** architecture and validated for Foundry VTT **v14**
> (minimum compatibility v13).

## Features

- **Sidebar tab** — a clean, native "Quests" tab injected into the sidebar.
- **GM Quest Editor** — create / edit / duplicate / delete; control state
  (Start · Pause · Resume · Complete · Cancel); configure name, description,
  opening / completion / warning messages, and assigned participants (Actors & Users).
- **Objectives** — three types:
  - **Manual** — text checklist items (players can tick them).
  - **Kill / Hunt** — combat targets that auto-advance when a matching creature is
    marked *defeated* in combat.
  - **Timed** — live countdown; fires the warning message on expiry.
  - Any objective can be flagged **Hidden** for secret / progressive steps.
- **Rewards** — text/message rewards and **item rewards**. On completion, linked
  items are automatically cloned into each assigned character's inventory. Rewards
  can be flagged **Hidden** for surprise loot.
- **Player Quest Log** — players see only the quests assigned to them or their
  characters, with progress, visible rewards, status, and details.
- **Immersive banners** — animated on-screen banners for Quest Start / Complete,
  with 4 built-in presets: **Default · Medieval · Sci-Fi · Steampunk**
  (customizable colors, icon, background image, and auto-close timer).

## Architecture

| Layer | File |
| --- | --- |
| Entry point / lifecycle hooks | `scripts/quest-system.mjs` |
| Constants & presets | `scripts/config.mjs` |
| Data factories / normalization | `scripts/data/quest-model.mjs` |
| Persistence (world setting) | `scripts/data/quest-store.mjs` |
| Orchestration / state machine | `scripts/api.mjs` |
| Reward automation | `scripts/rewards.mjs` |
| Socket relay (player → GM) | `scripts/socket.mjs` |
| Banners | `scripts/notifications/banners.mjs` |
| Sidebar tab injection | `scripts/ui/sidebar.mjs` |
| Player Quest Log app | `scripts/apps/quest-log.mjs` |
| GM Quest Editor app | `scripts/apps/quest-editor.mjs` |

### Data storage

Quests are stored in a single **world setting** (`quest-system.quests`), an object
keyed by quest id. This keeps the module portable and independent of any system's
data model. Because only GMs may write world settings, player actions (e.g. ticking
a manual objective) are relayed to the GM through the core socket channel.

## Public API

Available as `game.modules.get("quest-system").api` and `globalThis.QuestSystem`:

```js
const { QuestAPI } = game.modules.get("quest-system").api;
const quest = await QuestAPI.create({ name: "The Lost Heirloom" });
await QuestAPI.start(quest.id);
await QuestAPI.complete(quest.id); // grants rewards + fires the banner
QuestSystem.openLog();             // open the Quest Log
QuestSystem.openEditor(quest.id);  // open the editor
```

## Installation

Install from the Foundry setup screen using this manifest URL:

```text
https://github.com/NathanDigiDev/holysheet-foundry-modules/releases/latest/download/holysheet-quest-system-module.json
```

Then enable **Quest System** in your world module settings.

## Installation (development)

Symlink or copy this folder into `Data/modules/holysheet-quest-system` of your
Foundry user data (the folder name **must** match the manifest `id`), then enable
**Quest System** in your world's module settings.

## Notes

- Banner theme background images live under `assets/themes/`. The presets reference
  optional images there; drop your own to taste (the gradient renders fine without
  them).
- Kill objective matching is name-based (case-insensitive substring) to remain
  system-agnostic.

## Bugs

Please report issues on GitHub:

```text
https://github.com/NathanDigiDev/holysheet-foundry-modules/issues
```

## License

MIT
