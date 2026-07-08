import { NoteStore } from "../data/note-store.js";

export async function renderMarkdown(content) {
  const html = basicMarkdown(content);
  const TextEditor = foundry.applications?.ux?.TextEditor ?? globalThis.TextEditor;
  if (!TextEditor?.enrichHTML) return html;
  return TextEditor.enrichHTML(html, { async: true, secrets: true, documents: true });
}

export function basicMarkdown(content) {
  const source = String(content ?? "").replace(/\r\n/g, "\n");
  const blocks = [];
  let inCode = false;
  let code = [];
  let list = [];

  const flushList = () => {
    if (!list.length) return;
    blocks.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
    list = [];
  };

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith("```")) {
      if (inCode) {
        blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = [];
        inCode = false;
      } else {
        flushList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      flushList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      list.push(bullet[1]);
      continue;
    }
    flushList();
    blocks.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  if (inCode) blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  return blocks.join("\n");
}

export function inline(value) {
  return escapeHtml(value)
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, label) => {
      const text = label || target;
      return `<a href="#" class="hsgm-wiki-link" data-wiki="${escapeAttribute(target)}">${escapeHtml(text)}</a>`;
    })
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export async function openWikiTarget(target) {
  const wanted = String(target ?? "").trim().toLowerCase();
  if (!wanted) return null;
  const note = NoteStore.all().find((candidate) => candidate.title.toLowerCase() === wanted);
  if (!note) {
    ui.notifications?.info(`Note introuvable: ${target}`);
    return null;
  }
  const { NoteWindowApp } = await import("../apps/note-window.js");
  new NoteWindowApp(note.id).render({ force: true });
  return note;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
