export type ImportantDate = {
  date: string;
  name: string;
  kind: "festivo" | "comercial";
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toIso(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function addDays(year: number, month: number, day: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function nextMondayIso(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const daysUntilMonday = weekday === 1 ? 0 : (8 - weekday) % 7;
  const shifted = addDays(year, month, day, daysUntilMonday);
  return toIso(shifted.year, shifted.month, shifted.day);
}

/** Domingo de Pascua via el algoritmo de Gauss (calendario gregoriano). */
function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

/** Devuelve la fecha del n-ésimo weekday (0=domingo..6=sabado) de un mes. */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = first.getUTCDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return toIso(year, month, day);
}

/** Devuelve la fecha del ultimo weekday (0=domingo..6=sabado) de un mes. */
function lastWeekdayOfMonth(year: number, month: number, weekday: number) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = new Date(Date.UTC(year, month - 1, daysInMonth));
  const lastWeekday = last.getUTCDay();
  const offset = (lastWeekday - weekday + 7) % 7;
  return toIso(year, month, daysInMonth - offset);
}

/** Festivos oficiales de Colombia, incluyendo la Ley Emiliani (traslado al lunes siguiente). */
export function colombianHolidaysForYear(year: number): ImportantDate[] {
  const fixed: Array<{ month: number; day: number; name: string }> = [
    { month: 1, day: 1, name: "Año Nuevo" },
    { month: 5, day: 1, name: "Día del Trabajo" },
    { month: 7, day: 20, name: "Independencia" },
    { month: 8, day: 7, name: "Batalla de Boyacá" },
    { month: 12, day: 8, name: "Inmaculada Concepción" },
    { month: 12, day: 25, name: "Navidad" }
  ];

  const emilianiMoved: Array<{ month: number; day: number; name: string }> = [
    { month: 1, day: 6, name: "Reyes Magos" },
    { month: 3, day: 19, name: "San José" },
    { month: 6, day: 29, name: "San Pedro y San Pablo" },
    { month: 8, day: 15, name: "Asunción de la Virgen" },
    { month: 10, day: 12, name: "Día de la Diversidad" },
    { month: 11, day: 1, name: "Todos los Santos" },
    { month: 11, day: 11, name: "Independencia de Cartagena" }
  ];

  const easter = easterSunday(year);
  const easterDate = new Date(Date.UTC(easter.year, easter.month - 1, easter.day));
  const offsetIso = (days: number) => {
    const shifted = new Date(easterDate);
    shifted.setUTCDate(shifted.getUTCDate() + days);
    return toIso(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
  };

  const movedFromEaster = (daysAfterEaster: number, name: string) => {
    const shifted = new Date(easterDate);
    shifted.setUTCDate(shifted.getUTCDate() + daysAfterEaster);
    return {
      date: nextMondayIso(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate()),
      name,
      kind: "festivo" as const
    };
  };

  const holidays: ImportantDate[] = [];
  for (const item of fixed) {
    holidays.push({ date: toIso(year, item.month, item.day), name: item.name, kind: "festivo" });
  }
  for (const item of emilianiMoved) {
    holidays.push({ date: nextMondayIso(year, item.month, item.day), name: item.name, kind: "festivo" });
  }
  holidays.push({ date: offsetIso(-3), name: "Jueves Santo", kind: "festivo" });
  holidays.push({ date: offsetIso(-2), name: "Viernes Santo", kind: "festivo" });
  holidays.push(movedFromEaster(39, "Ascensión"));
  holidays.push(movedFromEaster(60, "Corpus Christi"));
  holidays.push(movedFromEaster(68, "Sagrado Corazón"));

  return holidays;
}

/** Fechas comerciales relevantes para el consumo de un gimnasio. */
export function commercialDatesForYear(year: number): ImportantDate[] {
  return [
    { date: toIso(year, 1, 15), name: "Propósito de año nuevo (temporada fitness)", kind: "comercial" },
    { date: toIso(year, 2, 14), name: "San Valentín", kind: "comercial" },
    { date: toIso(year, 3, 8), name: "Día de la Mujer", kind: "comercial" },
    { date: lastWeekdayOfMonth(year, 4, 6), name: "Día de la Niñez", kind: "comercial" },
    { date: nthWeekdayOfMonth(year, 5, 0, 2), name: "Día de la Madre", kind: "comercial" },
    { date: nthWeekdayOfMonth(year, 6, 0, 3), name: "Día del Padre", kind: "comercial" },
    { date: toIso(year, 6, 30), name: "Prima de mitad de año", kind: "comercial" },
    { date: nthWeekdayOfMonth(year, 9, 6, 3), name: "Amor y Amistad", kind: "comercial" },
    { date: toIso(year, 10, 31), name: "Halloween", kind: "comercial" },
    { date: nthWeekdayOfMonth(year, 11, 5, 4), name: "Black Friday", kind: "comercial" },
    {
      date: (() => {
        const blackFriday = nthWeekdayOfMonth(year, 11, 5, 4);
        const [y, m, d] = blackFriday.split("-").map(Number);
        const shifted = addDays(y, m, d, 3);
        return toIso(shifted.year, shifted.month, shifted.day);
      })(),
      name: "Cyber Monday",
      kind: "comercial"
    },
    { date: toIso(year, 12, 7), name: "Día de las Velitas", kind: "comercial" },
    { date: toIso(year, 12, 20), name: "Prima de diciembre", kind: "comercial" },
    { date: toIso(year, 12, 24), name: "Navidad (víspera)", kind: "comercial" },
    { date: toIso(year, 12, 31), name: "Fin de año", kind: "comercial" }
  ];
}

export function importantDatesForYear(year: number): ImportantDate[] {
  const all = [...colombianHolidaysForYear(year), ...commercialDatesForYear(year)];
  return all.sort((a, b) => a.date.localeCompare(b.date));
}
