import React from "react";
import {
  BarChart3,
  Building2,
  Activity,
  LineChart,
  Megaphone,
  MessageCircle,
  Radar,
  Settings,
  Sparkles,
  TrendingUp,
  Users
} from "lucide-react";

export type TabId = "dashboard" | "projection" | "advisors" | "branches" | "evolution" | "marketing" | "competition" | "trends" | "experience" | "direction" | "assistant" | "settings";

export type AppState = any;

export function DashComMark({ size = 26 }: { size?: number }) {
  const gradientId = React.useId();
  return (
    <svg className="dc-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef1f4" />
          <stop offset="1" stopColor="#a9b2bc" />
        </linearGradient>
      </defs>
      <path d="M15 11 H30 A21 21 0 0 1 30 53 H15 Z" fill="none" stroke={`url(#${gradientId})`} strokeWidth="5.5" strokeLinejoin="round" />
      <polyline points="21,41 28,33.5 33.5,37.5 42,27" fill="none" stroke="#33e6a4" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="42" cy="27" r="3.6" fill="#33e6a4" />
    </svg>
  );
}

export const tabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: "dashboard", label: "Tablero", icon: BarChart3 },
  { id: "projection", label: "Proyección del mes", icon: LineChart },
  { id: "advisors", label: "Asesores", icon: Users },
  { id: "branches", label: "Sedes", icon: Building2 },
  { id: "evolution", label: "Evolución", icon: Activity },
  { id: "marketing", label: "Mercadeo", icon: Megaphone },
  { id: "competition", label: "Competencia", icon: Radar },
  { id: "trends", label: "Tendencias", icon: TrendingUp },
  { id: "direction", label: "Dirección", icon: Sparkles },
  { id: "assistant", label: "Chat IA", icon: MessageCircle },
  { id: "settings", label: "Configuración", icon: Settings }
];

export const monthOptions = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];

export function currency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function compactCurrency(value: number) {
  const number = Number(value || 0);
  const formatCompact = (amount: number) => {
    const truncated = Math.trunc(Math.abs(amount) * 10) / 10;
    const signed = amount < 0 ? -truncated : truncated;
    return new Intl.NumberFormat("es-CO", {
      maximumFractionDigits: 1
    }).format(signed).replace(",0", "");
  };
  if (Math.abs(number) >= 1000000) return `$${formatCompact(number / 1000000)}M`;
  if (Math.abs(number) >= 1000) return `$${formatCompact(number / 1000)}K`;
  return currency(number);
}

export function signedCompactCurrency(value: number) {
  const number = Number(value || 0);
  const amount = compactCurrency(Math.abs(number)).replace(/\s/g, "");
  return `${number > 0 ? "+" : number < 0 ? "-" : ""}${amount}`;
}

export function dateTimeLabel(value?: string | null) {
  if (!value) return "Sin registro";
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function dateLabel(value?: string | null) {
  if (!value) return "Sin corte diario";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function coverageLabel(state?: AppState | null) {
  const coverage = state?.filters?.dataCoverage;
  if (!coverage) return "";
  const loaded = coverage.lastPositiveDay ? `Ventas positivas hasta día ${coverage.lastPositiveDay}` : "Sin ventas positivas cargadas";
  const pending = coverage.pendingFromDay ? `pendiente desde día ${coverage.pendingFromDay}` : "mes sin días positivos pendientes";
  const imported = coverage.latestImport?.importedAt ? `último import ${dateTimeLabel(coverage.latestImport.importedAt)}` : "sin imports registrados";
  return `${loaded} · ${pending} · ${imported}`;
}

export function percent(value: number) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

export function signedPercent(value: number) {
  const number = Number(value || 0);
  const formatted = new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(Math.abs(number) * 100);
  return `${number > 0 ? "+" : number < 0 ? "-" : ""}${formatted}%`;
}

export function ratePercent(value: number) {
  return `${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0) * 100)}%`;
}

export function percentagePointDelta(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const points = Number(value) * 100;
  if (Math.abs(points) < 0.005) return { direction: "flat", arrow: "→", label: "0,00 pp" };
  return {
    direction: points > 0 ? "up" : "down",
    arrow: points > 0 ? "↑" : "↓",
    label: `${points > 0 ? "+" : ""}${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(points)} pp`
  };
}

export function compact(value: number) {
  return new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));
}

