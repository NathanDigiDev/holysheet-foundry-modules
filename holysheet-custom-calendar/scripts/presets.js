import { DEFAULT_PHASES } from "./constants.js";

export function createGregorianCalendar() {
  return {
    id: foundry.utils.randomID(),
    name: "Grégorien",
    description: "Calendrier grégorien standard.",
    weekdayMode: "continuous",
    currentDate: {
      year: 2026,
      month: 1,
      day: 1,
      phaseId: "morning",
      minuteOfDay: 480
    },
    weekdays: [
      "Lundi",
      "Mardi",
      "Mercredi",
      "Jeudi",
      "Vendredi",
      "Samedi",
      "Dimanche"
    ],
    months: [
      { name: "Janvier", days: 31, startsOnWeekday: 3 },
      { name: "Février", days: 28, startsOnWeekday: 6 },
      { name: "Mars", days: 31, startsOnWeekday: 6 },
      { name: "Avril", days: 30, startsOnWeekday: 2 },
      { name: "Mai", days: 31, startsOnWeekday: 4 },
      { name: "Juin", days: 30, startsOnWeekday: 0 },
      { name: "Juillet", days: 31, startsOnWeekday: 2 },
      { name: "Août", days: 31, startsOnWeekday: 5 },
      { name: "Septembre", days: 30, startsOnWeekday: 1 },
      { name: "Octobre", days: 31, startsOnWeekday: 3 },
      { name: "Novembre", days: 30, startsOnWeekday: 6 },
      { name: "Décembre", days: 31, startsOnWeekday: 1 }
    ],
    events: [
      { name: "Jour de l'an", month: 1, day: 1, description: "Premier jour de l'année." }
    ],
    leapYears: {
      enabled: true,
      month: 2
    },
    zones: [
      {
        id: foundry.utils.randomID(),
        name: "Hémisphère nord",
        dayPercentage: 50,
        active: true,
        phases: structuredClone(DEFAULT_PHASES),
        seasons: [
          { name: "Hiver", from: { month: 12, day: 21 }, to: { month: 3, day: 19 } },
          { name: "Printemps", from: { month: 3, day: 20 }, to: { month: 6, day: 20 } },
          { name: "Été", from: { month: 6, day: 21 }, to: { month: 9, day: 21 } },
          { name: "Automne", from: { month: 9, day: 22 }, to: { month: 12, day: 20 } }
        ]
      }
    ]
  };
}

export function createDefaultState() {
  const calendar = createGregorianCalendar();
  return {
    version: 1,
    activeCalendarId: calendar.id,
    calendars: [calendar]
  };
}
