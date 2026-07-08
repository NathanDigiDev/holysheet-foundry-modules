import { MODULE_ID, warn } from "../config.js";
import { noteFileName, serializeMarkdown, stripFrontmatter } from "./model.js";

const SOURCE = "data";

export class FileStorage {
  static get worldPath() {
    const worldId = game.world?.id ?? "world";
    return `worlds/${worldId}/${MODULE_ID}`;
  }

  static get notesPath() {
    return `${this.worldPath}/notes`;
  }

  static async ensureReady() {
    const Picker = this.#picker();
    if (!Picker) return false;
    await this.#ensureDirectory(Picker, this.worldPath);
    await this.#ensureDirectory(Picker, this.notesPath);
    return true;
  }

  static async write(note, content) {
    const Picker = this.#picker();
    if (!Picker) return { ok: false, filePath: note.filePath };

    try {
      await this.ensureReady();
      const fileName = note.filePath ? note.filePath.split("/").pop() : noteFileName(note);
      const markdown = serializeMarkdown(note, content);
      const file = new File([markdown], fileName, { type: "text/markdown" });
      const result = await Picker.upload(SOURCE, this.notesPath, file, {}, { notify: false });
      return { ok: true, filePath: result?.path ?? `${this.notesPath}/${fileName}` };
    } catch (error) {
      warn("Unable to write markdown file", error);
      return { ok: false, filePath: note.filePath };
    }
  }

  static async read(note) {
    if (!note.filePath) return note.contentCache ?? "";
    try {
      const response = await fetch(note.filePath);
      if (!response.ok) return note.contentCache ?? "";
      return stripFrontmatter(await response.text());
    } catch (error) {
      warn("Unable to read markdown file", error);
      return note.contentCache ?? "";
    }
  }

  static async #ensureDirectory(Picker, path) {
    try {
      await Picker.browse(SOURCE, path);
    } catch (_error) {
      await Picker.createDirectory(SOURCE, path, {}, { notify: false });
    }
  }

  static #picker() {
    return foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker ?? null;
  }
}