export function wholeNumber(value: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

export const MAX_EXCEL_SIZE_MB = 25;
export const MAX_EXCEL_SIZE_BYTES = MAX_EXCEL_SIZE_MB * 1024 * 1024;

export function validateExcelFile(file: File) {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    throw new Error("Formato no permitido. Sube un archivo Excel .xlsx o .xls.");
  }
  if (file.size > MAX_EXCEL_SIZE_BYTES) {
    throw new Error(`El archivo supera el limite de ${MAX_EXCEL_SIZE_MB} MB.`);
  }
}

export function importSummaryNotice(label: string, summary: any, totalLabel: string) {
  const rowsRead = wholeNumber(summary?.rowsRead || 0);
  const rowsInserted = wholeNumber(summary?.rowsInserted || 0);
  const duplicates = wholeNumber(summary?.duplicatesSkipped || 0);
  const rowsIgnored = Number(summary?.rowsIgnored || 0);
  const ignoreReasons = summary?.ignoreReasons || {};
  const reasonLabels: Record<string, string> = {
    fecha_venta_faltante: "sin fecha de venta",
    missing_date: "sin fecha",
    removed_advisor: "asesor retirado",
    non_positive_value: "valor cero o negativo"
  };
  const ignoredDetail = rowsIgnored
    ? ` · Ignoradas: ${wholeNumber(rowsIgnored)} (${Object.entries(ignoreReasons).map(([key, value]) => `${reasonLabels[key] || key}: ${wholeNumber(Number(value || 0))}`).join(", ")})`
    : "";
  return `${label}: ${rowsInserted} nuevas · ${rowsRead} leidas · ${duplicates} duplicadas · ${totalLabel}${ignoredDetail}`;
}

export function safeRatio(numerator: number, denominator?: number | null) {
  if (!denominator || denominator <= 0) return 0;
  return Number(numerator || 0) / denominator;
}

export function advisorPace(advisor: any, state: AppState, year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const fallbackCutoffDay = Math.min(new Date().getDate(), daysInMonth);
  const elapsedDays = Number(advisor.paceCutoffDay || 0) || Math.max(
    1,
    Math.min(
      Number(state.projection?.elapsedDays || state.filters?.dataCoverage?.lastPositiveDay || 0) || fallbackCutoffDay,
      daysInMonth
    )
  );
  const sales = Number(advisor.sales || 0);
  const dailyGoal = Number(advisor.dailyGoal || 0);
  const requiredDailyGoal = Number(advisor.requiredDailyGoal || 0);
  const expectedSales = Number(advisor.expectedSalesToDate || 0) || dailyGoal * elapsedDays;
  const difference = Number.isFinite(Number(advisor.paceDelta)) ? Number(advisor.paceDelta) : sales - expectedSales;
  const dailyAverage = sales / elapsedDays;
  const projectedClose = dailyAverage * daysInMonth;
  const hasGoal = Number(advisor.monthlyGoal || 0) > 0;
  const isPositive = hasGoal && difference >= 0;
  const amount = Math.abs(difference);
  const goalLabel = advisor.monthlyGoalLabel || "meta vigente";

  return {
    hasGoal,
    isPositive,
    elapsedDays,
    label: hasGoal ? (isPositive ? "Ritmo positivo" : "Ritmo negativo") : "Sin ritmo",
    detail: hasGoal
      ? `${isPositive ? "Sobre" : "Faltan"} ${currency(amount)} vs ${goalLabel} al dia ${elapsedDays}`
      : "Sin meta diaria",
    title: hasGoal
      ? `Meta vigente: ${goalLabel} (${currency(advisor.monthlyGoal || 0)}). Presupuesto de hoy: ${currency(dailyGoal)}. Deberia llevar: ${currency(expectedSales)}. Diario para bonificacion: ${currency(requiredDailyGoal)}. Promedio diario: ${currency(dailyAverage)}. Proyeccion: ${currency(projectedClose)}.`
      : "No hay meta diaria configurada para este asesor."
  };
}

