# Holysheet Immersive Books for Foundry VTT

**System-agnostic** module for Foundry VTT 13–14. A book remains a regular `JournalEntry`, but gains two dedicated experiences: an immersive reader for players and a layout workshop for the GM.

## Immersive reader

- No Foundry window frame: only the book, its close button and the darkened scene.
- Standalone front and back covers; interior pages shown as two-page spreads.
- Fixed layout, identical for every player, with single-page mode on small screens.
- Full-frame image pages or pages composed of blocks.
- Navigation through page corners, keyboard and private bookmarks.
- Private, draggable sticky note attached to each page.
- Pages can be visible, GM-only, or locked behind a customizable visual.
- GM action "Show this page to everyone".

## Book workshop

- Page thumbnails and reordering on the left, canvas in the center, properties on the right.
- Image pages with cropping and focal point.
- Text, image, callout, decoration, shape and page-number blocks.
- Move, resize, rotate, opacity, layers, multi-selection and alignment.
- Toggleable grid and snapping.
- Visual detection of overflowing text.
- Built-in templates: chapter, illustration, two columns, letter and bestiary.
- Personal templates stored in the user's flags.
- Auto-saved draft, explicit publishing, undo/redo and five published versions.
- Recoverable trash until publication.
- Single-GM editing lock.

## Data

- The Journal and its `JournalEntryPage` documents remain the Foundry documents of record.
- The model, draft, published version and history are stored in `flags.holysheet-immersive-books.book`.
- Bookmarks, notes and personal templates are stored in the flags of the relevant `User`.
- No reading position is remembered: every opening starts at the cover.

## Installation

Install from the Foundry setup screen using this manifest URL:

```text
https://github.com/NathanDigiDev/holysheet-foundry-modules/releases/latest/download/holysheet-immersive-books-module.json
```

## Development installation

Copy this folder into `Data/modules/holysheet-immersive-books`, then enable **Holysheet Immersive Books** in the world. The manifest is `module.json`.

## Usage

1. In the Journal sidebar, click **Create book**.
2. Compose the pages in the workshop; the draft is saved automatically.
3. Use **Preview** to review the draft.
4. Click **Publish** to make the version visible to players.
5. Give the Journal at least the **Observer** permission.

Double-clicking a book in the Journal sidebar opens the reader directly. The context menu also lets you open the workshop or the native Journal.

```js
game.immersiveBooks.open("JOURNAL_ID");
game.immersiveBooks.design("JOURNAL_ID");
game.immersiveBooks.create();
game.immersiveBooks.showToAll("JOURNAL_ID", "PAGE_LAYOUT_ID");
```

## Local verification

```powershell
npm run check
npm test
```

## Bugs

Please report issues on GitHub:

```text
https://github.com/NathanDigiDev/holysheet-foundry-modules/issues
```

## License

MIT.

The project borrows from [Xbozon/storyteller](https://github.com/Xbozon/storyteller) the idea of presenting a Journal as a book, but uses `ApplicationV2`, publishable drafts and a native composer without `turn.js`.
