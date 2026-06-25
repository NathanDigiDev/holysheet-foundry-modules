export const MODULE_ID = "holysheet-interactive-zones";
export const SOCKET_NAME = `module.${MODULE_ID}`;

export const FLAGS = {
  zones: "zones"
};

export const TOOLS = {
  control: "holysheetInteractiveZones",
  select: "select",
  rect: "rect",
  circle: "circle",
  polygon: "polygon"
};

export const ACTION_TYPES = {
  vote: "vote",
  journal: "journal",
  image: "image",
  sound: "sound",
  macro: "macro",
  chat: "chat"
};

export const LABEL_MODES = {
  always: "always",
  hover: "hover",
  never: "never"
};

export const VISIBILITY_MODES = {
  all: "all",
  users: "users"
};

export const CHAT_MODES = {
  public: "public",
  private: "private"
};

export const VOTE_VISIBILITY = {
  all: "all",
  gm: "gm"
};

export const DEFAULT_ZONE = {
  name: "",
  active: true,
  alwaysVisible: false,
  highlight: {
    outline: true,
    fill: true,
    color: "#f5c542",
    alpha: 0.28,
    lineWidth: 3
  },
  labelMode: LABEL_MODES.hover,
  visibilityMode: VISIBILITY_MODES.all,
  users: [],
  action: {
    type: ACTION_TYPES.vote,
    voteVisibility: VOTE_VISIBILITY.all,
    journalUuid: "",
    imageUuid: "",
    soundPath: "",
    macroUuid: "",
    chatMode: CHAT_MODES.public,
    chatMessage: ""
  }
};
