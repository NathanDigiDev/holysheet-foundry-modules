/**
 * BannerManager — immersive animated on-screen banners for quest events.
 *
 * Banners are rendered as a transient DOM overlay (no ApplicationV2 needed) so
 * they can animate in/out freely and auto-dismiss. Themes come from BANNER_PRESETS
 * and can be overridden per-quest.
 */

import {
  BANNER_PRESETS,
  BANNER_DEFAULT_DURATION
} from "../config.mjs";

/** Minimal HTML escape for untrusted text (quest names, messages). */
function esc(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export class BannerManager {
  /** @type {HTMLElement|null} The container appended to <body>. */
  static #layer = null;

  /** Ensure the overlay layer exists. */
  static #ensureLayer() {
    if (this.#layer && document.body.contains(this.#layer)) return this.#layer;
    const layer = document.createElement("div");
    layer.id = "quest-system-banner-layer";
    document.body.appendChild(layer);
    this.#layer = layer;
    return layer;
  }

  /**
   * Build a serializable payload describing a banner for a quest event.
   * @param {object} quest
   * @param {"start"|"complete"} event
   * @returns {object}
   */
  static buildPayload(quest, event) {
    const preset = BANNER_PRESETS[quest.theme] ?? BANNER_PRESETS.default;
    const isComplete = event === "complete";

    const title = isComplete
      ? game.i18n.localize("QUESTSYSTEM.Banner.CompleteTitle")
      : game.i18n.localize("QUESTSYSTEM.Banner.StartTitle");

    const subtitle = quest.name;
    const message = isComplete ? quest.messages.completion : quest.messages.opening;

    return {
      questId: quest.id,
      event,
      title,
      subtitle,
      message,
      icon: preset.icon,
      colorPrimary: preset.colorPrimary,
      colorSecondary: preset.colorSecondary,
      textColor: preset.textColor,
      font: preset.font,
      borderStyle: preset.borderStyle,
      background: quest.banner?.background || preset.background || "",
      duration: quest.banner?.duration ?? BANNER_DEFAULT_DURATION,
      // Only show to assigned players (and GM); enforced again at render time.
      audience: {
        users: quest.participants.users,
        actors: quest.participants.actors
      }
    };
  }

  /**
   * Whether the local user should see this banner.
   * @param {object} payload
   */
  static #isForMe(payload) {
    if (game.user.isGM) return true;
    if (!payload.audience) return true;
    if (payload.audience.users.includes(game.user.id)) return true;
    return payload.audience.actors.some((actorId) => game.actors.get(actorId)?.testUserPermission(game.user, "OWNER"));
  }

  /**
   * Render a banner from a payload.
   * @param {object} payload
   */
  static render(payload) {
    if (!payload || !this.#isForMe(payload)) return;

    const layer = this.#ensureLayer();
    const el = document.createElement("div");
    el.className = `qs-banner qs-banner--${payload.event} qs-border-${payload.borderStyle ?? "double"}`;

    // Inline custom-property theming so a single CSS file handles every preset.
    el.style.setProperty("--qs-primary", payload.colorPrimary);
    el.style.setProperty("--qs-secondary", payload.colorSecondary);
    el.style.setProperty("--qs-text", payload.textColor);
    el.style.setProperty("--qs-font", payload.font);
    if (payload.background) {
      el.style.setProperty("--qs-bg-image", `url('${payload.background}')`);
      el.classList.add("has-bg");
    }

    el.innerHTML = `
      <div class="qs-banner__glow"></div>
      <div class="qs-banner__icon"><i class="${payload.icon}"></i></div>
      <div class="qs-banner__body">
        <div class="qs-banner__title">${esc(payload.title)}</div>
        <div class="qs-banner__subtitle">${esc(payload.subtitle)}</div>
        ${payload.message ? `<div class="qs-banner__message">${payload.message}</div>` : ""}
      </div>
      <button type="button" class="qs-banner__close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
    `;

    layer.appendChild(el);

    // Trigger the enter animation on the next frame.
    requestAnimationFrame(() => el.classList.add("is-visible"));

    const dismiss = () => {
      el.classList.remove("is-visible");
      el.classList.add("is-leaving");
      el.addEventListener("transitionend", () => el.remove(), { once: true });
      // Hard fallback in case the transition never fires.
      setTimeout(() => el.remove(), 1200);
    };

    el.querySelector(".qs-banner__close")?.addEventListener("click", dismiss);

    const duration = Number(payload.duration);
    if (duration > 0) setTimeout(dismiss, duration);
  }

  /** Local-only preview used by the editor's "Test banner" button. */
  static preview(quest, event = "start") {
    this.render(this.buildPayload(quest, event));
  }
}
