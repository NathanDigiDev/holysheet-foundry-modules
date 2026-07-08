import {
  MODULE_ID, DECORATIONS, FORMATS, clone, createBlock, createPage, ensureBookData,
  getModuleFlag, pageTemplate, publishDraft, restorePublishedVersion, setModuleFlag
} from "./book-model.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const LOCK_TIMEOUT = 10 * 60 * 1000;

export class BookDesignerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "immersive-book-designer",
    classes: ["immersive-books", "ib-designer-window"],
    tag: "section",
    position: { width: 1420, height: 860 },
    window: { icon: "fa-solid fa-pen-ruler", resizable: true }
  };

  static PARTS = {
    designer: { template: "modules/holysheet-immersive-books/templates/designer.hbs" }
  };

  constructor(document, options = {}) {
    const { onClose, ...applicationOptions } = options;
    super({ ...applicationOptions, id: `immersive-book-designer-${document.id}` });
    this.document = document;
    this.book = ensureBookData(getModuleFlag(document, "book"), document.name);
    this.selectedPageId = this.book.draft.pages[0]?.id ?? null;
    this.selectedBlockIds = [];
    this.undoStack = [];
    this.redoStack = [];
    this.copiedBlocks = [];
    this.onCloseCallback = onClose;
    this.saveTimer = null;
    this.saving = Promise.resolve();
    this.readOnly = isLockedByOther(this.book);
  }

  get title() {
    return `${game.i18n.localize("IMMERSIVE_BOOKS.Designer.Title")} — ${this.document.name}`;
  }

  async _prepareContext() {
    const page = this.#selectedPage();
    const selectedBlocks = page?.blocks?.filter(block => this.selectedBlockIds.includes(block.id)) ?? [];
    const block = selectedBlocks.length === 1 ? decorateBlock(selectedBlocks[0], true) : null;
    const customTemplates = getModuleFlag(game.user, "pageTemplates") ?? [];
    return {
      document: this.document,
      book: this.book,
      pages: this.book.draft.pages.map((item, index) => ({
        ...item,
        index,
        selected: item.id === this.selectedPageId,
        icon: item.kind === "image" ? "fa-image" : "fa-layer-group",
        roleIcon: ({ cover: "fa-book", back: "fa-book", normal: "fa-file-lines" })[item.role],
        isImage: item.kind === "image",
        thumbnailBlocks: (item.blocks ?? []).slice(0, 8).map(block => ({ style: blockStyle(block), type: block.type }))
      })),
      trash: this.book.draft.trash,
      page,
      isPageImage: page?.kind === "image",
      isPageComposed: page?.kind === "composed",
      isPageLocked: page?.visibility === "locked",
      hasPageTheme: Boolean(page?.pageTheme),
      blocks: (page?.blocks ?? []).map(item => decorateBlock(item, this.selectedBlockIds.includes(item.id))),
      block,
      multiSelection: selectedBlocks.length > 1,
      selectedCount: selectedBlocks.length,
      // Les constantes du modèle portent des clés i18n : on les traduit au rendu,
      // car elles sont évaluées à l'import du module, avant que i18n soit prêt.
      formats: Object.values(FORMATS).map(format => ({ ...format, label: game.i18n.localize(format.label) })),
      pageKinds: localizedOptions([["composed", "KindComposed"], ["image", "KindImage"]]),
      pageRoles: localizedOptions([["normal", "RoleNormal"], ["cover", "RoleCover"], ["back", "RoleBack"]]),
      visibilityOptions: localizedOptions([["visible", "VisibilityVisible"], ["gm", "VisibilityGM"], ["locked", "VisibilityLocked"]]),
      fitOptions: localizedOptions([["cover", "FitCover"], ["contain", "FitContain"], ["fill", "FitFill"]]),
      numberingStyles: localizedOptions([["arabic", "NumberingArabic"], ["roman", "NumberingRoman"]]),
      alignOptions: localizedOptions([["left", "AlignLeft"], ["center", "AlignCenter"], ["right", "AlignRight"], ["justify", "AlignJustify"]]),
      shapeOptions: localizedOptions([["rectangle", "ShapeRectangle"], ["ellipse", "ShapeEllipse"]]),
      // Les noms de polices sont des noms propres : rien à traduire.
      fontOptions: [
        { value: "Georgia, serif", label: "Georgia" },
        { value: "Garamond, Georgia, serif", label: "Garamond" },
        { value: "Palatino Linotype, Palatino, serif", label: "Palatino" },
        { value: "Book Antiqua, Georgia, serif", label: "Book Antiqua" }
      ],
      decorations: DECORATIONS.map(decoration => ({ ...decoration, label: game.i18n.localize(decoration.label) })),
      customTemplates,
      histories: this.book.history,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      readOnly: this.readOnly,
      lockedBy: this.book.lock?.userName,
      pageCanvasStyle: this.#pageCanvasStyle(),
      themeStyle: themeStyle({ ...this.book.settings.theme, ...(page?.pageTheme ?? {}) })
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element;
    root.querySelectorAll("[data-action]").forEach(element => element.addEventListener("click", event => this.#handleAction(event)));
    root.querySelectorAll("[data-bind]").forEach(element => element.addEventListener("change", event => this.#handleBinding(event)));
    root.querySelectorAll(".ibd-page-item").forEach(item => this.#activatePageDrag(item));
    root.querySelectorAll(".ibd-block").forEach(block => this.#activateBlockPointer(block));
    root.addEventListener("keydown", event => this.#handleKeyboard(event));
    root.querySelector("[data-template-import]")?.addEventListener("change", event => this.#importTemplates(event));
    this.#detectOverflow();
  }

  async close(options = {}) {
    window.clearTimeout(this.saveTimer);
    await this.#saveNow();
    const latest = ensureBookData(getModuleFlag(this.document, "book"), this.document.name);
    if (latest.lock?.userId === game.user.id) {
      latest.lock = null;
      await setModuleFlag(this.document, "book", latest);
    }
    this.onCloseCallback?.();
    return super.close(options);
  }

  #selectedPage() {
    return this.book.draft.pages.find(page => page.id === this.selectedPageId) ?? this.book.draft.pages[0] ?? null;
  }

  #selectedBlocks() {
    const page = this.#selectedPage();
    return page?.blocks?.filter(block => this.selectedBlockIds.includes(block.id)) ?? [];
  }

  #pageCanvasStyle() {
    const format = FORMATS[this.book.settings.format] ?? FORMATS.portrait;
    return `--canvas-width:${format.width};--canvas-height:${format.height};--canvas-ratio:${format.width}/${format.height}`;
  }

  #checkpoint() {
    this.undoStack.push(clone(this.book.draft));
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
  }

  #touch() {
    this.book.draft.updatedAt = Date.now();
    this.book.draft.updatedBy = game.user.id;
    this.book.draft.revision = Number(this.book.draft.revision ?? 0) + 1;
    if (this.book.lock?.userId === game.user.id) this.book.lock.timestamp = Date.now();
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.#saveNow(), 450);
  }

  async #saveNow() {
    if (this.readOnly) return;
    window.clearTimeout(this.saveTimer);
    this.saving = this.saving.then(async () => {
      const latest = ensureBookData(getModuleFlag(this.document, "book"), this.document.name);
      if (latest.lock?.userId && latest.lock.userId !== game.user.id && Date.now() - Number(latest.lock.timestamp ?? 0) < LOCK_TIMEOUT) {
        this.readOnly = true;
        ui.notifications.warn(game.i18n.localize("IMMERSIVE_BOOKS.Errors.LockLost"));
        return;
      }
      return setModuleFlag(this.document, "book", this.book);
    });
    return this.saving;
  }

  async #handleAction(event) {
    const button = event.currentTarget;
    const action = button.dataset.action;
    if (!action) return;
    event.preventDefault();
    if (action === "select-page") return this.#selectPage(button.dataset.pageId);
    if (action === "select-block") return this.#selectBlock(button.dataset.blockId, event.ctrlKey || event.metaKey || event.shiftKey);
    if (action === "preview") return game.immersiveBooks.open(this.document, { preview: true });
    if (action === "open-native") return this.document.sheet.render(true);
    if (action === "take-lock") return this.#takeLock();
    if (this.readOnly) return;
    if (action === "add-page") return this.#addPage(button.dataset.kind);
    if (action === "add-template") return this.#addTemplate(button.dataset.template);
    if (action === "add-custom-template") return this.#addCustomTemplate(Number(button.dataset.templateIndex));
    if (action === "duplicate-page") return this.#duplicatePage();
    if (action === "delete-page") return this.#deletePage();
    if (action === "restore-page") return this.#restorePage(button.dataset.pageId);
    if (action === "add-block") return this.#addBlock(button.dataset.type);
    if (action === "duplicate-block") return this.#duplicateBlocks();
    if (action === "delete-block") return this.#deleteBlocks();
    if (action === "layer-front") return this.#changeLayer(1);
    if (action === "layer-back") return this.#changeLayer(-1);
    if (action === "align") return this.#alignBlocks(button.dataset.align);
    if (action === "distribute") return this.#distributeBlocks(button.dataset.axis);
    if (action === "undo") return this.#undo();
    if (action === "redo") return this.#redo();
    if (action === "pick-image") return this.#pickImage(button.dataset.target);
    if (action === "format-text") return this.#formatText(button.dataset.tag);
    if (action === "save-template") return this.#saveTemplate();
    if (action === "export-templates") return this.#exportTemplates();
    if (action === "import-templates") return this.element.querySelector("[data-template-import]")?.click();
    if (action === "toggle-page-theme") return this.#togglePageTheme();
    if (action === "publish") return this.#publish();
    if (action === "restore-version") return this.#restoreVersion(button.dataset.revision);
  }

  #selectPage(pageId) {
    this.selectedPageId = pageId;
    this.selectedBlockIds = [];
    return this.render({ force: true });
  }

  #selectBlock(blockId, additive = false) {
    if (!additive) this.selectedBlockIds = [blockId];
    else if (this.selectedBlockIds.includes(blockId)) this.selectedBlockIds = this.selectedBlockIds.filter(id => id !== blockId);
    else this.selectedBlockIds.push(blockId);
    return this.render({ force: true });
  }

  async #addPage(kind = "composed") {
    this.#checkpoint();
    const page = createPage(kind);
    const [documentPage] = await this.document.createEmbeddedDocuments("JournalEntryPage", [nativePageData(page)]);
    page.documentId = documentPage.id;
    this.book.draft.pages.push(page);
    this.selectedPageId = page.id;
    this.selectedBlockIds = [];
    this.#touch();
    return this.render({ force: true });
  }

  async #addTemplate(template) {
    this.#checkpoint();
    const page = template === "toc" ? this.#createTableOfContents() : pageTemplate(template);
    const [documentPage] = await this.document.createEmbeddedDocuments("JournalEntryPage", [nativePageData(page)]);
    page.documentId = documentPage.id;
    this.book.draft.pages.push(page);
    this.selectedPageId = page.id;
    this.selectedBlockIds = [];
    this.#touch();
    return this.render({ force: true });
  }

  async #addCustomTemplate(index) {
    const templates = getModuleFlag(game.user, "pageTemplates") ?? [];
    const template = templates[index];
    if (!template) return;
    this.#checkpoint();
    const page = createPage("composed", { name: template.name, blocks: template.blocks.map(block => ({ ...clone(block), id: foundry.utils.randomID() })) });
    const [documentPage] = await this.document.createEmbeddedDocuments("JournalEntryPage", [nativePageData(page)]);
    page.documentId = documentPage.id;
    this.book.draft.pages.push(page);
    this.selectedPageId = page.id;
    this.#touch();
    return this.render({ force: true });
  }

  async #duplicatePage() {
    const source = this.#selectedPage();
    if (!source) return;
    this.#checkpoint();
    const page = clone(source);
    page.id = foundry.utils.randomID();
    page.name = game.i18n.format("IMMERSIVE_BOOKS.Designer.CopyName", { name: source.name });
    page.blocks = page.blocks.map(block => ({ ...block, id: foundry.utils.randomID() }));
    const [documentPage] = await this.document.createEmbeddedDocuments("JournalEntryPage", [nativePageData(page)]);
    page.documentId = documentPage.id;
    const index = this.book.draft.pages.findIndex(item => item.id === source.id);
    this.book.draft.pages.splice(index + 1, 0, page);
    this.selectedPageId = page.id;
    this.selectedBlockIds = [];
    this.#touch();
    return this.render({ force: true });
  }

  #deletePage() {
    const page = this.#selectedPage();
    if (!page) return;
    this.#checkpoint();
    this.book.draft.pages = this.book.draft.pages.filter(item => item.id !== page.id);
    this.book.draft.trash.unshift({ ...clone(page), deletedAt: Date.now() });
    this.selectedPageId = this.book.draft.pages[0]?.id ?? null;
    this.selectedBlockIds = [];
    this.#touch();
    return this.render({ force: true });
  }

  #restorePage(pageId) {
    const page = this.book.draft.trash.find(item => item.id === pageId);
    if (!page) return;
    this.#checkpoint();
    this.book.draft.trash = this.book.draft.trash.filter(item => item.id !== pageId);
    delete page.deletedAt;
    this.book.draft.pages.push(page);
    this.selectedPageId = page.id;
    this.#touch();
    return this.render({ force: true });
  }

  #addBlock(type) {
    const page = this.#selectedPage();
    if (!page || page.kind !== "composed") return;
    this.#checkpoint();
    const block = createBlock(type, { z: Math.max(0, ...page.blocks.map(item => item.z ?? 0)) + 1 });
    page.blocks.push(block);
    this.selectedBlockIds = [block.id];
    this.#touch();
    return this.render({ force: true });
  }

  #duplicateBlocks() {
    const page = this.#selectedPage();
    const selected = this.#selectedBlocks();
    if (!page || !selected.length) return;
    this.#checkpoint();
    const copies = selected.map(block => ({ ...clone(block), id: foundry.utils.randomID(), x: Math.min(95, block.x + 3), y: Math.min(95, block.y + 3), z: (block.z ?? 1) + 1 }));
    page.blocks.push(...copies);
    this.selectedBlockIds = copies.map(block => block.id);
    this.#touch();
    return this.render({ force: true });
  }

  #deleteBlocks() {
    const page = this.#selectedPage();
    if (!page || !this.selectedBlockIds.length) return;
    this.#checkpoint();
    page.blocks = page.blocks.filter(block => !this.selectedBlockIds.includes(block.id));
    this.selectedBlockIds = [];
    this.#touch();
    return this.render({ force: true });
  }

  #changeLayer(direction) {
    const page = this.#selectedPage();
    if (!page) return;
    this.#checkpoint();
    for (const block of this.#selectedBlocks()) block.z = Math.max(0, Number(block.z ?? 1) + direction);
    this.#touch();
    return this.render({ force: true });
  }

  #alignBlocks(alignment) {
    const blocks = this.#selectedBlocks();
    if (blocks.length < 2) return;
    this.#checkpoint();
    const minX = Math.min(...blocks.map(block => block.x));
    const maxX = Math.max(...blocks.map(block => block.x + block.width));
    const minY = Math.min(...blocks.map(block => block.y));
    const maxY = Math.max(...blocks.map(block => block.y + block.height));
    if (alignment === "left") blocks.forEach(block => { block.x = minX; });
    if (alignment === "right") blocks.forEach(block => { block.x = maxX - block.width; });
    if (alignment === "center") blocks.forEach(block => { block.x = (minX + maxX - block.width) / 2; });
    if (alignment === "top") blocks.forEach(block => { block.y = minY; });
    if (alignment === "bottom") blocks.forEach(block => { block.y = maxY - block.height; });
    if (alignment === "middle") blocks.forEach(block => { block.y = (minY + maxY - block.height) / 2; });
    this.#touch();
    return this.render({ force: true });
  }

  #distributeBlocks(axis) {
    const blocks = this.#selectedBlocks();
    if (blocks.length < 3) return;
    this.#checkpoint();
    const horizontal = axis === "horizontal";
    const ordered = [...blocks].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
    const start = horizontal ? ordered[0].x : ordered[0].y;
    const last = ordered.at(-1);
    const end = horizontal ? last.x : last.y;
    const gap = (end - start) / (ordered.length - 1);
    ordered.forEach((block, index) => { if (horizontal) block.x = start + gap * index; else block.y = start + gap * index; });
    this.#touch();
    return this.render({ force: true });
  }

  #handleKeyboard(event) {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
    const command = event.ctrlKey || event.metaKey;
    if (command && event.key.toLowerCase() === "z") { event.preventDefault(); return event.shiftKey ? this.#redo() : this.#undo(); }
    if (command && event.key.toLowerCase() === "y") { event.preventDefault(); return this.#redo(); }
    if (command && event.key.toLowerCase() === "c") { event.preventDefault(); this.copiedBlocks = clone(this.#selectedBlocks()); return; }
    if (command && event.key.toLowerCase() === "v") { event.preventDefault(); return this.#pasteBlocks(); }
    if (command && event.key.toLowerCase() === "d") { event.preventDefault(); return this.#duplicateBlocks(); }
    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); return this.#deleteBlocks(); }
  }

  #pasteBlocks() {
    const page = this.#selectedPage();
    if (!page || page.kind !== "composed" || !this.copiedBlocks.length) return;
    this.#checkpoint();
    const copies = this.copiedBlocks.map(block => ({ ...clone(block), id: foundry.utils.randomID(), x: Math.min(95, block.x + 3), y: Math.min(95, block.y + 3), z: (block.z ?? 1) + 1 }));
    page.blocks.push(...copies);
    this.selectedBlockIds = copies.map(block => block.id);
    this.#touch();
    return this.render({ force: true });
  }

  #togglePageTheme() {
    const page = this.#selectedPage();
    if (!page) return;
    this.#checkpoint();
    page.pageTheme = page.pageTheme ? null : clone(this.book.settings.theme);
    this.#touch();
    return this.render({ force: true });
  }

  #createTableOfContents() {
    const groups = [];
    for (const page of this.book.draft.pages.filter(item => item.role === "normal")) {
      const chapter = page.chapter?.trim() || game.i18n.localize("IMMERSIVE_BOOKS.Designer.Pages");
      let group = groups.find(item => item.chapter === chapter);
      if (!group) groups.push(group = { chapter, pages: [] });
      group.pages.push(page.name);
    }
    const tocTitle = game.i18n.localize("IMMERSIVE_BOOKS.Designer.TemplateToc");
    const html = `<h1>${escapeHtml(tocTitle)}</h1>${groups.map(group => `<h2>${escapeHtml(group.chapter)}</h2><ul>${group.pages.map(name => `<li>${escapeHtml(name)}</li>`).join("")}</ul>`).join("")}`;
    return createPage("composed", { name: tocTitle, blocks: [createBlock("text", { x: 10, y: 8, width: 80, height: 84, html, fontSize: 17, lineHeight: 1.5 })] });
  }

  #undo() {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(clone(this.book.draft));
    this.book.draft = previous;
    this.selectedPageId = this.book.draft.pages[0]?.id ?? null;
    this.selectedBlockIds = [];
    this.#touch();
    return this.render({ force: true });
  }

  #redo() {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(clone(this.book.draft));
    this.book.draft = next;
    this.selectedPageId = this.book.draft.pages[0]?.id ?? null;
    this.selectedBlockIds = [];
    this.#touch();
    return this.render({ force: true });
  }

  async #handleBinding(event) {
    if (this.readOnly) return;
    const input = event.currentTarget;
    const target = input.dataset.scope === "page" ? this.#selectedPage()
      : input.dataset.scope === "block" ? this.#selectedBlocks()[0]
      : this.book;
    if (!target) return;
    this.#checkpoint();
    const value = input.type === "checkbox" ? input.checked : input.type === "number" || input.type === "range" ? Number(input.value) : input.value;
    setPath(target, input.dataset.bind, value);
    if (input.dataset.bind === "kind" && target.kind === "image") target.blocks = [];
    if (input.dataset.bind === "kind" && target.kind === "composed" && !target.blocks.length) target.blocks = [createBlock("text")];
    this.#touch();
    return this.render({ force: true });
  }

  async #pickImage(target) {
    const page = this.#selectedPage();
    const block = this.#selectedBlocks()[0];
    const holder = target === "block" ? block : page;
    if (!holder) return;
    const image = target === "block" ? holder : holder.image;
    const FilePickerClass = foundry.applications.apps?.FilePicker?.implementation ?? foundry.applications.apps?.FilePicker ?? globalThis.FilePicker;
    if (!FilePickerClass) return;
    const picker = new FilePickerClass({
      type: "image",
      current: image.src ?? "",
      callback: path => {
        this.#checkpoint();
        image.src = path;
        this.#touch();
        this.render({ force: true });
      }
    });
    return picker.render({ force: true });
  }

  #formatText(tag) {
    const textarea = this.element.querySelector("textarea[data-rich-text]");
    const block = this.#selectedBlocks()[0];
    if (!textarea || !block) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end) || game.i18n.localize("IMMERSIVE_BOOKS.Designer.TextSelection");
    const wrappers = { bold: ["<strong>", "</strong>"], italic: ["<em>", "</em>"], heading: ["<h2>", "</h2>"], list: ["<ul><li>", "</li></ul>"], paragraph: ["<p>", "</p>"] };
    const [before, after] = wrappers[tag] ?? wrappers.paragraph;
    this.#checkpoint();
    block.html = `${textarea.value.slice(0, start)}${before}${selected}${after}${textarea.value.slice(end)}`;
    this.#touch();
    return this.render({ force: true });
  }

  async #saveTemplate() {
    const page = this.#selectedPage();
    if (!page || page.kind !== "composed") return;
    const templates = clone(getModuleFlag(game.user, "pageTemplates") ?? []);
    templates.push({ name: page.name, blocks: clone(page.blocks), createdAt: Date.now() });
    await setModuleFlag(game.user, "pageTemplates", templates.slice(-20));
    ui.notifications.info(game.i18n.localize("IMMERSIVE_BOOKS.Notifications.TemplateSaved"));
    return this.render({ force: true });
  }

  #exportTemplates() {
    const templates = getModuleFlag(game.user, "pageTemplates") ?? [];
    const blob = new Blob([JSON.stringify({ version: 1, templates }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "immersive-books-page-templates.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async #importTemplates(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.templates)) throw new Error("Invalid templates");
      const templates = data.templates.filter(template => template && typeof template.name === "string" && Array.isArray(template.blocks)).slice(-20);
      await setModuleFlag(game.user, "pageTemplates", templates);
      ui.notifications.info(game.i18n.localize("IMMERSIVE_BOOKS.Notifications.TemplatesImported"));
      return this.render({ force: true });
    } catch (_error) {
      ui.notifications.error(game.i18n.localize("IMMERSIVE_BOOKS.Errors.InvalidTemplateFile"));
    }
  }

  async #publish() {
    await this.#syncDocuments();
    this.book = publishDraft(this.book, game.user.id);
    this.book.draft.trash = [];
    await this.#saveNow();
    await ui.journal?.render({ force: true });
    ui.notifications.info(game.i18n.localize("IMMERSIVE_BOOKS.Notifications.Published"));
    return this.render({ force: true });
  }

  #restoreVersion(revision) {
    this.#checkpoint();
    this.book = restorePublishedVersion(this.book, revision);
    this.selectedPageId = this.book.draft.pages[0]?.id ?? null;
    this.selectedBlockIds = [];
    this.#touch();
    return this.render({ force: true });
  }

  async #syncDocuments() {
    const pages = this.book.draft.pages;
    for (const page of pages) {
      if (!page.documentId || !this.document.pages.get(page.documentId)) {
        const [created] = await this.document.createEmbeddedDocuments("JournalEntryPage", [nativePageData(page)]);
        page.documentId = created.id;
      }
    }
    const updates = pages.map((page, index) => ({
      ...nativePageData(page),
      _id: page.documentId,
      sort: (index + 1) * 100000,
      flags: { [MODULE_ID]: { layout: clone(page) } }
    }));
    if (updates.length) await this.document.updateEmbeddedDocuments("JournalEntryPage", updates);
    const activeIds = new Set(pages.map(page => page.documentId));
    const deleteIds = this.book.draft.trash.map(page => page.documentId).filter(id => id && this.document.pages.get(id) && !activeIds.has(id));
    if (deleteIds.length) await this.document.deleteEmbeddedDocuments("JournalEntryPage", deleteIds);
  }

  async #takeLock() {
    this.book.lock = { userId: game.user.id, userName: game.user.name, timestamp: Date.now() };
    this.readOnly = false;
    await setModuleFlag(this.document, "book", this.book);
    return this.render({ force: true });
  }

  #activatePageDrag(item) {
    item.addEventListener("dragstart", event => event.dataTransfer.setData("text/immersive-page", item.dataset.pageId));
    item.addEventListener("dragover", event => event.preventDefault());
    item.addEventListener("drop", event => {
      event.preventDefault();
      if (this.readOnly) return;
      const sourceId = event.dataTransfer.getData("text/immersive-page");
      const targetId = item.dataset.pageId;
      if (!sourceId || sourceId === targetId) return;
      this.#checkpoint();
      const pages = this.book.draft.pages;
      const sourceIndex = pages.findIndex(page => page.id === sourceId);
      const targetIndex = pages.findIndex(page => page.id === targetId);
      const [page] = pages.splice(sourceIndex, 1);
      pages.splice(targetIndex, 0, page);
      this.#touch();
      this.render({ force: true });
    });
  }

  #activateBlockPointer(element) {
    element.addEventListener("pointerdown", event => {
      if (this.readOnly || event.button !== 0) return;
      const blockId = element.dataset.blockId;
      const page = this.#selectedPage();
      const block = page?.blocks.find(item => item.id === blockId);
      if (!block || block.locked) return;
      if (!this.selectedBlockIds.includes(blockId)) this.selectedBlockIds = [blockId];
      this.#checkpoint();
      const canvas = this.element.querySelector(".ibd-canvas");
      const rect = canvas.getBoundingClientRect();
      const resizing = Boolean(event.target.closest(".ibd-resize-handle"));
      const start = { x: event.clientX, y: event.clientY };
      const originals = this.#selectedBlocks().map(item => ({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height }));
      const move = moveEvent => {
        const dx = (moveEvent.clientX - start.x) / rect.width * 100;
        const dy = (moveEvent.clientY - start.y) / rect.height * 100;
        const grid = this.book.settings.grid;
        for (const original of originals) {
          const item = page.blocks.find(candidate => candidate.id === original.id);
          if (resizing && item.id === blockId) {
            item.width = clamp(snap(original.width + dx, grid, moveEvent.shiftKey), 4, 100 - item.x);
            item.height = clamp(snap(original.height + dy, grid, moveEvent.shiftKey), 4, 100 - item.y);
          } else {
            item.x = clamp(snap(original.x + dx, grid, moveEvent.shiftKey), 0, 100 - item.width);
            item.y = clamp(snap(original.y + dy, grid, moveEvent.shiftKey), 0, 100 - item.height);
            if (!moveEvent.shiftKey) this.#applyAlignmentGuides(item);
          }
          const node = this.element.querySelector(`[data-block-id='${item.id}']`);
          if (node) node.style.cssText = blockStyle(item);
        }
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        this.element.querySelectorAll(".ibd-guide").forEach(guide => guide.classList.remove("is-visible"));
        this.#touch();
        this.render({ force: true });
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up, { once: true });
    });
  }

  #detectOverflow() {
    this.element.querySelectorAll(".ibd-block[data-textual='true']").forEach(element => {
      const content = element.querySelector(".ib-block-content");
      element.classList.toggle("has-overflow", Boolean(content && content.scrollHeight > content.clientHeight + 2));
    });
  }

  #applyAlignmentGuides(block) {
    const vertical = this.element.querySelector(".ibd-guide-v");
    const horizontal = this.element.querySelector(".ibd-guide-h");
    const centerX = block.x + block.width / 2;
    const centerY = block.y + block.height / 2;
    const snapX = Math.abs(centerX - 50) < 1.25;
    const snapY = Math.abs(centerY - 50) < 1.25;
    if (snapX) block.x = 50 - block.width / 2;
    if (snapY) block.y = 50 - block.height / 2;
    vertical?.classList.toggle("is-visible", snapX);
    horizontal?.classList.toggle("is-visible", snapY);
  }
}

