import { DEFAULT_PHASES, FLAGS, MODULE_ID } from "../constants.js";
import { getActiveCalendar, getActiveZone, normalizeCalendar } from "../calendar-engine.js";
import { getState, setState } from "../settings.js";
import { renderWidget } from "../widget.js";
import { refreshSidebarTab } from "../sidebar.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class HolysheetConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "holysheet-calendar-config",
    classes: ["holysheet-calendar-config"],
    tag: "section",
    window: {
      title: "HCC.Configure",
      icon: "fa-solid fa-gears"
    },
    position: {
      width: 760,
      height: "auto"
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/config-app.hbs`
    }
  };

  constructor(options = {}) {
    super(options);
    this.calendarId = options.calendarId ?? getState().activeCalendarId;
    this.tab = options.tab ?? "general";
  }

  async _prepareContext(options) {
    const state = getState();
    const calendar = state.calendars.find((candidate) => candidate.id === this.calendarId) ?? getActiveCalendar(state);
    const zone = getActiveZone(calendar);
    const weekdays = calendar.weekdays.map((name, index) => ({ name, index }));
    return {
      isGM: game.user.isGM,
      state,
      calendar,
      tab: this.tab,
      isGeneralTab: this.tab === "general",
      isMonthsTab: this.tab === "months",
      isWeeksTab: this.tab === "weeks",
      isEventsTab: this.tab === "events",
      isZonesTab: this.tab === "zones",
      isContinuousWeekdays: calendar.weekdayMode === "continuous",
      isManualWeekdays: calendar.weekdayMode !== "continuous",
      zone,
      calendars: state.calendars.map((candidate) => ({
        ...candidate,
        selected: candidate.id === calendar.id,
        active: candidate.id === state.activeCalendarId
      })),
      zones: calendar.zones.map((candidate) => ({
        ...candidate,
        active: candidate.id === zone?.id
      })),
      calendarJson: JSON.stringify(state, null, 2),
      weekdaysText: calendar.weekdays.join("\n"),
      weekdays,
      months: calendar.months.map((month, index) => ({
        ...month,
        number: index + 1,
        startsOptions: weekdays.map((weekday) => ({
          ...weekday,
          selected: weekday.index === month.startsOnWeekday
        }))
      })),
      seasons: (zone?.seasons ?? []).map((season, index) => ({ ...season, number: index + 1 })),
      events: (calendar.events ?? []).map((event, index) => ({ ...event, number: index + 1 })),
      phases: zone?.phases ?? DEFAULT_PHASES
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector("form[data-config-form]")?.addEventListener("submit", this.#saveConfig.bind(this));
    this.element.querySelectorAll("[data-action]").forEach((element) => {
      element.addEventListener("click", this.#handleAction.bind(this));
    });
    this.element.querySelector("[name='activeCalendarId']")?.addEventListener("change", this.#changeActiveCalendar.bind(this));
    this.element.querySelector("[name='activeZoneId']")?.addEventListener("change", this.#changeActiveZone.bind(this));
  }

  async #saveConfig(event) {
    event.preventDefault();
    if (!game.user.isGM) return;
    const form = new FormData(event.currentTarget);
    const state = getState();
    const calendar = state.calendars.find((candidate) => candidate.id === this.calendarId) ?? getActiveCalendar(state);
    const zone = getActiveZone(calendar);

    if (form.has("calendarName")) calendar.name = String(form.get("calendarName") || calendar.name);
    if (form.has("calendarDescription")) calendar.description = String(form.get("calendarDescription") || "");
    if (form.has("weekdayMode")) calendar.weekdayMode = String(form.get("weekdayMode") || "manual");
    if (form.has("year")) calendar.currentDate.year = Number(form.get("year") || calendar.currentDate.year);
    if (form.has("month")) calendar.currentDate.month = Number(form.get("month") || calendar.currentDate.month);
    if (form.has("day")) calendar.currentDate.day = Number(form.get("day") || calendar.currentDate.day);
    if (form.has("weekdays")) {
      calendar.weekdays = String(form.get("weekdays") || "")
        .split(/\r?\n/)
        .map((day) => day.trim())
        .filter(Boolean);
    }

    for (const month of calendar.months) {
      const index = calendar.months.indexOf(month);
      if (form.has(`month-${index}-name`)) month.name = String(form.get(`month-${index}-name`) || month.name);
      if (form.has(`month-${index}-days`)) month.days = Number(form.get(`month-${index}-days`) || month.days);
      if (form.has(`month-${index}-starts`)) month.startsOnWeekday = Number(form.get(`month-${index}-starts`) || 0);
    }

    if (form.has("event-0-name") || this.tab === "events") {
      calendar.events = (calendar.events ?? []).map((event, index) => ({
        name: String(form.get(`event-${index}-name`) || event.name),
        month: Number(form.get(`event-${index}-month`) || event.month),
        day: Number(form.get(`event-${index}-day`) || event.day),
        description: String(form.get(`event-${index}-description`) || "")
      }));
    }

    if (zone && (form.has("zoneName") || form.has("dayPercentage") || this.tab === "zones")) {
      if (form.has("zoneName")) zone.name = String(form.get("zoneName") || zone.name);
      if (form.has("dayPercentage")) zone.dayPercentage = Number(form.get("dayPercentage") || zone.dayPercentage);
      zone.seasons = zone.seasons.map((season, index) => ({
        name: String(form.get(`season-${index}-name`) || season.name),
        from: {
          month: Number(form.get(`season-${index}-from-month`) || season.from.month),
          day: Number(form.get(`season-${index}-from-day`) || season.from.day)
        },
        to: {
          month: Number(form.get(`season-${index}-to-month`) || season.to.month),
          day: Number(form.get(`season-${index}-to-day`) || season.to.day)
        }
      }));
      const dayStart = Math.max(0, Math.min(100, (100 - zone.dayPercentage) / 2));
      const dayEnd = Math.max(0, Math.min(100, dayStart + zone.dayPercentage));
      zone.phases = DEFAULT_PHASES.map((phase) => ({ ...phase }));
      zone.phases[1].at = Math.max(0, dayStart - 8);
      zone.phases[2].at = dayStart;
      zone.phases[3].at = 50;
      zone.phases[4].at = Math.min(100, dayEnd - 14);
      zone.phases[5].at = dayEnd;
      zone.phases[6].at = Math.min(100, dayEnd + 8);
    }

    const index = state.calendars.findIndex((candidate) => candidate.id === calendar.id);
    state.calendars[index] = normalizeCalendar(calendar);
    await setState(state);
    renderWidget();
    refreshSidebarTab();
    this.render();
  }

  async #handleAction(event) {
    event.preventDefault();
    if (!game.user.isGM) return;
    const action = event.currentTarget.dataset.action;
    const value = event.currentTarget.dataset.value;
    if (action === "set-config-tab") {
      this.tab = value;
      this.render();
      return;
    }
    if (action === "delete-calendar") {
      await this.#deleteCalendar();
      return;
    }
    if (action === "add-month") {
      const state = getState();
      const calendar = state.calendars.find((candidate) => candidate.id === this.calendarId) ?? getActiveCalendar(state);
      calendar.months.push({
        name: `Mois ${calendar.months.length + 1}`,
        days: 30,
        startsOnWeekday: 0
      });
      await setState(state);
      refreshSidebarTab();
      this.render();
      return;
    }
    if (action === "remove-month") {
      const state = getState();
      const calendar = state.calendars.find((candidate) => candidate.id === this.calendarId) ?? getActiveCalendar(state);
      if (calendar.months.length > 1) calendar.months.pop();
      await setState(state);
      refreshSidebarTab();
      this.render();
      return;
    }
    if (action === "add-zone") {
      const state = getState();
      const calendar = state.calendars.find((candidate) => candidate.id === this.calendarId) ?? getActiveCalendar(state);
      for (const zone of calendar.zones) zone.active = false;
      calendar.zones.push({
        id: foundry.utils.randomID(),
        name: `Zone ${calendar.zones.length + 1}`,
        dayPercentage: 50,
        active: true,
        phases: DEFAULT_PHASES.map((phase) => ({ ...phase })),
        seasons: []
      });
      await setState(state);
      renderWidget();
      refreshSidebarTab();
      this.render();
      return;
    }
    if (action === "add-season") {
      const state = getState();
      const calendar = state.calendars.find((candidate) => candidate.id === this.calendarId) ?? getActiveCalendar(state);
      const zone = getActiveZone(calendar);
      zone.seasons.push({
        name: `Saison ${zone.seasons.length + 1}`,
        from: { month: 1, day: 1 },
        to: { month: 1, day: 30 }
      });
      await setState(state);
      refreshSidebarTab();
      this.render();
      return;
    }
    if (action === "remove-season") {
      const state = getState();
      const calendar = state.calendars.find((candidate) => candidate.id === this.calendarId) ?? getActiveCalendar(state);
      const zone = getActiveZone(calendar);
      zone.seasons.pop();
      await setState(state);
      refreshSidebarTab();
      this.render();
      return;
    }
    if (action === "add-event") {
      const state = getState();
      const calendar = state.calendars.find((candidate) => candidate.id === this.calendarId) ?? getActiveCalendar(state);
      calendar.events ??= [];
      calendar.events.push({ name: "Nouvel événement", month: 1, day: 1, description: "" });
      await setState(state);
      refreshSidebarTab();
      this.render();
      return;
    }
    if (action === "remove-event") {
      const state = getState();
      const calendar = state.calendars.find((candidate) => candidate.id === this.calendarId) ?? getActiveCalendar(state);
      calendar.events?.pop();
      await setState(state);
      refreshSidebarTab();
      this.render();
      return;
    }
    if (action === "export") {
      this.#downloadJson();
      return;
    }
    if (action === "import") {
      await this.#importJson();
    }
  }

  async #changeActiveCalendar(event) {
    if (!game.user.isGM) return;
    this.calendarId = event.currentTarget.value;
    this.render();
  }

  async #changeActiveZone(event) {
    if (!game.user.isGM) return;
    const state = getState();
    const calendar = state.calendars.find((candidate) => candidate.id === this.calendarId) ?? getActiveCalendar(state);
    for (const zone of calendar.zones) zone.active = zone.id === event.currentTarget.value;
    await setState(state);
    renderWidget();
    refreshSidebarTab();
    this.render();
  }

  async #deleteCalendar() {
    const state = getState();
    if (state.calendars.length <= 1) {
      ui.notifications.warn("Impossible de supprimer le dernier calendrier.");
      return;
    }

    const calendar = state.calendars.find((candidate) => candidate.id === this.calendarId);
    if (!calendar) return;

    const confirmed = await Dialog.confirm({
      title: "Supprimer le calendrier",
      content: `<p>Supprimer définitivement <strong>${calendar.name}</strong> ?</p>`
    });
    if (!confirmed) return;

    state.calendars = state.calendars.filter((candidate) => candidate.id !== calendar.id);
    if (state.activeCalendarId === calendar.id) state.activeCalendarId = state.calendars[0].id;
    this.calendarId = state.activeCalendarId;

    await setState(state);
    renderWidget();
    refreshSidebarTab();
    this.render();
  }

  #downloadJson() {
    const notes = game.journal
      .filter((entry) => foundry.utils.getProperty(entry, `flags.${MODULE_ID}.${FLAGS.NOTE}`))
      .map((entry) => ({
        name: entry.name,
        ownership: entry.ownership,
        flags: foundry.utils.getProperty(entry, `flags.${MODULE_ID}`),
        pages: entry.pages.map((page) => ({
          name: page.name,
          type: page.type,
          text: page.text
        }))
      }));
    const content = JSON.stringify({ state: getState(), notes }, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "holysheet-custom-calendar.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async #importJson() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const data = JSON.parse(text);
      await setState(data.state ?? data);
      if (Array.isArray(data.notes)) {
        for (const note of data.notes) {
          await JournalEntry.create({
            name: note.name,
            ownership: note.ownership,
            pages: note.pages,
            flags: { [MODULE_ID]: note.flags }
          });
        }
      }
      renderWidget();
      refreshSidebarTab();
      this.render();
    });
    input.click();
  }
}