export const branchChurnTrafficLights: Record<string, { level: string; base: number; yellow: number; red: number }> = {
  MODELIA: { level: "B", base: 0.192, yellow: 0.212, red: 0.232 },
  "PRADO VERANIEGO": { level: "B", base: 0.193, yellow: 0.213, red: 0.233 },
  "BUENOS AIRES": { level: "C", base: 0.201, yellow: 0.221, red: 0.241 },
  "CALLE 109": { level: "A", base: 0.208, yellow: 0.228, red: 0.248 },
  "SANTA MATILDE": { level: "C", base: 0.218, yellow: 0.238, red: 0.258 },
  "COLORS 162": { level: "B", base: 0.235, yellow: 0.255, red: 0.275 },
  VILLAVICENCIO: { level: "C", base: 0.299, yellow: 0.319, red: 0.339 }
};

export function branchChurnTrafficLight(branch: any, state: AppState) {
  const config = branchChurnTrafficLights[normalizeText(branch.name)];
  const evolution = branch.memberEvolution;
  if (!config || !evolution) {
    return {
      status: "pending",
      label: "Sin dato",
      detail: config ? "Carga evolución para activar semáforo" : "Sin umbral en informe",
      config,
      churn: null
    };
  }
  const churn = Number(evolution.grossChurn || 0);
  const previousGrossChurn = Number(evolution.previousCutoff?.grossChurn);
  const hasPreviousGrossChurn = Number.isFinite(previousGrossChurn) && previousGrossChurn > 0;
  const base = hasPreviousGrossChurn ? previousGrossChurn : config.base;
  const yellow = base + 0.02;
  const red = base + 0.04;
  const dynamicConfig = { ...config, base, yellow, red };
  const history = (state.memberEvolution?.history || [])
    .filter((item: any) => Number(item.branchId) === Number(branch.id))
    .sort((a: any, b: any) => Number(a.year) - Number(b.year) || Number(a.month) - Number(b.month));
  const lastTwo = history.slice(-2);
  const twoYellowMonths = lastTwo.length === 2 && lastTwo.every((item: any) => Number(item.grossChurn || 0) > yellow);
  const baseDetail = hasPreviousGrossChurn ? "frente al corte anterior" : `frente a base ${config.level}`;
  if (churn > red || twoYellowMonths) {
    return {
      status: "red",
      label: "Rojo",
      detail: churn > red ? `Salida bruta sobre ${ratePercent(red)} ${baseDetail}` : "Dos meses seguidos en amarillo",
      config: dynamicConfig,
      churn
    };
  }
  if (churn > yellow) {
    return {
      status: "yellow",
      label: "Amarillo",
      detail: `Salida bruta sobre ${ratePercent(yellow)} ${baseDetail}`,
      config: dynamicConfig,
      churn
    };
  }
  return {
    status: "green",
    label: "Verde",
    detail: `Dentro de base +2pp (${ratePercent(yellow)})`,
    config: dynamicConfig,
    churn
  };
}

export function titleCase(value: string) {
  return String(value || "")
    .toLocaleLowerCase("es-CO")
    .replace(/\b([a-záéíóúñü])/g, (letter) => letter.toLocaleUpperCase("es-CO"));
}

export function advisorDisplayName(value: string) {
  return titleCase(value).replace(/\s+/g, " ").trim();
}

export function advisorChartName(value: string) {
  return advisorDisplayName(value);
}

