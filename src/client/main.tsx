import React from "react";
import ReactDOM from "react-dom/client";
import {
  BarChart3,
  Bot,
  Bug,
  Building2,
  CalendarDays,
  CheckSquare,
  Clock,
  ClipboardList,
  AlertTriangle,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  LineChart,
  Maximize2,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  Radar,
  RefreshCcw,
  RefreshCw,
  Settings,
  Sparkles,
  Star,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Upload,
  UserCircle,
  UserX,
  Users,
  X as CloseIcon
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import "./styles.css";

type TabId = "dashboard" | "projection" | "advisors" | "branches" | "marketing" | "trends" | "experience" | "direction" | "assistant" | "settings";

type AppState = any;

const tabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: "dashboard", label: "Tablero", icon: BarChart3 },
  { id: "projection", label: "Proyección del mes", icon: LineChart },
  { id: "advisors", label: "Asesores", icon: Users },
  { id: "branches", label: "Sedes", icon: Building2 },
  { id: "marketing", label: "Mercadeo", icon: Megaphone },
  { id: "trends", label: "Tendencias", icon: TrendingUp },
  { id: "direction", label: "Dirección", icon: Sparkles },
  { id: "assistant", label: "Chat IA", icon: MessageCircle },
  { id: "settings", label: "Configuración", icon: Settings }
];

const monthOptions = [
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

function currency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function compactCurrency(value: number) {
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

function signedCompactCurrency(value: number) {
  const number = Number(value || 0);
  const amount = compactCurrency(Math.abs(number)).replace(/\s/g, "");
  return `${number > 0 ? "+" : number < 0 ? "-" : ""}${amount}`;
}

function dateTimeLabel(value?: string | null) {
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

function dateLabel(value?: string | null) {
  if (!value) return "Sin corte diario";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function coverageLabel(state?: AppState | null) {
  const coverage = state?.filters?.dataCoverage;
  if (!coverage) return "";
  const loaded = coverage.lastPositiveDay ? `Ventas positivas hasta día ${coverage.lastPositiveDay}` : "Sin ventas positivas cargadas";
  const pending = coverage.pendingFromDay ? `pendiente desde día ${coverage.pendingFromDay}` : "mes sin días positivos pendientes";
  const imported = coverage.latestImport?.importedAt ? `último import ${dateTimeLabel(coverage.latestImport.importedAt)}` : "sin imports registrados";
  return `${loaded} · ${pending} · ${imported}`;
}

function percent(value: number) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function signedPercent(value: number) {
  const number = Number(value || 0);
  const formatted = new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(Math.abs(number) * 100);
  return `${number > 0 ? "+" : number < 0 ? "-" : ""}${formatted}%`;
}

function ratePercent(value: number) {
  return `${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0) * 100)}%`;
}

function percentagePointDelta(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const points = Number(value) * 100;
  if (Math.abs(points) < 0.005) return { direction: "flat", arrow: "→", label: "0,00 pp" };
  return {
    direction: points > 0 ? "up" : "down",
    arrow: points > 0 ? "↑" : "↓",
    label: `${points > 0 ? "+" : ""}${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(points)} pp`
  };
}

function compact(value: number) {
  return new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));
}

function wholeNumber(value: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

const MAX_EXCEL_SIZE_MB = 25;
const MAX_EXCEL_SIZE_BYTES = MAX_EXCEL_SIZE_MB * 1024 * 1024;

function validateExcelFile(file: File) {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    throw new Error("Formato no permitido. Sube un archivo Excel .xlsx o .xls.");
  }
  if (file.size > MAX_EXCEL_SIZE_BYTES) {
    throw new Error(`El archivo supera el limite de ${MAX_EXCEL_SIZE_MB} MB.`);
  }
}

function importSummaryNotice(label: string, summary: any, totalLabel: string) {
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

function safeRatio(numerator: number, denominator?: number | null) {
  if (!denominator || denominator <= 0) return 0;
  return Number(numerator || 0) / denominator;
}

function advisorPace(advisor: any, state: AppState, year: number, month: number) {
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

const branchChurnTrafficLights: Record<string, { level: string; base: number; yellow: number; red: number }> = {
  MODELIA: { level: "B", base: 0.192, yellow: 0.212, red: 0.232 },
  "PRADO VERANIEGO": { level: "B", base: 0.193, yellow: 0.213, red: 0.233 },
  "BUENOS AIRES": { level: "C", base: 0.201, yellow: 0.221, red: 0.241 },
  "CALLE 109": { level: "A", base: 0.208, yellow: 0.228, red: 0.248 },
  "SANTA MATILDE": { level: "C", base: 0.218, yellow: 0.238, red: 0.258 },
  "COLORS 162": { level: "B", base: 0.235, yellow: 0.255, red: 0.275 },
  VILLAVICENCIO: { level: "C", base: 0.299, yellow: 0.319, red: 0.339 }
};

function branchChurnTrafficLight(branch: any, state: AppState) {
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

function titleCase(value: string) {
  return String(value || "")
    .toLocaleLowerCase("es-CO")
    .replace(/\b([a-záéíóúñü])/g, (letter) => letter.toLocaleUpperCase("es-CO"));
}

function advisorDisplayName(value: string) {
  return titleCase(value).replace(/\s+/g, " ").trim();
}

function advisorChartName(value: string) {
  return advisorDisplayName(value);
}

function consolidateAdvisorChartRows(advisors: any[]) {
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

function branchShortName(value: string) {
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

function scoreValue(score: any) {
  return score?.score === null || score?.score === undefined ? "Pendiente" : Math.round(score.score).toString();
}

function nextAdvisorGoal(advisor: any) {
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

function branchGoalStage(branch: any) {
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

function branchTargetGoals(branch: any) {
  const target = branch.target;
  if (!target) return [];
  return [
    { label: "Meta 1", amount: Number(target.meta1 || 0) },
    { label: "Meta 2", amount: Number(target.meta2 || 0) },
    { label: "Meta 3", amount: Number(target.meta3 || 0) },
    { label: "Meta 4", amount: Number(target.meta4 || 0) }
  ].filter((goal) => goal.amount > 0);
}

function SplitTick({ x, y, payload }: any) {
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

function AdvisorTick({ x, y, payload }: any) {
  return (
    <g transform={`translate(${x - 8},${y})`}>
      <text textAnchor="end" fill="#9ba3ab" fontSize={11}>
        {String(payload.value || "")}
      </text>
    </g>
  );
}

function VerticalSplitTick({ x, y, payload }: any) {
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

function OneLineTick({ x, y, payload }: any) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="end" dominantBaseline="central" fill="#9ba3ab" fontSize={10}>
        {String(payload.value || "")}
      </text>
    </g>
  );
}

function scoreClass(status?: string) {
  if (status === "Alto") return "status high";
  if (status === "Medio") return "status medium";
  if (status === "Bajo") return "status low";
  return "status pending";
}

function displayStatus(value?: string) {
  if (!value) return "";
  const map: Record<string, string> = {
    Backlog: "Pendiente",
    completed: "Completado",
    done: "Hecho"
  };
  return map[value] || value;
}

function displayArea(value?: string) {
  if (!value) return "";
  const map: Record<string, string> = {
    Marketing: "Mercadeo",
    Direccion: "Dirección"
  };
  return map[value] || value;
}

function columnLabel(value: string) {
  const map: Record<string, string> = {
    name: "Nombre",
    sales: "Ventas",
    rows: "Registros",
    branchName: "Sede",
    day: "Día"
  };
  return map[value] || value;
}

function Kpi({
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

function Progress({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="progress" aria-label={`${width}%`}>
      <span style={{ width: `${width}%` }} />
    </div>
  );
}

function Empty() {
  return <div className="empty">Sin registros para el filtro actual.</div>;
}

function currentPeriod() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1
  };
}

function App() {
  const initialPeriod = React.useMemo(currentPeriod, []);
  const [tab, setTab] = React.useState<TabId>("dashboard");
  const [state, setState] = React.useState<AppState | null>(null);
  const [year, setYear] = React.useState(initialPeriod.year);
  const [month, setMonth] = React.useState(initialPeriod.month);
  const [loading, setLoading] = React.useState(true);
  const [notice, setNotice] = React.useState("");
  const [exportOpen, setExportOpen] = React.useState(false);
  const [uploadingExcel, setUploadingExcel] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/state?year=${year}&month=${month}&_=${Date.now()}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "No se pudo cargar el estado");
    setState(json);
    setLoading(false);
  }, [year, month]);

  React.useEffect(() => {
    load().catch((error) => {
      setNotice(error.message);
      setLoading(false);
    });
  }, [load]);

  React.useEffect(() => {
    function logClientError(message: string, details: Record<string, unknown> = {}) {
      fetch("/api/debug/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "DC-UI-001",
          userMessage: "La interfaz encontro un error.",
          technicalMessage: message,
          path: window.location.pathname,
          details
        })
      }).catch(() => undefined);
    }
    const onError = (event: ErrorEvent) => logClientError(event.message, { source: event.filename, line: event.lineno, column: event.colno });
    const onUnhandled = (event: PromiseRejectionEvent) => logClientError(String((event.reason as Error)?.message || event.reason || "Promesa rechazada"));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);

  React.useEffect(() => {
    const events = new EventSource("/api/events");
    events.addEventListener("sales_updated", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        const rows = Number(payload.rowsInserted ?? payload.summary?.rowsInserted ?? 0);
        setNotice(rows > 0 ? `Ventas actualizadas en tiempo real: ${rows} nuevas.` : "Sincronizacion de ventas revisada.");
      } catch {
        setNotice("Ventas actualizadas en tiempo real.");
      }
      load().catch((error) => setNotice(error.message));
    });
    events.addEventListener("evo_sync", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        if (payload.status === "ok") {
          const rows = Number(payload.summary?.rowsInserted ?? 0);
          if (rows > 0) setNotice(`EVO importó ${rows} ventas nuevas.`);
        }
      } catch {
        // Evento informativo no critico.
      }
    });
    events.addEventListener("catalog_updated", () => {
      setNotice("Catalogo de planes EVO actualizado.");
      load().catch((error) => setNotice(error.message));
    });
    events.addEventListener("member_evolution_updated", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        const rows = Number(payload.summary?.rowsInserted ?? 0);
        setNotice(`Evolución de miembros actualizada: ${rows} sedes.`);
      } catch {
        setNotice("Evolución de miembros actualizada.");
      }
      load().catch((error) => setNotice(error.message));
    });
    events.addEventListener("access_entries_updated", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        const rows = Number(payload.summary?.rowsInserted ?? 0);
        setNotice(rows > 0 ? `Entradas EVO actualizadas: ${rows} nuevas.` : "Entradas EVO revisadas.");
      } catch {
        setNotice("Entradas EVO actualizadas.");
      }
      load().catch((error) => setNotice(error.message));
    });
    events.onerror = () => {
      setNotice("Reconectando actualizaciones en tiempo real...");
    };
    return () => events.close();
  }, [load]);

  React.useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        load().catch((error) => setNotice(error.message));
      }
    }
    const timer = window.setInterval(() => {
      refreshWhenVisible();
    }, 60_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [load]);

  async function uploadExcel(file: File) {
    validateExcelFile(file);
    const data = new FormData();
    data.append("file", file);
    setUploadingExcel(true);
    setNotice(`Importando ${file.name}...`);
    try {
      const res = await fetch("/api/import/sales-excel", { method: "POST", body: data });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo importar");
      setNotice(importSummaryNotice("Ventas importadas", json.summary, `Valor: ${currency(json.summary.totalValue || 0)}`));
      await load();
    } finally {
      setUploadingExcel(false);
    }
  }

  if (!state && loading) {
    return <div className="boot">Cargando DashCom</div>;
  }

  return (
    <main className="app">
      <aside className={`sidebar${menuOpen ? " open" : ""}`}>
        <div className="brand">
          <BarChart3 size={24} />
          <div>
            <strong>DashCom</strong>
            <span>Dashboard Comercial</span>
          </div>
          <button
            type="button"
            className="menu-toggle"
            aria-label={menuOpen ? "Cerrar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <CloseIcon size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <nav>
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={tab === item.id ? "active" : ""}
                onClick={() => {
                  setTab(item.id);
                  setMenuOpen(false);
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <button className="logout" onClick={() => { window.location.href = "/logout"; }}>
          <LogOut size={18} />
          <span>Salir</span>
        </button>
      </aside>
      {menuOpen ? <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" /> : null}

      <section className={`workspace ${tab === "dashboard" ? "dashboard-workspace" : ""} ${tab === "branches" ? "branches-workspace" : ""} ${tab === "projection" ? "projection-workspace" : ""} ${tab === "settings" ? "settings-workspace" : ""}`}>
        <header className="topbar">
          <div>
            <h1>{tabs.find((item) => item.id === tab)?.label}</h1>
            <p>{state?.filters.selectedMonthName} {state?.filters.selectedYear}</p>
            {state ? <small className="data-coverage">{coverageLabel(state)}</small> : null}
          </div>
          <div className="actions">
            <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {(state?.filters.years?.length ? state.filters.years : [2026]).map((item: number) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
              {monthOptions.map((item, index) => (
                <option key={item} value={index + 1}>{item}</option>
              ))}
            </select>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadExcel(file).catch((error) => setNotice(error.message));
                event.currentTarget.value = "";
              }}
            />
            <button title="Cargar Excel" onClick={() => fileInput.current?.click()} disabled={uploadingExcel}>
              <Upload size={18} />
              <span>{uploadingExcel ? "Importando..." : "Excel"}</span>
            </button>
            <button title="Exportar PDF" onClick={() => setExportOpen(true)}>
              <FileText size={18} />
              <span>PDF</span>
            </button>
            <button title="Actualizar" onClick={() => load()}>
              <RefreshCcw size={18} />
            </button>
          </div>
        </header>

        {notice ? <div className="notice">{notice}</div> : null}
        {loading ? <div className="loader" /> : null}
        {state ? (
          <>
            {tab === "dashboard" && <Dashboard state={state} />}
            {tab === "projection" && <MonthProjection state={state} year={year} month={month} />}
            {tab === "advisors" && <Advisors state={state} year={year} month={month} onReload={load} />}
            {tab === "branches" && <Branches state={state} year={year} month={month} onReload={load} setNotice={setNotice} />}
            {tab === "marketing" && <Marketing state={state} onReload={load} setNotice={setNotice} />}
            {tab === "trends" && <SalesTrends state={state} onReload={load} setNotice={setNotice} />}
            {tab === "direction" && <Direction state={state} year={year} month={month} onReload={load} setNotice={setNotice} />}
            {tab === "assistant" && <AiChat state={state} year={year} month={month} setNotice={setNotice} />}
            {tab === "settings" && <Configuration state={state} onReload={load} setNotice={setNotice} />}
            {exportOpen ? <ExportDialog state={state} year={year} month={month} onClose={() => setExportOpen(false)} /> : null}
          </>
        ) : null}
      </section>
    </main>
  );
}

const pdfSections = [
  { id: "summary", label: "Resumen ejecutivo", description: "KPI principales, hallazgos y lectura general." },
  { id: "charts", label: "Graficos gerenciales", description: "Visuales de sedes, asesores, planes y tendencia." },
  { id: "daily", label: "Informe diario", description: "Ventas por dia y mejores dias del mes." },
  { id: "monthly", label: "Informe mensual", description: "Evolucion mes a mes con metas y avance." },
  { id: "churn", label: "Churn y miembros", description: "Evolución de activos, churn directo y salida bruta por sede." },
  { id: "annual", label: "Informe anual", description: "Acumulado del ano y comparativos clave." },
  { id: "branches", label: "Sedes", description: "Rendimiento mensual, anual, meta y score." },
  { id: "advisors", label: "Asesores", description: "Ventas, comisiones y score comercial." },
  { id: "plans", label: "Planes", description: "Ventas por plan, registros y score del plan." },
  { id: "scores", label: "Scores", description: "Score de sedes, asesores y planes." },
  { id: "quality", label: "Calidad de datos", description: "Duplicados, llaves unicas y datos por revisar." },
  { id: "recommendations", label: "Acciones sugeridas", description: "Recomendaciones calculadas por la plataforma." }
];

function ExportDialog({ state, year, month, onClose }: { state: AppState; year: number; month: number; onClose: () => void }) {
  const [selected, setSelected] = React.useState(() => new Set(pdfSections.map((item) => item.id)));
  const [includeGroq, setIncludeGroq] = React.useState(false);
  const groqConfigured = state.settings.groq_api_key_configured === "true";

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = selected.size === pdfSections.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(pdfSections.map((item) => item.id)));
  }

  function exportPdf() {
    const sections = Array.from(selected);
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
      sections: sections.join(","),
      includeGroq: includeGroq ? "1" : "0"
    });
    window.open(`/api/export/gerencial.pdf?${params.toString()}`, "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="export-dialog">
        <header>
          <div>
            <h2>Exportar informe PDF</h2>
            <p>{state.filters.selectedMonthName} {state.filters.selectedYear}</p>
          </div>
          <button className="icon-button" onClick={onClose} title="Cerrar">X</button>
        </header>
        <div className="export-select-all">
          <button className="secondary-button" onClick={toggleAll}>{allSelected ? "Desmarcar todo" : "Marcar todo"}</button>
          <span>{selected.size} de {pdfSections.length} secciones seleccionadas</span>
        </div>
        <div className="export-grid">
          {pdfSections.map((item) => (
            <label key={item.id} className="check-row">
              <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </label>
          ))}
        </div>
        <label className="check-row ai-option">
          <input type="checkbox" checked={includeGroq} onChange={(event) => setIncludeGroq(event.target.checked)} disabled={!groqConfigured} />
          <span>
            <strong>Incluir sugerencias guiadas por Groq</strong>
            <small>{groqConfigured ? "Agrega analisis ejecutivo generado con IA al PDF." : "Groq no esta configurado."}</small>
          </span>
        </label>
        <footer>
          <button className="secondary-button" onClick={onClose}>Cancelar</button>
          <button className="silver-button" onClick={exportPdf} disabled={!selected.size}>Generar PDF</button>
        </footer>
      </section>
    </div>
  );
}

function DashboardBranchTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="dashboard-chart-tooltip">
      <strong>{row.name}</strong>
      <span>Ejecutado: {currency(Number(row.executed || row.sales || 0))}</span>
      <span>Proyección: {currency(Number(row.projected || 0))}</span>
      <span>% ejecutado: {ratePercent(Number(row.executedRate || 0))}</span>
      <span className={Number(row.diff || 0) >= 0 ? "up" : "down"}>
        Ritmo: {compactCurrency(Number(row.diff || 0))}
      </span>
    </div>
  );
}

