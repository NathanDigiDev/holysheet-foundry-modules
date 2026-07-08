import {
  MODULE_ID, FORMATS, computePageNumbers, createReaderViews, ensureBookData,
  getModuleFlag, setModuleFlag
} from "./book-model.mjs";
import { blockStyle, themeStyle } from "./designer-app.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ImmersiveBookApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "immersive-book",
    classes: ["immersive-books", "ib-reader-window"],
    tag: "section",
    position: { width: 1200, height: 800, top: 0, left: 0 },
    window: { frame: false, resizable: false }
  };

  static PARTS = {
    book: { template: "modules/holysheet-immersive-books/templates/book.hbs" }
  };

  constructor(document, options = {}) {
    const { onClose, preview = false, pageId = null, ...applicationOptions } = options;
    super({ ...applicationOptions, id: `immersive-book-${document.id}` });
    this.document = document;
    this.preview = preview && game.user.isGM;
    this.requestedPageId = pageId;
    this.currentView = 0;
    this.selectedPageId = null;
    this.bookmarks = [];
    this.notes = {};
    this.views = [];
    this.onCloseCallback = onClose;
    this.resizeTimer = null;
    this.boundResize = () => {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => this.render({ force: true }), 180);
    };
  }

  get title() {
    return this.document.name;
  }

  async _prepareContext() {
    const book = ensureBookData(getModuleFlag(this.document, "book"), this.document.name);
    const pages = this.preview ? book.draft.pages : book.published.pages;
    const numbers = computePageNumbers(pages, book.settings.numbering);
    this.#loadPersonalData();
    const rawViews = createReaderViews(pages, { singlePage: this.#isSinglePage(), isGM: game.user.isGM });
    this.views = await Promise.all(rawViews.map(async (view, viewIndex) => ({
      ...view,
      viewIndex,
      isCover: view.kind === "cover",
      isBack: view.kind === "back",
      isSpread: view.kind === "spread",
      pages: await Promise.all(view.pages.map((page, side) => this.#decoratePage(page, numbers, book, viewIndex, side)))
    })));
    if (this.requestedPageId) {
      const requested = this.views.findIndex(view => view.pages.some(page => page.id === this.requestedPageId));
      if (requested >= 0) this.currentView = requested;
      this.requestedPageId = null;
    } else this.currentView = Math.min(this.currentView, Math.max(0, this.views.length - 1));
    const firstPage = this.views[this.currentView]?.pages.find(page => !page.isBlank);
    if (!this.selectedPageId || !this.views[this.currentView]?.pages.some(page => page.id === this.selectedPageId)) {
      this.selectedPageId = firstPage?.id ?? null;
    }
    const format = FORMATS[book.settings.format] ?? FORMATS.portrait;
    return {
      document: this.document,
      views: this.views,
      hasViews: this.views.length > 0,
      bookmarks: this.bookmarks.map(bookmark => ({
        ...bookmark,
        viewIndex: this.views.findIndex(view => view.pages.some(page => page.id === bookmark.pageId))
      })).filter(bookmark => bookmark.viewIndex >= 0),
      editable: game.user.isGM && this.document.isOwner,
      canShowAll: game.user.isGM && this.document.isOwner && !this.preview,
      preview: this.preview,
      themeStyle: themeStyle(book.settings.theme),
      formatStyle: `--page-ratio:${format.width}/${format.height};--page-width:${format.width};--page-height:${format.height}`
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element;
    root.querySelectorAll("[data-action]").forEach(element => element.addEventListener("click", event => this.#handleAction(event)));
    root.querySelectorAll(".ibr-page[data-page-id]").forEach(page => page.addEventListener("click", event => {
      if (event.target.closest("button, a, input, textarea, select")) return;
      this.#selectPage(page.dataset.pageId);
    }));
    root.addEventListener("keydown", event => this.#handleKeyboard(event));
    this.#activateNoteDrag();
    this.#syncView(false);
    window.addEventListener("resize", this.boundResize);
  }

  async close(options = {}) {
    window.removeEventListener("resize", this.boundResize);
    window.clearTimeout(this.resizeTimer);
    this.onCloseCallback?.();
    return super.close(options);
  }

  goToPage(pageId) {
    const viewIndex = this.views.findIndex(view => view.pages.some(page => page.id === pageId));
    if (viewIndex < 0) {
      this.requestedPageId = pageId;
      return this.render({ force: true });
    }
    this.selectedPageId = pageId;
    return this.#goTo(viewIndex, pageId);
  }

  #isSinglePage() {
    return window.innerWidth < 900 || window.innerHeight < 650;
  }

  async #decoratePage(page, numbers, book, viewIndex, side) {
    const bookmark = this.bookmarks.find(item => item.pageId === page.id);
    const note = this.notes[page.id];
    const pageTheme = { ...book.settings.theme, ...(page.pageTheme ?? {}) };
    const blocks = await Promise.all((page.blocks ?? []).map(async block => ({
      ...block,
      style: blockStyle(block),
      isText: block.type === "text",
      isImage: block.type === "image",
      isCallout: block.type === "callout",
      isDecoration: block.type === "decoration",
      isShape: block.type === "shape",
      isPageNumber: block.type === "pageNumber",
      html: ["text", "callout"].includes(block.type) ? await enrich(block.html ?? "") : block.html
    })));
    return {
      ...page,
      viewIndex,
      side,
      isBlank: page.kind === "blank",
      isImage: page.kind === "image",
      isComposed: page.kind === "composed",
      blocks,
      number: numbers[page.id] ?? "",
      bookmark,
      hasBookmark: Boolean(bookmark),
      note: note?.text ?? "",
      hasNote: Boolean(note?.text?.trim()),
      themeStyle: themeStyle(pageTheme),
      lockedTitle: page.lockedOverride?.title || book.settings.lockedPage.title,
      lockedMessage: page.lockedOverride?.message || book.settings.lockedPage.message,
      lockedImage: page.lockedOverride?.image || book.settings.lockedPage.image,
      lockedDecoration: page.lockedOverride?.decoration || book.settings.lockedPage.decoration
    };
  }

  #loadPersonalData() {
    const library = getModuleFlag(game.user, "library") ?? {};
    const data = library[this.document.id] ?? {};
    this.bookmarks = Array.isArray(data.bookmarks) ? foundry.utils.deepClone(data.bookmarks) : [];
    this.notes = foundry.utils.deepClone(data.notes ?? {});
  }

  async #savePersonalData() {
    const library = foundry.utils.deepClone(getModuleFlag(game.user, "library") ?? {});
    library[this.document.id] = { bookmarks: this.bookmarks, notes: this.notes };
    await setModuleFlag(game.user, "library", library);
  }

  #syncView(animate = true) {
    const views = Array.from(this.element.querySelectorAll(".ibr-view"));
    this.currentView = Math.min(Math.max(0, this.currentView), Math.max(0, views.length - 1));
    views.forEach((view, index) => {
      const visible = index === this.currentView;
      view.classList.toggle("is-visible", visible);
      view.setAttribute("aria-hidden", String(!visible));
    });
    this.element.querySelectorAll(".ibr-page[data-page-id]").forEach(page => page.classList.toggle("is-selected", page.dataset.pageId === this.selectedPageId));
    const shell = this.element.querySelector(".ibr-shell");
    shell?.classList.toggle("is-first", this.currentView === 0);
    shell?.classList.toggle("is-last", this.currentView === views.length - 1);
    shell?.classList.toggle("is-turning", animate && game.settings.get(MODULE_ID, "pageTurnAnimation"));
    if (animate) window.setTimeout(() => shell?.classList.remove("is-turning"), 260);
    const previous = this.element.querySelector("[data-action='previous']");
    const next = this.element.querySelector("[data-action='next']");
    if (previous) previous.disabled = this.currentView <= 0;
    if (next) next.disabled = this.currentView >= views.length - 1;
  }

  #goTo(viewIndex, pageId = null) {
    this.currentView = Number(viewIndex);
    const firstPage = this.views[this.currentView]?.pages.find(page => !page.isBlank);
    const requestedPage = this.views[this.currentView]?.pages.find(page => page.id === pageId);
    this.selectedPageId = requestedPage?.id ?? firstPage?.id ?? null;
    this.#closePanels();
    this.#syncView(true);
  }

  #selectPage(pageId) {
    this.selectedPageId = pageId;
    this.element.querySelectorAll(".ibr-page").forEach(page => page.classList.toggle("is-selected", page.dataset.pageId === pageId));
  }

  async #handleAction(event) {
    const button = event.currentTarget;
    const action = button.dataset.action;
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    if (action === "close") return this.close();
    if (action === "previous") return this.#goTo(this.currentView - 1);
    if (action === "next") return this.#goTo(this.currentView + 1);
    if (action === "go-to") {
      return this.#goTo(button.dataset.viewIndex, button.dataset.pageId);
    }
    if (action === "toggle-bookmark") return this.#togglePanel("bookmark", button.dataset.pageId);
    if (action === "toggle-note") return this.#togglePanel("note", button.dataset.pageId);
    if (action === "save-bookmark") return this.#saveBookmark();
    if (action === "remove-bookmark") return this.#removeBookmark(button.dataset.pageId);
    if (action === "save-note") return this.#saveNote();
    if (action === "close-panels") return this.#closePanels();
    if (action === "show-all") return game.immersiveBooks.showToAll(this.document.id, button.dataset.pageId);
    if (action === "open-designer") return game.immersiveBooks.design(this.document);
  }

  #handleKeyboard(event) {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
    if (event.key === "Escape") return this.close();
    if (event.key === "ArrowLeft") return this.#goTo(this.currentView - 1);
    if (event.key === "ArrowRight") return this.#goTo(this.currentView + 1);
  }

  #togglePanel(name, pageId) {
    if (pageId) this.selectedPageId = pageId;
    const panel = this.element.querySelector(`[data-panel='${name}']`);
    if (!panel) return;
    const opening = panel.hidden;
    this.#closePanels();
    panel.hidden = !opening;
    if (!opening) return;
    panel.dataset.pageId = this.selectedPageId ?? "";
    if (name === "note") panel.querySelector("textarea").value = this.notes[this.selectedPageId]?.text ?? "";
    if (name === "bookmark") {
      const bookmark = this.bookmarks.find(item => item.pageId === this.selectedPageId);
      const page = this.views.flatMap(view => view.pages).find(item => item.id === this.selectedPageId);
      panel.querySelector("[name='label']").value = bookmark?.label ?? page?.name ?? "";
      panel.querySelector("[name='color']").value = bookmark?.color ?? "#9d3d2d";
    }
    panel.querySelector("input, textarea, select")?.focus();
  }

  #closePanels() {
    this.element.querySelectorAll("[data-panel]").forEach(panel => { panel.hidden = true; });
  }

  async #saveBookmark() {
    const panel = this.element.querySelector("[data-panel='bookmark']");
    const pageId = panel.dataset.pageId;
    if (!pageId) return;
    const bookmark = {
      pageId,
      label: panel.querySelector("[name='label']").value.trim() || game.i18n.localize("IMMERSIVE_BOOKS.Bookmarks.DefaultLabel"),
      color: panel.querySelector("[name='color']").value
    };
    const index = this.bookmarks.findIndex(item => item.pageId === pageId);
    if (index >= 0) this.bookmarks[index] = bookmark;
    else this.bookmarks.push(bookmark);
    await this.#savePersonalData();
    return this.render({ force: true });
  }

  async #removeBookmark(pageId) {
    this.bookmarks = this.bookmarks.filter(item => item.pageId !== pageId);
    await this.#savePersonalData();
    return this.render({ force: true });
  }

  async #saveNote() {
    const panel = this.element.querySelector("[data-panel='note']");
    const pageId = panel.dataset.pageId;
    if (!pageId) return;
    const text = panel.querySelector("textarea").value.trim();
    if (text) this.notes[pageId] = { text, updatedAt: Date.now() };
    else delete this.notes[pageId];
    await this.#savePersonalData();
    return this.render({ force: true });
  }

  #activateNoteDrag() {
    const note = this.element.querySelector(".ibr-note-panel");
    const handle = note?.querySelector("header");
    if (!note || !handle) return;
    handle.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      const rect = note.getBoundingClientRect();
      const start = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      const move = moveEvent => {
        note.style.left = `${Math.max(8, Math.min(window.innerWidth - rect.width - 8, start.left + moveEvent.clientX - start.x))}px`;
        note.style.top = `${Math.max(8, Math.min(window.innerHeight - rect.height - 8, start.top + moveEvent.clientY - start.y))}px`;
        note.style.right = "auto";
      };
      const up = () => document.removeEventListener("pointermove", move);
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up, { once: true });
    });
  }
}

async function enrich(content) {
  const editor = foundry.applications.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
  if (!editor?.enrichHTML) return content;
  return editor.enrichHTML(content, { async: true, secrets: game.user.isGM });
}