export async function acquireDesignerLock(journal, { force = false } = {}) {
  const book = ensureBookData(getModuleFlag(journal, "book"), journal.name);
  const locked = isLockedByOther(book);
  if (!locked || force) {
    book.lock = { userId: game.user.id, userName: game.user.name, timestamp: Date.now() };
    await setModuleFlag(journal, "book", book);
  }
  return { book, readOnly: locked && !force };
}

// Construit des paires valeur/libellé traduites au moment du rendu,
// à partir du suffixe des clés IMMERSIVE_BOOKS.Designer.*.
function localizedOptions(entries) {
  return entries.map(([value, key]) => ({ value, label: game.i18n.localize(`IMMERSIVE_BOOKS.Designer.${key}`) }));
}

function isLockedByOther(book) {
  const lock = book.lock;
  if (!lock || lock.userId === game.user.id) return false;
  return Date.now() - Number(lock.timestamp ?? 0) < LOCK_TIMEOUT;
}

function nativePageData(page) {
  if (page.kind === "image") return { name: page.name, type: "image", src: page.image?.src || "icons/svg/book.svg" };
  return { name: page.name, type: "text", text: { content: `<p>${game.i18n.localize("IMMERSIVE_BOOKS.Designer.ManagedPage")}</p>` } };
}

