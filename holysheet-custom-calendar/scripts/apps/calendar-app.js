import { MODULE_ID, NOTE_VISIBILITY } from "../constants.js";
import {
  advanceDays,
  buildMonthGrid,
  formatDate,
  formatNarrativeDate,
  getActiveCalendar,
  getActiveZone,
  getMonth,
  getPhase,
  getSeason,
  getWeekdayName,
  normalizeCalendar
} from "../calendar-engine.js";
import { createCalendarNote, getNotesForDate, notifyDueNotes } from "../journal-service.js";
import { getState, setState } from "../settings.js";
import { renderWidget, showWidget } from "../widget.js";
import { createGregorianCalendar } from "../presets.js";
import { refreshSidebarTab } from "../sidebar.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class HolysheetCalendarApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "holysheet-calendar-app",
    classes: ["holysheet-calendar-app", "holysheet", "hs-theme-cuir"],
    tag: "section",
    window: {
      title: "HCC.Title",
      icon: "fa-solid fa-calendar-days"
    },
    position: {
      width: 720,
      height: "auto"
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/calendar-app.hbs`
    }
  };

  constructor(options = {}) {
    super(options);
    const calendar = getActiveCalendar(getState());
    this.mode = options.mode ?? "list";
    this.calendarId = options.calendarId ?? calendar.id;
    this.view = {
      year: calendar.currentDate.year,
      month: calendar.currentDate.month,
      selectedDay: calendar.currentDate.day
    };
  }

  async _prepareContext(options) {
    const state = getState();
    const calendar = state.calendars.find((candidate) => candidate.id === this.calendarId) ?? getActiveCalendar(state);
    const zone = getActiveZone(calendar);
    const selectedDate = {
      year: this.view.year,
      month: this.view.month,
      day: this.view.selectedDay,
      phaseId: calendar.currentDate.phaseId,
      minuteOfDay: calendar.currentDate.minuteOfDay
    };
    const currentDate = calendar.currentDate;
    const selectedNotes = getNotesForDate(calendar, selectedDate);
    const month = getMonth(calendar, this.view.month);
    const isCurrentMonth = this.view.year === currentDate.year && this.view.month === currentDate.month;
    const cells = buildMonthGrid(calendar, this.view.year, this.view.month).map((cell) => {
      if (cell.empty) return cell;
      return {
        ...cell,
        isToday: isCurrentMonth && cell.day === currentDate.day,
        isSelected: cell.day === this.view.selectedDay,
        hasNote: getNotesForDate(calendar, { year: this.view.year, month: this.view.month, day: cell.day }).length > 0
      };
    });

    return {
      mode: this.mode,
      isListMode: this.mode === "list",
      isSummaryMode: this.mode === "summary",
      isMonthMode: this.mode === "month",
      isGM: game.user.isGM,
      state,
      calendar,
      description: calendar.description ?? "",
      monthsCount: calendar.months.length,
      eventsCount: (calendar.events ?? []).length,
      events: (calendar.events ?? []).map((event) => ({
        ...event,
        monthName: getMonth(calendar, event.month)?.name ?? event.month
      })),
      calendars: state.calendars.map((candidate) => ({
        ...candidate,
        active: candidate.id === state.activeCalendarId,
        dateLabel: formatDate(candidate, candidate.currentDate),
        zoneName: getActiveZone(candidate)?.name ?? ""
      })),
      zone,
      month,
      year: this.view.year,
      cells,
      weekdaysCount: calendar.weekdays.length,
      selectedDate,
      selectedDateKey: `${selectedDate.year}-${selectedDate.month}-${selectedDate.day}`,
      selectedDateLabel: formatNarrativeDate(calendar, selectedDate),
      currentDateLabel: formatNarrativeDate(calendar, currentDate),
      currentDateKey: `${currentDate.year}-${currentDate.month}-${currentDate.day}`,
      currentWeekday: getWeekdayName(calendar, currentDate),
      season: getSeason(calendar, currentDate)?.name ?? "",
      notes: selectedNotes.map((note) => ({
        id: note.id,
        name: note.name,
        visible: note.visible
      })),
      phases: zone?.phases ?? [],
      visibilities: [
        { id: NOTE_VISIBILITY.PUBLIC, label: game.i18n.localize("HCC.VisibilityPublic") },
        { id: NOTE_VISIBILITY.PRIVATE, label: game.i18n.localize("HCC.VisibilityPrivate") },
        { id: NOTE_VISIBILITY.GM, label: game.i18n.localize("HCC.VisibilityGM") }
      ]
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll("[data-action]").forEach((element) => {
      element.addEventListener("click", this.#handleAction.bind(this));
    });
    this.element.querySelector("form[data-note-form]")?.addEventListener("submit", this.#createNote.bind(this));
    this.element.querySelector("form[data-advance-form]")?.addEventListener("submit", this.#advanceTime.bind(this));
  }

  async #handleAction(event) {
    event.preventDefault();
    const action = event.currentTarget.dataset.action;
    const value = event.currentTarget.dataset.value;
    if (action === "select-day") {
      this.view.selectedDay = Number(value);
      this.render();
      return;
    }
    if (action === "previous-month") {
      this.#shiftMonth(-1);
      this.render();
      return;
    }
    if (action === "next-month") {
      this.#shiftMonth(1);
      this.render();
      return;
    }
    if (action === "open-note") {
      game.journal.get(value)?.sheet.render(true);
      return;
    }
    if (action === "advance-day") {
      await this.#advanceCalendar(1, null);
      return;
    }
    if (action === "show-list") {
      this.mode = "list";
      this.render();
      return;
    }
    if (action === "view-calendar") {
      await this.#viewCalendar(value);
      return;
    }
    if (action === "summary-calendar") {
      await this.#showSummary(value);
      return;
    }
    if (action === "activate-calendar") {
      await this.#activateCalendar(value);
      return;
    }
    if (action === "duplicate-calendar") {
      await this.#duplicateCalendar(value);
      return;
    }
    if (action === "add-calendar") {
      await this.#addCalendar();
      return;
    }
    if (action === "configure-calendar") {
      const { HolysheetConfigApp } = await import("./config-app.js");
      new HolysheetConfigApp({ calendarId: value }).render({ force: true });
      return;
    }
    if (action === "configure") {
      const { HolysheetConfigApp } = await import("./config-app.js");
      new HolysheetConfigApp({ calendarId: this.calendarId }).render({ force: true });
      return;
    }
    if (action === "show-widget") {
      await showWidget();
    }
  }

  async #createNote(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const state = getState();
    const calendar = state.calendars.find((candidate) => candidate.id === this.calendarId) ?? getActiveCalendar(state);
    const date = {
      year: this.view.year,
      month: this.view.month,
      day: this.view.selectedDay
    };

    await createCalendarNote({
      calendar,
      date,
      phaseId: form.get("phaseId"),
      title: form.get("title"),
      content: form.get("content"),
      visibility: form.get("visibility")
    });
    this.render();
  }

  async #advanceTime(event) {
    event.preventDefault();
    if (!game.user.isGM) return;
    const form = new FormData(event.currentTarget);
    const days = Math.max(0, Number(form.get("days") ?? 0));
    const phaseId = String(form.get("phaseId") ?? "");
    const confirmed = await Dialog.confirm({
      title: game.i18n.localize("HCC.AdvanceTime"),
      content: `<p>${game.i18n.localize("HCC.ConfirmAdvance")}</p>`
    });
    if (!confirmed) return;
    await this.#advanceCalendar(days, phaseId);
  }

  async #advanceCalendar(days, phaseId) {
    const state = getState();
    const calendar = state.calendars.find((candidate) => candidate.id === this.calendarId) ?? getActiveCalendar(state);
    const nextCalendar = normalizeCalendar(advanceDays(calendar, days, phaseId));
    const index = state.calendars.findIndex((candidate) => candidate.id === nextCalendar.id);
    state.calendars[index] = nextCalendar;
    await setState(state);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ alias: "Holysheet Calendar" }),
      content: `<p>${game.i18n.format("HCC.TimeAdvanced", {
        date: formatDate(nextCalendar, nextCalendar.currentDate),
        phase: getPhase(nextCalendar, nextCalendar.currentDate.phaseId)?.label ?? nextCalendar.currentDate.phaseId
      })}</p>`
    });
    await notifyDueNotes(nextCalendar);
    renderWidget();
    refreshSidebarTab();
    this.view.year = nextCalendar.currentDate.year;
    this.view.month = nextCalendar.currentDate.month;
    this.view.selectedDay = nextCalendar.currentDate.day;
    this.render();
  }

  #shiftMonth(delta) {
    const state = getState();
    const calendar = state.calendars.find((candidate) => candidate.id === this.calendarId) ?? getActiveCalendar(state);
    this.view.month += delta;
    if (this.view.month < 1) {
      this.view.month = calendar.months.length;
      this.view.year -= 1;
    }
    if (this.view.month > calendar.months.length) {
      this.view.month = 1;
      this.view.year += 1;
    }
    this.view.selectedDay = 1;
  }

  async #viewCalendar(calendarId) {
    const state = getState();
    const calendar = state.calendars.find((candidate) => candidate.id === calendarId) ?? getActiveCalendar(state);
    this.calendarId = calendar.id;
    this.view.year = calendar.currentDate.year;
    this.view.month = calendar.currentDate.month;
    this.view.selectedDay = calendar.currentDate.day;
    this.mode = "month";
    this.render();
  }

  async #showSummary(calendarId) {
    const state = getState();
    const calendar = state.calendars.find((candidate) => candidate.id === calendarId) ?? getActiveCalendar(state);
    this.calendarId = calendar.id;
    this.view.year = calendar.currentDate.year;
    this.view.month = calendar.currentDate.month;
    this.view.selectedDay = calendar.currentDate.day;
    this.mode = "summary";
    this.render();
  }

  async #activateCalendar(calendarId) {
    if (!game.user.isGM) return;
    const state = getState();
    state.activeCalendarId = calendarId;
    this.calendarId = calendarId;
    await setState(state);
    renderWidget();
    refreshSidebarTab();
    this.render();
  }

  async #duplicateCalendar(calendarId) {
    if (!game.user.isGM) return;
    const state = getState();
    const source = state.calendars.find((candidate) => candidate.id === calendarId);
    if (!source) return;
    const duplicate = foundry.utils.deepClone(source);
    duplicate.id = foundry.utils.randomID();
    duplicate.name = `${source.name} - copie`;
    duplicate.zones = duplicate.zones.map((zone) => ({ ...zone, id: foundry.utils.randomID() }));
    state.calendars.push(duplicate);
    await setState(state);
    refreshSidebarTab();
    this.render();
  }

  async #addCalendar() {
    if (!game.user.isGM) return;
    const state = getState();
    const calendar = createGregorianCalendar();
    calendar.name = `Nouveau calendrier ${state.calendars.length + 1}`;
    state.calendars.push(calendar);
    await setState(state);
    refreshSidebarTab();
    this.render();
  }
}
