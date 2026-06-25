import { ImmersiveBookApp } from "./book-app.mjs";
import { BookDesignerApp, acquireDesignerLock } from "./designer-app.mjs";
import {
  MODULE_ID, clone, createBlock, createBookData, createPage, ensureBookData,
  getModuleFlag, setModuleFlag, unsetModuleFlag
} from "./book-model.mjs";

const openReaders = new Map();
const openDesigners = new Map();

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "pageTurnAnimation", {
    name: "IMMERSIVE_BOOKS.Settings.PageTurnAnimation.Name",
    hint: "IMMERSIVE_BOOKS.Settings.PageTurnAnimation.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", () => {
  const api = {
    open: openBook,
    design: openDesigner,
    create: createBook,
    markAsBook,
    unmarkAsBook,
    showToAll,
    isBook
  };
  game.immersiveBooks = api;
  game.holysheetImmersiveBooks = api;
  game.socket.on(`module.${MODULE_ID}`, handleSocketMessage);
  console.info("Holysheet Immersive Books | Ready");
});

Hooks.on("getJournalEntryContextOptions", addJournalContextOptions);
Hooks.on("getDocumentContextOptions", addJournalContextOptions);

function addJournalContextOptions(_application, options) {
  options.push(
    {
      label: "IMMERSIVE_BOOKS.Actions.Open",
      icon: "fa-solid fa-book-open",
      visible: element => isBook(journalFromElement(element)),
      onClick: (_event, element) => openBook(journalFromElement(element))
    },
    {
      label: "IMMERSIVE_BOOKS.Actions.Design",
      icon: "fa-solid fa-pen-ruler",
      visible: element => game.user.isGM && isBook(journalFromElement(element)),
      onClick: (_event, element) => openDesigner(journalFromElement(element))
    },
    {
      label: "IMMERSIVE_BOOKS.Actions.OpenNative",
      icon: "fa-solid fa-file-lines",
      visible: element => game.user.isGM && isBook(journalFromElement(element)),
      onClick: (_event, element) => journalFromElement(element)?.sheet.render(true)
    },
    {
      label: "IMMERSIVE_BOOKS.Actions.Convert",
      icon: "fa-solid fa-wand-magic-sparkles",
      visible: element => game.user.isGM && Boolean(journalFromElement(element)) && !isBook(journalFromElement(element)),
      onClick: (_event, element) => markAsBook(journalFromElement(element), true)
    },
    {
      label: "IMMERSIVE_BOOKS.Actions.RestoreJournal",
      icon: "fa-solid fa-book",
      visible: element => game.user.isGM && isBook(journalFromElement(element)),
      onClick: (_event, element) => unmarkAsBook(journalFromElement(element))
    }
  );
}

// Foundry 13 compatibility.
Hooks.on("getJournalDirectoryEntryContext", (_html, options) => {
  options.push(
    {
      name: "IMMERSIVE_BOOKS.Actions.Open",
      icon: '<i class="fa-solid fa-book-open"></i>',
      condition: element => isBook(journalFromElement(element)),
      callback: element => openBook(journalFromElement(element))
    },
    {
      name: "IMMERSIVE_BOOKS.Actions.Design",
      icon: '<i class="fa-solid fa-pen-ruler"></i>',
      condition: element => game.user.isGM && isBook(journalFromElement(element)),
      callback: element => openDesigner(journalFromElement(element))
    },
    {
      name: "IMMERSIVE_BOOKS.Actions.OpenNative",
      icon: '<i class="fa-solid fa-file-lines"></i>',
      condition: element => game.user.isGM && isBook(journalFromElement(element)),
      callback: element => journalFromElement(element)?.sheet.render(true)
    },
    {
      name: "IMMERSIVE_BOOKS.Actions.Convert",
      icon: '<i class="fa-solid fa-wand-magic-sparkles"></i>',
      condition: element => game.user.isGM && Boolean(journalFromElement(element)) && !isBook(journalFromElement(element)),
      callback: element => markAsBook(journalFromElement(element), true)
    },
    {
      name: "IMMERSIVE_BOOKS.Actions.RestoreJournal",
      icon: '<i class="fa-solid fa-book"></i>',
      condition: element => game.user.isGM && isBook(journalFromElement(element)),
      callback: element => unmarkAsBook(journalFromElement(element))
    }
  );
});