function Dashboard({ state }: { state: AppState }) {
  const [advisorsExpanded, setAdvisorsExpanded] = React.useState(false);
  const [compactExpandedChart, setCompactExpandedChart] = React.useState(() => window.innerWidth <= 680);
  const branchChart = state.branches.slice(0, 8).map((branch: any) => ({
    ...branch,
    chartName: branch.name,
    executed: Number(branch.tracking?.executed ?? branch.sales ?? 0),
    projected: Number(branch.tracking?.projected ?? branch.target?.meta1 ?? 0),
    diff: Number(branch.tracking?.diff ?? ((branch.sales || 0) - (branch.tracking?.projected || 0))),
    executedRate: safeRatio(Number(branch.tracking?.executed ?? branch.sales ?? 0), Number(branch.tracking?.projected ?? branch.target?.meta1 ?? 0)),
    executedRateLabel: ratePercent(safeRatio(Number(branch.tracking?.executed ?? branch.sales ?? 0), Number(branch.tracking?.projected ?? branch.target?.meta1 ?? 0)))
  }));
  const branchChartTotals = React.useMemo(() => {
    const executed = branchChart.reduce((sum: number, row: any) => sum + Number(row.executed || 0), 0);
    const projected = branchChart.reduce((sum: number, row: any) => sum + Number(row.projected || 0), 0);
    return {
      executed,
      projected,
      rate: safeRatio(executed, projected),
      overCount: branchChart.filter((row: any) => Number(row.executedRate || 0) >= 1).length
    };
  }, [branchChart]);
  const advisorRowsWithSales = state.advisors.filter((advisor: any) => Number(advisor.sales || 0) > 0);
  const advisorChart = consolidateAdvisorChartRows(state.advisors);
  const dashboardAdvisorChart = advisorChart.slice(0, 7);
  const advisorSplitCount = advisorRowsWithSales.length - advisorChart.length;
  const advisorChartHeight = 270;
  const advisorExpandedHeight = Math.max(460, advisorChart.length * 38 + 72);
  const quality = state.quality || {};
  const orphanSales = quality.orphanSales || {};
  const latestImport = state.filters?.dataCoverage?.latestImport;
  const latestImportDetails = latestImport?.details || {};
  const ignoredRows = Number(latestImportDetails.rowsIgnored || 0);
  const ignoreReasons = latestImportDetails.ignoreReasons || {};
  const unassignedAdvisorSales = (orphanSales.unassignedAdvisorByBranch || []).reduce((sum: number, row: any) => sum + Number(row.sales || 0), 0);
  const trackingCompany = state.branchTracking?.company;
  const trackingCutoffDay = state.branchTracking?.cutoffDay ?? state.filters?.dataCoverage?.lastPositiveDay;
  const trackingDiff = Number(trackingCompany?.diff ?? 0);
  const trackingProgress = Number(trackingCompany?.progress ?? state.kpis.targetProgress ?? 0);
  const trackingExpectedProgress = Number(trackingCompany?.expectedProgress ?? 0);
  const trackingDiffPp = Number(trackingCompany?.diffPp ?? (trackingProgress - trackingExpectedProgress));
  const previousTrackingDiff = Number(state.kpis.previous?.trackingDiff ?? 0);
  const trackingDiffVsPrevious = trackingDiff - previousTrackingDiff;
  React.useEffect(() => {
    const query = window.matchMedia("(max-width: 680px)");
    const update = () => setCompactExpandedChart(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return (
    <div className="view dashboard-view">
      <div className="kpi-grid projection-kpi-grid dashboard-kpi-grid">
        <Kpi label="Ventas mes" value={currency(state.kpis.totalSales)} sub={`${state.kpis.salesRows} registros`} delta={state.kpis.deltas?.totalSales} />
        <Kpi label={`Proyección día ${trackingCutoffDay ?? "-"}`} value={compactCurrency(trackingCompany?.projected ?? 0)} sub="ejecutado esperado a hoy" tone="blue" delta={state.kpis.deltas?.projectedToDate} />
        <Kpi label="Ticket promedio" value={currency(state.kpis.avgTicket)} sub="ventas con valor" tone="amber" delta={state.kpis.deltas?.avgTicket} />
        <Kpi label="Progreso meta" value={ratePercent(trackingProgress)} sub={`Esperado ${ratePercent(trackingExpectedProgress)} · ${compactCurrency(state.kpis.totalTarget)} meta`} tone={trackingDiffPp >= 0 ? "green" : "red"} delta={state.kpis.deltas?.targetProgress} />
        <Kpi
          label="Ritmo"
          value={compactCurrency(trackingDiff)}
          sub={trackingDiff >= 0 ? "sobre proyección" : "bajo proyección"}
          tone={trackingDiff >= 0 ? "green" : "red"}
          deltaLabel={`${signedCompactCurrency(trackingDiffVsPrevious)} vs mes anterior`}
          deltaTone={trackingDiffVsPrevious > 0 ? "up" : trackingDiffVsPrevious < 0 ? "down" : "flat"}
        />
        <Kpi label="Comisiones Asesores" value={currency(state.kpis.totalAdvisorCommissions)} sub="asesores" tone="red" delta={state.kpis.deltas?.totalAdvisorCommissions} />
        <Kpi label="Comisiones Director" value={currency(state.kpis.totalDirectorCommissions)} sub="director" tone="green" delta={state.kpis.deltas?.totalDirectorCommissions} />
      </div>

      <section className={`panel data-health-panel ${quality.status === "OK" ? "ok" : "review"}`}>
        <div className="panel-title">
          <div>
            <h2>Salud comercial de datos</h2>
            <span>{quality.status === "OK" ? "Sin alertas críticas en el filtro." : "Puntos que afectan comisiones, score o lectura comercial."}</span>
          </div>
          <AlertTriangle size={18} />
        </div>
        <div className="health-grid">
          <article>
            <span>Ventas positivas sin asesor</span>
            <strong>{wholeNumber(orphanSales.missingAdvisorPositive || 0)}</strong>
            <small>{orphanSales.missingAdvisorPositive ? "Revisar asignación antes de liquidar comisiones." : "Asignación completa para ventas positivas."}</small>
          </article>
          <article>
            <span>Valor sin asesor</span>
            <strong>{currency(unassignedAdvisorSales)}</strong>
            <small>Suma por sede para el periodo filtrado.</small>
          </article>
          <article>
            <span>Última carga</span>
            <strong>{latestImport ? `${wholeNumber(latestImport.rowsInserted || 0)} nuevas` : "Sin registro"}</strong>
            <small>{latestImport ? `${wholeNumber(latestImport.rowsRead || 0)} leídas · ${wholeNumber(latestImport.duplicatesSkipped || 0)} duplicadas` : "Carga ventas para activar auditoría."}</small>
          </article>
          <article>
            <span>Filas EVO ignoradas</span>
            <strong>{wholeNumber(ignoredRows)}</strong>
            <small>{ignoredRows ? Object.entries(ignoreReasons).map(([key, value]) => `${key}: ${value}`).join(" · ") : "Sin descartes reportados en la última carga."}</small>
          </article>
        </div>
        {orphanSales.unassignedAdvisorByBranch?.length ? (
          <div className="health-breakdown">
            {orphanSales.unassignedAdvisorByBranch.slice(0, 4).map((item: any) => (
              <span key={item.branchName}>{item.branchName}: {wholeNumber(item.rows)} regs · {compactCurrency(item.sales)}</span>
            ))}
          </div>
        ) : null}
      </section>

      <div className="grid two">
        <section className="panel">
          <div className="panel-title">
            <h2>Ventas por sede</h2>
            <Building2 size={18} />
          </div>
          <div className="branch-chart-fill">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchChart} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 0 }} barCategoryGap="26%">
                <XAxis type="number" tickFormatter={compact} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]} hide />
                <YAxis yAxisId="labels" dataKey="chartName" type="category" width={98} interval={0} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="track" dataKey="chartName" type="category" hide />
                <Tooltip content={<DashboardBranchTooltip />} cursor={{ fill: "rgba(51, 230, 164, .08)" }} />
                <Bar yAxisId="track" dataKey="projected" name="Proyección" fill="#262a2f" radius={999} barSize={15} isAnimationActive={false} />
                <Bar yAxisId="labels" dataKey="executed" name="Ejecutado" radius={999} barSize={15}>
                  {branchChart.map((row: any, index: number) => (
                    <Cell key={index} fill={row.executedRate >= 1 ? "#33e6a4" : row.executedRate >= 0.9 ? "#f5b944" : "#ff6b5e"} />
                  ))}
                  <LabelList dataKey="executedRateLabel" position="right" fill="#f1f3f5" fontSize={11} fontWeight={700} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="branch-chart-legend">
            <span className="ok">≥100% de proyección</span>
            <span className="warn">90–99%</span>
            <span className="bad">&lt;90%</span>
          </div>
          <div className="branch-chart-footer">
            <div>
              <span>Ejecutado total</span>
              <strong>{compactCurrency(branchChartTotals.executed)}</strong>
            </div>
            <div>
              <span>Proyección a hoy</span>
              <strong>{compactCurrency(branchChartTotals.projected)}</strong>
            </div>
            <div className={branchChartTotals.rate >= 1 ? "ok" : branchChartTotals.rate >= 0.9 ? "warn" : "bad"}>
              <span>Cumplimiento</span>
              <strong>{ratePercent(branchChartTotals.rate)}</strong>
            </div>
            <div>
              <span>Sedes sobre proyección</span>
              <strong>{branchChartTotals.overCount} de {branchChart.length}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Top asesores</h2>
              <span>{advisorChart.length} asesores únicos con ventas{advisorSplitCount > 0 ? ` · ${advisorSplitCount} repetidos integrados` : ""}</span>
            </div>
            <div className="panel-title-actions">
              <button className="icon-button" title="Ampliar top asesores" onClick={() => setAdvisorsExpanded(true)}>
                <Maximize2 size={16} />
              </button>
              <Users size={18} />
            </div>
          </div>
          <div className="dashboard-advisor-list">
            {dashboardAdvisorChart.map((advisor: any, index: number) => {
              const maxSales = Number(dashboardAdvisorChart[0]?.sales || 1);
              return (
                <article key={advisor.name}>
                  <span>{index + 1}</span>
                  <div>
                    <strong title={advisorDisplayName(advisor.name)}>{advisorDisplayName(advisor.name)}</strong>
                    <small>{compactCurrency(advisor.sales)} · {advisor.scoreText}</small>
                    <i style={{ width: `${Math.max(8, safeRatio(advisor.sales, maxSales) * 100)}%` }} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {advisorsExpanded ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setAdvisorsExpanded(false)}>
          <section className="expanded-chart-dialog" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h2>Top asesores completo</h2>
                <p>{advisorChart.length} asesores únicos con ventas · {state.filters.selectedMonthName} {state.filters.selectedYear}</p>
              </div>
              <button className="icon-button" onClick={() => setAdvisorsExpanded(false)} title="Cerrar">X</button>
            </header>
            <div className="expanded-chart-body" style={{ height: advisorExpandedHeight }}>
              <AdvisorSalesChart
                data={advisorChart}
                yAxisWidth={compactExpandedChart ? 160 : 220}
                margin={compactExpandedChart ? { top: 6, left: 0, right: 58, bottom: 8 } : undefined}
              />
            </div>
          </section>
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-title">
          <h2>Calendario comercial</h2>
          <CalendarDays size={18} />
        </div>
        <CalendarHeatmap
          days={state.dailySales}
          year={Number(state.filters.selectedYear)}
          month={Number(state.filters.selectedMonth)}
          holidays={state.holidays}
          compact
        />
      </section>
    </div>
  );
}

function MonthProjection({ state, year, month }: { state: AppState; year: number; month: number }) {
  const insights = React.useMemo(() => buildProjectionInsights(state, year, month), [state, year, month]);
  const statusTone = insights.projectedDifference >= 0 ? "green" : "red";
  const branchChartRows = insights.branchProjection.map((branch: any) => ({
    name: branchShortName(branch.name),
    Meta: Math.round(branch.target),
    Proyeccion: Math.round(branch.projectedClose),
    Actual: Math.round(branch.sales),
    gap: branch.projectedGap
  }));
  return (
    <div className="view projection-view">
      <div className="kpi-grid projection-kpi-grid dashboard-kpi-grid">
        <Kpi label="Venta actual" value={currency(insights.currentSales)} sub={`${insights.elapsedDays} de ${insights.daysInMonth} días base`} />
        <Kpi label="Proyección recomendada" value={currency(insights.projectedClose)} sub={`${insights.projectionMethod} · ${insights.confidenceLabel}`} tone={statusTone} />
        <Kpi label="Rango probable" value={`${compactCurrency(insights.conservativeProjectedClose)} - ${compactCurrency(insights.optimisticProjectedClose)}`} sub="conservador a optimista" tone="blue" />
        <Kpi label="Diferencia proyectada" value={currency(insights.projectedDifference)} sub={insights.requiredDailyToBeatPrevious > 0 ? `${currency(insights.requiredDailyToBeatPrevious)} diario para superar` : "Ritmo suficiente"} tone={statusTone} />
        <Kpi label="Promedio actual" value={currency(insights.dailyAverage)} sub="por día base" />
        <Kpi label="Promedio mes anterior" value={currency(insights.previousDailyAverage)} sub={insights.previousMonthLabel} tone="amber" />
        <Kpi label="Faltante para superar" value={currency(Math.max(insights.previousMonthSales - insights.currentSales, 0))} sub={`${insights.remainingDays} días restantes`} tone="red" />
      </div>

      <div className="grid two projection-chart-calendar-row">
        <section className="panel projection-charts-panel">
          <div className="panel-title">
            <div>
              <h2>Acumulado diario vs mes anterior</h2>
              <span>{state.filters.selectedMonthName} contra {insights.previousMonthLabel}</span>
            </div>
            <LineChart size={18} />
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <ReLineChart data={insights.dailyComparison} margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" interval={1} />
              <YAxis tickFormatter={compact} width={58} />
              <Tooltip formatter={(value) => currency(Number(value))} />
              <Line type="monotone" dataKey="currentAccumulated" name={`${state.filters.selectedMonthName} real`} stroke="#33e6a4" strokeWidth={3} dot={false} />
              <Line type="linear" dataKey="projectedAccumulated" name={`${state.filters.selectedMonthName} proyectado`} stroke="#f5b944" strokeWidth={2} strokeDasharray="6 4" dot={false} />
              <Line type="monotone" dataKey="previousAccumulated" name={insights.previousMonthLabel} stroke="#6ea8e0" strokeWidth={2} dot={false} />
            </ReLineChart>
          </ResponsiveContainer>

          <div className="panel-subtitle">
            <div>
              <h3>Proyección por sede</h3>
              <span>Venta actual, cierre proyectado y Meta 1</span>
            </div>
            <Building2 size={16} />
          </div>
          <ResponsiveContainer width="100%" height={245}>
            <BarChart data={branchChartRows} margin={{ top: 20, right: 14, left: 0, bottom: 22 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" interval={0} tick={<SplitTick />} height={54} />
              <YAxis tickFormatter={compactCurrency} tick={{ fontSize: 11 }} width={58} />
              <Tooltip formatter={(value) => currency(Number(value || 0))} />
              <Legend />
              <Bar dataKey="Meta" name="Meta 1" fill="#3a414a" radius={[5, 5, 0, 0]}>
                <LabelList
                  dataKey="Meta"
                  content={(props: any) => {
                    const { x, y, width, index } = props;
                    const row = branchChartRows[index];
                    if (!row) return null;
                    return (
                      <text x={Number(x) + Number(width) / 2} y={Number(y) - 8} textAnchor="middle" fill="#f1f3f5" fontSize={11} fontWeight={700}>
                        {compactCurrency(row.Actual)}
                      </text>
                    );
                  }}
                />
              </Bar>
              <Bar dataKey="Proyeccion" name="Proyección" fill="#6ea8e0" radius={[5, 5, 0, 0]} />
              <Bar dataKey="Actual" name="Venta actual" fill="#33e6a4" radius={[5, 5, 0, 0]}>
                {branchChartRows.map((row: any) => (
                  <Cell key={row.name} fill={row.gap >= 0 ? "#33e6a4" : "#ff6b5e"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="panel projection-calendar-panel">
          <div className="panel-title">
            <div>
              <h2>Calendario vs mismo mes del año anterior</h2>
              <span>
                {state.filters.selectedMonthName} {year} contra {insights.previousYearLabel}
                {insights.previousYearSource ? ` · fuente ${insights.previousYearSource}` : ""}
              </span>
            </div>
            <CalendarDays size={18} />
          </div>
          <CalendarHeatmap days={insights.previousYearCalendarDays} year={year} month={month} compact fillHeight />
        </section>
      </div>
    </div>
  );
}

function buildProjectionInsights(state: AppState, year: number, month: number) {
  const projection = state.projection || {};
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyRows = cleanRows(state.dailySales);
  const positiveDailyRows = dailyRows.filter((row: any) => Number(row.sales || 0) > 0);
  const lastSaleDay = Math.max(...positiveDailyRows.map((row: any) => Number(row.day || 0)), 0);
  const elapsedDays = Number(projection.elapsedDays || 0) || Math.max(lastSaleDay || Math.min(new Date().getDate(), daysInMonth), 1);
  const remainingDays = Math.max(daysInMonth - elapsedDays, 0);
  const currentSales = Number(state.kpis?.totalSales || 0);
  const projectedClose = Number(projection.projectedClose || 0) || (currentSales > 0 ? (currentSales / elapsedDays) * daysInMonth : 0);
  const conservativeProjectedClose = Number(projection.conservativeProjectedClose || 0) || projectedClose * 0.9;
  const optimisticProjectedClose = Number(projection.optimisticProjectedClose || 0) || projectedClose * 1.1;
  const dailyAverage = currentSales / elapsedDays;
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonthLabel = `${monthOptions[previousMonth - 1]} ${previousYear}`;
  const previousMonthRow = cleanRows(state.monthlySales).find((row: any) => Number(row.year) === previousYear && Number(row.month) === previousMonth);
  const previousMonthSales = Number(previousMonthRow?.sales || 0);
  const previousDaysInMonth = new Date(previousYear, previousMonth, 0).getDate();
  const previousDailyAverage = previousMonthSales / Math.max(previousDaysInMonth, 1);
  const projectedDifference = projectedClose - previousMonthSales;
  const projectedVsPreviousRate = previousMonthSales > 0 ? projectedDifference / previousMonthSales : 0;
  const requiredDailyToBeatPrevious = remainingDays > 0 ? Math.max(previousMonthSales - currentSales, 0) / remainingDays : 0;
  const previousDailyRows = cleanRows(state.previousDailySales);
  const previousYearDailyRows = cleanRows(state.previousYearDailySales);
  const previousYearSalesByDay = new Map(previousYearDailyRows.map((row: any) => [Number(row.day), row]));
  const previousYearLabel = `${monthOptions[month - 1]} ${year - 1}`;
  const previousYearSource = previousYearDailyRows.find((row: any) => row.sourceFile)?.sourceFile || "";
  const previousYearHasData = previousYearDailyRows.some((row: any) => Number(row.sales || 0) > 0);
  let currentAccumulated = 0;
  let previousAccumulated = 0;
  const projectedDailyBaseline = projectedClose / Math.max(daysInMonth, 1);
  const dailyComparison = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const row = dailyRows.find((item: any) => Number(item.day) === day);
    const currentDaySales = Number(row?.sales || 0);
    currentAccumulated += currentDaySales;
    const previousRow = previousDailyRows.find((item: any) => Number(item.day) === day);
    previousAccumulated += Number(previousRow?.sales ?? row?.previousMonthSales ?? 0);
    return {
      day,
      label: String(day),
      currentAccumulated: day <= elapsedDays ? currentAccumulated : null,
      projectedAccumulated: projectedDailyBaseline * day,
      previousAccumulated
    };
  });
  const previousYearCalendarDays = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const row = dailyRows.find((item: any) => Number(item.day) === day);
    const previousYearRow = previousYearSalesByDay.get(day);
    return {
      day,
      label: String(day).padStart(2, "0"),
      sales: Number(row?.sales || 0),
      rows: Number(row?.rows || 0),
      previousMonthSales: Number(previousYearRow?.sales || 0),
      previousMonthRows: Number(previousYearRow?.rows || 0),
      previousMonth: month,
      previousMonthYear: year - 1
    };
  });
  const branchProjection = cleanRows(state.branches)
    .map((branch: any) => {
      const sales = Number(branch.sales || 0);
      const target = Number(branch.target?.meta1 || 0);
      const projectionFactor = currentSales > 0 ? projectedClose / currentSales : daysInMonth / elapsedDays;
      const projected = sales > 0 ? sales * projectionFactor : 0;
      const goals = branchTargetGoals(branch);
      const projectedStage = branchGoalStage({ target: branch.target, sales: projected });
      const projectedStageReached = projectedStage.amount > 0 && projected >= projectedStage.amount;
      const nextGoal = projectedStageReached ? goals.find((goal) => goal.amount > projected) : undefined;
      return {
        id: branch.id,
        name: branch.name,
        sales,
        target,
        projectedClose: projected,
        projectedProgress: target > 0 ? projected / target : 0,
        projectedGap: Math.max(target - projected, 0),
        projectedStageLabel: projectedStage.label,
        projectedStageReached,
        nextGoalLabel: nextGoal?.label,
        nextGoalMissing: nextGoal ? Math.max(nextGoal.amount - projected, 0) : 0
      };
    })
    .sort((a: any, b: any) => Number(b.projectedClose || 0) - Number(a.projectedClose || 0));
  return {
    daysInMonth,
    elapsedDays,
    remainingDays,
    currentSales,
    projectedClose,
    conservativeProjectedClose,
    optimisticProjectedClose,
    dailyAverage,
    confidenceLabel: projection.confidence?.label || "Media",
    confidenceScore: Number(projection.confidence?.score || 0),
    projectionMethod: projection.history?.method === "historico_ajustado" ? "histórico ajustado" : "ritmo lineal",
    previousMonthLabel,
    previousMonthSales,
    previousDailyAverage,
    projectedDifference,
    projectedVsPreviousRate,
    requiredDailyToBeatPrevious,
    dailyComparison,
    previousYearLabel,
    previousYearSource,
    previousYearHasData,
    previousYearCalendarDays,
    branchProjection
  };
}

function CalendarHeatmap({ days, year, month, holidays, compact: compactMode = false, fillHeight = false }: { days: any[]; year: number; month: number; holidays?: Record<string, string>; compact?: boolean; fillHeight?: boolean }) {
  const holidaysMap = holidays ?? {};
  const byDay = new Map(days.map((item) => [item.day, item]));
  const max = Math.max(...days.map((item) => item.sales), 1);
  const safeYear = Number.isFinite(year) && year > 0 ? year : new Date().getFullYear();
  const safeMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
  const daysInMonth = new Date(safeYear, safeMonth, 0).getDate();
  const firstWeekday = new Date(safeYear, safeMonth - 1, 1).getDay();
  const weekStartsOnMondayOffset = (firstWeekday + 6) % 7;
  const totalCells = Math.ceil((weekStartsOnMondayOffset + daysInMonth) / 7) * 7;
  const weekRows = totalCells / 7;
  const weekdayLabels = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === safeYear && today.getMonth() + 1 === safeMonth;
  return (
    <div
      className={`commercial-calendar${compactMode ? " compact" : ""}`}
      aria-label={`Calendario comercial ${safeMonth}/${safeYear}`}
      style={fillHeight ? { height: "100%", gridTemplateRows: `auto repeat(${weekRows}, minmax(0, 1fr))` } : undefined}
    >
      {weekdayLabels.map((label) => (
        <div key={label} className="calendar-weekday">
          {label}
        </div>
      ))}
      {Array.from({ length: totalCells }, (_, index) => {
        const day = index - weekStartsOnMondayOffset + 1;
        if (day < 1 || day > daysInMonth) {
          return <div key={`empty-${index}`} className="day empty" aria-hidden="true" />;
        }
        const item = byDay.get(day);
        const hasData = Boolean(item) && (Number(item.sales) > 0 || Number(item.rows) > 0);
        const dayBudget = hasData ? Number(item?.budgetSales || 0) : 0;
        const budgetRatio = dayBudget > 0 ? Number(item?.sales || 0) / dayBudget : null;
        const variation = hasData ? budgetVariation(item) ?? dayVariation(item.sales, item.previousMonthSales) : null;
        const alpha = hasData
          ? budgetRatio !== null
            ? 0.07 + Math.min(budgetRatio, 1.4) / 1.4 * 0.16
            : 0.08 + (item.sales / max) * 0.14
          : 0;
        const dayColor = variation?.tone === "down" ? "255, 107, 94" : "51, 230, 164";
        const currentDay = isCurrentMonth && today.getDate() === day;
        const dateKey = `${safeYear}-${String(safeMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const holiday = holidaysMap[dateKey];
        const title = hasData ? variationTitle(item, variation, holiday) : holiday ? `Festivo: ${holiday}` : undefined;
        return (
          <div
            key={day}
            className={`day${currentDay ? " today" : ""}${holiday ? " holiday" : ""}${variation ? ` variation-${variation.tone}` : ""}${hasData ? " has-data" : ""}`}
            style={hasData ? { backgroundColor: `rgba(${dayColor}, ${alpha})`, borderLeftColor: `rgb(${dayColor})` } : undefined}
            title={title}
          >
            <div className="day-heading">
              <strong>{day}</strong>
              {holiday ? (
                <span className="holiday-badge" title={`Festivo: ${holiday}`}>
                  <Star size={10} strokeWidth={2.5} fill="currentColor" />
                </span>
              ) : null}
            </div>
            {holiday ? <span className="holiday-name">{holiday}</span> : null}
            <span className="day-metrics">
              <span className="day-sales">{hasData ? compact(item.sales).replace(/\s/g, "") : "-"}</span>
              {variation ? <span className={`day-percent ${variation?.tone ?? "neutral"}`}>{variation.label.replace(/\s*\(.+\)$/, "")}</span> : null}
            </span>
            {variation ? (
              <span className={`day-variation ${variation?.tone ?? "neutral"}`}>
                {variation.amountLabel ? <small>{variation.amountLabel}</small> : null}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function budgetVariation(item: any) {
  const current = Number(item?.sales || 0);
  const budget = Number(item?.budgetSales || 0);
  if (budget <= 0) return null;
  const delta = current - budget;
  const deltaLabel = signedCompactCurrency(delta);
  const change = (current - budget) / budget;
  if (Math.abs(change) < 0.005) {
    return { label: "0%", amountLabel: deltaLabel, tone: "neutral", previousLabel: "vs estacionalidad" };
  }
  return {
    label: `${change > 0 ? "+" : ""}${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(change * 100)}%`,
    amountLabel: deltaLabel,
    tone: change > 0 ? "up" : "down",
    previousLabel: "vs estacionalidad"
  };
}

function dayVariation(currentSales: number, previousSales: number) {
  const current = Number(currentSales || 0);
  const previous = Number(previousSales || 0);
  if (previous <= 0) return current > 0 ? { label: "Sin base", tone: "neutral" } : null;
  const change = (current - previous) / previous;
  const delta = current - previous;
  const deltaLabel = signedCompactCurrency(delta);
  const previousLabel = compact(previous);
  if (Math.abs(change) < 0.005) return { label: "0%", amountLabel: deltaLabel, tone: "neutral", previousLabel };
  return {
    label: `${change > 0 ? "+" : ""}${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(change * 100)}%`,
    amountLabel: deltaLabel,
    tone: change > 0 ? "up" : "down",
    previousLabel: `vs ${previousLabel}`
  };
}

function variationTitle(item: any, variation: ReturnType<typeof budgetVariation> | ReturnType<typeof dayVariation>, holiday?: string) {
  const previousLabel = item.previousMonth && item.previousMonthYear ? `${monthOptions[item.previousMonth - 1]} ${item.previousMonthYear}` : "mes anterior";
  const changeLabel = variation?.label ?? "sin variacion calculable";
  const holidayLabel = holiday ? ` Festivo: ${holiday}.` : "";
  const budgetSales = Number(item.budgetSales || 0);
  if (budgetSales > 0) {
    const accumulatedBudgetDelta = Number(item.accumulatedBudgetDelta || 0);
    const accumulatedRate = Number(item.accumulatedBudgetDeltaRate || 0);
    const accumulatedLabel = `${accumulatedBudgetDelta >= 0 ? "+" : ""}${currency(accumulatedBudgetDelta)}`;
    const accumulatedRateLabel = `${accumulatedRate >= 0 ? "+" : ""}${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(accumulatedRate * 100)}%`;
    return `Dia ${item.day}: ${currency(item.sales)}.${holidayLabel} Presupuesto del dia (estacionalidad): ${currency(budgetSales)}. Variacion vs estacionalidad: ${changeLabel}. Acumulado: ${currency(item.actualAccumulated || 0)} vs estacionalidad acumulada ${currency(item.budgetAccumulated || 0)} (${accumulatedLabel}, ${accumulatedRateLabel}). Referencia ${previousLabel}: ${currency(item.previousMonthSales || 0)}.`;
  }
  return `Dia ${item.day}: ${currency(item.sales)}.${holidayLabel} Mismo dia de ${previousLabel}: ${currency(item.previousMonthSales || 0)}. Variacion: ${changeLabel}.`;
}

function IntelligentGrowth({ state }: { state: AppState }) {
  const growth = state.growth;
  if (!growth) return <Empty />;
  const retention = growth.retention;
  const memberEvolution = state.memberEvolution;
  const churnSummary = memberEvolution?.summary;
  const churnRows = memberEvolution?.byBranch ?? [];
  const trendRows = memberEvolution?.dailyTrend?.length ? memberEvolution.dailyTrend : memberEvolution?.monthlyTrend ?? [];
  const totalSimulatedImpact = growth.simulator.reduce((sum: number, item: any) => sum + Number(item.impact || 0), 0);
  const churnChartRows = churnRows
    .slice()
    .sort((a: any, b: any) => Number(b.grossChurn || 0) - Number(a.grossChurn || 0))
    .slice(0, 6)
    .map((item: any) => ({
      ...item,
      chartName: branchShortName(item.branchName),
      grossPct: Number(item.grossChurn || 0) * 100,
      directPct: Number(item.directChurn || 0) * 100
    }));
  const planChartRows = growth.planFamilies.slice(0, 7).map((item: any) => ({
    ...item,
    chartName: String(item.family || "").replace("Membresia ", "").replace("Plan ", "")
  }));
  const simulatorRows = growth.simulator
    .slice()
    .sort((a: any, b: any) => Number(b.impact || 0) - Number(a.impact || 0))
    .slice(0, 4);
  const topActions = growth.recommendations.slice(0, 3);
  const topOpportunity = growth.opportunities
    .slice()
    .sort((a: any, b: any) => Number(b.potential || 0) - Number(a.potential || 0))[0];
  const hasUsefulTrend = trendRows.length > 1;
  const activeStart = Number(churnSummary?.activeStart ?? retention.previousClients ?? 0);
  const activeEnd = Number(churnSummary?.activeEnd ?? retention.currentClients ?? 0);
  const netEvolution = Number(churnSummary?.netEvolution ?? activeEnd - activeStart);
  const activeRatio = activeStart > 0 ? activeEnd / activeStart : 0;
  const churnDirect = Number(churnSummary?.directChurn ?? retention.churnProxy ?? 0);
  const churnGross = Number(churnSummary?.grossChurn ?? retention.churnProxy ?? 0);

  return (
    <div className="view growth-view compact-growth-view">
      <div className="growth-kpi-strip">
        <Kpi label="Clientes activos" value={wholeNumber(churnSummary?.activeEnd ?? retention.currentClients)} sub={memberEvolution?.available ? "corte actual" : "clientes con compra"} tone="blue" />
        <Kpi label="Churn directo" value={ratePercent(churnSummary?.directChurn ?? retention.churnProxy)} sub={memberEvolution?.available ? `${wholeNumber(churnSummary?.totalExits || 0)} salidas directas` : "proxy recompra"} tone="red" />
        <Kpi label="Salida bruta" value={ratePercent(churnSummary?.grossChurn ?? retention.churnProxy)} sub={memberEvolution?.available ? "riesgo total" : "sin EVO miembros"} tone="amber" />
        <Kpi label="Recompra" value={percent(retention.retentionRate)} sub={`${wholeNumber(retention.retainedClients)} clientes`} tone="green" />
        <Kpi label="Potencial" value={compactCurrency(totalSimulatedImpact)} sub="simulación real" tone="green" />
      </div>

      <div className="growth-dashboard-grid">
        <section className="panel growth-panel">
          <div className="panel-title"><h2>Activos y churn</h2><LineChart size={18} /></div>
          {hasUsefulTrend ? (
            <ResponsiveContainer width="100%" height={190}>
              <ReLineChart data={trendRows} margin={{ top: 8, right: 12, bottom: 2, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tickFormatter={compact} width={50} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} width={38} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value, name) => name === "directChurn" || name === "grossChurn" ? ratePercent(Number(value)) : Number(value).toLocaleString("es-CO")} />
                <Line yAxisId="left" type="monotone" dataKey="activeEnd" name="Clientes activos" stroke="#33e6a4" strokeWidth={3} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="directChurn" name="Churn directo" stroke="#ff6b5e" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="grossChurn" name="Salida bruta" stroke="#f5b944" strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </ReLineChart>
            </ResponsiveContainer>
          ) : (
            <div className="growth-health-card">
              <div className="growth-health-main">
                <span>Clientes activos</span>
                <strong>{wholeNumber(activeEnd)}</strong>
                <small>{netEvolution >= 0 ? "+" : ""}{wholeNumber(netEvolution)} vs base inicio</small>
              </div>
              <div className="growth-health-bars">
                <div>
                  <span>Retención de activos</span>
                  <b>{percent(activeRatio)}</b>
                  <i><em style={{ width: `${Math.max(0, Math.min(activeRatio, 1)) * 100}%` }} /></i>
                </div>
                <div>
                  <span>Churn directo</span>
                  <b>{ratePercent(churnDirect)}</b>
                  <i><em className="red" style={{ width: `${Math.max(0, Math.min(churnDirect / 0.5, 1)) * 100}%` }} /></i>
                </div>
                <div>
                  <span>Salida bruta</span>
                  <b>{ratePercent(churnGross)}</b>
                  <i><em className="amber" style={{ width: `${Math.max(0, Math.min(churnGross / 0.7, 1)) * 100}%` }} /></i>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="panel growth-panel">
          <div className="panel-title"><h2>Riesgo por sede</h2><Building2 size={18} /></div>
          {churnChartRows.length ? (
            <div className="growth-risk-list">
              {churnChartRows.map((item: any) => {
                const grossWidth = Math.max(2, Math.min(Number(item.grossPct || 0) / 0.8, 100));
                const directWidth = Math.max(2, Math.min(Number(item.directPct || 0) / 0.8, 100));
                return (
                  <article key={item.branchId ?? item.branchName}>
                    <header>
                      <strong>{item.branchName}</strong>
                      <span>{Number(item.grossPct || 0).toFixed(1)}%</span>
                    </header>
                    <div className="risk-bars">
                      <i title="Salida bruta"><em style={{ width: `${grossWidth}%` }} /></i>
                      <i title="Churn directo"><em className="red" style={{ width: `${directWidth}%` }} /></i>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <Empty />}
        </section>

        <section className="panel growth-panel">
          <div className="panel-title"><h2>Mix de planes</h2><FileSpreadsheet size={18} /></div>
          {planChartRows.length ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={planChartRows} margin={{ top: 8, right: 8, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="chartName" interval={0} tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={compact} width={48} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value, name) => name === "revenue" ? currency(Number(value)) : Number(value).toLocaleString("es-CO")} />
                <Bar dataKey="revenue" name="Ventas" fill="#33e6a4" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </section>
      </div>

      <div className="growth-bottom-grid">
        <section className="panel growth-panel growth-list-panel">
          <div className="panel-title"><h2>Acciones</h2><Sparkles size={18} /></div>
          <div className="growth-action-list">
            {topActions.map((item: any, index: number) => (
              <article key={`${item.title}-${index}`}>
                <strong>{item.title}</strong>
                <span>{item.priority}</span>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel growth-panel growth-list-panel">
          <div className="panel-title"><h2>Oportunidad principal</h2><TrendingUp size={18} /></div>
          {topOpportunity ? (
            <div className="growth-opportunity-summary">
              <strong>{topOpportunity.title}</strong>
              <div className="metric-row"><span>Clientes base</span><b>{wholeNumber(topOpportunity.clients)}</b></div>
              <div className="metric-row"><span>Ticket actual</span><b>{currency(topOpportunity.currentTicket)}</b></div>
              <div className="metric-row"><span>Potencial</span><b>{currency(topOpportunity.potential)}</b></div>
              <p>{topOpportunity.action}</p>
            </div>
          ) : <Empty />}
        </section>

        <section className="panel growth-panel growth-list-panel">
          <div className="panel-title"><h2>Escenarios</h2><BarChart3 size={18} /></div>
          <div className="growth-scenario-list">
            {simulatorRows.map((item: any) => (
              <article key={item.id}>
                <span>{item.name}</span>
                <strong>{compactCurrency(item.impact)}</strong>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SalesTrends({ state, onReload, setNotice }: { state: AppState; onReload: () => Promise<void>; setNotice: (value: string) => void }) {
  const [syncingCheckins, setSyncingCheckins] = React.useState(false);
  const trends = state.trends;
  if (!trends) return <Empty />;
  const bestWeekday = trends.bestWeekday;
  const bestMonthPart = trends.bestMonthPart;
  const nextKeyDate = trends.nextKeyDate;
  const monthlyComparison = trends.monthlyComparison;
  const accessTrends = trends.accessTrends;
  const liftLabel = (value: number | null | undefined) =>
    value === null || value === undefined ? "sin historial" : `${value >= 0 ? "+" : ""}${Math.round(value * 100)}%`;
  const dateStatusLabel = (status: string) =>
    status === "en_curso" ? "En curso" : status === "proxima" ? "Próxima" : "Programada";

  const currentPeriodKey = trends.period ? `${trends.period.year}-${String(trends.period.month).padStart(2, "0")}` : "";
  const upcomingKeyDates = (trends.yearKeyDates ?? []).filter((item: any) => item.date.slice(0, 7) >= currentPeriodKey);
  const pastKeyDates = (trends.yearKeyDates ?? [])
    .filter((item: any) => item.date.slice(0, 7) < currentPeriodKey)
    .sort((a: any, b: any) => b.date.localeCompare(a.date));

  const promoSuggestions = (state.todos ?? []).filter((todo: any) => todo.area === "Promociones");
  async function togglePromoDone(todo: any) {
    await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: todo.status === "Hecho" ? "Pendiente" : "Hecho", dueDate: todo.due_date })
    });
    await onReload();
  }
  async function syncEvoCheckins() {
    const period = trends.period;
    if (!period) return;
    setSyncingCheckins(true);
    setNotice(`Consultando entradas EVO de ${String(period.month).padStart(2, "0")}/${period.year}...`);
    try {
      const res = await fetch("/api/evo/checkins/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: period.year, month: period.month })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudieron sincronizar entradas EVO");
      setNotice(`EVO actualizó entradas: ${json.summary.rowsInserted || 0} nuevas, ${json.summary.duplicatesSkipped || 0} repetidas.`);
      await onReload();
    } finally {
      setSyncingCheckins(false);
    }
  }

  const weekdayChartRows = (trends.weekdayStats ?? []).map((item: any) => ({ ...item, chartName: item.label.slice(0, 3) }));
  const monthPartChartRows = (trends.monthPartStats ?? []).map((item: any) => ({ ...item, chartName: item.part.split(" ")[0] }));
  const planMixChartRows = (trends.planMix ?? []).slice(0, 7).map((item: any) => ({ ...item, chartName: item.family }));
  const accessHourRows = (accessTrends?.byHour ?? []).map((item: any) => ({
    ...item,
    chartName: `${String(item.hour).padStart(2, "0")}:00`
  }));
  const valleyHourText = (accessTrends?.valleyHours ?? [])
    .map((item: any) => `${String(item.hour).padStart(2, "0")}:00`)
    .join(", ");

  return (
    <div className="view growth-view compact-growth-view">
      <div className="growth-kpi-strip kpi-strip-6">
        <Kpi
          label={`Ventas del mes vs ${monthlyComparison?.previousYear ?? ""}`}
          value={monthlyComparison ? compactCurrency(monthlyComparison.currentRevenue) : "-"}
          tone="blue"
          delta={monthlyComparison?.deltaRatio != null ? monthlyComparison.deltaRatio * 100 : null}
          deltaSuffix={monthlyComparison ? `vs ${compactCurrency(monthlyComparison.previousRevenue)}${monthlyComparison.isPartialMonth ? " · parcial" : ""}` : ""}
        />
        <Kpi label="Mejor día" value={bestWeekday?.label ?? "-"} sub={bestWeekday ? compactCurrency(bestWeekday.revenue) : "sin datos"} tone="green" />
        <Kpi label="Mejor tramo del mes" value={bestMonthPart?.part ?? "-"} sub={bestMonthPart ? compactCurrency(bestMonthPart.revenue) : "sin datos"} tone="blue" />
        <Kpi
          label="Próxima fecha clave"
          value={nextKeyDate?.name ?? "-"}
          sub={nextKeyDate ? `${dateLabel(nextKeyDate.date)}${nextKeyDate.status === "en_curso" ? " · en curso" : ""}` : "sin fecha"}
          tone={nextKeyDate?.status === "en_curso" ? "red" : "amber"}
        />
        <Kpi label="Días restantes" value={nextKeyDate?.daysAway != null ? String(nextKeyDate.daysAway) : "-"} sub="para la fecha clave" tone="amber" />
        <Kpi label="Lift histórico esperado" value={liftLabel(nextKeyDate?.historicalLift)} sub="vs. promedio diario del mes" tone="green" />
      </div>

      <div className="growth-dashboard-grid">
        <section className="panel growth-panel">
          <div className="panel-title"><h2>Hábito por día de semana</h2><LineChart size={18} /></div>
          {weekdayChartRows.length ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={weekdayChartRows} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="chartName" interval={0} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={compact} width={48} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => currency(Number(value))} />
                <Bar dataKey="revenue" name="Ventas" fill="#33e6a4" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </section>

        <section className="panel growth-panel">
          <div className="panel-title">
            <div>
              <h2>Hábito por tramo del mes</h2>
              <span className="chart-caption">Ejecutado vs. proyectado (estacional) · corte día {monthlyComparison?.cutoffDay ?? "-"}</span>
            </div>
            <CalendarDays size={18} />
          </div>
          {monthPartChartRows.length ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={monthPartChartRows} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="chartName" interval={0} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={compact} width={48} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: any, name: any) => [currency(Number(value)), name === "actual" ? "Ejecutado" : "Proyectado"]}
                />
                <Bar dataKey="actual" name="actual" stackId="tramo" fill="#5cc8ff" radius={[0, 0, 0, 0]} />
                <Bar dataKey="projected" name="projected" stackId="tramo" fill="rgba(92, 200, 255, 0.35)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </section>

        <section className="panel growth-panel">
          <div className="panel-title"><h2>Mix de planes del período</h2><FileSpreadsheet size={18} /></div>
          {planMixChartRows.length ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={planMixChartRows} margin={{ top: 8, right: 8, bottom: 26, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="chartName" interval={0} angle={-30} textAnchor="end" height={50} tick={{ fontSize: 9.5 }} />
                <YAxis tickFormatter={compact} width={48} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => currency(Number(value))} />
                <Bar dataKey="revenue" name="Ventas" fill="#f5b944" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </section>

        <section className="panel growth-panel">
          <div className="panel-title">
            <div>
              <h2>Horas valle por entradas</h2>
              <span className="chart-caption">{accessTrends?.available ? `${wholeNumber(accessTrends.totalEntries)} entradas EVO · valle ${valleyHourText || "-"}` : "Pendiente de entradas EVO"}</span>
            </div>
            <button className="icon-button" onClick={() => syncEvoCheckins().catch((error) => setNotice(error.message))} disabled={syncingCheckins} title="Actualizar entradas EVO">
              {syncingCheckins ? <RefreshCcw size={18} /> : <Clock size={18} />}
            </button>
          </div>
          {accessHourRows.length ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={accessHourRows} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="chartName" interval="preserveStartEnd" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={compact} width={48} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${wholeNumber(Number(value))} entradas`, "Entradas"]} />
                <Bar dataKey="entries" name="Entradas" fill="#5cc8ff" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </section>
      </div>

      <div className="growth-bottom-grid growth-bottom-grid-4">
        <section className="panel growth-panel growth-list-panel">
          <div className="panel-title"><h2>Fechas clave {trends.period ? `· ${trends.period.year}` : ""}</h2><CalendarDays size={18} /></div>
          <div className="growth-scenario-list trends-date-scroll">
            {upcomingKeyDates.length ? <p className="trends-date-group-label">Próximos eventos</p> : null}
            {upcomingKeyDates.map((item: any) => (
              <article key={`${item.name}-${item.date}`} className={`trends-date-item status-${item.status}`}>
                <span>
                  <i className={`trends-date-dot status-${item.status}`} aria-hidden="true" />
                  {item.name} · {dateLabel(item.date)}
                  {item.status !== "programada" ? <em className={`trends-date-badge status-${item.status}`}>{dateStatusLabel(item.status)}</em> : null}
                </span>
                <div className="trends-lift-group">
                  <div className="trends-lift" title={`Promedio histórico (${item.historicalSamples || 0} año${item.historicalSamples === 1 ? "" : "s"} anteriores)`}>
                    <small>Histórico</small>
                    <strong>{liftLabel(item.historicalLift)}</strong>
                  </div>
                  {item.currentLift !== null ? (
                    <div className="trends-lift real" title={`Resultado real ya registrado en ${trends.period?.year ?? ""}`}>
                      <small>Real {trends.period?.year}</small>
                      <strong>{liftLabel(item.currentLift)}</strong>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
            {pastKeyDates.length ? <p className="trends-date-group-label">Eventos pasados</p> : null}
            {pastKeyDates.map((item: any) => (
              <article key={`${item.name}-${item.date}`} className="trends-date-item status-programada past">
                <span>
                  <i className="trends-date-dot status-programada" aria-hidden="true" />
                  {item.name} · {dateLabel(item.date)}
                </span>
                <div className="trends-lift-group">
                  <div className="trends-lift" title={`Promedio histórico (${item.historicalSamples || 0} año${item.historicalSamples === 1 ? "" : "s"} anteriores)`}>
                    <small>Histórico</small>
                    <strong>{liftLabel(item.historicalLift)}</strong>
                  </div>
                  {item.currentLift !== null ? (
                    <div className="trends-lift real" title={`Resultado real ya registrado en ${trends.period?.year ?? ""}`}>
                      <small>Real {trends.period?.year}</small>
                      <strong>{liftLabel(item.currentLift)}</strong>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
            {!upcomingKeyDates.length && !pastKeyDates.length ? <Empty /> : null}
          </div>
        </section>

        <section className="panel growth-panel growth-list-panel">
          <div className="panel-title"><h2>Recomendaciones</h2><Sparkles size={18} /></div>
          <div className="growth-action-list">
            {(trends.recommendations ?? []).map((text: string, index: number) => (
              <article key={index}>
                <strong>Acción {index + 1}</strong>
                <p>{text}</p>
              </article>
            ))}
            {!(trends.recommendations ?? []).length ? <Empty /> : null}
          </div>
        </section>

        <section className="panel growth-panel growth-list-panel">
          <div className="panel-title"><h2>Acciones por sede</h2><Building2 size={18} /></div>
          <div className="growth-action-list">
            {(trends.branchActions ?? []).slice(0, 4).map((item: any) => (
              <article key={item.branch}>
                <strong>{item.branch}</strong>
                <span>{compactCurrency(item.revenue)}</span>
                <p>{item.action}</p>
              </article>
            ))}
            {!(trends.branchActions ?? []).length ? <Empty /> : null}
          </div>
        </section>

        <section className="panel growth-panel growth-list-panel">
          <div className="panel-title">
            <div>
              <h2>Promociones sugeridas</h2>
              <span className="chart-caption">Próximo mes · plan y fecha clave con mejor desempeño</span>
            </div>
            <Sparkles size={18} />
          </div>
          <div className="growth-action-list promo-suggestions-list">
            {promoSuggestions.map((todo: any) => (
              <article key={todo.id} className={`promo-suggestion-card${todo.status === "Hecho" ? " done" : ""}`}>
                <header>
                  <strong>{todo.title}</strong>
                  <button
                    className={`promo-done-btn${todo.status === "Hecho" ? " done" : ""}`}
                    onClick={() => togglePromoDone(todo)}
                  >
                    <CheckSquare size={13} />
                    <span>{todo.status === "Hecho" ? "Hecho" : "Marcar hecho"}</span>
                  </button>
                </header>
                <p>{todo.notes}</p>
                <footer>Fecha límite: {todo.due_date ? dateLabel(todo.due_date) : "sin definir"}</footer>
              </article>
            ))}
            {!promoSuggestions.length ? <Empty /> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function AdvisorSalesChart({
  data,
  yAxisWidth = 220,
  margin = { top: 6, left: 24, right: 78, bottom: 8 }
}: {
  data: any[];
  yAxisWidth?: number;
  margin?: { top: number; left: number; right: number; bottom: number };
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={margin}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={compact} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.16)]} />
        <YAxis dataKey="chartName" type="category" width={yAxisWidth} interval={0} tick={<AdvisorTick />} />
        <Tooltip formatter={(value) => currency(Number(value))} labelFormatter={(_, payload) => advisorDisplayName(payload?.[0]?.payload?.name || "")} />
        <Bar dataKey="sales" fill="#33e6a4" radius={[0, 6, 6, 0]} isAnimationActive={false}>
          <LabelList dataKey="scoreText" position="right" fill="#f1f3f5" fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Asesores retirados que aún facturaron en el mes: se muestran al final de la lista.
const FORMER_ADVISORS = ["diana", "esteban", "alejandro leon", "sofia arias"];

function isFormerAdvisor(name: any) {
  const normalized = String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  if (!normalized) return false;
  return FORMER_ADVISORS.some((former) =>
    former.includes(" ") ? normalized.includes(former) : normalized.split(/\s+/)[0] === former
  );
}

function Advisors({ state, year, month, onReload }: { state: AppState; year: number; month: number; onReload: () => Promise<void> }) {
  const [editing, setEditing] = React.useState<string | null>(null);
  const [quality, setQuality] = React.useState("");
  const [admin, setAdmin] = React.useState("");
  const [aiActions, setAiActions] = React.useState<any[]>([]);
  const [aiActionsGeneratedAt, setAiActionsGeneratedAt] = React.useState<string | null>(null);
  const [aiActionsLoading, setAiActionsLoading] = React.useState(false);
  const [aiActionsError, setAiActionsError] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    setAiActions([]);
    setAiActionsGeneratedAt(null);
    setAiActionsError("");
    fetch(`/api/ai/advisor-actions?year=${year}&month=${month}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.ok) {
          setAiActions(json.actions || []);
          setAiActionsGeneratedAt(json.generatedAt || null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  async function generateAdvisorAiActions() {
    setAiActionsLoading(true);
    setAiActionsError("");
    try {
      const res = await fetch("/api/ai/advisor-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo generar el análisis");
      setAiActions(json.actions || []);
      setAiActionsGeneratedAt(json.generatedAt || null);
    } catch (error: any) {
      setAiActionsError(error?.message || "No se pudo generar el análisis");
    } finally {
      setAiActionsLoading(false);
    }
  }
  const advisorsByBranch = React.useMemo(() => {
    return [...state.advisors].sort((left: any, right: any) => {
      const formerCompare = (Number(left.active ?? 1) === 1 ? 0 : 1) - (Number(right.active ?? 1) === 1 ? 0 : 1);
      if (formerCompare !== 0) return formerCompare;
      const branchCompare = String(left.branchName || "Sin sede").localeCompare(String(right.branchName || "Sin sede"), "es");
      if (branchCompare !== 0) return branchCompare;
      const salesCompare = Number(right.sales || 0) - Number(left.sales || 0);
      if (salesCompare !== 0) return salesCompare;
      return advisorDisplayName(left.name).localeCompare(advisorDisplayName(right.name), "es");
    });
  }, [state.advisors]);
  const dailySummary = React.useMemo(() => {
    const rows = state.advisors.filter((advisor: any) => Number(advisor.monthlyGoal || 0) > 0);
    const todayGoal = rows.reduce((sum: number, advisor: any) => sum + Number(advisor.dailyGoal || 0), 0);
    const expectedToDate = rows.reduce((sum: number, advisor: any) => sum + Number(advisor.expectedSalesToDate || 0), 0);
    const sales = rows.reduce((sum: number, advisor: any) => sum + Number(advisor.sales || 0), 0);
    const requiredDaily = rows.reduce((sum: number, advisor: any) => sum + Number(advisor.requiredDailyGoal || 0), 0);
    const cutoffDay = Math.max(...rows.map((advisor: any) => Number(advisor.paceCutoffDay || 0)), 0);
    const usesSeasonality = rows.some((advisor: any) => advisor.budgetSource === "historico_mismo_mes");
    return {
      todayGoal,
      expectedToDate,
      sales,
      requiredDaily,
      cutoffDay,
      delta: sales - expectedToDate,
      sourceLabel: usesSeasonality ? "Base estacional del mismo mes" : "Base lineal por falta de historico"
    };
  }, [state.advisors]);

  const activeAdvisorsWithPace = React.useMemo(() => {
    return state.advisors
      .filter((advisor: any) => Number(advisor.active ?? 1) === 1 && !isFormerAdvisor(advisor.name))
      .map((advisor: any) => ({ advisor, pace: advisorPace(advisor, state, year, month) }));
  }, [state.advisors, state, year, month]);

  const paceChartRows = React.useMemo(() => {
    return activeAdvisorsWithPace
      .filter((row: any) => row.pace.hasGoal)
      .map((row: any) => {
        const expected = Number(row.advisor.expectedSalesToDate || 0) || Number(row.advisor.dailyGoal || 0) * row.pace.elapsedDays;
        const delta = Number(row.advisor.sales || 0) - expected;
        return { chartName: advisorChartName(row.advisor.name), delta, isPositive: delta >= 0 };
      })
      .sort((a: any, b: any) => b.delta - a.delta);
  }, [activeAdvisorsWithPace]);

  const paceStats = React.useMemo(() => {
    const withGoal = activeAdvisorsWithPace.filter((row: any) => row.pace.hasGoal);
    const onPace = withGoal.filter((row: any) => row.pace.isPositive).length;
    const deltas = withGoal.map((row: any) => {
      const expected = Number(row.advisor.expectedSalesToDate || 0) || Number(row.advisor.dailyGoal || 0) * row.pace.elapsedDays;
      return Number(row.advisor.sales || 0) - expected;
    });
    const avgDelta = deltas.length ? deltas.reduce((sum: number, value: number) => sum + value, 0) / deltas.length : 0;
    const best = withGoal.length
      ? withGoal.reduce((top: any, row: any) => (row.pace.isPositive && (!top || (row.advisor.sales - row.advisor.expectedSalesToDate) > (top.advisor.sales - top.advisor.expectedSalesToDate)) ? row : top), null)
      : null;
    return {
      total: withGoal.length,
      onPace,
      onPaceRate: withGoal.length ? onPace / withGoal.length : 0,
      avgDelta,
      bestName: best ? advisorDisplayName(best.advisor.name) : null
    };
  }, [activeAdvisorsWithPace]);

  const scoreDistribution = React.useMemo(() => {
    const buckets: Record<"Alto" | "Medio" | "Bajo" | "Pendiente", number> = { Alto: 0, Medio: 0, Bajo: 0, Pendiente: 0 };
    for (const row of activeAdvisorsWithPace) {
      const status = row.advisor.score?.status;
      if (status === "Alto" || status === "Medio" || status === "Bajo") buckets[status as "Alto" | "Medio" | "Bajo"] += 1;
      else buckets.Pendiente += 1;
    }
    const total = activeAdvisorsWithPace.length;
    return { buckets, total };
  }, [activeAdvisorsWithPace]);

  const advisorActionPlans = React.useMemo(() => {
    return activeAdvisorsWithPace
      .map((row: any) => {
        const advisor = row.advisor;
        const pace = row.pace;
        const goal = nextAdvisorGoal(advisor);
        const scoreStatus = advisor.score?.status || "Sin dato";
        const lines: string[] = [];
        lines.push(
          pace.hasGoal
            ? `Ritmo: ${pace.isPositive ? "va sobre" : "va bajo"} la meta del día ${pace.elapsedDays} (${pace.detail}).`
            : "Ritmo: sin meta diaria configurada este mes."
        );
        if (goal.label !== "Sin meta" && goal.missing > 0) {
          lines.push(`Le faltan ${compactCurrency(goal.missing)} para alcanzar ${goal.label}.`);
        } else if (goal.label !== "Sin meta") {
          lines.push(`Ya alcanzó ${goal.label}. Buscar el siguiente escalón de comisión.`);
        }
        if (scoreStatus === "Bajo" || scoreStatus === "Medio") {
          lines.push(`Score ${scoreStatus.toLowerCase()} (${scoreValue(advisor.score)} pts): reforzar guion de cierre, seguimiento de leads y calidad de gestión.`);
        } else if (pace.hasGoal && pace.isPositive) {
          lines.push("Buen ritmo y score: pedirle que comparta su guion de cierre con el equipo.");
        }
        const urgency = !pace.hasGoal ? 1 : pace.isPositive ? 3 : scoreStatus === "Bajo" ? 0 : 2;
        return { id: advisor.metricId ?? advisor.id, advisorId: Number(advisor.id), name: advisorDisplayName(advisor.name), branch: advisor.branchName, lines: lines.slice(0, 3), urgency };
      })
      .sort((a: any, b: any) => a.urgency - b.urgency);
  }, [activeAdvisorsWithPace]);

  const aiActionsById = React.useMemo(() => {
    const map = new Map<number, any>();
    for (const item of aiActions) map.set(Number(item.asesorId), item);
    return map;
  }, [aiActions]);

  const priorityRank: Record<string, number> = { alta: 0, media: 1, baja: 2 };
  const mergedActionPlans = React.useMemo(() => {
    return advisorActionPlans
      .map((item: any) => {
        const ai = aiActionsById.get(item.advisorId);
        return {
          ...item,
          aiDetail: ai?.detalle ?? null,
          aiPriority: ai?.prioridad ?? null
        };
      })
      .sort((a: any, b: any) => {
        if (aiActionsById.size) {
          const rankA = priorityRank[String(a.aiPriority || "").toLowerCase()] ?? 3;
          const rankB = priorityRank[String(b.aiPriority || "").toLowerCase()] ?? 3;
          if (rankA !== rankB) return rankA - rankB;
        }
        return a.urgency - b.urgency;
      });
  }, [advisorActionPlans, aiActionsById]);

  async function saveEvaluation(advisorId: number) {
    await fetch(`/api/evaluations/${advisorId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, qualityRating: quality, adminRating: admin })
    });
    setEditing(null);
    await onReload();
  }

  return (
    <div className="view advisors-view">
      <div className="kpi-grid dashboard-kpi-grid projection-kpi-grid">
        <Kpi label="Score prom." value={Math.round(state.kpis.averageAdvisorScore || 0).toString()} />
        <Kpi label="Comisiones asesores" value={currency(state.kpis.totalAdvisorCommissions)} tone="amber" />
        <Kpi label="Asesores activos" value={String(state.kpis.activeAdvisors)} tone="blue" />
        <Kpi label="Meta de hoy" value={compactCurrency(dailySummary.todayGoal)} sub={dailySummary.sourceLabel} tone="blue" />
        <Kpi label="Debe llevar" value={compactCurrency(dailySummary.expectedToDate)} sub={`corte día ${dailySummary.cutoffDay || "-"}`} tone="amber" />
        <Kpi label="Ventas actuales" value={compactCurrency(dailySummary.sales)} sub="equipo completo" tone="green" />
        <Kpi label="Diario para bono" value={compactCurrency(dailySummary.requiredDaily)} sub="promedio requerido" tone="amber" />
        <Kpi
          label="Ritmo estacional"
          value={compactCurrency(dailySummary.delta)}
          sub={dailySummary.delta >= 0 ? "sobre proyección" : "bajo proyección"}
          tone={dailySummary.delta >= 0 ? "green" : "red"}
        />
      </div>
      <aside className="advisor-side">
        <div className="policy-note">
          <strong>{state.commissionPolicy?.label}</strong>
          <span>Las comisiones se liquidan sobre la venta total con el porcentaje de la meta alcanzada, sin multiplicadores de calidad o gestión.</span>
        </div>

        <section className="panel score-distribution-panel">
          <div className="panel-title"><h2>Distribución de scores</h2><Star size={18} /></div>
          <div className="score-distribution-bar">
            {(["Alto", "Medio", "Bajo", "Pendiente"] as const).map((key) =>
              scoreDistribution.buckets[key] > 0 ? (
                <span
                  key={key}
                  className={`score-seg score-${key.toLowerCase()}`}
                  style={{ width: `${(scoreDistribution.buckets[key] / Math.max(scoreDistribution.total, 1)) * 100}%` }}
                />
              ) : null
            )}
          </div>
          <div className="score-distribution-legend">
            <div><i className="score-dot score-alto" /><span>Alto</span><strong>{scoreDistribution.buckets.Alto}</strong></div>
            <div><i className="score-dot score-medio" /><span>Medio</span><strong>{scoreDistribution.buckets.Medio}</strong></div>
            <div><i className="score-dot score-bajo" /><span>Bajo</span><strong>{scoreDistribution.buckets.Bajo}</strong></div>
            <div><i className="score-dot score-pendiente" /><span>Pendiente</span><strong>{scoreDistribution.buckets.Pendiente}</strong></div>
          </div>
        </section>

        <section className="panel advisor-pace-panel">
          <div className="panel-title"><h2>Ritmo de venta de asesores</h2><TrendingUp size={18} /></div>
          <div className="advisor-pace-stats">
            <div><span>En ritmo</span><strong>{paceStats.total ? `${paceStats.onPace}/${paceStats.total}` : "-"}</strong></div>
            <div><span>Ritmo promedio</span><strong className={paceStats.avgDelta >= 0 ? "positive" : "negative"}>{signedCompactCurrency(paceStats.avgDelta)}</strong></div>
            <div><span>Mejor ritmo</span><strong>{paceStats.bestName ?? "-"}</strong></div>
          </div>
          {paceChartRows.length ? (
            <div className="advisor-pace-chart-scroll">
              <ResponsiveContainer width="100%" height={Math.max(170, paceChartRows.length * 32)}>
                <BarChart data={paceChartRows} layout="vertical" margin={{ top: 4, left: 8, right: 24, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="chartName" type="category" width={128} interval={0} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value) => currency(Number(value))}
                    contentStyle={{ background: "var(--panel-strong)", border: "1px solid var(--line)", borderRadius: 8 }}
                    labelStyle={{ color: "var(--ink)" }}
                    itemStyle={{ color: "var(--ink)" }}
                  />
                  <Bar dataKey="delta" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {paceChartRows.map((row: any, index: number) => (
                      <Cell key={index} fill={row.isPositive ? "#33e6a4" : "#ff6b5e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty />}
        </section>

        <section className="panel growth-panel growth-list-panel advisor-actions-panel">
          <div className="panel-title">
            <div>
              <h2>Acciones con asesores</h2>
              <span className="advisor-actions-subtitle">
                {aiActionsById.size
                  ? `Personalizado con IA · historial de ventas${aiActionsGeneratedAt ? ` · ${dateLabel(aiActionsGeneratedAt)}` : ""}`
                  : "Reglas automáticas · genera el análisis IA para personalizar por historial"}
              </span>
            </div>
            <button className="ai-generate" onClick={() => generateAdvisorAiActions()} disabled={aiActionsLoading}>
              <Sparkles size={16} />
              <span>{aiActionsLoading ? "Analizando..." : aiActionsById.size ? "Actualizar con IA" : "Generar con IA"}</span>
            </button>
          </div>
          {aiActionsError ? <div className="notice">{aiActionsError}</div> : null}
          <div className="growth-action-list advisor-actions-list">
            {mergedActionPlans.map((item: any) => (
              <article key={item.id}>
                <strong>{item.name}</strong>
                <span>{item.branch}</span>
                <p>{item.aiDetail ?? item.lines.join(" ")}</p>
              </article>
            ))}
            {!mergedActionPlans.length ? <Empty /> : null}
          </div>
        </section>
      </aside>
      <section className="advisor-list">
        {advisorsByBranch.map((advisor: any) => {
          const nextGoal = nextAdvisorGoal(advisor);
          const pace = advisorPace(advisor, state, year, month);
          const PaceIcon = pace.isPositive ? TrendingUp : TrendingDown;
          const targets = advisor.target
            ? [
                ["Meta 1", advisor.target.meta1],
                ["Meta 2", advisor.target.meta2],
                ["Meta 3", advisor.target.meta3],
                ["Meta 4", advisor.target.meta4]
              ]
            : [];
          const former = Number(advisor.active ?? 1) !== 1 || isFormerAdvisor(advisor.name);
          const paceClass = !former && pace.hasGoal ? (pace.isPositive ? " pace-up" : " pace-down") : "";
          return (
            <article className={`advisor-card${former ? " former" : ""}${paceClass}`} key={advisor.metricId ?? advisor.id}>
              <header>
                <div>
                  <strong>{advisorDisplayName(advisor.name)}</strong>
                  <span>{advisor.branchName}</span>
                </div>
                <div className="advisor-badges">
                  {former ? <span className="retired-badge">Retirado</span> : null}
                  <span className={scoreClass(advisor.score.status)}>{scoreValue(advisor.score)}</span>
                  <span className={`pace-badge ${pace.hasGoal ? (pace.isPositive ? "positive" : "negative") : "neutral"}`} title={pace.title}>
                    <PaceIcon size={14} />
                    <b>{pace.label}</b>
                    <em>{pace.detail}</em>
                  </span>
                  <small>{advisor.commission.level}</small>
                </div>
              </header>

              <div className="advisor-metrics">
                <div><span>Ventas mes</span><strong>{currency(advisor.sales)}</strong></div>
                <div><span>Meta hoy</span><strong>{currency(advisor.dailyGoal)}</strong></div>
                <div><span>Debe llevar</span><strong>{currency(advisor.expectedSalesToDate)}</strong></div>
                <div><span>Diario para bono</span><strong>{currency(advisor.requiredDailyGoal)}</strong></div>
                <div><span>{advisor.monthlyGoalLabel || "Meta vigente"}</span><strong>{currency(advisor.monthlyGoal)}</strong></div>
                <div><span>Comisión</span><strong>{currency(advisor.commission.finalCommission)}</strong></div>
              </div>

              <div className="goal-progress">
                <div className="goal-progress-head">
                  <span>Avance a {nextGoal.label}</span>
                  <strong>{percent(nextGoal.progress)}</strong>
                </div>
                <Progress value={safeRatio(advisor.sales, advisor.target?.meta4)} />
                <small>
                  Faltan {currency(nextGoal.missing)} para {nextGoal.label}. Meta actual: {advisor.commission.level}.
                </small>
              </div>

              <div className="goal-grid">
                {targets.map(([label, amount]) => {
                  const progressValue = safeRatio(advisor.sales, Number(amount));
                  const missing = Math.max(Number(amount) - advisor.sales, 0);
                  return (
                    <div className={missing === 0 ? "reached" : ""} key={label}>
                      <span>{label}</span>
                      <strong>{currency(Number(amount))}</strong>
                      <small>{percent(progressValue)} · falta {currency(missing)}</small>
                    </div>
                  );
                })}
              </div>

              <footer>
                <small>
                  {advisor.commission.usesEvaluation
                    ? "Esquema con calidad y gestión aplicado."
                    : "Evaluación editable para score; no multiplica la comisión."}
                </small>
                {editing === (advisor.metricId ?? String(advisor.id)) ? (
                  <div className="inline-form">
                    <select value={quality} onChange={(event) => setQuality(event.target.value)}>
                      <option value="">Calidad</option>
                      <option>Malo</option>
                      <option>Regular</option>
                      <option>Bueno</option>
                      <option>Excelente</option>
                    </select>
                    <select value={admin} onChange={(event) => setAdmin(event.target.value)}>
                      <option value="">Gestión</option>
                      <option>Malo</option>
                      <option>Regular</option>
                      <option>Bueno</option>
                      <option>Excelente</option>
                    </select>
                    <button onClick={() => saveEvaluation(advisor.id)}>OK</button>
                  </div>
                ) : (
                  <button
                    className="link-button"
                    onClick={() => {
                      setEditing(advisor.metricId ?? String(advisor.id));
                      setQuality(advisor.evaluation.qualityRating || "");
                      setAdmin(advisor.evaluation.adminRating || "");
                    }}
                  >
                    Editar evaluación
                  </button>
                )}
              </footer>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function Branches({
  state,
  year,
  month,
  onReload,
  setNotice
}: {
  state: AppState;
  year: number;
  month: number;
  onReload: () => Promise<void>;
  setNotice: (value: string) => void;
}) {
  const memberFileInput = React.useRef<HTMLInputElement | null>(null);
  const [uploadingMembers, setUploadingMembers] = React.useState(false);
  const [aiRecs, setAiRecs] = React.useState<any[]>([]);
  const [aiGeneratedAt, setAiGeneratedAt] = React.useState<string | null>(null);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiError, setAiError] = React.useState("");
  const [syncingActiveMembers, setSyncingActiveMembers] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    setAiRecs([]);
    setAiGeneratedAt(null);
    setAiError("");
    fetch(`/api/ai/branch-recommendations?year=${year}&month=${month}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.ok) {
          setAiRecs(json.recommendations || []);
          setAiGeneratedAt(json.generatedAt || null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [year, month]);
  async function generateAiRecommendations() {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/ai/branch-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo generar el análisis");
      setAiRecs(json.recommendations || []);
      setAiGeneratedAt(json.generatedAt || null);
    } catch (error: any) {
      setAiError(error?.message || "No se pudo generar el análisis");
    } finally {
      setAiLoading(false);
    }
  }
  const daysInSelectedMonth = new Date(year, month, 0).getDate();
  const latestCutoffDay = Number(state.memberEvolution?.latestCutoff?.day || 0);
  const defaultCutoffDay =
    latestCutoffDay > 0
      ? Math.min(latestCutoffDay + 1, daysInSelectedMonth)
      : Math.min(new Date().getDate(), daysInSelectedMonth);
  const [memberCutoffDay, setMemberCutoffDay] = React.useState(defaultCutoffDay);
  React.useEffect(() => {
    setMemberCutoffDay(defaultCutoffDay);
  }, [defaultCutoffDay, month, year]);
  async function uploadMemberEvolution(file: File) {
    validateExcelFile(file);
    const data = new FormData();
    data.append("file", file);
    data.append("year", String(year));
    data.append("month", String(month));
    data.append("day", String(memberCutoffDay));
    setUploadingMembers(true);
    setNotice(`Importando evolución de miembros del día ${memberCutoffDay}...`);
    const res = await fetch("/api/import/member-evolution-excel", { method: "POST", body: data });
    const json = await res.json();
    setUploadingMembers(false);
    if (!res.ok) throw new Error(json.error || "No se pudo importar evolución de miembros");
    const cutoff = json.summary.months?.[0]?.cutoffDate ? ` · corte ${dateLabel(json.summary.months[0].cutoffDate)}` : "";
    setNotice(importSummaryNotice("Evolución importada", json.summary, `Activos fin: ${wholeNumber(json.summary.totalValue || 0)}${cutoff}`));
    await onReload();
  }
  async function syncEvoActiveMembers() {
    setSyncingActiveMembers(true);
    setNotice(`Consultando clientes activos EVO por sede del día ${memberCutoffDay}...`);
    try {
      const res = await fetch("/api/evo/active-members/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, day: memberCutoffDay })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo sincronizar clientes activos EVO");
      setNotice(`EVO actualizó clientes activos: ${wholeNumber(json.summary.totalValue || 0)} en ${json.summary.rowsInserted || 0} sedes.`);
      await onReload();
    } finally {
      setSyncingActiveMembers(false);
    }
  }
  const cutoffLabel = state.memberEvolution?.latestCutoff?.cutoffDate
    ? `Último corte: ${dateLabel(state.memberEvolution.latestCutoff.cutoffDate)}`
    : state.memberEvolution?.available
      ? "Último corte mensual histórico"
      : "Sin corte cargado";
  const tracking = state.branchTracking;
  const trackingCompany = tracking?.company;
  const trackingRows = state.branches
    .filter((branch: any) => branch.tracking || Number(branch.sales || 0) > 0 || branch.target)
    .map((branch: any) => {
      const source = branch.tracking;
      const target = source
        ? { meta1: source.meta1, meta2: source.meta2, meta3: source.meta3, meta4: source.meta4 }
        : branch.target;
      const executed = Number(source?.executed ?? branch.sales ?? 0);
      const projected = Number(source?.projected ?? ((Number(target?.meta1 || 0) / daysInSelectedMonth) * (state.filters?.dataCoverage?.lastPositiveDay || 1)));
      const diff = Number(source?.diff ?? (executed - projected));
      const progress = Number(source?.progress ?? safeRatio(executed, target?.meta1));
      const expectedProgress = Number(source?.expectedProgress ?? safeRatio(state.filters?.dataCoverage?.lastPositiveDay || 0, daysInSelectedMonth));
      const diffPp = Number(source?.diffPp ?? (progress - expectedProgress));
      const status = source?.status ?? (diff >= 0 ? "Sobre proyección" : "Bajo proyección");
      return {
        ...branch,
        target,
        trackingSource: source,
        executed,
        projected,
        diff,
        progress,
        expectedProgress,
        diffPp,
        status,
        dailyMeta: Number(source?.dailyMeta ?? (Number(target?.meta1 || 0) / daysInSelectedMonth)),
        requiredDaily: Number(source?.requiredDaily ?? 0),
        missingMeta1: Number(source?.missingMeta1 ?? Math.max(Number(target?.meta1 || 0) - executed, 0)),
        missingMeta4: Number(source?.missingMeta4 ?? Math.max(Number(target?.meta4 || 0) - executed, 0)),
        transactionDiff: Number(source?.transactionDiff || 0)
      };
    })
    .sort((a: any, b: any) => Number(b.executed || 0) - Number(a.executed || 0));
  const chartRows = trackingRows.map((branch: any) => ({
    name: branchShortName(branch.name),
    Ejecutado: Math.round(branch.executed),
    Proyeccion: Math.round(branch.projected),
    diff: branch.diff,
    status: branch.status
  }));
  const totalTransactionDiff = trackingRows.reduce((sum: number, branch: any) => sum + Math.abs(Number(branch.transactionDiff || 0)), 0);
  return (
    <div className="view branches-view">
      <div className="branch-summary-strip">
        <article><span>Ejecutado</span><strong>{compactCurrency(trackingCompany?.executed ?? state.kpis.totalSales)}</strong></article>
        <article><span>Proyección día {tracking?.cutoffDay ?? state.filters?.dataCoverage?.lastPositiveDay}</span><strong>{compactCurrency(trackingCompany?.projected ?? 0)}</strong></article>
        <article className={(trackingCompany?.diff ?? 0) >= 0 ? "positive" : "negative"}><span>Ritmo</span><strong>{compactCurrency(trackingCompany?.diff ?? 0)}</strong></article>
        <article><span>% meta</span><strong>{ratePercent(trackingCompany?.progress ?? state.kpis.targetProgress)}</strong></article>
        <article><span>Esperado</span><strong>{ratePercent(trackingCompany?.expectedProgress ?? 0)}</strong></article>
        <article className={totalTransactionDiff === 0 ? "positive" : "negative"}><span>QA transaccional</span><strong>{totalTransactionDiff === 0 ? "OK" : compactCurrency(totalTransactionDiff)}</strong></article>
      </div>
      <section className="panel branch-projection-panel">
        <div className="panel-title">
          <div>
            <h2>Ejecutado vs proyección por sede</h2>
            <span>{tracking ? `Fuente: ${tracking.sourceFile} · corte ${dateLabel(tracking.cutoffDate)}` : "Cálculo con ventas transaccionales del periodo"}</span>
          </div>
          <BarChart3 size={18} />
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartRows} margin={{ top: 8, right: 14, left: 0, bottom: 22 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" interval="preserveStartEnd" tick={<SplitTick />} height={54} />
            <YAxis tickFormatter={compactCurrency} tick={{ fontSize: 11 }} width={58} />
            <Tooltip formatter={(value) => currency(Number(value || 0))} />
            <Legend />
            <Bar dataKey="Proyeccion" fill="#2a2e34" radius={[5, 5, 0, 0]} />
            <Bar dataKey="Ejecutado" fill="#33e6a4" radius={[5, 5, 0, 0]}>
              {chartRows.map((row: any) => (
                <Cell key={row.name} fill={row.diff >= 0 ? "#33e6a4" : "#ff6b5e"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>
      <section className="panel member-import-panel branch-member-compact">
        <div className="panel-title">
          <div>
            <h2>Evolución de miembros</h2>
            <span>{state.memberEvolution?.available ? `${state.memberEvolution.byBranch.length} sedes con datos para el periodo. ${cutoffLabel}.` : "Carga activos, renovaciones, cancelaciones y salidas por sede."}</span>
          </div>
          <Thermometer size={18} />
        </div>
        <input
          ref={memberFileInput}
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) uploadMemberEvolution(file).catch((error) => {
              setUploadingMembers(false);
              setNotice(error.message);
            });
            event.currentTarget.value = "";
          }}
        />
        <div className="member-import-row">
          <label className="member-cutoff-control">
            <span>Día corte</span>
            <input
              type="number"
              min={1}
              max={daysInSelectedMonth}
              value={memberCutoffDay}
              onChange={(event) => {
                const next = Math.max(1, Math.min(daysInSelectedMonth, Number(event.target.value || 1)));
                setMemberCutoffDay(next);
              }}
            />
          </label>
          <button onClick={() => memberFileInput.current?.click()} disabled={uploadingMembers}>
            <Upload size={17} />
            <span>{uploadingMembers ? "Importando..." : "Cargar evolución"}</span>
          </button>
          <button onClick={() => syncEvoActiveMembers().catch((error) => setNotice(error.message))} disabled={syncingActiveMembers}>
            <RefreshCw size={17} />
            <span>{syncingActiveMembers ? "Consultando..." : "Activos EVO"}</span>
          </button>
        </div>
      </section>
      <section className="branch-tracking-cards" aria-label="Seguimiento diario por sede">
        {trackingRows.map((branch: any) => {
          const diffPp = percentagePointDelta(branch.diffPp);
          const metaAmounts = [branch.target?.meta1, branch.target?.meta2, branch.target?.meta3, branch.target?.meta4].map((value: any) => Number(value || 0));
          const reachedMeta = metaAmounts.reduce((level: number, amount: number, index: number) => (amount > 0 && branch.executed >= amount ? index + 1 : level), 0);
          const nextMetaAmount = reachedMeta < 4 ? metaAmounts[reachedMeta] : 0;
          const prevDelta = branch.previousMonthDelta;
          const hasPrevBase = prevDelta !== null && prevDelta !== undefined && Number.isFinite(Number(prevDelta));
          return (
            <article className={`branch-track-card ${branch.diff >= 0 ? "positive" : "negative"}`} key={branch.id}>
              <header>
                <div>
                  <strong>{branch.name}</strong>
                  <div className="branch-track-badges">
                    <span className={`pace-badge ${branch.diff >= 0 ? "positive" : "negative"}`}>{branch.status}</span>
                    <span className={`meta-badge${reachedMeta > 0 ? " reached" : ""}`}>{reachedMeta > 0 ? `Meta ${reachedMeta}` : "Sin meta"}</span>
                  </div>
                </div>
                <b className="branch-track-sales">{compactCurrency(branch.executed)}</b>
              </header>
              <div className="branch-track-progress">
                <div>
                  <span>Avance {ratePercent(branch.progress)}</span>
                  <small>{ratePercent(branch.expectedProgress)} esperado a hoy</small>
                </div>
                <Progress value={branch.progress} />
              </div>
              <div className="branch-track-stats">
                <div className={`compare ${diffPp ? diffPp.direction : "flat"}`}>
                  <span>Vs. estacionalidad</span>
                  <strong>{diffPp ? diffPp.label : "0,00 pp"}</strong>
                  <small>
                    <span>Proy. {compactCurrency(branch.projected)}</span>
                    <span>Dif. {compactCurrency(branch.diff)}</span>
                  </small>
                </div>
                <div className={`compare ${hasPrevBase ? (Number(prevDelta) >= 0 ? "up" : "down") : "flat"}`}>
                  <span>Vs. mes anterior</span>
                  <strong>{hasPrevBase ? signedPercent(Number(prevDelta)) : "Sin base"}</strong>
                  <small>{compactCurrency(branch.previousMonthSales || 0)}{branch.previousMonthCutoffDay ? ` al día ${branch.previousMonthCutoffDay}` : ""}</small>
                </div>
                <div>
                  <span>Diario meta</span>
                  <strong>{compactCurrency(branch.dailyMeta)}</strong>
                </div>
                <div>
                  <span>Diario requerido</span>
                  <strong>{compactCurrency(branch.requiredDaily)}</strong>
                </div>
                <div>
                  <span>Falta Meta 1</span>
                  <strong>{compactCurrency(branch.missingMeta1)}</strong>
                </div>
                <div>
                  <span>Falta Meta 4</span>
                  <strong>{compactCurrency(branch.missingMeta4)}</strong>
                </div>
                <div className="wide">
                  <span>Próxima meta</span>
                  <strong>{nextMetaAmount > 0 ? `Faltan ${compactCurrency(Math.max(nextMetaAmount - branch.executed, 0))} para Meta ${reachedMeta + 1}` : reachedMeta === 4 ? "Meta máxima alcanzada" : "Sin metas cargadas"}</strong>
                </div>
              </div>
            </article>
          );
        })}
      </section>
      <section className="panel branch-ai-panel">
        <div className="panel-title">
          <div>
            <h2>Recomendaciones IA de rentabilidad</h2>
            <span>
              Groq analiza toda la plataforma con criterio de dirección comercial
              {aiGeneratedAt ? ` · último análisis: ${dateLabel(aiGeneratedAt)}` : " · aún sin análisis para este periodo"}
            </span>
          </div>
          <button className="ai-generate" onClick={() => generateAiRecommendations()} disabled={aiLoading}>
            <Sparkles size={16} />
            <span>{aiLoading ? "Analizando..." : aiRecs.length ? "Actualizar análisis" : "Generar análisis"}</span>
          </button>
        </div>
        {aiError ? <div className="notice">{aiError}</div> : null}
        {aiLoading ? <div className="loader" /> : null}
        {aiRecs.length ? (
          <div className="branch-ai-grid">
            {aiRecs.map((rec: any, index: number) => (
              <article key={`${rec.titulo}-${index}`} className={`branch-ai-card ${String(rec.prioridad || "media").toLowerCase()}`}>
                <header>
                  <span>{rec.prioridad || "Media"}</span>
                  <strong>{rec.titulo}</strong>
                </header>
                <p>{rec.detalle}</p>
                {rec.impacto ? <small className="ai-impact">{rec.impacto}</small> : null}
                {rec.sedes?.length ? (
                  <footer>
                    {rec.sedes.map((sede: string) => <em key={sede}>{sede}</em>)}
                  </footer>
                ) : null}
              </article>
            ))}
          </div>
        ) : !aiLoading ? (
          <div className="empty">Genera el análisis para obtener las 3 recomendaciones del mes con base en todos los números de la empresa.</div>
        ) : null}
      </section>
    </div>
  );
}

function scoreLabel(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Sin dato";
  return new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(value));
}

function trendLabel(delta: number) {
  if (Math.abs(Number(delta || 0)) < 0.1) return "0.0";
  return `${delta > 0 ? "+" : ""}${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(delta)}`;
}

function Experience() {
  const [data, setData] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<"resumen" | "sedes" | "oportunidades" | "plan">("resumen");

  const loadExperience = React.useCallback(async (refresh = false) => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/experience${refresh ? "?refresh=1" : ""}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "No se pudo cargar experiencia");
    setData(json);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadExperience().catch((currentError) => {
      setError(currentError.message);
      setLoading(false);
    });
  }, [loadExperience]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadExperience().catch((currentError) => setError(currentError.message));
      }
    }, 5 * 60_000);
    return () => window.clearInterval(timer);
  }, [loadExperience]);

  const branchRows = (data?.byBranch || []).filter((branch: any) => {
    if (!query.trim()) return true;
    return normalizeText(branch.branch).includes(normalizeText(query));
  });
  const sourceChart = (data?.sources || []).map((source: any) => ({
    ...source,
    averageScore: Number(source.averageScore || 0),
    shortName: source.label.replace("Encuesta ", "").replace("Comunicación", "Com.")
  }));
  const branchChart = branchRows
    .filter((branch: any) => branch.averageScore !== null)
    .slice(0, 8)
    .map((branch: any) => ({
      ...branch,
      chartName: branch.branch.length > 18 ? `${branch.branch.slice(0, 18)}...` : branch.branch,
      scoreLabel: scoreLabel(branch.averageScore)
    }));
  const advanced = data?.advanced || {};
  const categoryChart = (advanced.categoryComparison || []).filter((item: any) => item.branch !== "Sin sede");
  const opportunityChart = (advanced.personalizedOpportunity || []).slice(0, 8);
  const topicChart = (advanced.topicCounts || []).filter((item: any) => Number(item.mentions || 0) > 0);
  const playbookRows = (advanced.branchPlaybook || []).filter((branch: any) => {
    if (!query.trim()) return true;
    return normalizeText(branch.branch).includes(normalizeText(query));
  });
  const tabs = [
    { id: "resumen", label: "Resumen ejecutivo" },
    { id: "sedes", label: "Diagnóstico por sede" },
    { id: "oportunidades", label: "Oportunidades y temas" },
    { id: "plan", label: "Plan de acción" }
  ];

  if (loading && !data) {
    return <div className="view"><div className="loader" /></div>;
  }

  if (error && !data) {
    return (
      <div className="view">
        <section className="panel experience-empty">
          <AlertTriangle size={22} />
          <h2>No se pudo cargar Experiencia</h2>
          <p>{error}</p>
          <button onClick={() => loadExperience(true).catch((currentError) => setError(currentError.message))}>Reintentar</button>
        </section>
      </div>
    );
  }

  return (
    <div className="view experience-view">
      <section className={`experience-thermometer ${data?.tone || "pending"}`}>
        <div>
          <span className="eyebrow">Informe vivo de experiencia</span>
          <h2>{advanced.reportTitle || "Marketing y Comunicación por Sede"}</h2>
          <p>
            {data?.scoredResponses
              ? `${advanced.reportSubtitle || "Termómetro de experiencia actualizado"} · Promedio ${scoreLabel(data.averageScore)} sobre ${data.scoredResponses} respuestas calificables.`
              : "Las encuestas se leen, pero no se detectaron columnas calificables todavía."}
          </p>
        </div>
        <div className="thermometer-score">
          <Thermometer size={24} />
          <strong>{scoreLabel(data?.averageScore)}</strong>
          <span>última respuesta {dateTimeLabel(data?.latestDate)}</span>
        </div>
      </section>

      <div className="kpi-grid">
        <Kpi label="Respuestas totales" value={wholeNumber(data?.totalResponses || 0)} sub={`${wholeNumber(data?.recentResponses || 0)} últimos 30 días`} tone="green" />
        <Kpi label="Promedio experiencia" value={scoreLabel(data?.averageScore)} sub={data?.status || "Sin datos"} tone={data?.tone || "blue"} />
        <Kpi label="Falta seguimiento" value={ratePercent(advanced.commercialMetrics?.followUpGapRate || 0)} sub="percepción comercial" tone="amber" />
        <Kpi label="Oportunidad personalizado" value={wholeNumber(advanced.commercialMetrics?.personalizedCandidates || 0)} sub={advanced.commercialMetrics?.topOpportunityBranch ? `mayor bolsa: ${advanced.commercialMetrics.topOpportunityBranch}` : "clientes probables"} tone="blue" />
      </div>

      <div className="config-tabs experience-tabs" role="tablist" aria-label="Experiencia">
        {tabs.map((item) => (
          <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id as any)}>{item.label}</button>
        ))}
      </div>

      {data?.errors?.length ? (
        <section className="panel experience-errors">
          {data.errors.map((item: any) => (
            <article key={item.source}>
              <AlertTriangle size={18} />
              <div><strong>{item.source}</strong><span>{item.error}</span></div>
            </article>
          ))}
        </section>
      ) : null}

      {view === "resumen" ? (
        <>
          <section className="panel executive-panel">
            <div className="panel-title">
              <div>
                <h2>Resumen ejecutivo</h2>
                <span>{advanced.periodLabel || "Fuentes conectadas a Google Sheets"}</span>
              </div>
              <Sparkles size={18} />
            </div>
            <div className="executive-list">
              {(advanced.executiveSummary || []).map((item: string, index: number) => (
                <article key={index}>
                  <strong>{index + 1}</strong>
                  <p>{item}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="grid two experience-grid">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Indicadores comerciales clave</h2>
                  <span>Lectura directa de la encuesta de marketing.</span>
                </div>
                <BarChart3 size={18} />
              </div>
              <div className="experience-metric-grid">
                <article><span>Experiencia asesores buena/excelente</span><strong>{ratePercent(advanced.commercialMetrics?.commercialExperienceRate || 0)}</strong></article>
                <article><span>Comunicación asesores buena/excelente</span><strong>{ratePercent(advanced.commercialMetrics?.advisorCommunicationRate || 0)}</strong></article>
                <article><span>Se siente importante</span><strong>{ratePercent(advanced.commercialMetrics?.feelsImportantRate || 0)}</strong></article>
                <article><span>Quiere mejor acompañamiento</span><strong>{ratePercent(advanced.commercialMetrics?.wantsBetterAccompanimentRate || 0)}</strong></article>
                <article><span>Usa personalizado</span><strong>{ratePercent(advanced.commercialMetrics?.usesPersonalizedRate || 0)}</strong></article>
                <article><span>Probable contratar personalizado</span><strong>{ratePercent(advanced.commercialMetrics?.likelyPersonalizedRate || 0)}</strong></article>
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Fuentes conectadas</h2>
                  <span>Lectura desde Google Sheets, actualizada cada minuto.</span>
                </div>
                <RefreshCcw size={18} />
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={sourceChart} margin={{ top: 8, right: 18, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="shortName" />
                  <YAxis domain={[0, 5]} />
                  <Tooltip formatter={(value, name, props) => name === "averageScore" ? [`${scoreLabel(Number(value))}/5`, `${props.payload.rows} respuestas`] : value} />
                  <Bar dataKey="averageScore" name="averageScore" fill="#33e6a4" radius={[5, 5, 0, 0]}>
                    <LabelList dataKey="rows" position="top" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="source-links">
                {(data?.sources || []).map((source: any) => (
                  <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    <span>{source.label}</span>
                  </a>
                ))}
              </div>
            </section>
          </div>

          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Índice comparativo por sede</h2>
                <span>Escala 1 a 5 homologando respuestas cualitativas y numéricas.</span>
              </div>
              <Building2 size={18} />
            </div>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={categoryChart} margin={{ top: 8, right: 18, bottom: 42, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="branch" interval={0} tick={<SplitTick />} height={58} />
                <YAxis domain={[0, 5]} />
                <Tooltip formatter={(value) => scoreLabel(Number(value))} />
                <Bar dataKey="general" name="Índice general" fill="#33e6a4" radius={[5, 5, 0, 0]} />
                <Bar dataKey="commercial" name="Comercial" fill="#6ea8e0" radius={[5, 5, 0, 0]} />
                <Bar dataKey="installations" name="Instalaciones / aseo" fill="#f5b944" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </>
      ) : null}

      {view === "sedes" ? (
        <>
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Diagnóstico por sede</h2>
                <span>Lectura adaptada del informe, enriquecida con datos vivos.</span>
              </div>
              <Building2 size={18} />
            </div>
            <div className="catalog-toolbar experience-toolbar">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar sede" />
              <button onClick={() => loadExperience(true).catch((currentError) => setError(currentError.message))}>
                <RefreshCcw size={16} />
                <span>Actualizar</span>
              </button>
            </div>
            <div className="branch-diagnosis-grid">
              {playbookRows.map((branch: any) => (
                <article key={branch.branch} className={branch.general < 3.7 ? "alert" : ""}>
                  <header>
                    <div>
                      <strong>{branch.branch}</strong>
                      <span>{branch.responses} respuestas · índice {scoreLabel(branch.general)}</span>
                    </div>
                    <b>{branch.weakestArea}</b>
                  </header>
                  <p>{branch.diagnosis}</p>
                  <div className="branch-score-strip">
                    <span>Inst. {scoreLabel(branch.installations)}</span>
                    <span>Planta {scoreLabel(branch.plantTrainers)}</span>
                    <span>Pers. {scoreLabel(branch.personalized)}</span>
                    <span>Com. {scoreLabel(branch.commercial)}</span>
                  </div>
                  <footer>
                    <strong>Acción</strong>
                    <span>{branch.action}</span>
                  </footer>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Mensajes por sede</h2>
                <span>Diferencial, objeción y servicio a comunicar para guion comercial.</span>
              </div>
              <Megaphone size={18} />
            </div>
            <div className="table-wrap small">
              <table>
                <thead><tr><th>Sede</th><th>Mensaje sugerido</th><th>Servicio a comunicar</th><th>Objeción / duda</th></tr></thead>
                <tbody>
                  {playbookRows.map((branch: any) => (
                    <tr key={branch.branch}>
                      <td>{branch.branch}</td>
                      <td>{branch.message}</td>
                      <td>{branch.serviceToCommunicate || branch.highlightedServices || "Personalizado / valoración"}</td>
                      <td>{branch.objection || branch.risk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {view === "oportunidades" ? (
        <>
          <div className="grid two experience-grid">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Oportunidad de personalizado</h2>
                  <span>Clientes que no lo usan y son probables/muy probables.</span>
                </div>
                <TrendingUp size={18} />
              </div>
              <ResponsiveContainer width="100%" height={330}>
                <BarChart data={opportunityChart} layout="vertical" margin={{ top: 4, right: 34, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="branch" type="category" width={132} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value, name, props) => [`${value} clientes`, `${props.payload.responses} respuestas`]} />
                  <Bar dataKey="candidates" fill="#33e6a4" radius={[0, 6, 6, 0]}>
                    <LabelList dataKey="candidates" position="right" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Temas en comentarios abiertos</h2>
                  <span>Menciones detectadas en respuestas abiertas.</span>
                </div>
                <MessageCircle size={18} />
              </div>
              <ResponsiveContainer width="100%" height={330}>
                <BarChart data={topicChart} layout="vertical" margin={{ top: 4, right: 34, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="theme" type="category" width={156} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${value} menciones`, "Tema"]} />
                  <Bar dataKey="mentions" fill="#f5b944" radius={[0, 6, 6, 0]}>
                    <LabelList dataKey="mentions" position="right" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>

          <div className="grid two experience-grid">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Alertas de experiencia</h2>
                  <span>Prioridad por calificación baja, tendencia o falta de respuestas recientes.</span>
                </div>
                <AlertTriangle size={18} />
              </div>
              <div className="experience-alert-list">
                {data?.alerts?.length ? data.alerts.map((alert: any, index: number) => (
                  <article key={`${alert.title}-${index}`} className={alert.tone}>
                    <strong>{alert.title}</strong>
                    <span>{alert.detail}</span>
                  </article>
                )) : (
                  <article className="green">
                    <strong>Sin alertas críticas</strong>
                    <span>Las respuestas actuales no muestran caídas fuertes ni sedes por debajo del umbral.</span>
                  </article>
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Comentarios para revisar</h2>
                  <span>Comentarios recientes o de menor calificación detectados en las encuestas.</span>
                </div>
                <MessageCircle size={18} />
              </div>
              <div className="experience-comments">
                {data?.comments?.length ? data.comments.map((item: any, index: number) => (
                  <article key={`${item.comment}-${index}`}>
                    <p>{item.comment}</p>
                    <footer>
                      <span>{item.branch}</span>
                      <span>{item.sourceLabel}</span>
                      <strong>{scoreLabel(item.score)}</strong>
                    </footer>
                  </article>
                )) : <Empty />}
              </div>
            </section>
          </div>
        </>
      ) : null}

      {view === "plan" ? (
        <>
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Plan de acción recomendado</h2>
                <span>Secuencia de implementación 15, 45 y 90 días.</span>
              </div>
              <ClipboardList size={18} />
            </div>
            <div className="action-plan-grid">
              {(advanced.actionPlan || []).map((phase: any) => (
                <article key={phase.phase}>
                  <strong>{phase.phase}</strong>
                  <ul>
                    {phase.actions.map((action: string) => <li key={action}>{action}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <div className="grid two experience-grid">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Guion comercial recomendado</h2>
                  <span>Venta consultiva y cierre con siguiente paso concreto.</span>
                </div>
                <ClipboardList size={18} />
              </div>
              <div className="script-list">
                {(advanced.salesScript || []).map((item: string, index: number) => (
                  <article key={item}><strong>{index + 1}</strong><span>{item}</span></article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Indicadores de éxito</h2>
                  <span>Metas iniciales para seguimiento directivo.</span>
                </div>
                <CheckSquare size={18} />
              </div>
              <div className="table-wrap small">
                <table>
                  <thead><tr><th>Indicador</th><th>Meta inicial</th></tr></thead>
                  <tbody>
                    {(advanced.successIndicators || []).map((item: any) => (
                      <tr key={item.indicator}><td>{item.indicator}</td><td>{item.target}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Riesgos si no se actúa</h2>
                <span>Riesgos comerciales y de experiencia identificados en el informe.</span>
              </div>
              <AlertTriangle size={18} />
            </div>
            <div className="risk-grid">
              {(advanced.risks || []).map((risk: string) => <article key={risk}>{risk}</article>)}
            </div>
          </section>
        </>
      ) : null}

      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Detalle por sede</h2>
            <span>Base operativa para seguimiento semanal de experiencia.</span>
          </div>
          <FileSpreadsheet size={18} />
        </div>
        <div className="table-wrap small">
          <table>
            <thead>
              <tr>
                <th>Sede</th>
                <th>Estado</th>
                <th>Promedio</th>
                <th>Respuestas</th>
                <th>Última respuesta</th>
              </tr>
            </thead>
            <tbody>
              {branchRows.map((branch: any) => (
                <tr key={branch.branch}>
                  <td>{branch.branch}</td>
                  <td><span className={`status ${branch.tone === "green" ? "high" : branch.tone === "amber" ? "medium" : branch.tone === "red" ? "low" : "pending"}`}>{branch.status}</span></td>
                  <td>{scoreLabel(branch.averageScore)}</td>
                  <td>{branch.responses}</td>
                  <td>{dateTimeLabel(branch.lastDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Marketing({ state, onReload, setNotice }: { state: AppState; onReload: () => Promise<void>; setNotice: (value: string) => void }) {
  const [query, setQuery] = React.useState("");
  const [syncing, setSyncing] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [planView, setPlanView] = React.useState<"plan" | "branch" | "family">("plan");
  const [oppView, setOppView] = React.useState<"opportunity" | "catalog" | "branch">("opportunity");
  const activePlans = state.plans.filter((plan: any) => Number(plan.active ?? 1) === 1);
  const filteredPlans = activePlans.filter((plan: any) => {
    const haystack = normalizeText(`${plan.name} ${plan.category} ${plan.membership_type || ""} ${plan.duration_type || ""}`);
    return !query.trim() || haystack.includes(normalizeText(query));
  });
  const plansWithSales = activePlans.filter((plan: any) => Number(plan.sales || 0) > 0);
  const plansWithoutPrice = activePlans.filter((plan: any) => !Number(plan.cash_price || 0));
  const evoPlans = activePlans.filter((plan: any) => String(plan.source || "").includes("EVO"));
  const totalPlanSales = activePlans.reduce((sum: number, plan: any) => sum + Number(plan.sales || 0), 0);
  const analytics = buildMarketingAnalytics(state, activePlans);
  const branchRevenuePlans = buildBranchRevenuePlans(state, activePlans);

  async function addCampaign() {
    if (!title.trim()) return;
    await fetch("/api/initiatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: "Marketing", type: "Plan por sede", title, status: "Pendiente" })
    });
    setTitle("");
    await onReload();
  }

  async function syncEvoPlans() {
    setSyncing(true);
    setNotice("Consultando planes activos en EVO...");
    const res = await fetch("/api/evo/plans/sync", { method: "POST" });
    const json = await res.json();
    setSyncing(false);
    if (!res.ok) throw new Error(json.error || "No se pudo consultar planes EVO");
    setNotice(`EVO actualizo ${json.summary.rowsUpserted} planes y completo ${json.summary.pricesCompleted || 0} precios.`);
    await onReload();
  }

  return (
    <div className="view marketing-view">
      <div className="kpi-grid marketing-kpi-grid">
        <Kpi label="Planes activos" value={String(activePlans.length)} sub={`${evoPlans.length} desde EVO`} />
        <Kpi label="Con ventas mes" value={String(plansWithSales.length)} sub={currency(totalPlanSales)} tone="blue" />
        <Kpi label="Adopción promedio" value={ratePercent(analytics.averageAdoption)} sub="planes con venta por sede" tone="green" />
        <Kpi label="Ingreso mensualizado" value={compactCurrency(analytics.totalMonthlyized)} sub="estimado por precio/mes" tone="amber" />
      </div>

      <div className="grid two marketing-top-row">
        <section className="panel marketing-compact-chart">
          <div className="panel-title">
            <div>
              <h2>Tendencias de uso comercial</h2>
              <span>Ventas, registros y ticket promedio por día.</span>
            </div>
            <LineChart size={16} />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={analytics.dailyUsage} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" interval={0} tick={{ fontSize: 7.5 }} />
              <YAxis yAxisId="left" tickFormatter={compact} width={44} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={compact} width={38} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value, name) => name === "sales" ? currency(Number(value)) : Number(value).toLocaleString("es-CO")} />
              <Bar yAxisId="left" dataKey="sales" name="Facturación" fill="#6ea8e0" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="rows" name="Registros" fill="#33e6a4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="panel marketing-compact-chart">
          <div className="panel-title">
            <div>
              <h2>Medios de pago por mes</h2>
              <span>Comparativo mensual de los medios más usados.</span>
            </div>
            <FileSpreadsheet size={16} />
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={analytics.paymentHistory.rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={compact} width={46} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value, name) => [currency(Number(value)), analytics.paymentHistory.labels.get(String(name)) || name]} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 16, lineHeight: "18px" }} formatter={(value) => analytics.paymentHistory.labels.get(String(value)) || value} />
              {analytics.paymentHistory.methods.map((method: any) => (
                <Bar key={method.key} dataKey={method.key} stackId="payments" name={method.key} fill={method.color} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      <div className="grid two marketing-merged-row">
        <section className="panel marketing-merged-card">
          <div className="panel-title">
            <div>
              <h2>Rentabilidad y adopción por plan</h2>
              <span>Ingreso mensualizado con adopción entre sedes en un solo gráfico.</span>
            </div>
            <TrendingUp size={18} />
          </div>
          <div className="panel-tabs">
            <button className={planView === "plan" ? "active" : ""} onClick={() => setPlanView("plan")}>Por plan</button>
            <button className={planView === "branch" ? "active" : ""} onClick={() => setPlanView("branch")}>Por sede y plan</button>
            <button className={planView === "family" ? "active" : ""} onClick={() => setPlanView("family")}>Mix familia</button>
          </div>
          {planView === "plan" ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.planPerformance} layout="vertical" margin={{ top: 4, right: 46, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 10 }} domain={[0, "dataMax"]} />
                <YAxis type="category" dataKey="axisLabel" width={230} tick={<OneLineTick />} interval={0} />
                <Tooltip formatter={(value, name, props) => name === "monthlyizedRevenue" ? [currency(Number(value)), `Adopción ${props.payload.adoptionLabel}`] : value} />
                <Bar dataKey="monthlyizedRevenue" name="monthlyizedRevenue" radius={[0, 6, 6, 0]}>
                  <LabelList dataKey="valueLabel" position="right" fontSize={11} fill="#f1f3f5" />
                  {analytics.planPerformance.map((row: any) => (
                    <Cell key={row.id} fill={row.tone} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : null}
          {planView === "branch" ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.branchPlanProfitability.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 46, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 10 }} domain={[0, "dataMax"]} />
                <YAxis type="category" dataKey="chartLabel" width={156} tick={<VerticalSplitTick />} interval={0} />
                <Tooltip formatter={(value, name, props) => name === "monthlyizedRevenue" ? [currency(Number(value)), `${props.payload.rows} ventas · ${currency(props.payload.sales)} facturado`] : value} />
                <Bar dataKey="monthlyizedRevenue" name="monthlyizedRevenue" fill="#6ea8e0" radius={[0, 6, 6, 0]}>
                  <LabelList dataKey="valueLabel" position="right" fontSize={11} fill="#f1f3f5" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : null}
          {planView === "family" ? (
            <>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={analytics.familyMix} margin={{ top: 8, right: 14, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="shortName" interval="preserveStartEnd" tick={<SplitTick />} height={36} />
                  <YAxis tickFormatter={compact} width={46} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value, name, props) => name === "sales" ? [currency(Number(value)), `${props.payload.rows} ventas`] : value} />
                  <Bar dataKey="sales" fill="#33e6a4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="family-mix-summary compact">
                {analytics.familyMix.slice(0, 4).map((item: any) => (
                  <article key={item.name}>
                    <strong>{item.name}</strong>
                    <span>{currency(item.sales)}</span>
                    <small>{item.rows} ventas · {ratePercent(item.share)}</small>
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </section>

        <section className="panel marketing-merged-card">
          <div className="panel-title">
            <div>
              <h2>Oportunidades comerciales</h2>
              <span>Planes a impulsar, catálogo y sugerencias por sede.</span>
            </div>
            <Megaphone size={18} />
          </div>
          <div className="panel-tabs">
            <button className={oppView === "opportunity" ? "active" : ""} onClick={() => setOppView("opportunity")}>Oportunidad</button>
            <button className={oppView === "catalog" ? "active" : ""} onClick={() => setOppView("catalog")}>Catálogo</button>
            <button className={oppView === "branch" ? "active" : ""} onClick={() => setOppView("branch")}>Por sede</button>
          </div>
          <div className="marketing-tab-scroll">
            {oppView === "opportunity" ? (
              <div className="opp-compact-list">
                {analytics.opportunityPlans.length ? analytics.opportunityPlans.map((plan: any) => (
                  <article key={plan.id} className="opp-compact-row" title={`${plan.branchCount} de ${analytics.activeBranches} sedes con venta`}>
                    <div className="opp-compact-main">
                      <strong>{plan.name}</strong>
                      <span>Adopción {plan.adoptionLabel} · Ticket ref. {currency(plan.referencePrice)} · {plan.branchCount}/{analytics.activeBranches} sedes</span>
                    </div>
                    <b>{currency(plan.sales)}</b>
                  </article>
                )) : <Empty />}
              </div>
            ) : null}
            {oppView === "catalog" ? (
              <>
                <div className="catalog-toolbar compact">
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar plan, categoria o duracion" />
                  <button onClick={() => syncEvoPlans().catch((error) => setNotice(error.message))} disabled={syncing || state.settings.evo_api_key_configured !== "true"}>
                    <RefreshCcw size={14} />
                    <span>{syncing ? "Consultando" : "Consultar EVO"}</span>
                  </button>
                </div>
                <div className="opp-compact-list">
                  {filteredPlans.slice(0, 16).map((plan: any) => {
                    const price = plan.cash_price ? compactCurrency(plan.cash_price) : plan.avg_ticket ? compactCurrency(plan.avg_ticket) : "-";
                    return (
                      <article key={plan.id} className="opp-compact-row">
                        <div className="opp-compact-main">
                          <strong>{plan.name}</strong>
                          <span>{plan.category || "Plan"} · Precio {price} · {plan.rows || 0} ventas · {plan.branch_count || 0} sedes</span>
                        </div>
                        <b>{compactCurrency(plan.sales)}</b>
                      </article>
                    );
                  })}
                </div>
              </>
            ) : null}
            {oppView === "branch" ? (
              <>
                <div className="add-row compact">
                  <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nuevo plan comercial por sede" />
                  <button onClick={addCampaign}>Crear</button>
                </div>
                <div className="opp-compact-list">
                  {branchRevenuePlans.length ? branchRevenuePlans.slice(0, 8).map((item: any) => (
                    <article key={`${item.branchId}-${item.planId}`} className="opp-compact-row" title={item.reason}>
                      <div className="opp-compact-main">
                        <strong>{item.branchName} · {item.title}</strong>
                        <span>Plan {item.planName} · Objetivo {item.units} ventas · Avance {percent(item.progress)}</span>
                      </div>
                      <b>{currency(item.impact)}</b>
                    </article>
                  )) : <Empty />}
                </div>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function buildBranchRevenuePlans(state: AppState, activePlans: any[]) {
  const candidates = activePlans
    .filter((plan: any) => Number(plan.sales || 0) > 0 && (Number(plan.cash_price || 0) > 0 || Number(plan.avg_ticket || 0) > 0))
    .slice()
    .sort((a: any, b: any) => Number(b.sales || 0) - Number(a.sales || 0));
  if (!candidates.length) return [];

  return state.branches
    .filter((branch: any) => Number(branch.sales || 0) > 0 || branch.target)
    .map((branch: any) => {
      const mix = Array.isArray(branch.planMix) ? branch.planMix : [];
      const currentPlanIds = new Set(mix.slice(0, 5).map((plan: any) => Number(plan.planId)));
      const plan =
        candidates.find((candidate: any) => !currentPlanIds.has(Number(candidate.id))) ||
        candidates.find((candidate: any) => Number(candidate.rows || 0) >= 3) ||
        candidates[0];
      const branchPlan = mix.find((item: any) => Number(item.planId) === Number(plan.id));
      const price = Number(plan.cash_price || plan.avg_ticket || state.kpis.avgTicket || 0);
      const target = Number(branch.target?.meta1 || 0);
      const gap = Math.max(target - Number(branch.sales || 0), 0);
      const baseImpact = gap > 0 ? Math.min(Math.max(gap * 0.08, price * 3), price * 25, gap) : price * 5;
      const units = Math.max(1, Math.ceil(baseImpact / Math.max(price, 1)));
      const impact = units * price;
      const progress = Number(branch.score?.progressMeta1 || 0);
      const ownerAdvisor = state.advisors
        .filter((advisor: any) => Number(advisor.branchId) === Number(branch.id))
        .slice()
        .sort((a: any, b: any) => Number(b.sales || 0) - Number(a.sales || 0))[0];
      const currentRows = Number(branchPlan?.rows || 0);
      const currentSales = Number(branchPlan?.sales || 0);
      const reason = currentRows > 0
        ? `${plan.name} ya vendio ${currency(currentSales)} en ${branch.name}, pero puede ganar peso: el plan mueve ${currency(plan.sales)} a nivel plataforma y la sede tiene una brecha de ${currency(gap)} contra meta.`
        : `${plan.name} tiene traccion en la plataforma (${currency(plan.sales)} y ${plan.rows} ventas), pero casi no aparece en ${branch.name}. Es una oportunidad concreta para cubrir ${currency(gap)} de brecha sin depender de descuentos.`;

      return {
        branchId: branch.id,
        branchName: branch.name,
        planId: plan.id,
        planName: plan.name,
        title: `Implementar ${plan.name}`,
        units,
        impact,
        progress,
        currentRows,
        owner: ownerAdvisor ? `Responsable sugerido: ${advisorDisplayName(ownerAdvisor.name)}` : "Responsable sugerido: jefe de sede",
        reason
      };
    })
    .sort((a: any, b: any) => b.impact - a.impact)
    .slice(0, 12);
}

function buildMarketingAnalytics(state: AppState, activePlans: any[]) {
  const branches = cleanRows(state.branches);
  const activeBranches = Math.max(Number(state.kpis?.activeBranches || 0), branches.filter((branch: any) => Number(branch.sales || 0) > 0).length, 1);
  const totalPlanSales = activePlans.reduce((sum: number, plan: any) => sum + Number(plan.sales || 0), 0);
  const planById = new Map(activePlans.map((plan: any) => [Number(plan.id), plan]));
  const topPlans = activePlans
    .filter((plan: any) => Number(plan.sales || 0) > 0)
    .slice()
    .sort((a: any, b: any) => Number(b.sales || 0) - Number(a.sales || 0))
    .slice(0, 10)
    .map((plan: any) => ({ ...plan, shortName: oneLineLabel(plan.name, 22) }));
  const adoptionByPlan = topPlans
    .map((plan: any) => {
      const adoption = activeBranches > 0 ? Number(plan.branch_count || 0) / activeBranches : 0;
      return {
        ...plan,
        adoption,
        adoptionLabel: ratePercent(adoption),
        branchCount: Number(plan.branch_count || 0)
      };
    })
    .sort((a: any, b: any) => b.adoption - a.adoption || Number(b.sales || 0) - Number(a.sales || 0))
    .slice(0, 10);
  const familyMix = Object.values(
    activePlans.reduce((acc: Record<string, any>, plan: any) => {
      const key = marketingPlanFamily(plan.name);
      acc[key] ||= { name: key, shortName: wrapTickLabel(key), sales: 0, rows: 0 };
      acc[key].sales += Number(plan.sales || 0);
      acc[key].rows += Number(plan.rows || 0);
      return acc;
    }, {})
  )
    .map((item: any) => ({ ...item, share: totalPlanSales > 0 ? Number(item.sales || 0) / totalPlanSales : 0 }))
    .filter((item: any) => Number(item.sales || 0) > 0)
    .sort((a: any, b: any) => b.sales - a.sales);
  const dailyUsage = cleanRows(state.dailySales)
    .filter((day: any) => Number(day.sales || 0) > 0 || Number(day.rows || 0) > 0)
    .map((day: any) => {
      const rows = Number(day.rows || 0);
      const sales = Number(day.sales || 0);
      return {
        label: String(day.day).padStart(2, "0"),
        sales,
        rows,
        avgTicket: rows > 0 ? sales / rows : 0
      };
    });
  const planProfitability = topPlans
    .map((plan: any) => {
      const monthlyPrice = Number(plan.cost_per_month || plan.avg_ticket || plan.cash_price || 0);
      const rows = Number(plan.rows || 0);
      return {
        ...plan,
        monthlyizedRevenue: rows * monthlyPrice,
        monthlyPrice
      };
    })
    .sort((a: any, b: any) => b.monthlyizedRevenue - a.monthlyizedRevenue)
    .slice(0, 10);
  const opportunityPlans = activePlans
    .filter((plan: any) => Number(plan.sales || 0) > 0)
    .map((plan: any) => {
      const adoption = activeBranches > 0 ? Number(plan.branch_count || 0) / activeBranches : 0;
      const referencePrice = Number(plan.cash_price || plan.avg_ticket || plan.cost_per_month || 0);
      return {
        ...plan,
        adoption,
        adoptionLabel: ratePercent(adoption),
        branchCount: Number(plan.branch_count || 0),
        referencePrice
      };
    })
    .filter((plan: any) => plan.adoption < 0.75 && plan.referencePrice > 0)
    .sort((a: any, b: any) => Number(b.sales || 0) - Number(a.sales || 0))
    .slice(0, 6);
  const branchPlanProfitability = branches.flatMap((branch: any) =>
    cleanRows(branch.planMix).map((item: any) => {
      const plan = planById.get(Number(item.planId)) || {};
      const monthlyPrice = Number(plan.cost_per_month || item.avgTicket || plan.cash_price || 0);
      const rows = Number(item.rows || 0);
      return {
        branch: branch.name,
        plan: item.name,
        label: `${branchShortName(branch.name)} · ${shortLabel(item.name, 16)}`,
        chartLabel: `${branchShortName(branch.name)}\n${shortLabel(item.name, 18)}`,
        rows,
        sales: Number(item.sales || 0),
        monthlyizedRevenue: rows * monthlyPrice,
        valueLabel: compactCurrency(rows * monthlyPrice)
      };
    })
  )
    .filter((item: any) => item.monthlyizedRevenue > 0)
    .sort((a: any, b: any) => b.monthlyizedRevenue - a.monthlyizedRevenue)
    .slice(0, 12);
  const averageAdoption = adoptionByPlan.length
    ? adoptionByPlan.reduce((sum: number, plan: any) => sum + Number(plan.adoption || 0), 0) / adoptionByPlan.length
    : 0;
  const adoptionById = new Map(adoptionByPlan.map((plan: any) => [Number(plan.id), plan]));
  const planPerformance = planProfitability
    .map((plan: any) => {
      const adoptionInfo = adoptionById.get(Number(plan.id));
      const adoption = Number(adoptionInfo?.adoption || 0);
      const adoptionLabel = adoptionInfo?.adoptionLabel || ratePercent(adoption);
      return {
        ...plan,
        adoption,
        adoptionLabel,
        axisLabel: `${oneLineLabel(plan.name, 30)} (${adoptionLabel})`,
        valueLabel: compactCurrency(plan.monthlyizedRevenue),
        tone: adoption >= 0.7 ? "#33e6a4" : adoption >= 0.4 ? "#f5b944" : "#ff6b5e"
      };
    })
    .sort((a: any, b: any) => b.monthlyizedRevenue - a.monthlyizedRevenue)
    .slice(0, 8);
  return {
    topPlans,
    adoptionByPlan,
    familyMix,
    dailyUsage,
    planProfitability,
    planPerformance,
    branchPlanProfitability,
    opportunityPlans,
    paymentHistory: buildPaymentMethodHistory(state),
    averageAdoption,
    totalMonthlyized: planProfitability.reduce((sum: number, plan: any) => sum + Number(plan.monthlyizedRevenue || 0), 0),
    activeBranches
  };
}

function oneLineLabel(value: string, max = 22) {
  const text = String(value || "Sin dato").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function shortLabel(value: string, max = 18) {
  const text = String(value || "Sin dato");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function wrapTickLabel(value: string, maxLineLen = 9) {
  const text = String(value || "Sin dato").trim();
  if (text.length <= maxLineLen) return text;
  const words = text.split(/[\s/]+/).filter(Boolean);
  if (words.length < 2) {
    const mid = Math.ceil(text.length / 2);
    const breakAt = text.lastIndexOf("-", mid) > 0 ? text.lastIndexOf("-", mid) + 1 : mid;
    return `${text.slice(0, breakAt)}\n${text.slice(breakAt)}`;
  }
  let bestSplit = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ").length;
    const b = words.slice(i).join(" ").length;
    const diff = Math.abs(a - b);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSplit = i;
    }
  }
  return `${words.slice(0, bestSplit).join(" ")}\n${words.slice(bestSplit).join(" ")}`;
}

function paymentMethodKey(value: string) {
  return `payment_${normalizeText(value).replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "sin_medio"}`;
}

function buildPaymentMethodHistory(state: AppState) {
  const colors = ["#33e6a4", "#6ea8e0", "#f5b944", "#ff6b5e", "#9b82c9", "#7fb0bf"];
  const history = cleanRows(state.paymentMethodHistory);
  const totalsByMethod = new Map<string, { name: string; sales: number; rows: number }>();
  for (const item of history) {
    const name = String(item.name || "Sin medio");
    const current = totalsByMethod.get(name) || { name, sales: 0, rows: 0 };
    current.sales += Number(item.sales || 0);
    current.rows += Number(item.rows || 0);
    totalsByMethod.set(name, current);
  }
  const topNames = Array.from(totalsByMethod.values())
    .sort((left, right) => right.sales - left.sales)
    .slice(0, 5)
    .map((item) => item.name);
  const methods = topNames.map((name, index) => ({
    name,
    key: paymentMethodKey(name),
    color: colors[index % colors.length]
  }));
  const labels = new Map(methods.map((method) => [method.key, method.name]));
  const rowsByMonth = new Map<string, any>();

  for (const item of history) {
    const year = Number(item.year || 0);
    const month = Number(item.month || 0);
    if (!year || !month) continue;
    const id = `${year}-${String(month).padStart(2, "0")}`;
    const row = rowsByMonth.get(id) || {
      id,
      year,
      month,
      label: `${(monthOptions[month - 1] || String(month)).slice(0, 3)} ${String(year).slice(-2)}`,
      total: 0,
      topMethod: "",
      topSales: 0
    };
    const sales = Number(item.sales || 0);
    const name = String(item.name || "Sin medio");
    row.total += sales;
    if (sales > row.topSales) {
      row.topSales = sales;
      row.topMethod = name;
    }
    if (topNames.includes(name)) {
      const key = paymentMethodKey(name);
      row[key] = Number(row[key] || 0) + sales;
    }
    rowsByMonth.set(id, row);
  }

  return {
    rows: Array.from(rowsByMonth.values()).sort((left, right) => left.year - right.year || left.month - right.month),
    methods,
    labels
  };
}

function marketingPlanFamily(name: string) {
  const value = normalizeText(name);
  if (value.includes("DUO")) return "Duo";
  if (value.includes("CORPORATIVO")) return "Corporativo";
  if (value.includes("HORA VALLE")) return "Hora valle";
  if (value.includes("PREVENTA")) return "Preventa";
  if (value.includes("ANUAL") || value.includes("13 MESES") || value.includes("14 MESES")) return "Anual/larga";
  if (value.includes("SEMESTRE") || value.includes("6 MESES")) return "Semestre";
  if (value.includes("TRIMESTRE") || value.includes("BIMESTRE") || value.includes("4 MESES") || value.includes("5 MESES")) return "Media duracion";
  if (value.includes("MES")) return "Mensual";
  return "Otros";
}

function BoardReports({ state, year, month }: { state: AppState; year: number; month: number }) {
  const [report, setReport] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/reports/gerencial?year=${year}&month=${month}`)
      .then((res) => res.json())
      .then((json) => {
        if (alive) setReport(json);
      })
      .catch(() => {
        if (alive) setReport(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [year, month]);

  const boardReports = state.boardReports || {};
  const model = report || {
    state,
    monthlyTrend: [],
    annualByBranch: boardReports.byBranch || [],
    annualByAdvisor: boardReports.byAdvisor || [],
    annualByPlan: boardReports.byPlan || [],
    dailyTrend: boardReports.byDay || [],
    topDays: [],
    weakDays: [],
    monthlyInsights: {
      monthProjection: {},
      branchGoalRows: [],
      advisorLevelDistribution: [],
      planFamilyMix: [],
      topPlansByBranch: [],
      weekdayPerformance: [],
      commissionSummary: {},
      paymentMethods: state.paymentMethods || []
    }
  };
  const fallbackInsights = buildReportFallbackInsights(state, year, month);
  const insights = model.monthlyInsights || {};
  const monthProjection = hasRows([insights.monthProjection]) ? insights.monthProjection : fallbackInsights.monthProjection;
  const branchGoalRows = hasRows(insights.branchGoalRows) ? insights.branchGoalRows : fallbackInsights.branchGoalRows;
  const advisorLevelDistribution = hasRows(insights.advisorLevelDistribution) ? insights.advisorLevelDistribution : fallbackInsights.advisorLevelDistribution;
  const planFamilyMix = hasRows(insights.planFamilyMix) ? insights.planFamilyMix : fallbackInsights.planFamilyMix;
  const topPlansByBranch = hasRows(insights.topPlansByBranch) ? insights.topPlansByBranch : fallbackInsights.topPlansByBranch;
  const weekdayPerformance = hasRows(insights.weekdayPerformance) ? insights.weekdayPerformance : fallbackInsights.weekdayPerformance;
  const commissionSummary = hasRows([insights.commissionSummary]) ? insights.commissionSummary : fallbackInsights.commissionSummary;
  const paymentMethods = hasRows(insights.paymentMethods) ? insights.paymentMethods : fallbackInsights.paymentMethods;
  const dailyTrend = cleanRows(hasRows(model.dailyTrend) ? model.dailyTrend : boardReports.byDay);
  const topDays = hasRows(model.topDays)
    ? cleanRows(model.topDays)
    : dailyTrend.slice().sort((a: any, b: any) => Number(b.sales || 0) - Number(a.sales || 0)).slice(0, 6);
  const weakDays = hasRows(model.weakDays)
    ? cleanRows(model.weakDays)
    : fallbackInsights.weakDays;
  const months = cleanRows(model.monthlyTrend).filter((row: any) => Number(row.month) <= month);
  const total = months.reduce((sum: number, row: any) => sum + Number(row.sales || 0), 0) || state.kpis.totalSales;
  const bestMonth = months.slice().sort((a: any, b: any) => Number(b.sales || 0) - Number(a.sales || 0))[0];
  const branches = cleanRows(model.annualByBranch).filter((row: any) => Number(row.sales || 0) > 0).slice(0, 8);
  const advisors = cleanRows(model.annualByAdvisor).filter((row: any) => Number(row.sales || 0) > 0);
  const topAdvisorRows = advisors.slice(0, 18).map((row: any) => ({
    ...row,
    reportChartName: advisorChartName(row.name)
  }));
  const advisorChartHeight = Math.max(460, topAdvisorRows.length * 30);
  const plans = cleanRows(model.annualByPlan).filter((row: any) => Number(row.sales || 0) > 0);
  const totalPlans = plans.reduce((sum: number, row: any) => sum + Number(row.sales || 0), 0);
  const projectionMethod = monthProjection.history?.method === "historico_ajustado" ? "historico ajustado" : "ritmo lineal";
  const projectionBand = (
    <div className="report-projection-band">
      <div>
        <span>Proyeccion gerencial de cierre</span>
        <strong>{currency(monthProjection.projectedClose || 0)}</strong>
        <small>{monthProjection.confidence?.label || "Confianza media"} · {projectionMethod}</small>
      </div>
      <div>
        <span>Venta actual</span>
        <strong>{currency(monthProjection.sales || 0)}</strong>
        <small>{percent(monthProjection.progress || 0)} de Meta 1</small>
      </div>
      <div>
        <span>Rango probable</span>
        <strong>{compactCurrency(monthProjection.conservativeProjectedClose || 0)} - {compactCurrency(monthProjection.optimisticProjectedClose || 0)}</strong>
        <small>cierre esperado del mes</small>
      </div>
      <div>
        <span>Brecha proyectada</span>
        <strong>{currency(monthProjection.projectedGap || 0)}</strong>
        <small>{currency(monthProjection.requiredDaily || 0)} diario requerido</small>
      </div>
    </div>
  );

  const branchTrafficRows = state.branches
    .filter((branch: any) => branch.name !== "Online")
    .map((branch: any) => {
      const light = branchChurnTrafficLight(branch, state);
      const target = Number(branch.target?.meta1 || 0);
      const sales = Number(branch.sales || 0);
      const progress = target > 0 ? sales / target : Number(branch.score?.progressMeta1 || 0);
      const gap = Math.max(target - sales, 0);
      const action = light.status === "red"
        ? "Congelar repricing y choque renovaciones"
        : light.status === "yellow"
          ? "Doble pasada WhatsApp + diagnóstico"
          : progress < 0.45
            ? "Empujar pipeline semanal"
            : "Mantener ritmo";
      const priority = light.status === "red" ? 3 : light.status === "yellow" ? 2 : progress < 0.45 ? 1 : 0;
      return { ...branch, light, progress, gap, action, priority };
    })
    .sort((a: any, b: any) => b.priority - a.priority || Number(b.light.churn || 0) - Number(a.light.churn || 0) || Number(b.gap || 0) - Number(a.gap || 0));
  const executiveBranches = branchTrafficRows.slice(0, 5);
  const redBranches = branchTrafficRows.filter((branch: any) => branch.light.status === "red");
  const yellowBranches = branchTrafficRows.filter((branch: any) => branch.light.status === "yellow");
  const weakestProgress = branchTrafficRows.slice().sort((a: any, b: any) => Number(a.progress || 0) - Number(b.progress || 0))[0];
  const onlineBranch = state.branches.find((branch: any) => branch.name === "Online");
  const currentGap = Math.max(Number(state.kpis.totalTarget || 0) - Number(state.kpis.totalSales || 0), 0);
  const projectedGap = Math.max(Number(state.kpis.totalTarget || 0) - Number(monthProjection.projectedClose || 0), 0);
  const executiveAlerts = [
    redBranches.length ? {
      tone: "red",
      title: `${redBranches.length} sedes en rojo de churn`,
      detail: "Activar protocolo: congelar repricing, proteger renovaciones y revisar causas el viernes."
    } : null,
    weakestProgress ? {
      tone: weakestProgress.progress < 0.4 ? "red" : "amber",
      title: `${weakestProgress.name} es la sede más rezagada`,
      detail: `${percent(weakestProgress.progress)} de Meta 1; brecha actual ${compactCurrency(weakestProgress.gap)}.`
    } : null,
    onlineBranch ? {
      tone: Number(onlineBranch.score?.progressMeta1 || 0) < 0.1 ? "red" : "amber",
      title: "Canal Online sigue débil",
      detail: `${percent(onlineBranch.score?.progressMeta1 || 0)} de meta; requiere plan digital separado de sedes físicas.`
    } : null
  ].filter(Boolean).slice(0, 3);
  const executiveDecisions = [
    redBranches.length ? "Congelar upsell agresivo en sedes rojas hasta bajar churn." : "Mantener fases sin escalar precio fuera del plan.",
    projectedGap > 0 ? `Cerrar brecha proyectada de ${compactCurrency(projectedGap)} con acciones de renovación.` : "Sostener ritmo porque la proyección cubre Meta 1.",
    yellowBranches.length ? `Auditar sedes amarillas: ${yellowBranches.map((branch: any) => branch.name).join(", ")}.` : "No hay amarillos fuera de control; concentrarse en rojos y meta."
  ];
  const weeklyActions = [
    { label: "Renovaciones", owner: "Líderes sede", action: "Doble pasada a vencidos y vencimientos", due: "7 días" },
    { label: "Repricing", owner: "Dirección", action: "Pausar presión de tier en rojo", due: "Hoy" },
    { label: "Online", owner: "Marketing", action: "Activar campaña con leads por sede", due: "Viernes" }
  ];

  return (
    <div className="view report-view executive-report-view">
      {loading ? <div className="notice compact-notice">Actualizando informe gerencial...</div> : null}
      <section className="executive-dashboard">
        <div className="executive-kpis">
          <article><span>Venta actual</span><strong>{compactCurrency(state.kpis.totalSales)}</strong><small>{wholeNumber(state.kpis.salesRows)} registros</small></article>
          <article><span>Meta 1</span><strong>{percent(state.kpis.targetProgress || 0)}</strong><small>Brecha {compactCurrency(currentGap)}</small></article>
          <article><span>Proyección</span><strong>{compactCurrency(monthProjection.projectedClose || 0)}</strong><small>{monthProjection.confidence?.label || "Confianza media"}</small></article>
          <article><span>Brecha proy.</span><strong>{compactCurrency(projectedGap)}</strong><small>{currency(monthProjection.requiredDaily || 0)} diario</small></article>
          <article><span>Churn red</span><strong>{ratePercent(state.kpis.memberChurnGross || state.kpis.memberChurnDirect || 0)}</strong><small>{redBranches.length} rojas · {yellowBranches.length} amarillas</small></article>
        </div>

        <div className="executive-main-grid">
          <section className="executive-panel branch-risk-panel">
            <div className="panel-title compact"><h2>Semáforo de sedes</h2><Building2 size={17} /></div>
            <div className="executive-branch-table">
              {executiveBranches.map((branch: any) => (
                <article key={branch.id} className={`executive-branch-row ${branch.light.status}`}>
                  <div>
                    <strong>{branch.name}</strong>
                    <span>{branch.action}</span>
                  </div>
                  <b>{percent(branch.progress)}</b>
                  <span className={`churn-badge ${branch.light.status}`}>
                    <i className={`churn-light ${branch.light.status}`} />
                    {branch.light.label}
                    {branch.light.churn !== null ? <small>{ratePercent(branch.light.churn)}</small> : null}
                  </span>
                </article>
              ))}
            </div>
          </section>

          <section className="executive-panel">
            <div className="panel-title compact"><h2>Alertas ejecutivas</h2><AlertTriangle size={17} /></div>
            <div className="executive-alerts">
              {executiveAlerts.map((alert: any) => (
                <article key={alert.title} className={alert.tone}>
                  <strong>{alert.title}</strong>
                  <span>{alert.detail}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="executive-panel">
            <div className="panel-title compact"><h2>Decisiones</h2><ClipboardList size={17} /></div>
            <div className="executive-decision-plan">
              <div className="executive-decisions">
                {executiveDecisions.map((item, index) => (
                  <article key={item}><strong>{index + 1}</strong><span>{item}</span></article>
                ))}
              </div>
              <div className="executive-actions">
                {weeklyActions.map((item) => (
                  <article key={item.label}>
                    <strong>{item.label}</strong>
                    <span>{item.action}</span>
                    <small>{item.owner} · {item.due}</small>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );

  return (
    <div className="view report-view">
      {loading ? <div className="notice">Actualizando informe gerencial...</div> : null}
      <section className="report-projection-dock">
        <div>
          <h2>Proyección visible del informe gerencial</h2>
          <p>Resumen de cierre del mes calculado con la misma información del informe y del PDF.</p>
        </div>
        {projectionBand}
      </section>
      <section className="report-page">
        <h2>Informe sedes y asesores - Enero a {state.filters.selectedMonthName} {state.filters.selectedYear}</h2>
        <h3>Dinero ingresado: {currency(total)} | Promedio mensual: {currency(total / Math.max(months.length, 1))} | Mejor mes: {bestMonth?.label || state.filters.selectedMonthName} ({currency(bestMonth?.sales || 0)})</h3>
        <p>Incluye ventas positivas disponibles en la plataforma. La informacion se actualiza con los datos cargados y el PDF conserva esta misma estructura.</p>
        <ReportTable rows={months} columns={[
          { key: "label", label: "Mes" },
          { key: "sales", label: "Dinero ingresado", format: currency },
          { key: "share", label: "% periodo", value: (row: any) => percent(total ? row.sales / total : 0) },
          { key: "daily", label: "Promedio diario", value: (row: any) => currency(row.sales / new Date(year, row.month, 0).getDate()) },
          { key: "rows", label: "Transacciones" }
        ]} />
        <ReportChart title="Rendimiento acumulado - dinero ingresado por mes" data={months} dataKey="sales" />
      </section>

      <section className="report-page">
        <h2>Pulso mensual y proyección de cierre</h2>
        <div className="report-kpi-grid">
          <article><span>Venta actual</span><strong>{currency(monthProjection.sales || 0)}</strong><small>{percent(monthProjection.progress || 0)} de Meta 1</small></article>
          <article><span>Proyección recomendada</span><strong>{currency(monthProjection.projectedClose || 0)}</strong><small>{monthProjection.confidence?.label || "Confianza media"} · {percent(monthProjection.projectedProgress || 0)}</small></article>
          <article><span>Rango probable</span><strong>{compactCurrency(monthProjection.conservativeProjectedClose || 0)} - {compactCurrency(monthProjection.optimisticProjectedClose || 0)}</strong><small>{projectionMethod}</small></article>
          <article><span>Brecha actual</span><strong>{currency(monthProjection.currentGap || 0)}</strong><small>{currency(monthProjection.requiredDaily || 0)} diario requerido</small></article>
        </div>
        <div className="report-chart-grid">
          <ReportBar title="Sedes por avance a Meta 1" data={branchGoalRows.slice().sort((a: any, b: any) => Number(b.progress || 0) - Number(a.progress || 0))} dataKey="progress" labelKey="name" valueFormatter={percent} />
          <ReportBar title="Distribución de asesores por nivel" data={advisorLevelDistribution} dataKey="advisors" labelKey="level" color="#6ea8e0" valueFormatter={(value) => String(Math.round(value))} />
        </div>
        <ReportTable rows={branchGoalRows} columns={[
          { key: "name", label: "Sede" },
          { key: "sales", label: "Venta mes", format: currency },
          { key: "target", label: "Meta 1", format: currency },
          { key: "progress", label: "Avance", format: percent },
          { key: "gap", label: "Brecha", format: currency },
          { key: "projectedClose", label: "Proy. cierre", format: currency }
        ]} />
      </section>

      <section className="report-page">
        <h2>Sedes</h2>
        <ReportTable rows={branches} columns={[
          { key: "name", label: "Sede" },
          { key: "sales", label: "Dinero ingresado", format: currency },
          { key: "share", label: "% periodo", value: (row: any) => percent(total ? row.sales / total : 0) },
          { key: "rows", label: "Transacciones" },
          { key: "ticket", label: "Ticket promedio", value: (row: any) => currency(row.sales / Math.max(row.rows, 1)) }
        ]} />
        <div className="report-chart-grid">
          <ReportBar title="Ventas acumuladas por sede" data={branches} dataKey="sales" labelKey="name" />
          <ReportChart title="Rendimiento por sede" data={months} dataKey="sales" />
        </div>
      </section>

      <section className="report-page">
        <h2>Asesores</h2>
        <h3>Asesores con ventas positivas: {advisors.length} | Venta sin asesor asignado: {currency(model.unassignedSales || 0)} | Venta SUPORTEEVO positiva: {currency(model.supportEvoSales || 0)}</h3>
        <ReportTable rows={advisorLevelDistribution} columns={[
          { key: "level", label: "Nivel" },
          { key: "advisors", label: "Asesores" },
          { key: "sales", label: "Venta", format: currency },
          { key: "commissions", label: "Comisiones", format: currency }
        ]} />
        <ReportBar title="Top asesores por venta acumulada" data={topAdvisorRows} dataKey="sales" labelKey="reportChartName" height={advisorChartHeight} labelWidth={210} />
        <ReportTable rows={advisors.slice(0, 24)} columns={[
          { key: "name", label: "Asesor" },
          { key: "branchName", label: "Sede" },
          { key: "sales", label: "Dinero ingresado", format: currency },
          { key: "rows", label: "Transacciones" },
          { key: "ticket", label: "Ticket prom.", value: (row: any) => currency(row.sales / Math.max(row.rows, 1)) }
        ]} />
      </section>

      <section className="report-page">
        <h2>Rendimiento Diario Mensual</h2>
        <div className="report-chart-grid">
          <ReportChart title={`Rendimiento diario - ${state.filters.selectedMonthName}`} data={dailyTrend || []} dataKey="sales" labelKey="label" />
          <ReportBar title="Dias de mayor facturacion" data={topDays || []} dataKey="sales" labelKey="label" />
          <ReportBar title="Dias con menor facturacion" data={weakDays || []} dataKey="sales" labelKey="label" color="#f5b944" />
          <ReportBar title="Promedio por dia de semana" data={weekdayPerformance} dataKey="avgSales" labelKey="weekday" color="#9b82c9" />
        </div>
      </section>

      <section className="report-page">
        <h2>Rendimiento del Periodo de Planes</h2>
        <h3>Ingreso por planes: {currency(totalPlans)} | Planes con ventas: {plans.length} | Transacciones de planes: {plans.reduce((sum: number, row: any) => sum + Number(row.rows || 0), 0)}</h3>
        <div className="report-chart-grid">
          <ReportBar title="Mix mensual por familia de plan" data={planFamilyMix} dataKey="sales" labelKey="family" color="#21c78c" />
          <ReportBar title="Métodos de pago del mes" data={paymentMethods} dataKey="sales" labelKey="name" color="#6ea8e0" />
        </div>
        <ReportTable rows={topPlansByBranch} columns={[
          { key: "branchName", label: "Sede" },
          { key: "topRevenuePlan", label: "Plan mayor ingreso" },
          { key: "topRevenueSales", label: "Ingreso", format: currency },
          { key: "topVolumePlan", label: "Plan más vendido" },
          { key: "topVolumeRows", label: "Ventas" }
        ]} />
        <ReportTable rows={plans.slice(0, 32)} columns={[
          { key: "name", label: "Plan" },
          { key: "sales", label: "Dinero ingresado", format: currency },
          { key: "share", label: "% planes", value: (row: any) => percent(totalPlans ? row.sales / totalPlans : 0) },
          { key: "rows", label: "Transacciones" },
          { key: "ticket", label: "Ticket prom.", value: (row: any) => currency(row.sales / Math.max(row.rows, 1)) },
          { key: "branchCount", label: "Sedes" }
        ]} />
        <div className="report-chart-grid plan-report-charts">
          <ReportBar title="Top planes por dinero ingresado" data={plans.slice(0, 16)} dataKey="sales" labelKey="name" labelWidth={190} rowHeight={34} />
          <ReportBar title="Top planes por transacciones" data={plans.slice().sort((a: any, b: any) => Number(b.rows || 0) - Number(a.rows || 0)).slice(0, 16)} dataKey="rows" labelKey="name" color="#6ea8e0" labelWidth={190} rowHeight={34} />
        </div>
      </section>
    </div>
  );
}

function ReportChart({ title, data, dataKey, labelKey = "label" }: { title: string; data: any[]; dataKey: string; labelKey?: string }) {
  const hasChartData = hasRows(data) && data.some((row) => Number(row?.[dataKey] || 0) > 0);
  return (
    <div className="report-chart">
      <h3>{title}</h3>
      {hasChartData ? (
        <ResponsiveContainer width="100%" height={300}>
          <ReLineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={labelKey} />
            <YAxis tickFormatter={(value) => compactCurrency(Number(value))} />
            <Tooltip formatter={(value) => currency(Number(value))} />
            <Line type="monotone" dataKey={dataKey} stroke="#6ea8e0" strokeWidth={3} dot />
          </ReLineChart>
        </ResponsiveContainer>
      ) : <EmptyChart />}
    </div>
  );
}

function ReportBar({
  title,
  data,
  dataKey,
  labelKey,
  color = "#21c78c",
  height,
  labelWidth = 140,
  rowHeight = 26
  , valueFormatter
}: {
  title: string;
  data: any[];
  dataKey: string;
  labelKey: string;
  color?: string;
  height?: number;
  labelWidth?: number;
  rowHeight?: number;
  valueFormatter?: (value: number) => string;
}) {
  const chartHeight = height ?? Math.max(320, data.length * rowHeight + 56);
  const formatValue = valueFormatter ?? ((value: number) => dataKey === "rows" ? String(value) : compactCurrency(value));
  const hasChartData = hasRows(data) && data.some((row) => Number(row?.[dataKey] || 0) > 0);
  return (
    <div className="report-chart">
      <h3>{title}</h3>
      {hasChartData ? (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={data} layout="vertical" margin={{ top: 8, left: 8, right: 32, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(value) => formatValue(Number(value))} />
            <YAxis type="category" dataKey={labelKey} width={labelWidth} interval={0} tickLine={false} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => typeof value === "number" ? formatValue(value) : value} />
            <Bar dataKey={dataKey} fill={color} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : <EmptyChart height={Math.min(chartHeight, 320)} />}
    </div>
  );
}

function EmptyChart({ height = 300 }: { height?: number }) {
  return (
    <div className="empty-chart" style={{ minHeight: height }}>
      Sin datos para graficar
    </div>
  );
}

function hasRows(value: any) {
  return Array.isArray(value)
    ? cleanRows(value).length > 0
    : Boolean(value && typeof value === "object" && Object.values(value).some((item) => item !== undefined && item !== null && item !== 0 && item !== ""));
}

function cleanRows(value: any) {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === "object") : [];
}

function reportPlanFamily(name: string) {
  const value = normalizeText(name);
  if (value.includes("DUO")) return "Duo";
  if (value.includes("CORPORATIVO")) return "Corporativo";
  if (value.includes("HORA VALLE")) return "Hora valle";
  if (value.includes("WEB")) return "Web";
  if (value.includes("2 SESIONES")) return "Con sesiones";
  if (value.includes("MES")) return "Mensual/base";
  if (["TRIMESTRE", "BIMESTRE", "SEMESTRE", "ANUAL", "13 MESES", "14 MESES", "4 MESES", "5 MESES", "7 MESES"].some((token) => value.includes(token))) {
    return "Duracion larga";
  }
  return "Otros";
}

function buildReportFallbackInsights(state: AppState, year: number, month: number) {
  const dailyRows = cleanRows(state.boardReports?.byDay || state.dailySales || []).filter((row: any) => Number(row.sales || 0) > 0);
  const daysInMonth = new Date(year, month, 0).getDate();
  const lastSaleDay = Math.max(...dailyRows.map((row: any) => Number(row.day || row.label || 0)), 0);
  const elapsedDays = Math.max(lastSaleDay || Math.min(new Date().getDate(), daysInMonth), 1);
  const remainingDays = Math.max(daysInMonth - elapsedDays, 0);
  const totalSales = Number(state.kpis?.totalSales || 0);
  const totalTarget = Number(state.kpis?.totalTarget || 0);
  const projectedClose = totalSales > 0 ? (totalSales / elapsedDays) * daysInMonth : 0;
  const branchGoalRows = (state.branches || [])
    .filter((branch: any) => branch.target)
    .map((branch: any) => {
      const sales = Number(branch.sales || 0);
      const target = Number(branch.target?.meta1 || 0);
      const projected = sales > 0 ? (sales / elapsedDays) * daysInMonth : 0;
      return {
        id: branch.id,
        name: branch.name,
        sales,
        target,
        gap: Math.max(target - sales, 0),
        progress: target > 0 ? sales / target : 0,
        projectedClose: projected
      };
    })
    .sort((a: any, b: any) => Number(a.progress || 0) - Number(b.progress || 0));
  const levelMap = new Map<string, any>();
  for (const advisor of cleanRows(state.advisors)) {
    const level = advisor.commission?.level || "Sin comision";
    const row = levelMap.get(level) || { level, advisors: 0, sales: 0, commissions: 0 };
    row.advisors += 1;
    row.sales += Number(advisor.sales || 0);
    row.commissions += Number(advisor.commission?.finalCommission || 0);
    levelMap.set(level, row);
  }
  const levelOrder = ["Sin venta", "Sin comision", "Activacion", "Bronce", "Plata", "Meta 1", "Meta 2", "Meta 3", "Meta 4"];
  const planMap = new Map<string, any>();
  for (const plan of cleanRows(state.plans)) {
    const sales = Number(plan.sales || 0);
    const rows = Number(plan.rows || 0);
    if (sales <= 0 && rows <= 0) continue;
    const family = reportPlanFamily(plan.name);
    const row = planMap.get(family) || { family, sales: 0, rows: 0, plans: 0 };
    row.sales += sales;
    row.rows += rows;
    row.plans += 1;
    planMap.set(family, row);
  }
  const weekdayLabels = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
  const weekdayMap = new Map<number, any>();
  for (const row of dailyRows) {
    const day = Number(row.day || row.label || 0);
    if (!day) continue;
    const index = new Date(year, month - 1, day).getDay();
    const bucket = weekdayMap.get(index) || { weekday: weekdayLabels[index], sales: 0, rows: 0, activeDays: 0 };
    bucket.sales += Number(row.sales || 0);
    bucket.rows += Number(row.rows || 0);
    bucket.activeDays += 1;
    weekdayMap.set(index, bucket);
  }
  const weekdayPerformance = Array.from(weekdayMap.values()).map((row: any) => ({
    ...row,
    avgSales: row.activeDays > 0 ? row.sales / row.activeDays : 0,
    avgRows: row.activeDays > 0 ? row.rows / row.activeDays : 0
  }));
  return {
    monthProjection: {
      sales: totalSales,
      target: totalTarget,
      progress: totalTarget > 0 ? totalSales / totalTarget : 0,
      projectedClose,
      conservativeProjectedClose: projectedClose * 0.9,
      optimisticProjectedClose: projectedClose * 1.1,
      projectedProgress: totalTarget > 0 ? projectedClose / totalTarget : 0,
      currentGap: Math.max(totalTarget - totalSales, 0),
      requiredDaily: remainingDays > 0 ? Math.max(totalTarget - totalSales, 0) / remainingDays : 0,
      confidence: { label: "Media", score: 50 },
      history: { method: "ritmo_lineal" }
    },
    branchGoalRows,
    advisorLevelDistribution: Array.from(levelMap.values()).sort((a: any, b: any) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level)),
    planFamilyMix: Array.from(planMap.values()).sort((a: any, b: any) => b.sales - a.sales),
    topPlansByBranch: [],
    weekdayPerformance,
    weakDays: dailyRows.slice().sort((a: any, b: any) => Number(a.sales || 0) - Number(b.sales || 0)).slice(0, 6),
    commissionSummary: {
      advisorCommissions: Number(state.kpis?.totalAdvisorCommissions || 0),
      directorCommissions: Number(state.kpis?.totalDirectorCommissions || 0),
      totalCommissions: Number(state.kpis?.totalAdvisorCommissions || 0) + Number(state.kpis?.totalDirectorCommissions || 0),
      commissionRate: totalSales > 0 ? (Number(state.kpis?.totalAdvisorCommissions || 0) + Number(state.kpis?.totalDirectorCommissions || 0)) / totalSales : 0
    },
    paymentMethods: cleanRows(state.paymentMethods)
  };
}

function ReportTable({ rows, columns }: { rows: any[]; columns: Array<{ key: string; label: string; format?: (value: number) => string; value?: (row: any) => React.ReactNode }> }) {
  const safeRows = cleanRows(rows);
  return (
    <div className="report-table">
      <table>
        <thead><tr>{columns.map((col) => <th key={col.key}>{col.label}</th>)}</tr></thead>
        <tbody>
          {safeRows.length ? safeRows.map((row, index) => (
            <tr key={row.id ?? `${row.name || row.label}-${index}`}>
              {columns.map((col) => {
                const raw = col.value ? col.value(row) : row[col.key];
                return <td key={col.key}>{col.format && typeof raw === "number" ? col.format(raw) : String(raw ?? "")}</td>;
              })}
            </tr>
          )) : <tr><td colSpan={columns.length}>Sin registros</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Direction({ state }: { state: AppState; year: number; month: number; onReload: () => Promise<void>; setNotice: (value: string) => void }) {
  const directorRows = state.branches
    .filter((branch: any) => branch.target)
    .slice()
    .sort((a: any, b: any) => Number(b.directorCommission?.bonus || 0) - Number(a.directorCommission?.bonus || 0) || Number(b.score?.progressMeta1 || 0) - Number(a.score?.progressMeta1 || 0));
  const payingBranches = directorRows.filter((branch: any) => Number(branch.directorCommission?.bonus || 0) > 0).length;
  const nextBranches = directorRows
    .filter((branch: any) => Number(branch.directorCommission?.bonus || 0) <= 0)
    .slice()
    .sort((a: any, b: any) => Number(b.score?.progressMeta1 || 0) - Number(a.score?.progressMeta1 || 0))
    .slice(0, 4);
  const branchRecommendations = state.recommendations
    .filter((item: any) => String(item.title || "").startsWith("Ritmo comercial"))
    .slice(0, 5);
  const qualityIssues = [
    {
      label: "Duplicados",
      value: state.quality.duplicateGroups.length + state.quality.naturalDuplicateGroups.length,
      detail: "ventas repetidas detectadas"
    },
    {
      label: "Ventas positivas sin asesor",
      value: state.quality.orphanSales.missingAdvisorPositive ?? state.quality.orphanSales.missingAdvisor,
      detail: "afectan atribución comercial"
    },
    {
      label: "Ventas positivas en soporte",
      value: state.quality.orphanSales.supportAdvisorPositiveRows ?? 0,
      detail: currency(state.quality.orphanSales.supportAdvisorPositiveSales ?? 0)
    },
    {
      label: "Cortesías / valor cero",
      value: state.quality.orphanSales.zeroValue,
      detail: "informativo, no descuenta comisión"
    }
  ];

  return (
    <div className="view direction-view">
      <section className="panel direction-hero">
        <div>
          <span className="eyebrow">Comisión director</span>
          <h2>{state.filters.selectedMonthName} {state.filters.selectedYear}</h2>
          <p>Liquidación mensual por sede. No incluye comisiones de asesores.</p>
        </div>
        <div className="direction-hero-metrics">
          <Kpi label="Venta total" value={currency(state.kpis.totalSales)} sub={percent(state.kpis.targetProgress)} />
          <Kpi label="Comisión director" value={currency(state.kpis.totalDirectorCommissions)} sub={`${payingBranches} sedes pagan bono`} tone="blue" />
          <Kpi label="Meta 1 compañía" value={currency(state.kpis.totalTarget)} sub={`${directorRows.length} sedes con meta`} tone="amber" />
        </div>
      </section>

      <section className="panel">
        <div className="panel-title"><h2>Detalle por sede</h2><Building2 size={18} /></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sede</th>
                <th>Venta mes</th>
                <th>Meta 1 sede</th>
                <th>Avance</th>
                <th>Nivel director</th>
                <th>Bono director</th>
                <th>Falta Meta 1</th>
              </tr>
            </thead>
            <tbody>
              {directorRows.map((branch: any) => (
                <tr key={branch.id}>
                  <td>{branch.name}</td>
                  <td>{currency(branch.sales)}</td>
                  <td>{currency(branch.target?.meta1 || 0)}</td>
                  <td>{percent(branch.score?.progressMeta1 || 0)}</td>
                  <td>{branch.directorCommission?.level || "Sin meta"}</td>
                  <td>{currency(branch.directorCommission?.bonus || 0)}</td>
                  <td>{currency(Math.max((branch.target?.meta1 || 0) - Number(branch.sales || 0), 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {nextBranches.length ? (
        <section className="panel">
          <div className="panel-title"><h2>Sedes más cercanas a bono</h2><Building2 size={18} /></div>
          <div className="focus-list">
            {nextBranches.map((branch: any) => (
              <article key={branch.id}>
                <div>
                  <strong>{branch.name}</strong>
                  <span>{currency(branch.sales)} de {currency(branch.target.meta1)}</span>
                </div>
                <strong>{percent(branch.score.progressMeta1)}</strong>
                <Progress value={branch.score.progressMeta1} />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-title"><h2>Calidad de datos y apoyo comercial</h2><Sparkles size={18} /></div>
        <div className="quality-grid">
          {qualityIssues.map((item) => (
            <div className="quality-card" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </div>
          ))}
        </div>
        <div className="recommendation-list">
          {branchRecommendations.length ? branchRecommendations.map((item: any, index: number) => (
            <article key={`${item.title}-${index}`} className="recommendation">
              <strong>{item.title}</strong>
              <span>{item.priority}</span>
              <p>{item.detail}</p>
              <small>{item.metric}</small>
            </article>
          )) : <Empty />}
        </div>
      </section>
    </div>
  );
}

function normalizeText(value?: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();
}

function renderInlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function parseMarkdownTable(lines: string[], startIndex: number) {
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

function ChatContent({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(<p key={`p-${blocks.length}`}>{renderInlineMarkdown(paragraph.join(" "))}</p>);
    paragraph = [];
  };

  for (let index = 0; index < lines.length;) {
    const table = parseMarkdownTable(lines, index);
    if (table) {
      flushParagraph();
      blocks.push(
        <div className="chat-table-wrap" key={`table-${blocks.length}`}>
          <table className="chat-table">
            <thead>
              <tr>{table.headers.map((header, cellIndex) => <th key={cellIndex}>{renderInlineMarkdown(header)}</th>)}</tr>
            </thead>
            <tbody>
              {table.body.map((row, rowIndex) => (
                <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{renderInlineMarkdown(cell)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      index = table.nextIndex;
      continue;
    }
    const line = lines[index].trim();
    if (!line) {
      flushParagraph();
      index += 1;
      continue;
    }
    paragraph.push(line);
    index += 1;
  }
  flushParagraph();
  return <div className="chat-content">{blocks}</div>;
}

function AiChat({ state, year, month, setNotice }: { state: AppState; year: number; month: number; setNotice: (value: string) => void }) {
  const groqConfigured = state.settings.groq_api_key_configured === "true";
  const [prompt, setPrompt] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [messages, setMessages] = React.useState<Array<{ role: "user" | "assistant"; content: string }>>([]);

  async function ask(question = prompt) {
    const text = question.trim();
    if (!text || loading) return;
    if (!groqConfigured) {
      setNotice("Groq no esta configurado.");
      return;
    }
    const nextMessages: Array<{ role: "user" | "assistant"; content: string }> = [...messages, { role: "user", content: text }];
    setPrompt("");
    setLoading(true);
    setMessages(nextMessages);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 35_000);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, messages: nextMessages.slice(-10), year, month, mode: "chat" })
      });
      const json = await res.json();
      if (!res.ok) {
        const error = json.error || "Groq no pudo responder";
        setMessages((current) => [...current, { role: "assistant", content: error }]);
        return;
      }
      setMessages((current) => [...current, { role: "assistant", content: json.answer }]);
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError"
        ? "Groq tardó demasiado en responder. Intenta de nuevo en unos segundos."
        : error instanceof Error
          ? error.message
          : "Groq no pudo responder";
      setMessages((current) => [...current, { role: "assistant", content: message }]);
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

  return (
    <div className="view ai-chat-view">
      <section className="panel ai-chat-panel">
        <div className="panel-title">
          <h2>Chat IA</h2>
          <span className={groqConfigured ? "status-pill ok" : "status-pill pending"}>{groqConfigured ? "Activo" : "Sin configurar"}</span>
        </div>
        <div className="chat-log">
          {messages.length ? (
            messages.map((message, index) => (
              <article key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
                <span className="chat-message-author">
                  {message.role === "user" ? <UserCircle size={15} /> : <Bot size={15} />}
                  {message.role === "user" ? "Tú" : "AI-sistente DashCom"}
                </span>
                <ChatContent content={message.content} />
              </article>
            ))
          ) : (
            <div className="chat-empty-state">
              <MessageCircle size={24} />
              <strong>Escribe una pregunta para hablar con AI-sistente DashCom.</strong>
            </div>
          )}
          {loading ? (
            <article className="chat-message assistant">
              <span className="chat-message-author"><Bot size={15} />AI-sistente DashCom</span>
              <ChatContent content="Analizando..." />
            </article>
          ) : null}
        </div>
        <div className="chat-input">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                ask().catch((error) => setNotice(error.message));
              }
            }}
            placeholder="Escribe tu mensaje..."
          />
          <button onClick={() => ask()} disabled={loading || !prompt.trim() || !groqConfigured}>Enviar</button>
        </div>
      </section>
    </div>
  );
}

function Configuration({ state, onReload, setNotice }: { state: AppState; onReload: () => Promise<void>; setNotice: (value: string) => void }) {
  const [settings, setSettings] = React.useState({
    evo_base_url: state.settings.evo_base_url || "",
    evo_dns: state.settings.evo_dns || "",
    evo_api_key: "",
    groq_api_key: "",
    groq_model: state.settings.groq_model || "llama-3.3-70b-versatile"
  });
  const [configTab, setConfigTab] = React.useState<"branches" | "targets" | "advisors" | "commissions" | "integrations" | "queryUsers" | "health" | "debug">("branches");
  const [branchForm, setBranchForm] = React.useState({ code: "", displayName: "" });
  const [advisorForm, setAdvisorForm] = React.useState({ name: "", branchId: "" });
  const [queryUsers, setQueryUsers] = React.useState<any[]>([]);
  const [queryUsersLoaded, setQueryUsersLoaded] = React.useState(false);
  const [queryUserForm, setQueryUserForm] = React.useState({ name: "", username: "", role: "asesor", advisorId: "", branchId: "" });
  const [lastIssuedPins, setLastIssuedPins] = React.useState<Record<number, string>>({});
  const consultaLink = `${window.location.origin}/consulta`;
  const groqConfigured = state.settings.groq_api_key_configured === "true";
  const evoConfigured = state.settings.evo_api_key_configured === "true";
  const config = state.configuration || { branches: [], advisors: [], health: state.dataHealth || {}, debug: { errors: [] } };
  const configBranches = cleanRows(config.branches);
  const configAdvisors = cleanRows(config.advisors).sort((left: any, right: any) => {
    const activeCompare = Number(right.active || 0) - Number(left.active || 0);
    if (activeCompare !== 0) return activeCompare;
    const alertCompare = Number(Boolean(right.inactiveAlert)) - Number(Boolean(left.inactiveAlert));
    if (alertCompare !== 0) return alertCompare;
    const branchCompare = String(left.branchName || "Sin sede").localeCompare(String(right.branchName || "Sin sede"), "es");
    if (branchCompare !== 0) return branchCompare;
    return String(left.name || "").localeCompare(String(right.name || ""), "es");
  });
  const activeConfigAdvisors = configAdvisors.filter((advisor: any) => Number(advisor.active) === 1);
  const inactiveConfigAdvisors = configAdvisors.filter((advisor: any) => Number(advisor.active) !== 1);
  const health = config.health || state.dataHealth || {};

  React.useEffect(() => {
    setSettings({
      evo_base_url: state.settings.evo_base_url || "",
      evo_dns: state.settings.evo_dns || "",
      evo_api_key: "",
      groq_api_key: "",
      groq_model: state.settings.groq_model || "llama-3.3-70b-versatile"
    });
  }, [state.settings.evo_base_url, state.settings.evo_dns, state.settings.groq_model]);

  async function requestJson(url: string, options: RequestInit = {}) {
    const res = await fetch(url, options);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || json.userMessage || "No se pudo completar la accion");
    return json;
  }

  async function loadQueryUsers() {
    const json = await requestJson("/api/query-users");
    setQueryUsers(json.users || []);
    setQueryUsersLoaded(true);
  }

  React.useEffect(() => {
    if (configTab === "queryUsers" && !queryUsersLoaded) {
      loadQueryUsers().catch((error) => setNotice(error.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configTab]);

  async function copyToClipboard(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(successMessage);
    } catch {
      setNotice("No se pudo copiar automaticamente. Copia manualmente: " + text);
    }
  }

  function credentialsText(user: any, pin: string) {
    return [
      "Plataforma de consulta DashCom",
      `Link: ${consultaLink}`,
      `Usuario: ${user.username}`,
      `PIN: ${pin}`
    ].join("\n");
  }

  async function createQueryUser() {
    if (!queryUserForm.name.trim() || !queryUserForm.username.trim()) return;
    if (queryUserForm.role === "asesor" && !queryUserForm.advisorId) {
      setNotice("Selecciona el asesor para este acceso");
      return;
    }
    if (queryUserForm.role === "lider_sede" && !queryUserForm.branchId) {
      setNotice("Selecciona la sede para este acceso");
      return;
    }
    const json = await requestJson("/api/query-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queryUserForm)
    });
    setQueryUserForm({ name: "", username: "", role: "asesor", advisorId: "", branchId: "" });
    setLastIssuedPins((prev) => ({ ...prev, [json.user.id]: json.pin }));
    await loadQueryUsers();
    setNotice(`Usuario creado. PIN generado: ${json.pin}. Usa "Copiar datos" para compartirlo.`);
  }

  async function updateQueryUser(user: any, updates: Record<string, unknown>) {
    await requestJson(`/api/query-users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    await loadQueryUsers();
  }

  async function regeneratePin(user: any) {
    if (!window.confirm(`Regenerar el PIN de ${user.name}? El PIN anterior dejara de funcionar.`)) return;
    const json = await requestJson(`/api/query-users/${user.id}/regenerate-pin`, { method: "POST" });
    setLastIssuedPins((prev) => ({ ...prev, [user.id]: json.pin }));
    setNotice(`PIN regenerado para ${user.name}.`);
  }

  async function copyUserCredentials(user: any) {
    const pin = lastIssuedPins[user.id];
    if (!pin) {
      setNotice(`Regenera el PIN de ${user.name} para poder copiarlo (no se guarda en texto plano).`);
      return;
    }
    await copyToClipboard(credentialsText(user, pin), `Datos de ${user.name} copiados al portapapeles.`);
  }

  async function removeQueryUser(user: any) {
    if (!window.confirm(`Eliminar el acceso de consulta de ${user.name}?`)) return;
    await requestJson(`/api/query-users/${user.id}`, { method: "DELETE" });
    setNotice("Acceso de consulta eliminado");
    await loadQueryUsers();
  }

  async function saveSettings() {
    await requestJson("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: settings })
    });
    setNotice("Integraciones guardadas");
    await onReload();
  }

  async function addBranch() {
    if (!branchForm.displayName.trim()) return;
    await requestJson("/api/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(branchForm)
    });
    setBranchForm({ code: "", displayName: "" });
    setNotice("Sede creada");
    await onReload();
  }

  async function updateBranch(branch: any, updates: Record<string, unknown>) {
    await requestJson(`/api/branches/${branch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: branch.code, displayName: branch.displayName, active: Number(branch.active) === 1, ...updates })
    });
    setNotice("Sede actualizada");
    await onReload();
  }

  async function removeBranch(branch: any) {
    if (!window.confirm(`Eliminar o desactivar la sede ${branch.displayName}?`)) return;
    const json = await requestJson(`/api/branches/${branch.id}`, { method: "DELETE" });
    setNotice(json.message || "Sede eliminada");
    await onReload();
  }

  async function addAdvisor() {
    if (!advisorForm.name.trim()) return;
    await requestJson("/api/advisors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: advisorForm.name, branchId: advisorForm.branchId || null })
    });
    setAdvisorForm({ name: "", branchId: "" });
    setNotice("Asesor creado");
    await onReload();
  }

  async function updateAdvisor(advisor: any, updates: Record<string, unknown>) {
    await requestJson(`/api/advisors/${advisor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: advisor.name,
        branchId: advisor.branchId || null,
        active: Number(advisor.active) === 1,
        excludedFromCommissions: Number(advisor.excludedFromCommissions || 0) === 1,
        inactiveSince: advisor.inactiveSince || "",
        inactiveReason: advisor.inactiveReason || "",
        ...updates
      })
    });
    setNotice("Asesor actualizado");
    await onReload();
  }

  async function removeAdvisor(advisor: any) {
    if (!window.confirm(`Eliminar o desactivar a ${advisorDisplayName(advisor.name)}?`)) return;
    const json = await requestJson(`/api/advisors/${advisor.id}`, { method: "DELETE" });
    setNotice(json.message || "Asesor eliminado");
    await onReload();
  }

  async function reassignInactiveSales(advisor: any) {
    if (!window.confirm(`Reasignar ventas nuevas de ${advisorDisplayName(advisor.name)} al asesor activo sugerido de cada sede?`)) return;
    const json = await requestJson(`/api/advisors/${advisor.id}/reassign-inactive-sales`, { method: "POST" });
    setNotice(`Reasignadas ${json.updated} ventas. Sin reasignar: ${json.skipped?.length || 0}`);
    await onReload();
  }

  async function resolveError(error: any) {
    await requestJson(`/api/debug/errors/${error.id}/resolve`, { method: "POST" });
    setNotice(`Error ${error.code} marcado como revisado`);
    await onReload();
  }

  async function syncEvo() {
    setNotice("Sincronizando EVO...");
    const res = await fetch("/api/evo/sync", { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "No se pudo sincronizar");
    setNotice(`EVO importó ${json.summary.rowsInserted} ventas nuevas. Duplicadas omitidas: ${json.summary.duplicatesSkipped}`);
    await onReload();
  }

  async function testGroq() {
    setNotice("Probando Groq...");
    const res = await fetch("/api/ai/health");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Groq no respondió");
    setNotice(`Groq conectado: ${json.model}`);
  }

  async function testEvo() {
    setNotice("Probando EVO...");
    const res = await fetch("/api/evo/health");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "EVO no respondió");
    setNotice(`EVO conectado: DNS ${json.dns}. Ventas reconocidas en prueba: ${json.itemsRecognized}`);
  }

  function renderAdvisorRows(rows: any[]) {
    return (
      <div className="advisor-config-table">
        {rows.map((advisor: any) => {
          const inactive = Number(advisor.active) !== 1;
          return (
            <article key={advisor.id} className={`advisor-config-row ${inactive ? "inactive" : ""} ${advisor.inactiveAlert ? "alert" : ""}`}>
              <div className="advisor-row-main">
                <strong>{advisorDisplayName(advisor.name)}</strong>
                <span>{advisor.branchName}</span>
              </div>
              <span>{advisor.salesRows} ventas</span>
              <span>{currency(advisor.sales || 0)}</span>
              <div className="advisor-row-status">
                {inactive ? <span className="retired-badge">Inactivo</span> : <span className="active-badge">Activo</span>}
                {advisor.inactiveAlert ? <span className="data-alert-badge">{advisor.inactiveAlert.rows} nuevas</span> : null}
              </div>
              {advisor.inactiveAlert ? (
                <button className="warning-action" title="Reasignar ventas" onClick={() => reassignInactiveSales(advisor).catch((error) => setNotice(error.message))}>Reasignar</button>
              ) : <span />}
              <select value={advisor.branchId || ""} onChange={(event) => updateAdvisor(advisor, { branchId: event.target.value || null }).catch((error) => setNotice(error.message))}>
                <option value="">Sin sede</option>
                {configBranches.map((branch: any) => (
                  <option key={branch.id} value={branch.id}>{branch.displayName}</option>
                ))}
              </select>
              <label className="toggle-row">
                <input type="checkbox" checked={!inactive} onChange={(event) => updateAdvisor(advisor, { active: event.target.checked }).catch((error) => setNotice(error.message))} />
                Activo
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={Number(advisor.excludedFromCommissions || 0) === 1} onChange={(event) => updateAdvisor(advisor, { excludedFromCommissions: event.target.checked }).catch((error) => setNotice(error.message))} />
                Excluir
              </label>
              <button className="danger-light" title="Eliminar asesor" onClick={() => removeAdvisor(advisor).catch((error) => setNotice(error.message))}>Borrar</button>
            </article>
          );
        })}
      </div>
    );
  }

  function advisorBranchGroups(rows: any[]) {
    const groups = rows.reduce((result: Record<string, any[]>, advisor: any) => {
      const branchName = advisor.branchName || "Sin sede";
      result[branchName] = result[branchName] || [];
      result[branchName].push(advisor);
      return result;
    }, {});

    return Object.entries(groups)
      .sort(([leftBranch], [rightBranch]) => leftBranch.localeCompare(rightBranch, "es"))
      .map(([branchName, advisors]) => ({
        branchName,
        advisors: advisors.sort((left: any, right: any) => {
          const alertCompare = Number(Boolean(right.inactiveAlert)) - Number(Boolean(left.inactiveAlert));
          if (alertCompare !== 0) return alertCompare;
          return String(left.name || "").localeCompare(String(right.name || ""), "es");
        })
      }));
  }

  function renderAdvisorBranchGroups(rows: any[], inactive?: boolean) {
    return (
      <div className="advisor-branch-groups">
        {advisorBranchGroups(rows).map((group) => (
          <section className={`advisor-branch-group ${inactive ? "inactive" : ""}`} key={group.branchName}>
            <header>
              <strong>{group.branchName}</strong>
              <span>{group.advisors.length} asesores</span>
            </header>
            {renderAdvisorRows(group.advisors)}
          </section>
        ))}
      </div>
    );
  }

  function branchTargetLabel(target: any) {
    if (!target?.loaded) return "-";
    return target.meta1 > 0 ? compactCurrency(target.meta1) : "$0";
  }

  return (
    <div className="view">
      <section className="panel config-panel">
        <div className="panel-title"><h2>Configuración de la plataforma</h2><Settings size={18} /></div>
        <div className="config-tabs" role="tablist" aria-label="Configuración">
          <button className={configTab === "branches" ? "active" : ""} onClick={() => setConfigTab("branches")}>Sedes</button>
          <button className={configTab === "targets" ? "active" : ""} onClick={() => setConfigTab("targets")}>Metas</button>
          <button className={configTab === "advisors" ? "active" : ""} onClick={() => setConfigTab("advisors")}>Asesores</button>
          <button className={configTab === "commissions" ? "active" : ""} onClick={() => setConfigTab("commissions")}>Mecánica de comisiones</button>
          <button className={configTab === "integrations" ? "active" : ""} onClick={() => setConfigTab("integrations")}>Groq y EVO</button>
          <button className={configTab === "queryUsers" ? "active" : ""} onClick={() => setConfigTab("queryUsers")}>Modo consulta</button>
          <button className={configTab === "health" ? "active" : ""} onClick={() => setConfigTab("health")}>Salud de datos</button>
          <button className={configTab === "debug" ? "active" : ""} onClick={() => setConfigTab("debug")}>Debug</button>
        </div>

        {configTab === "branches" ? (
          <div className="config-section">
            <div className="config-add-row">
              <input value={branchForm.displayName} onChange={(event) => setBranchForm({ ...branchForm, displayName: event.target.value })} placeholder="Nombre de nueva sede" />
              <input value={branchForm.code} onChange={(event) => setBranchForm({ ...branchForm, code: event.target.value })} placeholder="Código opcional" />
              <button onClick={() => addBranch().catch((error) => setNotice(error.message))}>Crear sede</button>
            </div>
            <div className="branch-config-table-wrap">
              <table className="branch-config-table">
                <thead>
                  <tr>
                    <th>Sede</th>
                    <th>Código</th>
                    <th>Estado</th>
                    <th className="num">Ases.</th>
                    <th className="num">Reg.</th>
                    <th className="num">Venta hist.</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {configBranches.map((branch: any) => (
                    <tr key={branch.id} className={Number(branch.active) === 1 ? "" : "inactive"}>
                      <td>
                        <input
                          aria-label={`Nombre de ${branch.displayName}`}
                          defaultValue={branch.displayName}
                          onBlur={(event) => event.currentTarget.value !== branch.displayName ? updateBranch(branch, { displayName: event.currentTarget.value }).catch((error) => setNotice(error.message)) : undefined}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Código de ${branch.displayName}`}
                          defaultValue={branch.code}
                          onBlur={(event) => event.currentTarget.value !== branch.code ? updateBranch(branch, { code: event.currentTarget.value }).catch((error) => setNotice(error.message)) : undefined}
                        />
                      </td>
                      <td>
                        <label className="compact-toggle">
                          <input type="checkbox" checked={Number(branch.active) === 1} onChange={(event) => updateBranch(branch, { active: event.target.checked }).catch((error) => setNotice(error.message))} />
                          {Number(branch.active) === 1 ? "Act." : "Inact."}
                        </label>
                      </td>
                      <td className="num">{wholeNumber(branch.advisorsCount)}</td>
                      <td className="num">{wholeNumber(branch.salesRows)}</td>
                      <td className="num-strong">{compactCurrency(branch.sales || 0)}</td>
                      <td>
                        <button className="danger-light" onClick={() => removeBranch(branch).catch((error) => setNotice(error.message))}>Borrar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {configTab === "targets" ? (
          <div className="config-section">
            <div className="branch-config-table-wrap">
              <table className="branch-config-table">
                <thead>
                  <tr>
                    <th>Sede</th>
                    <th className="num">Meta anual 2026</th>
                    {monthOptions.map((monthName) => <th className="num" key={monthName}>{monthName.slice(0, 3)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {configBranches.map((branch: any) => (
                    <tr key={branch.id} className={Number(branch.active) === 1 ? "" : "inactive"}>
                      <td>{branch.displayName}</td>
                      <td className="num">
                        <span>{branch.annualTarget2026 ? compactCurrency(branch.annualTarget2026) : "-"}</span>
                        <small>{branch.loadedTargetMonths2026 || 0}/12 meses</small>
                      </td>
                      {(branch.targets2026 || []).map((target: any) => (
                        <td key={target.month} className={target.loaded ? "month-target" : "month-target missing-target"} title={`${target.label} 2026: ${branchTargetLabel(target)}`}>
                          {branchTargetLabel(target)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {configTab === "advisors" ? (
          <div className="config-section">
            <div className="config-add-row">
              <input value={advisorForm.name} onChange={(event) => setAdvisorForm({ ...advisorForm, name: event.target.value })} placeholder="Nombre del asesor" />
              <select value={advisorForm.branchId} onChange={(event) => setAdvisorForm({ ...advisorForm, branchId: event.target.value })}>
                <option value="">Sede</option>
                {configBranches.filter((branch: any) => Number(branch.active) === 1).map((branch: any) => (
                  <option key={branch.id} value={branch.id}>{branch.displayName}</option>
                ))}
              </select>
              <button onClick={() => addAdvisor().catch((error) => setNotice(error.message))}>Crear asesor</button>
            </div>
            <div className="advisor-status-groups">
              <section>
                <header><strong>Activos</strong><span>{activeConfigAdvisors.length} asesores</span></header>
                {activeConfigAdvisors.length ? renderAdvisorBranchGroups(activeConfigAdvisors) : <Empty />}
              </section>
              <section className="inactive">
                <header><strong>Inactivos</strong><span>{inactiveConfigAdvisors.length} asesores</span></header>
                {inactiveConfigAdvisors.length ? renderAdvisorBranchGroups(inactiveConfigAdvisors, true) : <Empty />}
              </section>
            </div>
          </div>
        ) : null}

        {configTab === "commissions" ? (
          <div className="config-section">
            <CommissionMechanics state={state} />
          </div>
        ) : null}

        {configTab === "integrations" ? (
          <div className="config-section">
            <div className="integration-grid">
              <section>
                <h3>API EVO</h3>
                <input value={settings.evo_base_url} onChange={(event) => setSettings({ ...settings, evo_base_url: event.target.value })} placeholder="URL EVO" />
                <input value={settings.evo_dns} onChange={(event) => setSettings({ ...settings, evo_dns: event.target.value })} placeholder="DNS EVO" />
                <input value={settings.evo_api_key} onChange={(event) => setSettings({ ...settings, evo_api_key: event.target.value })} placeholder={evoConfigured ? "Token EVO configurado" : "Token EVO"} type="password" />
                <div className="button-row">
                  <button onClick={saveSettings}>Guardar</button>
                  <button onClick={() => testEvo().catch((error) => setNotice(error.message))}>Probar EVO</button>
                  <button onClick={() => syncEvo().catch((error) => setNotice(error.message))}>Sincronizar</button>
                </div>
              </section>
              <section>
                <h3>Groq</h3>
                <input value={settings.groq_api_key} onChange={(event) => setSettings({ ...settings, groq_api_key: event.target.value })} placeholder={groqConfigured ? "Clave API Groq configurada" : "Clave API Groq"} type="password" />
                <input value={settings.groq_model} onChange={(event) => setSettings({ ...settings, groq_model: event.target.value })} placeholder="Modelo Groq" />
                <div className="button-row">
                  <button onClick={saveSettings}>Guardar</button>
                  <button onClick={() => testGroq().catch((error) => setNotice(error.message))}>Probar Groq</button>
                </div>
              </section>
            </div>
            <div className="integration-status">
              <span className={groqConfigured ? "ok" : "pending"}>Groq: {groqConfigured ? "clave guardada" : "pendiente"}</span>
              <span className={evoConfigured ? "ok" : "pending"}>EVO: {evoConfigured ? "token guardado" : "pendiente"}</span>
              <span className={settings.evo_dns ? "ok" : "pending"}>DNS EVO: {settings.evo_dns || "pendiente"}</span>
            </div>
            <div className="integration-note">
              Las claves se guardan como secretas. Por seguridad no se muestran completas en pantalla; si escribes una nueva y guardas, reemplaza la anterior.
            </div>
          </div>
        ) : null}

        {configTab === "queryUsers" ? (
          <div className="config-section">
            <div className="integration-note">
              Cada acceso de consulta usa un usuario y un PIN propio. Un asesor solo ve sus propios numeros de venta; un lider de sede solo ve los numeros de su sede. El PIN se genera automaticamente y solo se muestra una vez: copialo y pasalo al usuario.
            </div>
            <div className="config-add-row">
              <span className="consulta-link-label">Link del panel de consulta</span>
              <input readOnly value={consultaLink} onFocus={(event) => event.currentTarget.select()} />
              <button onClick={() => copyToClipboard(consultaLink, "Link copiado al portapapeles")}>Copiar link</button>
            </div>
            <div className="config-add-row">
              <input value={queryUserForm.name} onChange={(event) => setQueryUserForm({ ...queryUserForm, name: event.target.value })} placeholder="Nombre a mostrar" />
              <input value={queryUserForm.username} onChange={(event) => setQueryUserForm({ ...queryUserForm, username: event.target.value })} placeholder="Usuario de acceso" />
              <select value={queryUserForm.role} onChange={(event) => setQueryUserForm({ ...queryUserForm, role: event.target.value, advisorId: "", branchId: "" })}>
                <option value="asesor">Asesor</option>
                <option value="lider_sede">Líder de sede</option>
              </select>
              {queryUserForm.role === "asesor" ? (
                <select value={queryUserForm.advisorId} onChange={(event) => setQueryUserForm({ ...queryUserForm, advisorId: event.target.value })}>
                  <option value="">Asesor</option>
                  {activeConfigAdvisors.map((advisor: any) => (
                    <option key={advisor.id} value={advisor.id}>{advisor.name}</option>
                  ))}
                </select>
              ) : (
                <select value={queryUserForm.branchId} onChange={(event) => setQueryUserForm({ ...queryUserForm, branchId: event.target.value })}>
                  <option value="">Sede</option>
                  {configBranches.filter((branch: any) => Number(branch.active) === 1).map((branch: any) => (
                    <option key={branch.id} value={branch.id}>{branch.displayName}</option>
                  ))}
                </select>
              )}
              <button onClick={() => createQueryUser().catch((error) => setNotice(error.message))}>Crear acceso y generar PIN</button>
            </div>
            <div className="branch-config-table-wrap">
              <table className="branch-config-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Alcance</th>
                    <th>Estado</th>
                    <th>Último ingreso</th>
                    <th>PIN</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {queryUsers.map((user: any) => (
                    <tr key={user.id} className={user.active ? "" : "inactive"}>
                      <td>{user.name}</td>
                      <td>{user.username}</td>
                      <td>{user.role === "lider_sede" ? "Líder de sede" : "Asesor"}</td>
                      <td>{user.role === "lider_sede" ? (user.branchName || "Sin sede") : (user.advisorName || "Sin asesor")}</td>
                      <td>
                        <label className="compact-toggle">
                          <input type="checkbox" checked={Boolean(user.active)} onChange={(event) => updateQueryUser(user, { active: event.target.checked }).catch((error) => setNotice(error.message))} />
                          {user.active ? "Act." : "Inact."}
                        </label>
                      </td>
                      <td>{user.lastLoginAt || "Sin ingresos"}</td>
                      <td>{lastIssuedPins[user.id] ? <code>{lastIssuedPins[user.id]}</code> : <small>Oculto</small>}</td>
                      <td>
                        <div className="button-row">
                          <button onClick={() => regeneratePin(user).catch((error) => setNotice(error.message))}>{lastIssuedPins[user.id] ? "Regenerar PIN" : "Generar PIN"}</button>
                          <button onClick={() => copyUserCredentials(user).catch((error) => setNotice(error.message))} disabled={!lastIssuedPins[user.id]}>Copiar datos</button>
                          <button className="danger-light" onClick={() => removeQueryUser(user).catch((error) => setNotice(error.message))}>Borrar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!queryUsers.length ? <Empty /> : null}
            </div>
          </div>
        ) : null}

        {configTab === "health" ? (
          <div className="config-section">
            <div className={`data-health-console ${health.ok ? "ok" : "review"}`}>
              <div className="health-light-wrap">
                <span className={`health-light green ${health.ok ? "on" : ""}`} />
                <span className={`health-light red ${health.ok ? "" : "on"}`} />
              </div>
              <div>
                <strong>{health.ok ? "Calidad de datos OK" : "Datos por revisar"}</strong>
                <p>{health.ok ? "Sedes, asesores e importaciones no tienen alertas críticas visibles." : "Hay señales que pueden afectar la lectura comercial o la liquidación."}</p>
              </div>
            </div>
            <div className="mini-grid">
              <article><span>Alertas calidad</span><strong>{health.qualityIssues || 0}</strong><small>Duplicados, faltantes o soporte EVO</small></article>
              <article><span>Ventas en inactivos</span><strong>{health.inactiveSalesRows || 0}</strong><small>Requieren reasignación</small></article>
              <article><span>Errores abiertos</span><strong>{health.unresolvedErrors || 0}</strong><small>Debug sin resolver</small></article>
              <article><span>Errores críticos</span><strong>{health.criticalErrors || 0}</strong><small>Estado técnico</small></article>
            </div>
          </div>
        ) : null}

        {configTab === "debug" ? (
          <div className="config-section">
            <div className="debug-codebook">
              <article><strong>DC-UPL</strong><span>Cargas de Excel y archivos.</span></article>
              <article><strong>DC-EVO</strong><span>Conexión o sincronización EVO.</span></article>
              <article><strong>DC-GRQ</strong><span>Conexión o respuesta Groq.</span></article>
              <article><strong>DC-CFG</strong><span>Configuración de sedes, asesores o credenciales.</span></article>
              <article><strong>DC-DATA</strong><span>Calidad de datos o reasignaciones.</span></article>
              <article><strong>DC-SRV</strong><span>Error interno de servidor.</span></article>
            </div>
            <div className="debug-list">
              {(config.debug?.errors || []).length ? config.debug.errors.map((error: any) => (
                <article key={error.id} className={`debug-card ${Number(error.statusCode || 0) >= 500 ? "critical" : ""}`}>
                  <header>
                    <strong>{error.code}</strong>
                    <span>{error.area} · {error.method} {error.path}</span>
                  </header>
                  <p>{error.userMessage}</p>
                  <code>{error.technicalMessage}</code>
                  <footer>
                    <small>{error.createdAt}</small>
                    <button onClick={() => resolveError(error).catch((err) => setNotice(err.message))}>Marcar revisado</button>
                  </footer>
                </article>
              )) : <Empty />}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

const historicalAdvisorCommissionLevels = [
  { level: "Meta 1", condition: "100% de Meta 1 asesor", rate: 0.004, bonus: 0 },
  { level: "Meta 2", condition: "100% de Meta 2 asesor", rate: 0.008, bonus: 0 },
  { level: "Meta 3", condition: "100% de Meta 3 asesor", rate: 0.012, bonus: 0 },
  { level: "Meta 4", condition: "100% de Meta 4 asesor", rate: 0.02, bonus: 500000 }
];

const advisorCommissionLevels = [
  { level: "Meta 1", condition: "Alcanza Meta 1 asesor", rate: 0.004, bonus: 0 },
  { level: "Meta 2", condition: "Alcanza Meta 2 asesor", rate: 0.008, bonus: 0 },
  { level: "Meta 3", condition: "Alcanza Meta 3 asesor", rate: 0.012, bonus: 0 },
  { level: "Meta 4", condition: "Alcanza Meta 4 asesor", rate: 0.02, bonus: 500000 }
];

const directorCommissionLevels = [
  { level: "Meta 1", condition: "La sede alcanza Meta 1", bonus: 100000 },
  { level: "Meta 2", condition: "La sede alcanza Meta 2", bonus: 200000 },
  { level: "Meta 3", condition: "La sede alcanza Meta 3 o superior", bonus: 500000 }
];

function CommissionMechanics({ state }: { state: AppState }) {
  const topAdvisor = state.advisors.find((advisor: any) => advisor.sales > 0);
  const topBranch = state.branches.find((branch: any) => branch.sales > 0);
  return (
    <div className="commission-guide">
      <div className="guide-summary">
        <article>
          <span>Comisiones asesores</span>
          <strong>{currency(state.kpis.totalAdvisorCommissions)}</strong>
          <small>Suma final del mes filtrado</small>
        </article>
        <article>
          <span>Comisiones director</span>
          <strong>{currency(state.kpis.totalDirectorCommissions)}</strong>
          <small>Suma de bonos por sede</small>
        </article>
      </div>

      <div className="guide-block">
        <h3>1. Mecánica general</h3>
        <p>La plataforma identifica el nivel más alto alcanzado contra las metas del asesor y aplica el porcentaje de ese nivel sobre el monto total vendido.</p>
        <code>Comisión base = ventas totales x porcentaje del nivel alcanzado + bono fijo</code>
        <p>La evaluación de calidad y gestión se conserva para score y seguimiento, pero no multiplica la liquidación de comisiones.</p>
        <code>Comisión final = comisión base</code>
      </div>

      <div className="guide-block">
        <h3>2. Niveles de asesor</h3>
      </div>
      <div className="table-wrap small">
        <table>
          <thead>
            <tr><th>Nivel</th><th>Condición</th><th>Porcentaje</th><th>Bono fijo</th></tr>
          </thead>
          <tbody>
            {advisorCommissionLevels.map((item) => (
              <tr key={item.level}>
                <td>{item.level}</td>
                <td>{item.condition}</td>
                <td>{ratePercent(item.rate)}</td>
                <td>{currency(item.bonus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="guide-block">
        <h3>3. Metas por sede y asesor</h3>
        <p>Meta 1 de sede usa la rampa oficial 2026 cargada en la plataforma para cada sede y mes. Esa meta mensual es la referencia de liquidación de sede.</p>
        <code>Meta 1 sede = meta oficial del informe para la sede y el mes filtrado</code>
        <p>La Meta 1 del asesor se calcula dividiendo la meta oficial de la sede entre el conteo oficial de asesores definido para esa sede. Si no hay meta oficial para un periodo, la plataforma usa una meta motivacional basada en desempeño reciente como respaldo.</p>
        <code>Meta 1 asesor = Meta 1 sede oficial / conteo oficial de asesores</code>
        <p>El porcentaje se aplica al monto total vendido según la meta alcanzada. Al llegar a Meta 4 se suma el bono fijo de $500.000.</p>
      </div>

      <div className="guide-block">
        <h3>4. Composición de metas</h3>
        <p>Meta 2 y Meta 3 siguen los escalones del archivo de metas, y Meta 4 se calcula como Meta 3 por 120%.</p>
        <code>Meta 1 oficial · Meta 2/3 escalonadas · Meta 4 = Meta 3 x 120%</code>
      </div>

      <div className="guide-block">
        <h3>5. Comisión director</h3>
        <p>Tu comisión se calcula por sede. Cada sede se evalúa contra sus metas del mes. Si una sede llega a Meta 1, Meta 2 o Meta 3, genera el bono fijo indicado. El total del director es la suma de los bonos de todas las sedes.</p>
      </div>
      <div className="table-wrap small">
        <table>
          <thead>
            <tr><th>Nivel sede</th><th>Condición</th><th>Bono director</th></tr>
          </thead>
          <tbody>
            {directorCommissionLevels.map((item) => (
              <tr key={item.level}>
                <td>{item.level}</td>
                <td>{item.condition}</td>
                <td>{currency(item.bonus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="guide-block">
        <h3>6. Comisión y score</h3>
        <p>La comisión paga el resultado económico según metas. La evaluación se puede editar y se conserva para score y seguimiento comercial, junto con avance a Meta 1, avance a Meta 4, conversiones y descuentos.</p>
      </div>

      <div className="example-grid">
        {topAdvisor ? (
          <article>
            <h3>Ejemplo actual de asesor</h3>
            <strong>{topAdvisor.name}</strong>
            <span>{topAdvisor.branchName}</span>
            <div className="metric-row"><span>Ventas mes</span><strong>{currency(topAdvisor.sales)}</strong></div>
            <div className="metric-row"><span>Nivel</span><strong>{topAdvisor.commission.level}</strong></div>
            <div className="metric-row"><span>Comisión final</span><strong>{currency(topAdvisor.commission.finalCommission)}</strong></div>
          </article>
        ) : null}
        {topBranch ? (
          <article>
            <h3>Ejemplo actual de sede</h3>
            <strong>{topBranch.name}</strong>
            <span>Director</span>
            <div className="metric-row"><span>Ventas mes</span><strong>{currency(topBranch.sales)}</strong></div>
            <div className="metric-row"><span>Nivel</span><strong>{topBranch.directorCommission.level}</strong></div>
            <div className="metric-row"><span>Bono director</span><strong>{currency(topBranch.directorCommission.bonus)}</strong></div>
          </article>
        ) : null}
      </div>
    </div>
  );
}

function Competitors({ state, year, month, onReload, setNotice }: { state: AppState; year: number; month: number; onReload: () => Promise<void>; setNotice: (value: string) => void }) {
  const competitors: any[] = state.competitors ?? [];
  const branches: any[] = state.branches ?? [];
  const [form, setForm] = React.useState({ name: "", brand: "", zone: "", branchId: "", segment: "Low cost" });
  const [snapshotFor, setSnapshotFor] = React.useState<number | null>(null);
  const [snapshot, setSnapshot] = React.useState({ monthlyPrice: "", enrollmentFee: "", promo: "", services: "", source: "" });
  const [historyFor, setHistoryFor] = React.useState<number | null>(null);

  const monthlyPlanPrices = (state.plans ?? [])
    .filter((plan: any) => Number(plan.active ?? 1) === 1 && Number(plan.cost_per_month || 0) > 0)
    .map((plan: any) => Number(plan.cost_per_month));
  const ourMonthlyAvg = monthlyPlanPrices.length
    ? monthlyPlanPrices.reduce((sum: number, value: number) => sum + value, 0) / monthlyPlanPrices.length
    : 0;

  const zonesCovered = new Set(competitors.map((item) => String(item.zone || "").trim()).filter(Boolean)).size;
  const freshCount = competitors.filter((item) => !item.stale).length;
  const withPrice = competitors.filter((item) => Number(item.latest?.monthly_price || 0) > 0);
  const competitorAvg = withPrice.length
    ? withPrice.reduce((sum, item) => sum + Number(item.latest.monthly_price), 0) / withPrice.length
    : 0;
  const priceGap = ourMonthlyAvg > 0 && competitorAvg > 0 ? (ourMonthlyAvg - competitorAvg) / competitorAvg : null;
  const periodLabel = `${monthOptions[month - 1]} ${year}`;

  async function addCompetitor() {
    if (!form.name.trim()) return;
    const res = await fetch("/api/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, branchId: form.branchId || null })
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setNotice(json.error || "No se pudo crear el competidor.");
      return;
    }
    setForm({ name: "", brand: "", zone: "", branchId: "", segment: "Low cost" });
    setNotice("Competidor registrado. Ahora registra su primer dato de precios.");
    await onReload();
  }

  async function saveSnapshot(competitorId: number) {
    const res = await fetch(`/api/competitors/${competitorId}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, ...snapshot })
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setNotice(json.error || "No se pudo guardar el dato de competencia.");
      return;
    }
    setSnapshotFor(null);
    setSnapshot({ monthlyPrice: "", enrollmentFee: "", promo: "", services: "", source: "" });
    setNotice(`Dato de competencia guardado para ${periodLabel}.`);
    await onReload();
  }

  async function removeCompetitor(competitorId: number, name: string) {
    if (!window.confirm(`¿Eliminar a ${name} y todo su historial de seguimiento?`)) return;
    await fetch(`/api/competitors/${competitorId}`, { method: "DELETE" });
    await onReload();
  }

  function openSnapshotForm(competitor: any) {
    setHistoryFor(null);
    setSnapshotFor(competitor.id);
    setSnapshot({
      monthlyPrice: competitor.latest?.monthly_price ? String(competitor.latest.monthly_price) : "",
      enrollmentFee: competitor.latest?.enrollment_fee ? String(competitor.latest.enrollment_fee) : "",
      promo: competitor.latest?.promo || "",
      services: competitor.latest?.services || "",
      source: ""
    });
  }

  return (
    <div className="view">
      <div className="kpi-grid">
        <Kpi label="Competidores monitoreados" value={String(competitors.length)} sub={`${zonesCovered} zonas cubiertas`} />
        <Kpi label="Actualizados (≤3 meses)" value={`${freshCount}/${competitors.length}`} sub="cadencia trimestral mínima" tone={freshCount === competitors.length && competitors.length > 0 ? "green" : "amber"} />
        <Kpi label="Precio promedio competencia" value={competitorAvg > 0 ? currency(competitorAvg) : "Sin datos"} sub={`${withPrice.length} con precio vigente`} tone="blue" />
        <Kpi
          label="Brecha vs nuestro precio"
          value={priceGap === null ? "Sin datos" : `${priceGap >= 0 ? "+" : ""}${Math.round(priceGap * 100)}%`}
          sub={ourMonthlyAvg > 0 ? `nuestro promedio ${currency(ourMonthlyAvg)}/mes` : "sin precio propio de referencia"}
          tone={priceGap !== null && priceGap > 0.15 ? "amber" : "green"}
        />
      </div>

      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Radar de competencia</h2>
            <span>Registro estructurado de precios, promociones y servicios por zona. Los datos se guardan sobre el periodo seleccionado arriba ({periodLabel}); actualiza mínimo cada trimestre.</span>
          </div>
          <Radar size={18} />
        </div>

        <div className="add-row">
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nombre del gimnasio (ej. Smart Fit Centro)" />
          <input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} placeholder="Cadena / marca" />
          <input value={form.zone} onChange={(event) => setForm({ ...form, zone: event.target.value })} placeholder="Zona o barrio" />
          <select value={form.branchId} onChange={(event) => setForm({ ...form, branchId: event.target.value })}>
            <option value="">Sede nuestra que compite</option>
            {branches.map((branch: any) => (
              <option key={branch.id} value={branch.id}>{branch.display_name || branch.name}</option>
            ))}
          </select>
          <select value={form.segment} onChange={(event) => setForm({ ...form, segment: event.target.value })}>
            <option>Low cost</option>
            <option>Medio</option>
            <option>Premium</option>
            <option>Boutique / estudio</option>
          </select>
          <button onClick={addCompetitor}>Agregar competidor</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Competidor</th>
                <th>Zona · Sede nuestra</th>
                <th>Segmento</th>
                <th>Precio mensual</th>
                <th>Δ vs registro anterior</th>
                <th>Inscripción</th>
                <th>Promoción vigente</th>
                <th>Última actualización</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {competitors.length === 0 && (
                <tr><td colSpan={9}>Aún no hay competidores registrados. Agrega Smart Fit, 24-7 y los gimnasios de cada zona para iniciar el seguimiento.</td></tr>
              )}
              {competitors.map((competitor) => (
                <React.Fragment key={competitor.id}>
                  <tr>
                    <td>
                      <strong>{competitor.name}</strong>
                      {competitor.brand ? <div><small>{competitor.brand}</small></div> : null}
                    </td>
                    <td>{[competitor.zone, competitor.branch_name].filter(Boolean).join(" · ") || "—"}</td>
                    <td>{competitor.segment || "—"}</td>
                    <td>{Number(competitor.latest?.monthly_price || 0) > 0 ? currency(Number(competitor.latest.monthly_price)) : "Sin dato"}</td>
                    <td>
                      {competitor.priceDelta === null || competitor.priceDelta === undefined
                        ? "—"
                        : competitor.priceDelta === 0
                          ? "Sin cambio"
                          : `${competitor.priceDelta > 0 ? "▲" : "▼"} ${currency(Math.abs(Number(competitor.priceDelta)))}`}
                    </td>
                    <td>{Number(competitor.latest?.enrollment_fee || 0) > 0 ? currency(Number(competitor.latest.enrollment_fee)) : "—"}</td>
                    <td>{competitor.latest?.promo || "—"}</td>
                    <td>
                      {competitor.latest ? competitor.latest.periodLabel : "Nunca"}
                      {" "}
                      <span className={`status ${competitor.stale ? "low" : "high"}`}>
                        {competitor.stale ? "Desactualizado" : "Vigente"}
                      </span>
                    </td>
                    <td>
                      <div className="add-row" style={{ margin: 0 }}>
                        <button onClick={() => openSnapshotForm(competitor)}>Actualizar</button>
                        <button onClick={() => { setSnapshotFor(null); setHistoryFor(historyFor === competitor.id ? null : competitor.id); }}>Historial</button>
                        <button onClick={() => removeCompetitor(competitor.id, competitor.name)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                  {snapshotFor === competitor.id && (
                    <tr>
                      <td colSpan={9}>
                        <div className="add-row">
                          <input type="number" value={snapshot.monthlyPrice} onChange={(event) => setSnapshot({ ...snapshot, monthlyPrice: event.target.value })} placeholder="Precio mensual" />
                          <input type="number" value={snapshot.enrollmentFee} onChange={(event) => setSnapshot({ ...snapshot, enrollmentFee: event.target.value })} placeholder="Inscripción" />
                          <input value={snapshot.promo} onChange={(event) => setSnapshot({ ...snapshot, promo: event.target.value })} placeholder="Promoción vigente" />
                          <input value={snapshot.services} onChange={(event) => setSnapshot({ ...snapshot, services: event.target.value })} placeholder="Servicios (clases, piscina, app...)" />
                          <input value={snapshot.source} onChange={(event) => setSnapshot({ ...snapshot, source: event.target.value })} placeholder="Fuente (web, visita, llamada)" />
                          <button onClick={() => saveSnapshot(competitor.id)}>Guardar {periodLabel}</button>
                          <button onClick={() => setSnapshotFor(null)}>Cancelar</button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {historyFor === competitor.id && (
                    <tr>
                      <td colSpan={9}>
                        {competitor.history?.length ? (
                          <div className="table-wrap small">
                            <table>
                              <thead>
                                <tr><th>Periodo</th><th>Precio mensual</th><th>Inscripción</th><th>Promoción</th><th>Servicios</th><th>Fuente</th></tr>
                              </thead>
                              <tbody>
                                {competitor.history.map((row: any) => (
                                  <tr key={row.id}>
                                    <td>{row.periodLabel}</td>
                                    <td>{Number(row.monthly_price || 0) > 0 ? currency(Number(row.monthly_price)) : "—"}</td>
                                    <td>{Number(row.enrollment_fee || 0) > 0 ? currency(Number(row.enrollment_fee)) : "—"}</td>
                                    <td>{row.promo || "—"}</td>
                                    <td>{row.services || "—"}</td>
                                    <td>{row.source || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <span>Sin historial: registra el primer dato con "Actualizar".</span>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Todos({ state, onReload }: { state: AppState; onReload: () => Promise<void> }) {
  const [title, setTitle] = React.useState("");
  async function addTodo() {
    if (!title.trim()) return;
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title })
    });
    setTitle("");
    await onReload();
  }
  async function setStatus(id: number, status: string) {
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    await onReload();
  }
  return (
    <div className="view">
      <section className="panel">
        <div className="panel-title"><h2>Tareas</h2><CheckSquare size={18} /></div>
        <div className="add-row">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nueva tarea" />
          <button onClick={addTodo}>Crear</button>
        </div>
        <div className="todo-list">
          {state.todos.map((todo: any) => (
            <article key={todo.id} className={`todo ${todo.status === "Hecho" ? "done" : ""}`}>
              <button title="Pendiente" onClick={() => setStatus(todo.id, todo.status === "Hecho" ? "Pendiente" : "Hecho")}>
                <CheckSquare size={18} />
              </button>
              <div>
                <strong>{todo.title}</strong>
                <span>{displayArea(todo.area)} · {todo.priority}</span>
              </div>
              <small>{displayStatus(todo.status)}</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) return "Sin registros todavia";
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function ConsultaLogin({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [username, setUsername] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/panel/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "No se pudo iniciar sesion");
      await onSuccess();
    } catch (err: any) {
      setError(err.message || "No se pudo iniciar sesion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="consulta-login">
      <form className="consulta-login-card" onSubmit={submit}>
        <div className="brand">
          <BarChart3 size={26} />
          <div>
            <strong>DashCom</strong>
            <span>Panel de consulta</span>
          </div>
        </div>
        <p>Ingresa tu usuario y PIN de consulta para ver tu rendimiento.</p>
        <label htmlFor="consulta-username">Usuario</label>
        <input
          id="consulta-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          autoFocus
          required
        />
        <label htmlFor="consulta-pin">PIN</label>
        <input
          id="consulta-pin"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={8}
          required
        />
        <button type="submit" disabled={loading || !username.trim() || !pin.trim()}>
          {loading ? "Ingresando..." : "Consultar"}
        </button>
        {error ? <div className="error">{error}</div> : null}
      </form>
    </div>
  );
}

function ConsultaAdvisorCard({ advisor, readOnly = true }: { advisor: any; readOnly?: boolean }) {
  const nextGoal = nextAdvisorGoal(advisor);
  const targets = advisor.target
    ? [
        ["Meta 1", advisor.target.meta1],
        ["Meta 2", advisor.target.meta2],
        ["Meta 3", advisor.target.meta3],
        ["Meta 4", advisor.target.meta4]
      ]
    : [];
  return (
    <article className={`advisor-card${readOnly ? " consulta-readonly" : ""}`}>
      <header>
        <div>
          <strong>{advisorDisplayName(advisor.name)}</strong>
          <span>{advisor.branchName}</span>
        </div>
        <div className="advisor-badges">
          <span className={scoreClass(advisor.score?.status)}>{scoreValue(advisor.score)}</span>
          <small>{advisor.commission?.level}</small>
        </div>
      </header>

      <div className="advisor-metrics">
        <div><span>Ventas mes</span><strong>{currency(advisor.sales)}</strong></div>
        <div><span>Meta hoy</span><strong>{currency(advisor.dailyGoal)}</strong></div>
        <div><span>Debe llevar</span><strong>{currency(advisor.expectedSalesToDate)}</strong></div>
        <div><span>{advisor.monthlyGoalLabel || "Meta vigente"}</span><strong>{currency(advisor.monthlyGoal)}</strong></div>
        <div><span>Comisión</span><strong>{currency(advisor.commission?.finalCommission || 0)}</strong></div>
        <div><span>Ticket / registros</span><strong>{wholeNumber(advisor.rows)}</strong></div>
      </div>

      <div className="goal-progress">
        <div className="goal-progress-head">
          <span>Avance a {nextGoal.label}</span>
          <strong>{percent(nextGoal.progress)}</strong>
        </div>
        <Progress value={nextGoal.progress} />
        <small>Faltan {currency(nextGoal.missing)} para {nextGoal.label}. Nivel actual: {advisor.commission?.level || "Sin comisión"}.</small>
      </div>

      {targets.length ? (
        <div className="goal-grid">
          {targets.map(([label, amount]) => {
            const progressValue = safeRatio(advisor.sales, Number(amount));
            const missing = Math.max(Number(amount) - advisor.sales, 0);
            return (
              <div className={missing === 0 ? "reached" : ""} key={label}>
                <span>{label}</span>
                <strong>{currency(Number(amount))}</strong>
                <small>{percent(progressValue)} · falta {currency(missing)}</small>
              </div>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}

function ConsultaHistoryBars({ history }: { history: Array<{ year: number; month: number; revenue: number }> }) {
  if (!history.length) return <Empty />;
  const max = Math.max(...history.map((item) => item.revenue), 1);
  return (
    <div className="consulta-history">
      {history.map((item) => (
        <div className="consulta-history-row" key={`${item.year}-${item.month}`}>
          <span>{monthOptions[item.month - 1]?.slice(0, 3)} {item.year}</span>
          <div className="consulta-history-track">
            <div className="consulta-history-fill" style={{ width: `${Math.max(safeRatio(item.revenue, max) * 100, item.revenue > 0 ? 3 : 0)}%` }} />
          </div>
          <strong>{compactCurrency(item.revenue)}</strong>
        </div>
      ))}
    </div>
  );
}

function ConsultaPeriodBar({
  year,
  month,
  years,
  onYear,
  onMonth,
  onLogout,
  name,
  roleLabel
}: {
  year: number;
  month: number;
  years: number[];
  onYear: (value: number) => void;
  onMonth: (value: number) => void;
  onLogout: () => void;
  name: string;
  roleLabel: string;
}) {
  return (
    <header className="topbar consulta-topbar">
      <div>
        <h1>Panel de consulta</h1>
        <p>{name} · {roleLabel}</p>
      </div>
      <div className="actions">
        <select value={year} onChange={(event) => onYear(Number(event.target.value))}>
          {(years.length ? years : [year]).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={month} onChange={(event) => onMonth(Number(event.target.value))}>
          {monthOptions.map((item, index) => (
            <option key={item} value={index + 1}>{item}</option>
          ))}
        </select>
        <button className="logout" onClick={onLogout}>
          <LogOut size={18} />
          <span>Salir</span>
        </button>
      </div>
    </header>
  );
}

function ConsultaAdvisorPanel({ session, onLogout }: { session: any; onLogout: () => void }) {
  const initialPeriod = React.useMemo(currentPeriod, []);
  const [year, setYear] = React.useState(initialPeriod.year);
  const [month, setMonth] = React.useState(initialPeriod.month);
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/panel/advisor?year=${year}&month=${month}&_=${Date.now()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "No se pudo cargar tu informacion");
      setData(json);
      setError("");
    } catch (err: any) {
      setError(err.message || "No se pudo cargar tu informacion");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <ConsultaPeriodBar
        year={year}
        month={month}
        years={data?.period?.years || []}
        onYear={setYear}
        onMonth={setMonth}
        onLogout={onLogout}
        name={session.name}
        roleLabel="Asesor"
      />
      {error ? <div className="notice">{error}</div> : null}
      {loading && !data ? <div className="loader" /> : null}
      {data ? (
        <div className="view consulta-view">
          <div className="kpi-grid dashboard-kpi-grid">
            <Kpi label="Ventas del mes" value={currency(data.advisor.sales)} sub={`${wholeNumber(data.advisor.rows)} registros`} />
            <Kpi label="Comisión estimada" value={currency(data.advisor.commission?.finalCommission || 0)} sub={data.advisor.commission?.level} tone="green" />
            <Kpi label="Score" value={scoreValue(data.advisor.score)} sub={data.advisor.score?.status || ""} tone="amber" />
            <Kpi label="Debe llevar" value={currency(data.advisor.expectedSalesToDate)} sub="a la fecha de corte" tone="blue" />
          </div>

          <section className="panel">
            <div className="panel-title"><h2>Tu avance en {data.period.label} {data.period.year}</h2><Clock size={16} /></div>
            <ConsultaAdvisorCard advisor={data.advisor} />
            <small className="consulta-updated">Última actualización de tus datos: {formatUpdatedAt(data.lastUpdatedAt)}</small>
          </section>

          <section className="panel">
            <div className="panel-title"><h2>Últimos 6 meses</h2><TrendingUp size={16} /></div>
            <ConsultaHistoryBars history={data.history} />
          </section>
        </div>
      ) : null}
    </>
  );
}

function ConsultaBranchPanel({ session, onLogout }: { session: any; onLogout: () => void }) {
  const initialPeriod = React.useMemo(currentPeriod, []);
  const [year, setYear] = React.useState(initialPeriod.year);
  const [month, setMonth] = React.useState(initialPeriod.month);
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/panel/branch?year=${year}&month=${month}&_=${Date.now()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "No se pudo cargar la informacion de la sede");
      setData(json);
      setError("");
    } catch (err: any) {
      setError(err.message || "No se pudo cargar la informacion de la sede");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  React.useEffect(() => {
    load();
  }, [load]);

  const goalStage = data ? branchGoalStage(data.branch) : null;
  const advisors = (data?.advisors || []).slice().sort((left: any, right: any) => Number(right.sales || 0) - Number(left.sales || 0));

  return (
    <>
      <ConsultaPeriodBar
        year={year}
        month={month}
        years={data?.period?.years || []}
        onYear={setYear}
        onMonth={setMonth}
        onLogout={onLogout}
        name={session.name}
        roleLabel="Líder de sede"
      />
      {error ? <div className="notice">{error}</div> : null}
      {loading && !data ? <div className="loader" /> : null}
      {data ? (
        <div className="view consulta-view">
          <div className="kpi-grid dashboard-kpi-grid">
            <Kpi label="Ventas de la sede" value={currency(data.branch.sales)} sub={`${wholeNumber(data.branch.rows)} registros`} />
            <Kpi label="Avance a meta" value={goalStage ? percent(goalStage.progress) : "-"} sub={goalStage?.label} tone="green" />
            <Kpi label="Asesores con venta" value={wholeNumber(data.branch.advisorsWithSales)} sub={`de ${wholeNumber(data.branch.expectedAdvisors)} activos`} tone="blue" />
            <Kpi label="Score de sede" value={scoreValue(data.branch.score)} tone="amber" />
          </div>

          <section className="panel">
            <div className="panel-title"><h2>Metas de {data.branch.name}</h2><Building2 size={16} /></div>
            <div className="goal-grid">
              {branchTargetGoals(data.branch).map((goal) => {
                const progressValue = safeRatio(data.branch.sales, goal.amount);
                const missing = Math.max(goal.amount - data.branch.sales, 0);
                return (
                  <div className={missing === 0 ? "reached" : ""} key={goal.label}>
                    <span>{goal.label}</span>
                    <strong>{currency(goal.amount)}</strong>
                    <small>{percent(progressValue)} · falta {currency(missing)}</small>
                  </div>
                );
              })}
            </div>
            <small className="consulta-updated">Última actualización de los datos de la sede: {formatUpdatedAt(data.lastUpdatedAt)}</small>
          </section>

          <section className="panel">
            <div className="panel-title"><h2>Asesores de la sede</h2><Users size={16} /></div>
            <div className="advisor-list consulta-advisor-list">
              {advisors.map((advisor: any) => (
                <ConsultaAdvisorCard advisor={advisor} key={advisor.id} />
              ))}
              {!advisors.length ? <Empty /> : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function ConsultaApp() {
  const [session, setSession] = React.useState<any>(null);

  const loadSession = React.useCallback(async () => {
    const res = await fetch("/api/panel/session", { cache: "no-store" });
    if (!res.ok) {
      setSession(false);
      return;
    }
    const json = await res.json();
    setSession(json);
  }, []);

  React.useEffect(() => {
    loadSession().catch(() => setSession(false));
  }, [loadSession]);

  async function logout() {
    await fetch("/api/panel/logout", { method: "POST" }).catch(() => undefined);
    setSession(false);
  }

  if (session === null) {
    return <div className="boot">Cargando panel de consulta</div>;
  }

  if (!session) {
    return <ConsultaLogin onSuccess={loadSession} />;
  }

  return (
    <main className="app consulta-app">
      <section className="workspace consulta-workspace">
        {session.role === "lider_sede"
          ? <ConsultaBranchPanel session={session} onLogout={logout} />
          : <ConsultaAdvisorPanel session={session} onLogout={logout} />}
      </section>
    </main>
  );
}

const isConsultaRoute = window.location.pathname === "/consulta" || window.location.pathname.startsWith("/consulta/");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isConsultaRoute ? <ConsultaApp /> : <App />}
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  let refreshedByServiceWorker = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshedByServiceWorker) return;
    refreshedByServiceWorker = true;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      const applyWaitingWorker = () => registration.waiting?.postMessage({ type: "SKIP_WAITING" });
      const checkForUpdate = () => registration.update().then(applyWaitingWorker).catch(() => undefined);

      applyWaitingWorker();
      await checkForUpdate();

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
      window.addEventListener("focus", checkForUpdate);
    } catch {
      // La app debe seguir funcionando aunque el navegador bloquee SW.
    }
  });
}
