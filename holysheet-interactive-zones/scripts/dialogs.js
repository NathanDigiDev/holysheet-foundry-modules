import {
  ACTION_TYPES,
  CHAT_MODES,
  DEFAULT_ZONE,
  LABEL_MODES,
  VOTE_VISIBILITY,
  VISIBILITY_MODES
} from "./constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ZoneConfigApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "holysheet-interactive-zone-config",
    classes: ["holysheet-interactive-zones-config"],
    tag: "form",
    window: {
      title: "HIZ.ConfigTitle",
      icon: "fas fa-draw-polygon",
      resizable: true
    },
    position: {
      width: 620,
      height: "auto"
    },
    form: {
      closeOnSubmit: true,
      handler: ZoneConfigApplication.#onSubmit
    }
  };

  static PARTS = {
    form: {
      template: "modules/holysheet-interactive-zones/templates/zone-config.hbs"
    }
  };

  constructor(zone, { onSave } = {}) {
    super();
    this.zone = foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_ZONE), zone, { inplace: false });
    this.onSave = onSave;
  }

  async _prepareContext(options) {
    const zone = this.zone;
    return {
      ...(await super._prepareContext(options)),
      zone,
      labelModes: optionList(LABEL_MODES, zone.labelMode, {
        always: "HIZ.LabelAlways",
        hover: "HIZ.LabelHover",
        never: "HIZ.LabelNever"
      }),
      visibilityModes: optionList(VISIBILITY_MODES, zone.visibilityMode, {
        all: "HIZ.VisibilityAll",
        users: "HIZ.VisibilityUsers"
      }),
      voteVisibilityModes: optionList(VOTE_VISIBILITY, zone.action.voteVisibility, {
        all: "HIZ.VoteVisibilityAll",
        gm: "HIZ.VoteVisibilityGM"
      }),
      actionTypes: optionList(ACTION_TYPES, zone.action.type, {
        vote: "HIZ.ActionVote",
        journal: "HIZ.ActionJournal",
        image: "HIZ.ActionImage",
        sound: "HIZ.ActionSound",
        macro: "HIZ.ActionMacro",
        chat: "HIZ.ActionChat"
      }),
      chatModes: optionList(CHAT_MODES, zone.action.chatMode, {
        public: "HIZ.ChatPublic",
        private: "HIZ.ChatPrivate"
      }),
      users: game.users.map((user) => ({
        id: user.id,
        name: user.name,
        selected: zone.users?.includes(user.id)
      })),
      journals: game.journal.map((document) => selectDocument(document, zone.action.journalUuid)),
      imageDocuments: [
        ...game.actors.map((document) => selectDocument(document, zone.action.imageUuid)),
        ...game.items.map((document) => selectDocument(document, zone.action.imageUuid))
      ],
      macros: game.macros.map((document) => selectDocument(document, zone.action.macroUuid))
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    const form = root instanceof HTMLFormElement ? root : root.querySelector("form");
    if (!form) return;

    const actionSelect = form.querySelector("[data-action-type]");
    const syncPanels = () => {
      const action = actionSelect?.value ?? ACTION_TYPES.vote;
      for (const panel of form.querySelectorAll("[data-action-panel]")) {
        panel.hidden = panel.dataset.actionPanel !== action;
      }
    };

    actionSelect?.addEventListener("change", syncPanels);
    form.querySelector("[data-pick-sound]")?.addEventListener("click", () => this.#pickSound(form));
    form.querySelector("[data-close]")?.addEventListener("click", () => this.close());
    syncPanels();
  }

  #pickSound(form) {
    const input = form.elements.soundPath;
    const Picker = foundry.applications?.apps?.FilePicker ?? FilePicker;
    new Picker({
      type: "audio",
      current: input.value,
      title: game.i18n.localize("HIZ.SoundPickerTitle"),
      callback: (path) => {
        input.value = path;
      }
    }).render(true);
  }

  static async #onSubmit(event, form, formData) {
    const app = this;
    const data = formData.object;
    const get = (name) => form.elements[name];
    const users = Array.from(form.querySelectorAll("select[name='users'] option:checked")).map((option) => option.value);

    const updated = foundry.utils.mergeObject(foundry.utils.deepClone(app.zone), {
      name: String(data.name || "").trim() || game.i18n.localize("HIZ.Zone"),
      active: Boolean(get("active")?.checked),
      alwaysVisible: Boolean(get("alwaysVisible")?.checked),
      labelMode: data.labelMode,
      visibilityMode: data.visibilityMode,
      users,
      highlight: {
        outline: Boolean(get("highlightOutline")?.checked),
        fill: Boolean(get("highlightFill")?.checked),
        color: data.highlightColor || "#f5c542",
        alpha: Number(data.highlightAlpha || 0.28),
        lineWidth: app.zone.highlight?.lineWidth ?? 3
      },
      action: {
        type: data.actionType,
        voteVisibility: data.voteVisibility,
        journalUuid: data.journalUuid,
        imageUuid: data.imageUuid,
        soundPath: data.soundPath,
        macroUuid: data.macroUuid,
        chatMode: data.chatMode,
        chatMessage: data.chatMessage
      }
    }, { inplace: false });

    await app.onSave?.(updated);
  }
}

function optionList(values, selectedValue, labels) {
  return Object.values(values).map((value) => ({
    value,
    label: game.i18n.localize(labels[value]),
    selected: value === selectedValue
  }));
}

function selectDocument(document, selectedUuid) {
  return {
    uuid: document.uuid,
    name: document.name,
    selected: document.uuid === selectedUuid
  };
}