Hooks.on("renderJournalDirectory", (_app, html) => {
  const root = domRoot(html);
  if (!root) return;
  for (const item of root.querySelectorAll(".directory-item[data-entry-id], .directory-item[data-document-id]")) {
    const journal = journalFromElement(item);
    if (!isBook(journal)) continue;
    item.classList.add("is-immersive-book");
    item.dataset.tooltip = game.i18n.localize("IMMERSIVE_BOOKS.Actions.Open");
    const icon = item.querySelector(".entry-name i, .document-name i");
    if (icon) icon.className = "fa-solid fa-book-open";
    const entryName = item.querySelector(".entry-name, .document-name");
    if (entryName && !entryName.dataset.immersiveBound) {
      entryName.dataset.immersiveBound = "true";
      entryName.removeAttribute("data-action");
      entryName.addEventListener("click", event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openBook(journal);
      });
    }
    if (!item.querySelector(".ib-directory-open-reader")) {
      const readButton = document.createElement("button");
      readButton.type = "button";
      readButton.className = "ib-directory-open-reader";
      readButton.dataset.tooltip = game.i18n.localize("IMMERSIVE_BOOKS.Actions.Open");
      readButton.setAttribute("aria-label", game.i18n.localize("IMMERSIVE_BOOKS.Actions.Open"));
      readButton.innerHTML = '<i class="fa-solid fa-book-open"></i>';
      readButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openBook(journal);
      });
      item.append(readButton);
    }
    const book = ensureBookData(getModuleFlag(journal, "book"), journal.name);
    const cover = book.published.pages.find(page => page.role === "cover" && page.kind === "image" && page.image?.src);
    if (cover && !item.querySelector(".ib-directory-cover-preview")) {
      const preview = document.createElement("span");
      preview.className = "ib-directory-cover-preview";
      preview.style.backgroundImage = `url("${cover.image.src.replaceAll('"', '%22')}")`;
      item.append(preview);
    }
    if (!item.dataset.immersiveBound) {
      item.dataset.immersiveBound = "true";
      item.addEventListener("dblclick", event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
        openBook(journal);
      }, { capture: true });
    }
  }
  if (!game.user.isGM || root.querySelector("[data-action='create-immersive-book']")) return;
  const create = root.querySelector(".directory-footer .create-entry, .header-actions .create-entry, [data-action='createEntry']");
  if (!create) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "immersive-books-create";
  button.dataset.action = "create-immersive-book";
  button.innerHTML = '<i class="fa-solid fa-book-medical"></i> <span></span>';
  button.querySelector("span").textContent = game.i18n.localize("IMMERSIVE_BOOKS.Actions.CreateBook");
  button.addEventListener("click", () => createBook());
  create.insertAdjacentElement("afterend", button);
});

const addJournalControls = (app, html) => {
  const journal = app.document ?? app.object;
  const frame = domRoot(html)?.closest(".window-app") ?? app.element?.[0] ?? app.element;
  const header = frame?.querySelector?.(".window-header");
  if (!header || header.querySelector(".immersive-books-open-header")) return;
  const controls = document.createElement("span");
  controls.className = "immersive-books-open-header";
  if (isBook(journal)) {
    controls.innerHTML = '<a data-control="read"><i class="fa-solid fa-book-open"></i></a><a data-control="design"><i class="fa-solid fa-pen-ruler"></i></a>';
    controls.querySelector("[data-control='read']").dataset.tooltip = game.i18n.localize("IMMERSIVE_BOOKS.Actions.Open");
    controls.querySelector("[data-control='design']").dataset.tooltip = game.i18n.localize("IMMERSIVE_BOOKS.Actions.Design");
    controls.querySelector("[data-control='read']").addEventListener("click", () => openBook(journal));
    controls.querySelector("[data-control='design']").addEventListener("click", () => openDesigner(journal));
  } else if (game.user.isGM) {
    controls.innerHTML = '<a data-control="convert"><i class="fa-solid fa-wand-magic-sparkles"></i></a>';
    controls.querySelector("[data-control='convert']").dataset.tooltip = game.i18n.localize("IMMERSIVE_BOOKS.Actions.Convert");
    controls.querySelector("[data-control='convert']").addEventListener("click", () => markAsBook(journal, true));
  } else return;
  header.querySelector(".window-close")?.insertAdjacentElement("beforebegin", controls);
};

for (const hook of ["renderJournalSheet", "renderJournalEntrySheet", "renderJournalEntrySheetV2"]) Hooks.on(hook, addJournalControls);

Hooks.on("deleteJournalEntry", journal => {
  closeAppsFor(journal.id);
});

export async function openBook(journalOrId, options = {}) {
  const journal = resolveJournal(journalOrId);
  if (!journal) return ui.notifications.warn(game.i18n.localize("IMMERSIVE_BOOKS.Errors.NotFound"));
  if (!isBook(journal)) return ui.notifications.warn(game.i18n.localize("IMMERSIVE_BOOKS.Errors.NotBook"));
  if (!journal.testUserPermission(game.user, "OBSERVER")) return ui.notifications.warn(game.i18n.localize("IMMERSIVE_BOOKS.Errors.NoPermission"));
  const key = `${journal.id}:${Boolean(options.preview)}`;
  let app = openReaders.get(key);
  if (!app) {
    app = new ImmersiveBookApp(journal, {
      ...options,
      onClose: () => openReaders.delete(key)
    });
    openReaders.set(key, app);
    return app.render({ force: true });
  }
  if (options.pageId) return app.goToPage(options.pageId);
  return app.render({ force: true });
}