export function consolidateAdvisorChartRows(advisors: any[]) {
  const byAdvisor = new Map<string, any>();
  for (const advisor of advisors.filter((item: any) => Number(item.sales || 0) > 0)) {
    const key = normalizeText(advisor.name).replace(/\s+/g, " ").trim();
    const score = advisor.score?.score === null || advisor.score?.score === undefined ? 0 : Number(advisor.score.score || 0);
    const current = byAdvisor.get(key);
    if (!current) {
      byAdvisor.set(key, {
        ...advisor,
        sales: Number(advisor.sales || 0),
        rows: Number(advisor.rows || advisor.rows_count || 0),
        conversions: Number(advisor.conversions || 0),
        scorePower: score,
        scoreWeightedSum: score * Number(advisor.sales || 0),
        advisorCount: 1,
        branches: advisor.branchName ? [advisor.branchName] : []
      });
      continue;
    }
    current.sales += Number(advisor.sales || 0);
    current.rows += Number(advisor.rows || advisor.rows_count || 0);
    current.conversions += Number(advisor.conversions || 0);
    current.scorePower += score;
    current.scoreWeightedSum += score * Number(advisor.sales || 0);
    current.advisorCount += 1;
    if (advisor.branchName && !current.branches.includes(advisor.branchName)) current.branches.push(advisor.branchName);
  }
  return Array.from(byAdvisor.values())
    .map((advisor) => ({
      ...advisor,
      chartName: advisorChartName(advisor.name),
      combinedScore: advisor.sales > 0 ? advisor.scoreWeightedSum / advisor.sales : advisor.scorePower / Math.max(advisor.advisorCount, 1),
      scoreText: `Score ${Math.round(advisor.sales > 0 ? advisor.scoreWeightedSum / advisor.sales : advisor.scorePower / Math.max(advisor.advisorCount, 1))}`
    }))
    .sort((a, b) => Number(b.sales || 0) - Number(a.sales || 0) || Number(b.combinedScore || 0) - Number(a.combinedScore || 0));
}

export function branchShortName(value: string) {
  const name = String(value || "");
  const map: Record<string, string> = {
    "Buenos Aires": "Buenos\nAires",
    "Santa Matilde": "Santa\nMatilde",
    "Prado Veraniego": "Prado\nVeraniego",
    "Villavicencio": "Villavicencio",
    "Colors 162": "Colors 162",
    "Calle 109": "Calle 109",
    Modelia: "Modelia",
    Online: "Online"
  };
  return map[name] || name;
}

export function scoreValue(score: any) {
  return score?.score === null || score?.score === undefined ? "Pendiente" : Math.round(score.score).toString();
}

export function nextAdvisorGoal(advisor: any) {
  const target = advisor.target;
  if (!target) return { label: "Sin meta", amount: 0, missing: 0, progress: 0 };
  const goals = [
    { label: "Meta 1", amount: target.meta1 },
    { label: "Meta 2", amount: target.meta2 },
    { label: "Meta 3", amount: target.meta3 },
    { label: "Meta 4", amount: target.meta4 }
  ];
  const next = goals.find((goal) => advisor.sales < goal.amount) || goals[goals.length - 1];
  return {
    ...next,
    missing: Math.max(next.amount - advisor.sales, 0),
    progress: safeRatio(advisor.sales, next.amount)
  };
}

export function branchGoalStage(branch: any) {
  const target = branch.target;
  const sales = Number(branch.sales || 0);
  if (!target) return { label: "Sin meta", amount: 0, progress: 0 };
  const goals = [
    { label: "Meta 1", amount: Number(target.meta1 || 0) },
    { label: "Meta 2", amount: Number(target.meta2 || 0) },
    { label: "Meta 3", amount: Number(target.meta3 || 0) },
    { label: "Meta 4", amount: Number(target.meta4 || 0) }
  ].filter((goal) => goal.amount > 0);
  if (!goals.length) return { label: "Sin meta", amount: 0, progress: 0 };
  const current = goals.slice().reverse().find((goal) => sales >= goal.amount) || goals[0];
  return {
    ...current,
    progress: safeRatio(sales, current.amount)
  };
}

export function branchTargetGoals(branch: any) {
  const target = branch.target;
  if (!target) return [];
  return [
    { label: "Meta 1", amount: Number(target.meta1 || 0) },
    { label: "Meta 2", amount: Number(target.meta2 || 0) },
    { label: "Meta 3", amount: Number(target.meta3 || 0) },
    { label: "Meta 4", amount: Number(target.meta4 || 0) }
  ].filter((goal) => goal.amount > 0);
}

export function SplitTick({ x, y, payload }: any) {
  const lines = String(payload.value || "").split("\n");
  return (
    <g transform={`translate(${x},${y + 8})`}>
      {lines.map((line, index) => (
        <text key={`${line}-${index}`} y={index * 13} textAnchor="middle" fill="#9ba3ab" fontSize={11}>
          {line}
        </text>
      ))}
    </g>
  );
}

