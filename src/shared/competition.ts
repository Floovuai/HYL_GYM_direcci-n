// Funciones puras del modulo Competencia (sin acceso a base ni red): se prueban con vitest.

export type LatLng = { lat: number; lng: number };

export type PlaceKind = "directo" | "indirecto" | "descartar";

export type PlaceClass = { kind: PlaceKind; segment: string };

export type PriceObservation = {
  planName: string;
  monthlyPrice: number | null;
  promo: string;
};

export type PriceChange = {
  kind: "precio" | "promocion" | "plan_nuevo" | "plan_retirado";
  planName: string;
  oldValue: string;
  newValue: string;
};

export function normalizeName(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function haversineMeters(a: LatLng, b: LatLng) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const earth = 6_371_000;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * earth * Math.asin(Math.min(1, Math.sqrt(h))));
}

// Colombia continental e insular cercana: evita coordenadas invertidas o de otro pais.
export function isColombiaCoordinate(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -4.5 && lat <= 13.6 && lng >= -82.5 && lng <= -66.5;
}

const MAPS_HOSTS = new Set([
  "maps.app.goo.gl",
  "goo.gl",
  "g.co",
  "maps.google.com",
  "www.google.com",
  "google.com",
  "www.google.com.co",
  "google.com.co"
]);

export function isAllowedMapsUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (!MAPS_HOSTS.has(url.hostname.toLowerCase())) return false;
    if (url.hostname.endsWith("google.com") || url.hostname.endsWith("google.com.co")) return url.pathname.startsWith("/maps") || url.hostname === "maps.google.com";
    return true;
  } catch {
    return false;
  }
}

export function isShortMapsUrl(raw: string) {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host === "maps.app.goo.gl" || host === "goo.gl" || host === "g.co";
  } catch {
    return false;
  }
}

// Lee coordenadas de un enlace largo de Google Maps. Prefiere la ubicacion del lugar (!3d/!4d)
// sobre el centro de la vista (@lat,lng).
export function parseMapsUrl(raw: string): (LatLng & { name?: string }) | null {
  const text = decodeURIComponent(String(raw || "").replace(/\+/g, " "));
  const patterns = [
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /[?&](?:q|ll|query|destination)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!isColombiaCoordinate(lat, lng)) continue;
    const place = /\/place\/([^/@?]+)/.exec(text);
    return { lat, lng, name: place ? place[1].replace(/\s+/g, " ").trim() : undefined };
  }
  return null;
}

const SCHOOL_WORDS = /\b(colegio|preescolar|jardin infantil|gimnasio (moderno|nuevo|real|infantil|campestre|los|el|la)|liceo|institucion educativa|universidad)\b/;
const FUNCTIONAL_WORDS = /\b(crossfit|cross fit|box|funcional|functional|calistenia|hyrox|halterofilia|powerlifting)\b/;
const BOUTIQUE_WORDS = /\b(pilates|yoga|barre|spinning studio|cycling|reformer)\b/;
const OTHER_SPORT_WORDS = /\b(taekwondo|tae kwon|karate|judo|boxeo|muay|jiu|artes marciales|danza|baile|zumba|natacion|escuela)\b/;

// Clasificacion determinista de un lugar (nombre + etiquetas de OpenStreetMap). Groq solo la refina.
export function classifyPlace(name: string, tags: Record<string, string> = {}): PlaceClass {
  const n = normalizeName(name);
  if (!n) return { kind: "descartar", segment: "" };
  if (SCHOOL_WORDS.test(n) || tags.amenity === "school" || tags.amenity === "kindergarten") return { kind: "descartar", segment: "" };
  if (FUNCTIONAL_WORDS.test(n)) return { kind: "indirecto", segment: "Funcional / CrossFit" };
  if (BOUTIQUE_WORDS.test(n)) return { kind: "indirecto", segment: "Boutique (pilates / yoga)" };
  if (OTHER_SPORT_WORDS.test(n)) return { kind: "indirecto", segment: "Artes marciales / otros deportes" };
  const sport = normalizeName(tags.sport || "");
  if (/\b(crossfit|functional)\b/.test(sport)) return { kind: "indirecto", segment: "Funcional / CrossFit" };
  if (/\b(pilates|yoga)\b/.test(sport)) return { kind: "indirecto", segment: "Boutique (pilates / yoga)" };
  return { kind: "directo", segment: "Gimnasio tradicional" };
}

export type NamedRecord = { id: number; name: string };

// Coincidencia por nombre normalizado: igual o uno contenido en el otro (minimo 4 caracteres).
export function findByName<T extends NamedRecord>(name: string, records: T[]): T | null {
  const target = normalizeName(name);
  if (!target) return null;
  let best: T | null = null;
  let bestScore = 0;
  for (const record of records) {
    const candidate = normalizeName(record.name);
    if (!candidate) continue;
    let score = 0;
    if (candidate === target) score = 3;
    else if (Math.min(candidate.length, target.length) >= 4 && (candidate.includes(target) || target.includes(candidate))) score = 2;
    if (score > bestScore) {
      best = record;
      bestScore = score;
    }
  }
  return best;
}

