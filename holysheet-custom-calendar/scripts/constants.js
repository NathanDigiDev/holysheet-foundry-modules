export const MODULE_ID = "holysheet-custom-calendar";

export const SETTINGS = {
  STATE: "state",
  WIDGET: "widget"
};

export const FLAGS = {
  NOTE: "note",
  CALENDAR_ID: "calendarId",
  DATE_KEY: "dateKey",
  PHASE_ID: "phaseId",
  VISIBILITY: "visibility",
  OWNER_USER_ID: "ownerUserId"
};

export const NOTE_VISIBILITY = {
  PUBLIC: "public",
  PRIVATE: "private",
  GM: "gm"
};

// Les labels ci-dessous sont des valeurs de repli stockées dans les données de
// monde ; à l'affichage, `localizePhaseLabel()` (calendar-engine.js) les
// remplace par la traduction i18n correspondant à l'id de phase.
export const DEFAULT_PHASES = [
  { id: "night", label: "Nuit", at: 0, color: "#10172a" },
  { id: "dawn", label: "Aube", at: 18, color: "#d18a5b" },
  { id: "morning", label: "Matin", at: 30, color: "#f4c76b" },
  { id: "noon", label: "Midi", at: 50, color: "#f8e58c" },
  { id: "afternoon", label: "Après-midi", at: 66, color: "#82b7df" },
  { id: "dusk", label: "Crépuscule", at: 80, color: "#b45d7a" },
  { id: "evening", label: "Soir", at: 90, color: "#243b68" }
];

export const DEFAULT_WIDGET = {
  hidden: false,
  locked: true,
  left: null,
  top: 16
};