export function AdvisorTick({ x, y, payload }: any) {
  return (
    <g transform={`translate(${x - 8},${y})`}>
      <text textAnchor="end" fill="#9ba3ab" fontSize={11}>
        {String(payload.value || "")}
      </text>
    </g>
  );
}

export function VerticalSplitTick({ x, y, payload }: any) {
  const lines = String(payload.value || "").split("\n");
  const offset = -((lines.length - 1) * 6);
  return (
    <g transform={`translate(${x - 8},${y})`}>
      {lines.map((line, index) => (
        <text key={`${line}-${index}`} y={offset + index * 13} textAnchor="end" dominantBaseline="central" fill="#9ba3ab" fontSize={11}>
          {line}
        </text>
      ))}
    </g>
  );
}

export function OneLineTick({ x, y, payload }: any) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="end" dominantBaseline="central" fill="#9ba3ab" fontSize={10}>
        {String(payload.value || "")}
      </text>
    </g>
  );
}

export function scoreClass(status?: string) {
  if (status === "Alto") return "status high";
  if (status === "Medio") return "status medium";
  if (status === "Bajo") return "status low";
  return "status pending";
}

export function displayStatus(value?: string) {
  if (!value) return "";
  const map: Record<string, string> = {
    Backlog: "Pendiente",
    completed: "Completado",
    done: "Hecho"
  };
  return map[value] || value;
}

export function displayArea(value?: string) {
  if (!value) return "";
  const map: Record<string, string> = {
    Marketing: "Mercadeo",
    Direccion: "Dirección"
  };
  return map[value] || value;
}

export function columnLabel(value: string) {
  const map: Record<string, string> = {
    name: "Nombre",
    sales: "Ventas",
    rows: "Registros",
    branchName: "Sede",
    day: "Día"
  };
  return map[value] || value;
}

function KpiView({
  label,
  value,
  sub,
  tone = "green",
  delta,
  deltaLabel,
  deltaTone,
  deltaSuffix = "vs mes anterior"
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
  delta?: number | null;
  deltaLabel?: string;
  deltaTone?: "up" | "down" | "flat";
  deltaSuffix?: string;
}) {
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(Number(delta));
  const hasDeltaLabel = Boolean(deltaLabel);
  const deltaValue = Number(delta || 0);
  const deltaClass = deltaTone ?? (deltaValue > 0 ? "up" : deltaValue < 0 ? "down" : "flat");
  return (
    <div className={`kpi ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hasDelta || hasDeltaLabel ? (
        <em className={`kpi-delta ${deltaClass}`}>
          {deltaClass === "up" ? "↑" : deltaClass === "down" ? "↓" : "→"} {deltaLabel ?? `${signedPercent(deltaValue)} ${deltaSuffix}`}
        </em>
      ) : null}
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

function ProgressView({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="progress" aria-label={`${width}%`}>
      <span style={{ width: `${width}%` }} />
    </div>
  );
}

export function Empty() {
  return <div className="empty">Sin registros para el filtro actual.</div>;
}

export function currentPeriod() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1
  };
}


export function normalizeText(value?: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();
}

export function cleanRows(value: any) {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === "object") : [];
}

export function renderInlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export function parseMarkdownTable(lines: string[], startIndex: number) {
  const separatorIndex = startIndex + 1;
  if (!lines[startIndex]?.includes("|") || !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[separatorIndex] ?? "")) {
    return null;
  }
  const rows: string[][] = [];
  let cursor = startIndex;
  while (cursor < lines.length && lines[cursor].includes("|")) {
    if (cursor !== separatorIndex) {
      rows.push(lines[cursor].trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
    }
    cursor += 1;
  }
  if (rows.length < 2) return null;
  return { headers: rows[0], body: rows.slice(1), nextIndex: cursor };
}

export function formatUpdatedAt(value: string | null | undefined) {
  if (!value) return "Sin registros todavia";
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export function scoreLabel(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Sin dato";
  return new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(value));
}

// Componentes de presentacion puros: no se vuelven a pintar si sus props no cambian.
export const Kpi = React.memo(KpiView);
export const Progress = React.memo(ProgressView);
