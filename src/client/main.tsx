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
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import "./styles.css";

type TabId = "dashboard" | "advisors" | "branches" | "marketing" | "board" | "direction" | "todos";

type AppState = any;

const tabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: "dashboard", label: "Tablero", icon: BarChart3 },
  { id: "advisors", label: "Asesores", icon: Users },
  { id: "branches", label: "Sedes", icon: Building2 },
  { id: "marketing", label: "Mercadeo", icon: Megaphone },
  { id: "board", label: "Informes gerenciales", icon: ClipboardList },
  { id: "direction", label: "Dirección", icon: Settings },
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

function compact(value: number) {
  return new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));
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
  const branchChart = state.branches.slice(0, 8);
  const advisorChart = state.advisors.slice(0, 10);
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
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={branchChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={compact} width={44} />
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
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={advisorChart} layout="vertical" margin={{ left: 12, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={compact} />
              <YAxis dataKey="name" type="category" width={112} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value) => currency(Number(value))} />
              <Bar dataKey="sales" fill="#18715c" radius={[0, 4, 4, 0]} />
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
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Asesor</th>
              <th>Sede</th>
              <th>Ventas mes</th>
              <th>Meta mes</th>
              <th>% Meta 1</th>
              <th>Score</th>
              <th>Comision</th>
              <th>Evaluacion</th>
            </tr>
          </thead>
          <tbody>
            {state.advisors.map((advisor: any) => (
              <tr key={advisor.id}>
                <td><strong>{advisor.name}</strong></td>
                <td>{advisor.branchName}</td>
                <td>{currency(advisor.sales)}</td>
                <td>{advisor.target ? currency(advisor.target.meta4) : "Sin meta"}</td>
                <td><Progress value={advisor.progressMeta1} /></td>
                <td><span className={scoreClass(advisor.score.status)}>{advisor.score.score === null ? "Pendiente" : Math.round(advisor.score.score)}</span></td>
                <td>
                  <strong>{currency(advisor.commission.finalCommission)}</strong>
                  <small>{advisor.commission.level}</small>
                </td>
                <td>
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
                        <option value="">Gestion</option>
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
                      Editar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
  const [settings, setSettings] = React.useState({
    evo_base_url: state.settings.evo_base_url || "",
    evo_api_key: "",
    groq_api_key: "",
    groq_model: state.settings.groq_model || "llama-3.3-70b-versatile"
  });
  const [prompt, setPrompt] = React.useState("Verifica duplicados, calidad de datos y dame 5 acciones comerciales para mejorar el rendimiento de asesores y sedes.");
  const [answer, setAnswer] = React.useState("");
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

  return (
    <div className="view">
      <div className="grid two">
        <section className="panel">
          <div className="panel-title"><h2>Comisiones</h2><Sparkles size={18} /></div>
          <div className="metric-row"><span>Asesores</span><strong>{currency(state.kpis.totalAdvisorCommissions)}</strong></div>
          <div className="metric-row"><span>Director</span><strong>{currency(state.kpis.totalDirectorCommissions)}</strong></div>
          <div className="metric-row"><span>Venta total</span><strong>{currency(state.kpis.totalSales)}</strong></div>
          <Progress value={state.kpis.targetProgress} />
        </section>
        <section className="panel">
          <div className="panel-title"><h2>Integraciones</h2><Settings size={18} /></div>
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
        </section>
      </div>
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
