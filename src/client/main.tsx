import React from "react";
import ReactDOM from "react-dom/client";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Download,
  Dumbbell,
  FileText,
  FileSpreadsheet,
  LineChart,
  Megaphone,
  RefreshCcw,
  Settings,
  Sparkles,
  Upload,
  Users
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import "./styles.css";

type TabId = "dashboard" | "advisors" | "branches" | "marketing" | "board" | "direction" | "settings" | "todos";

type AppState = any;

const tabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: "dashboard", label: "Tablero", icon: BarChart3 },
  { id: "advisors", label: "Asesores", icon: Users },
  { id: "branches", label: "Sedes", icon: Building2 },
  { id: "marketing", label: "Mercadeo", icon: Megaphone },
  { id: "board", label: "Informes gerenciales", icon: ClipboardList },
  { id: "direction", label: "Dirección", icon: Sparkles },
  { id: "settings", label: "Configuración", icon: Settings },
  { id: "todos", label: "Tareas", icon: CheckSquare }
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

function percent(value: number) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function ratePercent(value: number) {
  return `${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0) * 100)}%`;
}

function compact(value: number) {
  return new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));
}

function safeRatio(numerator: number, denominator?: number | null) {
  if (!denominator || denominator <= 0) return 0;
  return Number(numerator || 0) / denominator;
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
  const parts = advisorDisplayName(value).split(" ").filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  if (parts.length === 3) return `${parts[0]} ${parts[2]}`;
  return `${parts[0]} ${parts[2]} ${parts[3]}`.trim();
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

function SplitTick({ x, y, payload }: any) {
  const lines = String(payload.value || "").split("\n");
  return (
    <g transform={`translate(${x},${y + 8})`}>
      <text textAnchor="middle" fill="#4d554f" fontSize={11}>
        {lines.map((line, index) => (
          <tspan key={line} x={0} dy={index === 0 ? 0 : 13}>{line}</tspan>
        ))}
      </text>
    </g>
  );
}

function AdvisorTick({ x, y, payload }: any) {
  return (
    <g transform={`translate(${x - 8},${y})`}>
      <text textAnchor="end" fill="#4d554f" fontSize={11}>
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

function Kpi({ label, value, sub, tone = "green" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={`kpi ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
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

function App() {
  const [tab, setTab] = React.useState<TabId>("dashboard");
  const [state, setState] = React.useState<AppState | null>(null);
  const [year, setYear] = React.useState(2026);
  const [month, setMonth] = React.useState(6);
  const [loading, setLoading] = React.useState(true);
  const [notice, setNotice] = React.useState("");
  const [exportOpen, setExportOpen] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/state?year=${year}&month=${month}`);
    const json = await res.json();
    setState(json);
    setLoading(false);
  }, [year, month]);

  React.useEffect(() => {
    load().catch((error) => {
      setNotice(error.message);
      setLoading(false);
    });
  }, [load]);

  async function uploadExcel(file: File) {
    const data = new FormData();
    data.append("file", file);
    setNotice("Importando Excel...");
    const res = await fetch("/api/import/sales-excel", { method: "POST", body: data });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "No se pudo importar");
    setNotice(`Importadas ${json.summary.rowsInserted} ventas nuevas por ${currency(json.summary.totalValue)}. Duplicadas omitidas: ${json.summary.duplicatesSkipped}`);
    await load();
  }

  if (!state && loading) {
    return <div className="boot">Cargando HYL Gym Dirección</div>;
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand">
          <Dumbbell size={24} />
          <div>
            <strong>HYL Gym</strong>
            <span>Dirección comercial</span>
          </div>
        </div>
        <nav>
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{tabs.find((item) => item.id === tab)?.label}</h1>
            <p>{state?.filters.selectedMonthName} {state?.filters.selectedYear}</p>
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
            <button title="Cargar Excel" onClick={() => fileInput.current?.click()}>
              <Upload size={18} />
              <span>Excel</span>
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
            {tab === "advisors" && <Advisors state={state} year={year} month={month} onReload={load} />}
            {tab === "branches" && <Branches state={state} />}
            {tab === "marketing" && <Marketing state={state} onReload={load} />}
            {tab === "board" && <BoardReports state={state} year={year} month={month} />}
            {tab === "direction" && <Direction state={state} year={year} month={month} onReload={load} setNotice={setNotice} />}
            {tab === "settings" && <Configuration state={state} onReload={load} setNotice={setNotice} />}
            {tab === "todos" && <Todos state={state} onReload={load} />}
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
          <button onClick={exportPdf} disabled={!selected.size}>Generar PDF</button>
        </footer>
      </section>
    </div>
  );
}

function Dashboard({ state }: { state: AppState }) {
  const branchChart = state.branches.slice(0, 8).map((branch: any) => ({
    ...branch,
    chartName: branchShortName(branch.name)
  }));
  const advisorChart = state.advisors.slice(0, 10).map((advisor: any) => ({
    ...advisor,
    chartName: advisorChartName(advisor.name),
    scoreText: `Score ${scoreValue(advisor.score)}`
  }));
  return (
    <div className="view">
      <div className="kpi-grid">
        <Kpi label="Ventas mes" value={currency(state.kpis.totalSales)} sub={`${state.kpis.salesRows} registros`} />
        <Kpi label="Ticket promedio" value={currency(state.kpis.avgTicket)} sub="ventas con valor" tone="amber" />
        <Kpi label="Progreso meta" value={percent(state.kpis.targetProgress)} sub={currency(state.kpis.totalTarget)} tone="blue" />
        <Kpi label="Comisiones" value={currency(state.kpis.totalAdvisorCommissions)} sub="asesores" tone="red" />
      </div>

      <div className="grid two">
        <section className="panel">
          <div className="panel-title">
            <h2>Ventas por sede</h2>
            <Building2 size={18} />
          </div>
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={branchChart} margin={{ top: 8, right: 8, bottom: 26, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="chartName" interval={0} tick={<SplitTick />} height={48} />
              <YAxis tickFormatter={compact} width={58} />
              <Tooltip formatter={(value) => currency(Number(value))} />
              <Bar dataKey="sales" radius={[4, 4, 0, 0]}>
                {branchChart.map((_: any, index: number) => (
                  <Cell key={index} fill={["#18715c", "#3467a7", "#c47b22", "#8a5a44", "#c84d36"][index % 5]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="panel">
          <div className="panel-title">
            <h2>Top asesores</h2>
            <Users size={18} />
          </div>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={advisorChart} layout="vertical" margin={{ top: 6, left: 52, right: 78, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={compact} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.16)]} />
              <YAxis dataKey="chartName" type="category" width={168} interval={0} tick={<AdvisorTick />} />
              <Tooltip formatter={(value) => currency(Number(value))} labelFormatter={(_, payload) => advisorDisplayName(payload?.[0]?.payload?.name || "")} />
              <Bar dataKey="sales" fill="#18715c" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="scoreText" position="right" fill="#202421" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      <section className="panel">
        <div className="panel-title">
          <h2>Calendario comercial</h2>
          <CalendarDays size={18} />
        </div>
        <CalendarHeatmap days={state.dailySales} />
      </section>
    </div>
  );
}

function CalendarHeatmap({ days }: { days: any[] }) {
  const byDay = new Map(days.map((item) => [item.day, item]));
  const max = Math.max(...days.map((item) => item.sales), 1);
  const count = Math.max(31, ...days.map((item) => item.day));
  return (
    <div className="calendar-grid">
      {Array.from({ length: count }, (_, index) => {
        const day = index + 1;
        const item = byDay.get(day);
        const alpha = item ? 0.18 + (item.sales / max) * 0.75 : 0.05;
        return (
          <div key={day} className="day" style={{ backgroundColor: `rgba(24, 113, 92, ${alpha})` }}>
            <strong>{day}</strong>
            <span>{item ? compact(item.sales) : "-"}</span>
          </div>
        );
      })}
    </div>
  );
}

function Advisors({ state, year, month, onReload }: { state: AppState; year: number; month: number; onReload: () => Promise<void> }) {
  const [editing, setEditing] = React.useState<number | null>(null);
  const [quality, setQuality] = React.useState("");
  const [admin, setAdmin] = React.useState("");

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
    <div className="view">
      <div className="kpi-grid">
        <Kpi label="Score prom." value={Math.round(state.kpis.averageAdvisorScore || 0).toString()} />
        <Kpi label="Comisiones asesores" value={currency(state.kpis.totalAdvisorCommissions)} tone="amber" />
        <Kpi label="Asesores activos" value={String(state.kpis.activeAdvisors)} tone="blue" />
        <Kpi label="Ventas año" value={currency(state.advisors.reduce((sum: number, advisor: any) => sum + advisor.yearlySales, 0))} tone="red" />
      </div>
      <section className="advisor-list">
        {state.advisors.map((advisor: any) => {
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
            <article className="advisor-card" key={advisor.id}>
              <header>
                <div>
                  <strong>{advisorDisplayName(advisor.name)}</strong>
                  <span>{advisor.branchName}</span>
                </div>
                <div className="advisor-badges">
                  <span className={scoreClass(advisor.score.status)}>{scoreValue(advisor.score)}</span>
                  <small>{advisor.commission.level}</small>
                </div>
              </header>

              <div className="advisor-metrics">
                <div><span>Ventas mes</span><strong>{currency(advisor.sales)}</strong></div>
                <div><span>Ventas año</span><strong>{currency(advisor.yearlySales)}</strong></div>
                <div><span>Meta diaria</span><strong>{currency(advisor.dailyGoal)}</strong></div>
                <div><span>Meta mes</span><strong>{currency(advisor.monthlyGoal)}</strong></div>
                <div><span>Meta anual</span><strong>{currency(advisor.annualGoal)}</strong></div>
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
                    <div key={label}>
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
                    : "Esquema histórico sin multiplicadores de evaluación."}
                </small>
                {editing === advisor.id ? (
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
                      setEditing(advisor.id);
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
      <div className="policy-note">
        <strong>{state.commissionPolicy?.label}</strong>
        <span>{state.commissionPolicy?.usesEvaluation ? "Las comisiones usan multiplicadores de calidad y gestión." : "Las comisiones de este período usan la bonificación histórica del Excel."}</span>
      </div>
    </div>
  );
}

function Branches({ state }: { state: AppState }) {
  return (
    <div className="view">
      <div className="kpi-grid">
        <Kpi label="Score sedes" value={Math.round(state.kpis.averageBranchScore || 0).toString()} />
        <Kpi label="Comision director" value={currency(state.kpis.totalDirectorCommissions)} tone="amber" />
        <Kpi label="Sedes con venta" value={String(state.kpis.activeBranches)} tone="blue" />
        <Kpi label="Meta total" value={currency(state.kpis.totalTarget)} tone="red" />
      </div>
      <div className="branch-grid">
        {state.branches.map((branch: any) => (
          <article className="branch-card" key={branch.id}>
            <header>
              <h2>{branch.name}</h2>
              <span className={scoreClass(branch.score.status)}>{branch.score.score === null ? "Pendiente" : Math.round(branch.score.score)}</span>
            </header>
            <div className="metric-row"><span>Ventas</span><strong>{currency(branch.sales)}</strong></div>
            <div className="metric-row"><span>Meta 1</span><strong>{branch.target ? currency(branch.target.meta1) : "Sin meta"}</strong></div>
            <Progress value={branch.score.progressMeta1} />
            <div className="metric-row"><span>Director</span><strong>{currency(branch.directorCommission.bonus)}</strong></div>
            <div className="metric-row"><span>Nivel</span><strong>{branch.directorCommission.level}</strong></div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Marketing({ state, onReload }: { state: AppState; onReload: () => Promise<void> }) {
  const [title, setTitle] = React.useState("");
  async function addCampaign() {
    if (!title.trim()) return;
    await fetch("/api/initiatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: "Marketing", type: "Campana", title, status: "Pendiente" })
    });
    setTitle("");
    await onReload();
  }
  return (
    <div className="view">
      <div className="grid two">
        <section className="panel">
          <div className="panel-title"><h2>Planes y precios</h2><FileSpreadsheet size={18} /></div>
          <div className="table-wrap small">
            <table>
              <thead><tr><th>Plan</th><th>Categoria</th><th>Precio</th><th>Ventas</th></tr></thead>
              <tbody>
                {state.plans.slice(0, 20).map((plan: any) => (
                  <tr key={plan.id}>
                    <td>{plan.name}</td>
                    <td>{plan.category}</td>
                    <td>{plan.cash_price ? currency(plan.cash_price) : "-"}</td>
                    <td>{currency(plan.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <div className="panel-title"><h2>Indicadores de mercadeo</h2><LineChart size={18} /></div>
          <ResponsiveContainer width="100%" height={280}>
            <ReLineChart data={state.monthlySales}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={compact} />
              <Tooltip formatter={(value) => currency(Number(value))} />
              <Line type="monotone" dataKey="sales" stroke="#18715c" strokeWidth={3} dot={{ r: 3 }} />
            </ReLineChart>
          </ResponsiveContainer>
        </section>
      </div>
      <section className="panel">
        <div className="panel-title"><h2>Campañas y estrategias</h2><Megaphone size={18} /></div>
        <div className="add-row">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nueva campaña" />
          <button onClick={addCampaign}>Crear</button>
        </div>
        <div className="initiative-list">
          {state.marketing.length ? state.marketing.slice(0, 24).map((item: any) => (
            <article key={item.id} className="initiative">
              <strong>{item.title}</strong>
              <span>{displayStatus(item.status)}</span>
              <small>{item.channel || item.type}</small>
            </article>
          )) : <Empty />}
        </div>
      </section>
    </div>
  );
}

function BoardReports({ state, year, month }: { state: AppState; year: number; month: number }) {
  const downloads = [
    { kind: "sales", label: "Ventas" },
    { kind: "branches", label: "Sedes" },
    { kind: "advisors", label: "Asesores" },
    { kind: "plans", label: "Planes" }
  ];
  return (
    <div className="view">
      <div className="download-row">
        {downloads.map((item) => (
          <a key={item.kind} href={`/api/export/${item.kind}.csv?year=${year}&month=${month}`}>
            <Download size={16} />
            {item.label} CSV
          </a>
        ))}
      </div>
      <div className="grid two">
        <ReportTable title="Por sede" rows={state.boardReports.byBranch} columns={["name", "sales", "rows"]} />
        <ReportTable title="Por asesor" rows={state.boardReports.byAdvisor.slice(0, 16)} columns={["name", "branchName", "sales"]} />
        <ReportTable title="Por plan" rows={state.boardReports.byPlan.slice(0, 16)} columns={["name", "sales", "rows"]} />
        <ReportTable title="Diario" rows={state.boardReports.byDay} columns={["day", "sales", "rows"]} />
      </div>
    </div>
  );
}

function ReportTable({ title, rows, columns }: { title: string; rows: any[]; columns: string[] }) {
  return (
    <section className="panel">
      <div className="panel-title"><h2>{title}</h2><ClipboardList size={18} /></div>
      <div className="table-wrap small">
        <table>
          <thead><tr>{columns.map((col) => <th key={col}>{columnLabel(col)}</th>)}</tr></thead>
          <tbody>
            {rows.length ? rows.map((row, index) => (
              <tr key={row.id ?? index}>
                {columns.map((col) => (
                  <td key={col}>{typeof row[col] === "number" && col !== "day" && col !== "rows" ? currency(row[col]) : String(row[col] ?? "")}</td>
                ))}
              </tr>
            )) : <tr><td colSpan={columns.length}><Empty /></td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Direction({ state, year, month, onReload, setNotice }: { state: AppState; year: number; month: number; onReload: () => Promise<void>; setNotice: (value: string) => void }) {
  const [prompt, setPrompt] = React.useState("Verifica duplicados, calidad de datos y dame 5 acciones comerciales para mejorar el rendimiento de asesores y sedes.");
  const [answer, setAnswer] = React.useState("");
  const [draft, setDraft] = React.useState({ type: "Requerimiento", title: "", notes: "" });
  const directionItems = state.initiatives.filter((item: any) => displayArea(item.area) === "Dirección");
  const requirements = directionItems.filter((item: any) => normalizeText(item.type).includes("REQUERIMIENTO"));
  const ideas = directionItems.filter((item: any) => normalizeText(item.type).includes("IDEA"));
  const directionPlans = directionItems.filter((item: any) => normalizeText(item.type).includes("PLAN"));

  async function askAi() {
    setAnswer("Pensando...");
    const res = await fetch("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, year, month })
    });
    const json = await res.json();
    if (!res.ok) {
      setAnswer(json.error || "Groq no respondió");
      return;
    }
    setAnswer(json.answer);
  }

  async function addDirectionItem() {
    if (!draft.title.trim()) return;
    await fetch("/api/initiatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        area: "Direccion",
        type: draft.type,
        title: draft.title,
        status: "Pendiente",
        notes: draft.notes
      })
    });
    setDraft({ type: "Requerimiento", title: "", notes: "" });
    await onReload();
  }

  return (
    <div className="view">
      <div className="grid two">
        <section className="panel">
          <div className="panel-title"><h2>Comisiones</h2><Sparkles size={18} /></div>
          <div className="metric-row"><span>Asesores</span><strong>{currency(state.kpis.totalAdvisorCommissions)}</strong></div>
          <div className="metric-row"><span>Director</span><strong>{currency(state.kpis.totalDirectorCommissions)}</strong></div>
          <div className="metric-row"><span>Venta total</span><strong>{currency(state.kpis.totalSales)}</strong></div>
          <Progress value={state.kpis.targetProgress} />
          <small className="muted-line">{state.commissionPolicy?.label}</small>
          <div className="mini-list">
            {state.branches.slice(0, 6).map((branch: any) => (
              <div key={branch.id} className="metric-row">
                <span>{branch.name}</span>
                <strong>{currency(branch.directorCommission.bonus)}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-title"><h2>Requerimientos, planes e ideas</h2><ClipboardList size={18} /></div>
          <div className="form-grid direction-form">
            <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>
              <option>Requerimiento</option>
              <option>Plan</option>
              <option>Idea</option>
            </select>
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Titulo" />
            <input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Notas o impacto esperado" />
            <button onClick={addDirectionItem}>Crear</button>
          </div>
          <div className="direction-columns">
            <DirectionColumn title="Requerimientos" items={requirements} />
            <DirectionColumn title="Planes" items={directionPlans} fallback={state.plans.slice(0, 6).map((plan: any) => ({ id: `plan-${plan.id}`, title: plan.name, status: currency(plan.sales), type: plan.category }))} />
            <DirectionColumn title="Ideas" items={ideas} />
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-title"><h2>Planes comerciales con tracción</h2><FileSpreadsheet size={18} /></div>
        <div className="plan-strip">
          {state.plans.slice(0, 10).map((plan: any) => (
            <article key={plan.id}>
              <strong>{plan.name}</strong>
              <span>{plan.category}</span>
              <small>{currency(plan.sales)} · Score {scoreValue(plan.score)}</small>
            </article>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>Calidad de datos y apoyo comercial</h2><Sparkles size={18} /></div>
        <div className="quality-grid">
          <div className="quality-card">
            <span>Duplicados</span>
            <strong>{state.quality.duplicateGroups.length + state.quality.naturalDuplicateGroups.length}</strong>
            <small>{state.quality.status}</small>
          </div>
          <div className="quality-card">
            <span>Llaves únicas</span>
            <strong>{state.quality.uniqueSaleKeys}</strong>
            <small>{state.quality.totalRows} ventas</small>
          </div>
          <div className="quality-card">
            <span>Sin asesor</span>
            <strong>{state.quality.orphanSales.missingAdvisor}</strong>
            <small>filas por revisar</small>
          </div>
          <div className="quality-card">
            <span>Valor cero</span>
            <strong>{state.quality.orphanSales.zeroValue}</strong>
            <small>filas por revisar</small>
          </div>
        </div>
        <div className="recommendation-list">
          {state.recommendations.slice(0, 5).map((item: any, index: number) => (
            <article key={`${item.title}-${index}`} className="recommendation">
              <strong>{item.title}</strong>
              <span>{item.priority}</span>
              <p>{item.detail}</p>
              <small>{item.metric}</small>
            </article>
          ))}
        </div>
        <div className="ai-box">
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          <button onClick={askAi}>Groq</button>
        </div>
        {answer ? <pre className="answer">{answer}</pre> : null}
      </section>
      <section className="panel">
        <div className="panel-title"><h2>Hoja de ruta operativa</h2><ClipboardList size={18} /></div>
        <div className="initiative-list">
          {state.initiatives.slice(0, 18).map((item: any) => (
            <article key={item.id} className="initiative">
              <strong>{item.title}</strong>
              <span>{displayStatus(item.status)}</span>
              <small>{displayArea(item.area)} · {item.type}</small>
            </article>
          ))}
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

function DirectionColumn({ title, items, fallback = [] }: { title: string; items: any[]; fallback?: any[] }) {
  const rows = items.length ? items : fallback;
  return (
    <div className="direction-column">
      <h3>{title}</h3>
      {rows.length ? rows.slice(0, 6).map((item: any) => (
        <article key={item.id}>
          <strong>{item.title}</strong>
          <span>{displayStatus(item.status)}</span>
          <small>{item.type || item.owner || ""}</small>
        </article>
      )) : <Empty />}
    </div>
  );
}

function Configuration({ state, onReload, setNotice }: { state: AppState; onReload: () => Promise<void>; setNotice: (value: string) => void }) {
  const [settings, setSettings] = React.useState({
    evo_base_url: state.settings.evo_base_url || "",
    evo_api_key: "",
    groq_api_key: "",
    groq_model: state.settings.groq_model || "llama-3.3-70b-versatile"
  });
  const [configTab, setConfigTab] = React.useState<"integrations" | "commissions">("integrations");
  const groqConfigured = state.settings.groq_api_key_configured === "true";
  const evoConfigured = state.settings.evo_api_key_configured === "true";

  React.useEffect(() => {
    setSettings({
      evo_base_url: state.settings.evo_base_url || "",
      evo_api_key: "",
      groq_api_key: "",
      groq_model: state.settings.groq_model || "llama-3.3-70b-versatile"
    });
  }, [state.settings.evo_base_url, state.settings.groq_model]);

  async function saveSettings() {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: settings })
    });
    setNotice("Integraciones guardadas");
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

  return (
    <div className="view">
      <section className="panel">
        <div className="panel-title"><h2>Configuración de la plataforma</h2><Settings size={18} /></div>
        <div className="config-tabs" role="tablist" aria-label="Configuración">
          <button className={configTab === "integrations" ? "active" : ""} onClick={() => setConfigTab("integrations")}>Integraciones</button>
          <button className={configTab === "commissions" ? "active" : ""} onClick={() => setConfigTab("commissions")}>Mecánica de comisiones</button>
        </div>
        {configTab === "integrations" ? (
          <>
            <div className="form-grid">
              <input value={settings.evo_base_url} onChange={(event) => setSettings({ ...settings, evo_base_url: event.target.value })} placeholder="URL EVO" />
              <input value={settings.evo_api_key} onChange={(event) => setSettings({ ...settings, evo_api_key: event.target.value })} placeholder={evoConfigured ? "Clave API EVO configurada" : "Clave API EVO"} type="password" />
              <input value={settings.groq_api_key} onChange={(event) => setSettings({ ...settings, groq_api_key: event.target.value })} placeholder={groqConfigured ? "Clave API Groq configurada" : "Clave API Groq"} type="password" />
              <input value={settings.groq_model} onChange={(event) => setSettings({ ...settings, groq_model: event.target.value })} placeholder="Modelo GROQ" />
            </div>
            <div className="integration-status">
              <span>Groq: {groqConfigured ? "configurado" : "pendiente"}</span>
              <span>EVO: {evoConfigured ? "configurado" : "pendiente"}</span>
            </div>
            <div className="button-row">
              <button onClick={saveSettings}>Guardar</button>
              <button onClick={() => syncEvo().catch((error) => setNotice(error.message))}>EVO</button>
            </div>
          </>
        ) : (
          <CommissionMechanics state={state} />
        )}
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
  { level: "Activación", condition: "Alcanza meta de activación", rate: 0.0015, bonus: 0 },
  { level: "Bronce", condition: "Alcanza meta bronce", rate: 0.0025, bonus: 0 },
  { level: "Plata", condition: "Alcanza meta plata", rate: 0.0035, bonus: 0 },
  { level: "Meta 1", condition: "Alcanza Meta 1", rate: 0.005, bonus: 0 },
  { level: "Meta 2", condition: "Alcanza Meta 2", rate: 0.008, bonus: 0 },
  { level: "Meta 3", condition: "Alcanza Meta 3", rate: 0.012, bonus: 0 },
  { level: "Meta 4", condition: "Alcanza Meta 4", rate: 0.02, bonus: 500000 }
];

const evaluationMultipliers = [
  { label: "Malo", score: 60, multiplier: 0.6 },
  { label: "Regular", score: 75, multiplier: 0.85 },
  { label: "Bueno", score: 85, multiplier: 1 },
  { label: "Excelente", score: 100, multiplier: 1.15 }
];

const directorCommissionLevels = [
  { level: "Meta 1", condition: "La sede alcanza Meta 1", bonus: 100000 },
  { level: "Meta 2", condition: "La sede alcanza Meta 2", bonus: 200000 },
  { level: "Meta 3", condition: "La sede alcanza Meta 3 o más", bonus: 500000 }
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
        <h3>1. Esquema vigente del mes filtrado</h3>
        <p>{state.commissionPolicy?.label}. La plataforma identifica el nivel más alto alcanzado contra las metas del asesor y calcula una comisión base.</p>
        <code>Comisión base = ventas del asesor x porcentaje del nivel + bono fijo</code>
        <p>Desde julio se aplican dos multiplicadores: calidad y gestión administrativa. En enero-junio se respeta la bonificación histórica del Excel sin multiplicadores.</p>
        <code>Comisión final = comisión base x multiplicador calidad x multiplicador gestión</code>
      </div>

      <div className="guide-block">
        <h3>2. Bonificación histórica enero-junio 2026</h3>
      </div>
      <div className="table-wrap small">
        <table>
          <thead>
            <tr><th>Nivel</th><th>Condición</th><th>Porcentaje</th><th>Bono fijo</th></tr>
          </thead>
          <tbody>
            {historicalAdvisorCommissionLevels.map((item) => (
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
        <h3>3. Nuevo esquema desde julio 2026</h3>
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
        <h3>4. Ajuste por calidad y gestión</h3>
        <p>La evaluación mensual impacta la comisión. Si el asesor tiene calidad y gestión excelentes, la comisión se multiplica dos veces por 1,15. Si tiene una evaluación baja, se reduce.</p>
      </div>
      <div className="mini-grid">
        {evaluationMultipliers.map((item) => (
          <article key={item.label}>
            <strong>{item.label}</strong>
            <span>Puntaje {item.score}</span>
            <small>Multiplica x {item.multiplier}</small>
          </article>
        ))}
      </div>

      <div className="guide-block">
        <h3>5. Cómo se calculan tus comisiones como director</h3>
        <p>Tu comisión se calcula por sede. Cada sede se evalúa contra sus metas del mes. Si una sede llega a Meta 1, Meta 2 o Meta 3, genera un bono fijo. El total del director es la suma de los bonos de todas las sedes.</p>
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
        <h3>6. Diferencia entre comisión y score</h3>
        <p>La comisión paga el resultado económico según metas y evaluaciones. El score acumula componentes de salud comercial: avance a Meta 1, avance a Meta 4, calidad, gestión, conversiones y descuentos. Sirve para priorizar seguimiento y acciones comerciales.</p>
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