function setPath(target, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  let current = target;
  for (const key of keys) current = current[key] ??= {};
  current[last] = value;
}

function themeStyle(theme) {
  return `--ib-paper:${theme.paper};--ib-paper-alt:${theme.paperAlt};--ib-ink:${theme.ink};--ib-accent:${theme.accent};--ib-leather:${theme.leather};--ib-font-body:${theme.fontBody};--ib-font-display:${theme.fontDisplay};--ib-margin:${theme.margin}px`;
}

function blockStyle(block) {
  return `left:${block.x}%;top:${block.y}%;width:${block.width}%;height:${block.height}%;z-index:${block.z ?? 1};transform:rotate(${block.rotation ?? 0}deg);opacity:${block.opacity ?? 1}`;
}

function decorateBlock(item, selected = false) {
  return {
    ...item,
    selected,
    style: blockStyle(item),
    textual: ["text", "callout"].includes(item.type),
    isText: item.type === "text",
    isImage: item.type === "image",
    isCallout: item.type === "callout",
    isDecoration: item.type === "decoration",
    isShape: item.type === "shape",
    isPageNumber: item.type === "pageNumber"
  };
}

function snap(value, grid, disabled) {
  if (!grid?.snap || disabled) return value;
  const size = Math.max(1, Number(grid.size ?? 4));
  return Math.round(value / size) * size;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>\"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

export { blockStyle, themeStyle };
