import test from "node:test";
import assert from "node:assert/strict";
import {
  computePageNumbers, createBookData, createPage, createReaderViews, pageTemplate,
  getModuleFlag, publishDraft, restorePublishedVersion, toRoman
} from "../scripts/book-model.mjs";

test("a new book begins with a standalone cover", () => {
  const book = createBookData("Chroniques");
  const views = createReaderViews(book.published.pages);
  assert.equal(views[0].kind, "cover");
  assert.equal(views[0].pages.length, 1);
  assert.equal(views[1].kind, "spread");
  assert.equal(views[1].pages.length, 2);
  assert.equal(views[1].pages[1].kind, "blank");
});

test("interior pages are paired and the back cover remains standalone", () => {
  const pages = [
    createPage("image", { role: "cover" }),
    createPage("composed"), createPage("composed"), createPage("composed"),
    createPage("image", { role: "back" })
  ];
  const views = createReaderViews(pages);
  assert.deepEqual(views.map(view => view.kind), ["cover", "spread", "spread", "back"]);
  assert.equal(views[2].pages[1].kind, "blank");
});

test("GM-only pages are hidden from players and locked pages remain as placeholders", () => {
  const secret = createPage("composed", { visibility: "gm" });
  const locked = createPage("composed", { visibility: "locked" });
  const playerPages = createReaderViews([secret, locked], { singlePage: true }).flatMap(view => view.pages);
  assert.equal(playerPages.length, 1);
  assert.equal(playerPages[0].id, locked.id);
  assert.equal(playerPages[0].isLockedForViewer, true);
  const gmPages = createReaderViews([secret, locked], { singlePage: true, isGM: true }).flatMap(view => view.pages);
  assert.equal(gmPages.length, 2);
  assert.equal(gmPages.every(page => !page.isLockedForViewer), true);
});

test("numbering excludes covers and supports roman numerals and hidden pages", () => {
  const cover = createPage("image", { role: "cover" });
  const first = createPage("composed");
  const hidden = createPage("composed", { numberingHidden: true });
  const third = createPage("composed");
  const numbers = computePageNumbers([cover, first, hidden, third], { start: 4, style: "roman" });
  assert.equal(numbers[cover.id], "");
  assert.equal(numbers[first.id], "iv");
  assert.equal(numbers[hidden.id], "");
  assert.equal(numbers[third.id], "vi");
  assert.equal(toRoman(49), "xlix");
});

test("publishing keeps at most five previous versions and a version can be restored to draft", () => {
  let book = createBookData("Archives");
  for (let index = 0; index < 7; index += 1) {
    book.draft.pages[1].name = `Révision ${index}`;
    book = publishDraft(book, "gm");
  }
  assert.equal(book.history.length, 5);
  const oldestKept = book.history.at(-1);
  const restored = restorePublishedVersion(book, oldestKept.revision);
  assert.deepEqual(restored.draft.pages, oldestKept.pages);
});

test("every built-in template creates a composed page with blocks", () => {
  for (const template of ["chapter", "illustration", "columns", "letter", "bestiary"]) {
    const page = pageTemplate(template);
    assert.equal(page.kind, "composed");
    assert.ok(page.blocks.length > 0);
  }
});

test("legacy flag lookup does not crash when old module scope is inactive", () => {
  const document = {
    getFlag(scope) {
      if (scope === "immersive-books") throw new Error("Flag scope is not valid");
      return undefined;
    }
  };
  assert.equal(getModuleFlag(document, "book"), undefined);
});