// Todos los registros que empatan con el mejor puntaje (varias sedes de una misma cadena).
export function findAllByName<T extends NamedRecord>(name: string, records: T[]): T[] {
  const target = normalizeName(name);
  if (!target) return [];
  const scored: Array<{ record: T; score: number }> = [];
  for (const record of records) {
    const candidate = normalizeName(record.name);
    if (!candidate) continue;
    let score = 0;
    if (candidate === target) score = 3;
    else if (Math.min(candidate.length, target.length) >= 4 && (candidate.includes(target) || target.includes(candidate))) score = 2;
    if (score) scored.push({ record, score });
  }
  const best = Math.max(0, ...scored.map((item) => item.score));
  return scored.filter((item) => item.score === best).map((item) => item.record);
}

export function findBrand<T extends { name: string; aliases: string[] }>(placeName: string, brands: T[]): T | null {
  const target = normalizeName(placeName);
  if (!target) return null;
  for (const brand of brands) {
    for (const alias of [brand.name, ...brand.aliases]) {
      const a = normalizeName(alias);
      if (a.length >= 4 && (target === a || target.includes(a))) return brand;
    }
  }
  return null;
}

export const MIN_PLAUSIBLE_MONTHLY = 15_000;

export const PERIOD_MONTHS: Record<string, number> = {
  mes: 1,
  mensual: 1,
  bimestre: 2,
  trimestre: 3,
  trimestral: 3,
  cuatrimestre: 4,
  semestre: 6,
  semestral: 6,
  ano: 12,
  anual: 12
};

// Convierte el precio declarado a valor mensual cuando el periodo se conoce.
export function monthlyEquivalent(price: number | null, period: string | null | undefined, months?: number | null) {
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  const key = normalizeName(period || "");
  const divisor = months && months > 0 ? months : PERIOD_MONTHS[key];
  if (!divisor) return key === "unico" || key === "" ? price : null;
  const monthly = Math.round(price / divisor);
  // Una mensualidad de gimnasio menor a $15.000 es casi seguro un periodo mal interpretado: mejor sin dato que un valor falso.
  return monthly < MIN_PLAUSIBLE_MONTHLY ? null : monthly;
}

export function detectPriceChanges(previous: PriceObservation[], next: PriceObservation[]): PriceChange[] {
  const changes: PriceChange[] = [];
  const prev = new Map(previous.map((item) => [normalizeName(item.planName), item]));
  const seen = new Set<string>();
  const money = (value: number | null) => (value == null ? "sin dato" : `$${Math.round(value).toLocaleString("es-CO")}`);
  for (const item of next) {
    const key = normalizeName(item.planName);
    seen.add(key);
    const old = prev.get(key);
    if (!old) {
      changes.push({ kind: "plan_nuevo", planName: item.planName, oldValue: "", newValue: money(item.monthlyPrice) });
      continue;
    }
    if (old.monthlyPrice != null && item.monthlyPrice != null && Math.abs(old.monthlyPrice - item.monthlyPrice) >= 1) {
      changes.push({ kind: "precio", planName: item.planName, oldValue: money(old.monthlyPrice), newValue: money(item.monthlyPrice) });
    }
    if (normalizeName(old.promo) !== normalizeName(item.promo)) {
      changes.push({ kind: "promocion", planName: item.planName, oldValue: old.promo, newValue: item.promo });
    }
  }
  for (const [key, old] of prev) {
    if (!seen.has(key)) changes.push({ kind: "plan_retirado", planName: old.planName, oldValue: money(old.monthlyPrice), newValue: "" });
  }
  return changes;
}

export function htmlToText(html: string, maxChars = 30_000) {
  const text = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return text.slice(0, maxChars);
}

// Extrae el primer objeto o arreglo JSON de una respuesta de modelo (con o sin bloque ```).
export function extractJson<T = unknown>(raw: string): T | null {
  const text = String(raw || "").replace(/```(?:json)?/gi, "");
  const starts = [text.indexOf("{"), text.indexOf("[")].filter((index) => index >= 0);
  if (!starts.length) return null;
  const start = Math.min(...starts);
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i += 1;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// Bloquea destinos locales o de red privada: la app solo debe leer paginas publicas.
export function isPublicHttpUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split(".").map(Number);
      if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
    }
    if (host.startsWith("[")) return false;
    return true;
  } catch {
    return false;
  }
}

export function cleanHandle(value: string) {
  return String(value ?? "").trim().replace(/^@+/, "").slice(0, 200);
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const digits = value.replace(/[^\d,.-]/g, "");
  if (!digits) return null;
  // Formato COP: 99.000 o 99,000 => miles; 99.5 seria decimal (raro en pesos).
  const cleaned = /^\d{1,3}([.,]\d{3})+$/.test(digits) ? digits.replace(/[.,]/g, "") : digits.replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
