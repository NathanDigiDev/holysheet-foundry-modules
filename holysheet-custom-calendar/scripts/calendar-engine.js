// Correspondance id de phase -> clé i18n. Les labels stockés dans les données
// de monde (zones) servent de repli pour les phases personnalisées.
const PHASE_I18N_KEYS = {
  night: "HCC.Phase.Night",
  dawn: "HCC.Phase.Dawn",
  morning: "HCC.Phase.Morning",
  noon: "HCC.Phase.Noon",
  afternoon: "HCC.Phase.Afternoon",
  dusk: "HCC.Phase.Dusk",
  evening: "HCC.Phase.Evening"
};

/**
 * Retourne le label affichable d'une phase : traduit via i18n pour les phases
 * par défaut, sinon retombe sur le label stocké dans les données de monde.
 */
export function localizePhaseLabel(phase) {
  if (!phase) return "";
  const key = PHASE_I18N_KEYS[phase.id];
  if (key && game.i18n.has(key)) return game.i18n.localize(key);
  return phase.label ?? phase.id;
}

export function getActiveCalendar(state) {
  return state.calendars.find((calendar) => calendar.id === state.activeCalendarId) ?? state.calendars[0];
}

export function getActiveZone(calendar) {
  return calendar.zones.find((zone) => zone.active) ?? calendar.zones[0];
}

export function getPhase(calendar, phaseId) {
  const zone = getActiveZone(calendar);
  return zone?.phases.find((phase) => phase.id === phaseId) ?? zone?.phases[0] ?? null;
}

export function getMonth(calendar, monthNumber) {
  return calendar.months[Math.max(0, monthNumber - 1)] ?? calendar.months[0];
}

export function isLeapYear(calendar, year) {
  if (!calendar.leapYears?.enabled) return false;
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function getDaysInMonth(calendar, year, monthNumber) {
  const month = getMonth(calendar, monthNumber);
  const extraLeapDay = isLeapYear(calendar, year) && calendar.leapYears?.month === monthNumber ? 1 : 0;
  return month.days + extraLeapDay;
}

export function getDateKey(date) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export function formatDate(calendar, date) {
  const weekday = getWeekdayName(calendar, date);
  const month = getMonth(calendar, date.month);
  return `${weekday} ${date.day} ${month.name} ${date.year}`;
}

export function formatNarrativeDate(calendar, date) {
  const weekday = getWeekdayName(calendar, date);
  const month = getMonth(calendar, date.month);
  return game.i18n.format("HCC.NarrativeDate", {
    weekday,
    day: toOrdinal(date.day),
    month: month.name,
    year: date.year
  });
}

// Ordinal adapté à la langue courante (le français et l'anglais n'ont pas les
// mêmes suffixes, on branche donc sur game.i18n.lang).
function toOrdinal(value) {
  const number = Number(value);
  if (game.i18n.lang === "fr") return number === 1 ? "1er" : `${number}ème`;
  const mod10 = number % 10;
  const mod100 = number % 100;
  if (mod10 === 1 && mod100 !== 11) return `${number}st`;
  if (mod10 === 2 && mod100 !== 12) return `${number}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${number}rd`;
  return `${number}th`;
}

export function getWeekdayName(calendar, date) {
  const index = (getMonthStartWeekday(calendar, date.year, date.month) + date.day - 1) % calendar.weekdays.length;
  return calendar.weekdays[index] ?? "";
}

export function getMonthStartWeekday(calendar, year, monthNumber) {
  const month = getMonth(calendar, monthNumber);
  if (calendar.weekdayMode !== "continuous") return month.startsOnWeekday;

  let index = calendar.months[0]?.startsOnWeekday ?? 0;
  for (let month = 1; month < monthNumber; month += 1) {
    index = (index + getDaysInMonth(calendar, year, month)) % calendar.weekdays.length;
  }
  return index;
}

export function getSeason(calendar, date) {
  const zone = getActiveZone(calendar);
  if (!zone?.seasons?.length) return null;
  const target = date.month * 100 + date.day;
  return zone.seasons.find((season) => {
    const from = season.from.month * 100 + season.from.day;
    const to = season.to.month * 100 + season.to.day;
    return from <= to ? target >= from && target <= to : target >= from || target <= to;
  }) ?? null;
}

export function buildMonthGrid(calendar, year, monthNumber) {
  const daysInMonth = getDaysInMonth(calendar, year, monthNumber);
  const startsOnWeekday = getMonthStartWeekday(calendar, year, monthNumber);
  const cells = [];

  for (let i = 0; i < startsOnWeekday; i += 1) {
    cells.push({ empty: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = { year, month: monthNumber, day };
    const events = (calendar.events ?? []).filter((event) => event.month === monthNumber && event.day === day);
    cells.push({
      empty: false,
      day,
      dateKey: getDateKey(date),
      weekday: getWeekdayName(calendar, date),
      events
    });
  }

  while (cells.length % calendar.weekdays.length !== 0) cells.push({ empty: true });
  return cells;
}

export function advanceDays(calendar, count, targetPhaseId = null) {
  const next = foundry.utils.deepClone(calendar);
  for (let i = 0; i < count; i += 1) {
    next.currentDate.day += 1;
    const daysInMonth = getDaysInMonth(next, next.currentDate.year, next.currentDate.month);
    if (next.currentDate.day > daysInMonth) {
      next.currentDate.day = 1;
      next.currentDate.month += 1;
    }
    if (next.currentDate.month > next.months.length) {
      next.currentDate.month = 1;
      next.currentDate.year += 1;
    }
  }

  if (targetPhaseId) {
    next.currentDate.phaseId = targetPhaseId;
    next.currentDate.minuteOfDay = phaseToMinute(next, targetPhaseId);
  }

  return next;
}

export function setMinuteOfDay(calendar, minuteOfDay) {
  const next = foundry.utils.deepClone(calendar);
  next.currentDate.minuteOfDay = Math.max(0, Math.min(1439, Number(minuteOfDay)));
  next.currentDate.phaseId = getPhaseForMinute(next, next.currentDate.minuteOfDay)?.id ?? next.currentDate.phaseId;
  return next;
}

export function getPhaseForMinute(calendar, minuteOfDay) {
  const zone = getActiveZone(calendar);
  if (!zone?.phases?.length) return null;
  const percent = minuteOfDay / 1439 * 100;
  return [...zone.phases].sort((a, b) => b.at - a.at).find((phase) => percent >= phase.at) ?? zone.phases[0];
}

export function phaseToMinute(calendar, phaseId) {
  const phase = getPhase(calendar, phaseId);
  return Math.round(((phase?.at ?? 0) / 100) * 1439);
}

export function createGaugeGradient(zone) {
  const phases = [...(zone?.phases ?? [])].sort((a, b) => a.at - b.at);
  if (!phases.length) return "linear-gradient(90deg, #111827, #f8e58c, #111827)";
  const stops = phases.map((phase) => `${phase.color} ${phase.at}%`);
  const first = phases[0];
  return `linear-gradient(90deg, ${stops.join(", ")}, ${first.color} 100%)`;
}

export function normalizeCalendar(calendar) {
  return {
    ...calendar,
    description: calendar.description ?? "",
    weekdayMode: calendar.weekdayMode ?? "manual",
    events: calendar.events ?? [],
    months: calendar.months.map((month, index) => ({
      ...month,
      startsOnWeekday: Math.max(0, Math.min(calendar.weekdays.length - 1, Number(month.startsOnWeekday ?? index % calendar.weekdays.length))),
      days: Math.max(1, Number(month.days ?? 30))
    }))
  };
}
