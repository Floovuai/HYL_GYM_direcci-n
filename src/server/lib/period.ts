// Helpers de periodo/fecha compartidos por el servidor.
// Extraidos de index.ts sin cambios de comportamiento.

export function currentBogotaParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day)
  };
}

export function currentBogotaPeriod() {
  return currentBogotaParts();
}

export function monthDateRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, month, 0));
  return {
    start,
    end: `${year}-${String(month).padStart(2, "0")}-${String(endDate.getUTCDate()).padStart(2, "0")}`
  };
}

export function dateFromPeriod(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
