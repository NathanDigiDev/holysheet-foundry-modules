import test from "node:test";
import assert from "node:assert/strict";

test("registers Foundry 14 and Foundry 13 Journal context hooks", async () => {
  const hooks = new Map();
  globalThis.foundry = {
    applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: Base => Base } },
    utils: { deepClone: value => JSON.parse(JSON.stringify(value)), randomID: () => "test-id" }
  };
  globalThis.Hooks = {
    once(name, callback) { hooks.set(name, [...(hooks.get(name) ?? []), callback]); },
    on(name, callback) { hooks.set(name, [...(hooks.get(name) ?? []), callback]); }
  };
  await import(`../scripts/main.mjs?directory-hooks=${Date.now()}`);
  assert.ok(hooks.has("getJournalEntryContextOptions"), "Foundry 14 context hook is registered");
  assert.ok(hooks.has("getJournalDirectoryEntryContext"), "Foundry 13 compatibility hook is registered");
  assert.ok(hooks.has("renderJournalDirectory"), "Journal directory render hook is registered");

  const standardJournal = { id: "journal-1", getFlag: () => null };
  globalThis.game = { user: { isGM: true }, journal: { get: id => id === "journal-1" ? standardJournal : null } };
  const element = { dataset: { entryId: "journal-1" }, closest() { return this; } };
  const options = [];
  hooks.get("getJournalEntryContextOptions")[0]({}, options);
  const convert = options.find(option => option.label === "IMMERSIVE_BOOKS.Actions.Convert");
  assert.ok(convert, "conversion action is present");
  assert.equal(convert.visible(element), true, "conversion action is visible for a standard Journal owned by a GM");
  assert.equal(typeof convert.onClick, "function");
});
