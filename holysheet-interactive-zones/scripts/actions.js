import { ACTION_TYPES, CHAT_MODES, SOCKET_NAME, VOTE_VISIBILITY } from "./constants.js";
import { canUseZone } from "./storage.js";

export class InteractiveZoneActions {
  constructor({ onStateChange } = {}) {
    this.onStateChange = onStateChange;
    this.votes = new Map();
  }

  registerSocket() {
    game.socket.on(SOCKET_NAME, (payload) => this.#onSocket(payload));
  }

  clearTransientState() {
    this.votes.clear();
    this.onStateChange?.();
  }

  getVotes(zone) {
    return Array.from(this.votes.get(zone.id)?.values() ?? []);
  }

  shouldShowVotes(zone) {
    return zone.action?.voteVisibility !== VOTE_VISIBILITY.gm || game.user.isGM;
  }

  async execute(zone) {
    if (!canUseZone(zone)) {
      ui.notifications.warn(game.i18n.localize("HIZ.NotAuthorized"));
      return;
    }

    switch (zone.action?.type) {
      case ACTION_TYPES.vote:
        this.#toggleVote(zone);
        return;
      case ACTION_TYPES.journal:
        return openDocumentSheet(zone.action.journalUuid);
      case ACTION_TYPES.image:
        return openDocumentImage(zone.action.imageUuid);
      case ACTION_TYPES.sound:
        return playSound(zone.action.soundPath);
      case ACTION_TYPES.macro:
        return executeMacro(zone.action.macroUuid);
      case ACTION_TYPES.chat:
        return sendChatMessage(zone);
      default:
        ui.notifications.warn(game.i18n.localize("HIZ.NoActionTarget"));
    }
  }

  #toggleVote(zone) {
    const votes = this.votes.get(zone.id) ?? new Map();
    const hasVote = votes.has(game.user.id);
    const vote = {
      userId: game.user.id,
      userName: game.user.name,
      color: game.user.color || "#ffffff"
    };

    if (hasVote) votes.delete(game.user.id);
    else votes.set(game.user.id, vote);

    this.votes.set(zone.id, votes);
    this.#emit({ type: "vote", zoneId: zone.id, vote, selected: !hasVote });
    this.onStateChange?.();
  }

  #onSocket(payload) {
    if (!payload || payload.sceneId !== canvas?.scene?.id || payload.userId === game.user.id) return;

    if (payload.type === "vote") {
      const votes = this.votes.get(payload.zoneId) ?? new Map();
      if (payload.selected) votes.set(payload.vote.userId, payload.vote);
      else votes.delete(payload.vote.userId);
      this.votes.set(payload.zoneId, votes);
      this.onStateChange?.();
    }
  }

  #emit(payload) {
    game.socket.emit(SOCKET_NAME, {
      ...payload,
      sceneId: canvas.scene.id,
      userId: game.user.id
    });
  }
}

async function openDocumentSheet(uuid) {
  const document = uuid ? await fromUuid(uuid) : null;
  if (!document?.sheet) {
    ui.notifications.warn(game.i18n.localize("HIZ.NoActionTarget"));
    return;
  }
  document.sheet.render(true);
}

async function openDocumentImage(uuid) {
  const document = uuid ? await fromUuid(uuid) : null;
  const src = document?.img ?? document?.texture?.src;
  if (!src) {
    ui.notifications.warn(game.i18n.localize("HIZ.NoActionTarget"));
    return;
  }

  const title = game.i18n.format("HIZ.ImageTitle", { name: document.name });
  if (typeof ImagePopout !== "undefined") {
    new ImagePopout(src, { title }).render(true);
    return;
  }

  new foundry.applications.api.DialogV2({
    window: { title },
    content: `<img src="${src}" alt="${foundry.utils.escapeHTML(title)}" style="max-width: 100%; height: auto;">`,
    buttons: [{ action: "close", label: game.i18n.localize("Close") }]
  }).render(true);
}

async function playSound(soundPath) {
  if (!soundPath) {
    ui.notifications.warn(game.i18n.localize("HIZ.NoActionTarget"));
    return;
  }

  await foundry.audio.AudioHelper.play({
    src: soundPath,
    volume: 1,
    autoplay: true,
    loop: false
  }, true);
}

async function executeMacro(uuid) {
  const macro = uuid ? await fromUuid(uuid) : null;
  if (!macro) {
    ui.notifications.warn(game.i18n.localize("HIZ.NoActionTarget"));
    return;
  }

  return macro.execute();
}

async function sendChatMessage(zone) {
  const message = zone.action.chatMessage?.trim();
  if (!message) {
    ui.notifications.warn(game.i18n.localize("HIZ.NoActionTarget"));
    return;
  }

  const data = {
    content: escapeParagraph(message),
    speaker: ChatMessage.getSpeaker({ alias: zone.name })
  };

  if (zone.action.chatMode === CHAT_MODES.private) data.whisper = privateRecipients(zone);
  await ChatMessage.create(data);
}

function privateRecipients(zone) {
  const selected = zone.users?.length ? zone.users : game.users.filter((user) => !user.isGM).map((user) => user.id);
  const gms = game.users.filter((user) => user.isGM).map((user) => user.id);
  return Array.from(new Set([...selected, ...gms]));
}

function escapeParagraph(content) {
  return `<p>${foundry.utils.escapeHTML(content).replaceAll("\n", "<br>")}</p>`;
}