export async function openDesigner(journalOrId) {
  if (!game.user.isGM) return;
  const journal = resolveJournal(journalOrId);
  if (!journal || !isBook(journal)) return;
  let app = openDesigners.get(journal.id);
  if (!app) {
    await acquireDesignerLock(journal);
    app = new BookDesignerApp(journal, { onClose: () => openDesigners.delete(journal.id) });
    openDesigners.set(journal.id, app);
  }
  return app.render({ force: true });
}

export async function createBook() {
  if (!game.user.isGM) return;
  const name = game.i18n.localize("IMMERSIVE_BOOKS.NewBook.Title");
  const book = createBookData(name);
  const journal = await JournalEntry.create({
    name,
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
    flags: { [MODULE_ID]: { book } }
  });
  const documents = await journal.createEmbeddedDocuments("JournalEntryPage", book.draft.pages.map(nativePageData));
  book.draft.pages.forEach((page, index) => { page.documentId = documents[index].id; });
  book.published.pages = clone(book.draft.pages);
  await setModuleFlag(journal, "book", book);
  await refreshJournalDirectory();
  ui.notifications.info(game.i18n.localize("IMMERSIVE_BOOKS.Notifications.Created"));
  return openDesigner(journal);
}

export async function markAsBook(journal, open = false) {
  if (!journal || !game.user.isGM) return;
  const existingPages = Array.from(journal.pages ?? []).sort((a, b) => a.sort - b.sort);
  const book = createBookData(journal.name);
  if (existingPages.length) {
    const imported = existingPages.map((page, index) => {
      if (page.type === "image") return createPage("image", {
        documentId: page.id,
        name: page.name,
        role: index === 0 ? "cover" : "normal",
        image: { src: page.src, fit: "cover", focalX: 50, focalY: 50 }
      });
      return createPage("composed", {
        documentId: page.id,
        name: page.name,
        role: "normal",
        blocks: [createBlock("text", { x: 8, y: 8, width: 84, height: 84, html: page.text?.content ?? "" })]
      });
    });
    book.draft.pages = imported;
    book.published.pages = clone(imported);
  }
  await setModuleFlag(journal, "book", book);
  await refreshJournalDirectory();
  ui.notifications.info(game.i18n.localize("IMMERSIVE_BOOKS.Notifications.Converted"));
  if (open) return openDesigner(journal);
}

export async function unmarkAsBook(journal) {
  if (!journal || !game.user.isGM) return;
  closeAppsFor(journal.id);
  await unsetModuleFlag(journal, "book");
  await refreshJournalDirectory();
  ui.notifications.info(game.i18n.localize("IMMERSIVE_BOOKS.Notifications.Restored"));
}

export function isBook(journal) {
  return Boolean(getModuleFlag(journal, "book")?.isBook);
}

export function showToAll(journalId, pageId) {
  const payload = { action: "showPage", journalId, pageId };
  game.socket.emit(`module.${MODULE_ID}`, payload);
  ui.notifications.info(game.i18n.localize("IMMERSIVE_BOOKS.Notifications.ShownToAll"));
}

async function handleSocketMessage(payload) {
  if (payload?.action !== "showPage" || game.user.isGM) return;
  const journal = game.journal.get(payload.journalId);
  if (!journal || !isBook(journal) || !journal.testUserPermission(game.user, "OBSERVER")) return;
  return openBook(journal, { pageId: payload.pageId });
}

function closeAppsFor(journalId) {
  for (const [key, app] of openReaders) {
    if (key.startsWith(`${journalId}:`)) app.close();
  }
  openDesigners.get(journalId)?.close();
  openDesigners.delete(journalId);
}

function nativePageData(page) {
  if (page.kind === "image") return { name: page.name, type: "image", src: page.image?.src || "icons/svg/book.svg" };
  return { name: page.name, type: "text", text: { content: `<p>${game.i18n.localize("IMMERSIVE_BOOKS.Designer.ManagedPage")}</p>` } };
}

function resolveJournal(value) {
  return typeof value === "string" ? game.journal.get(value) : value;
}

function journalFromElement(element) {
  const source = element?.[0] ?? element;
  const node = source?.closest?.("[data-entry-id], [data-document-id]") ?? source;
  const id = node?.dataset?.entryId ?? node?.dataset?.documentId ?? element?.data?.("entryId");
  return game.journal.get(id);
}

function domRoot(html) {
  return html?.[0] ?? html;
}

function refreshJournalDirectory() {
  return ui.journal?.render({ force: true });
}
