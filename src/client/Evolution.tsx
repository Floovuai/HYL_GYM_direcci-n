import React from "react";
import { Activity, Info, Upload } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

interface EvolutionRow {
  year: number;
  month: number;
  branchId: number;
  branchName: string;
  activeStart: number;
  newMembers: number;
  renewed: number;
  reinscriptions: number;
  returnedFromSuspension: number;
  totalEntries: number;
  cancellations: number;
  expired: number;
  notRenewed: number;
  suspended: number;
  totalExits: number;
  activeEnd: number;
  netEvolution: number;
  netEvolutionRate: number;
  directChurn: number;
  grossChurn: number;
  trend: "grows" | "falls" | "stable";
}

interface EvolutionMonth {
  year: number;
  month: number;
  key: string;
  label: string;
  longLabel: string;
  branchesWithData: number;
  totals: Omit<EvolutionRow, "year" | "month" | "branchId" | "branchName">;
}

interface EvolutionOverview {
  available: boolean;
  months: EvolutionMonth[];
  branches: Array<{ id: number; name: string }>;
  rows: EvolutionRow[];
  sources: Array<{ year: number; month: number; source: string; file: string }>;
  updatedAt: string | null;
}

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const BRANCH_COLORS = ["#33e6a4", "#6ea8e0", "#f5b944", "#c78ff0", "#ff8a5e", "#5ed4e6", "#e0e35e"];
const GREEN = "#33e6a4";
const RED = "#ff6b5e";
const GREY = "#7b848d";

const whole = (value: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Number(value || 0));
const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${whole(Math.abs(value))}`;
const pct = (value: number, digits = 1) =>
  `${new Intl.NumberFormat("es-CO", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(value) * 100)}%`;
const signedPct = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${pct(value)}`;
const compactNumber = (value: number) => new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));

function shortBranch(name: string) {
  return name.replace("Prado Veraniego", "Prado").replace("Santa Matilde", "Sta. Matilde");
}

function trendColor(net: number, rate: number) {
  if (Math.abs(rate) < 0.005) return GREY;
  return net > 0 ? GREEN : RED;
}

function heatStyle(rate: number, hasData: boolean): React.CSSProperties {
  if (!hasData) return {};
  const strength = Math.min(0.6, 0.1 + Math.abs(rate) * 4);
  if (Math.abs(rate) < 0.005) return { background: "rgba(155, 163, 171, .12)" };
  return { background: rate > 0 ? `rgba(51, 230, 164, ${strength})` : `rgba(255, 107, 94, ${strength})` };
}

function EvoKpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className={`kpi ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

export function Evolution({ setNotice }: { setNotice: (message: string) => void }) {
  const [data, setData] = React.useState<EvolutionOverview | null>(null);
  const [error, setError] = React.useState("");
  const [selectedKey, setSelectedKey] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [uploadMonth, setUploadMonth] = React.useState(0);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/evolution");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "No se pudo cargar la evolución");
    setData(json);
    setSelectedKey((current) => (current && json.months.some((month: EvolutionMonth) => month.key === current) ? current : json.months.at(-1)?.key ?? ""));
  }, []);

  React.useEffect(() => {
    load().catch((err) => setError(err.message));
    const events = new EventSource("/api/events");
    events.addEventListener("evolution_updated", () => load().catch((err) => setError(err.message)));
    return () => events.close();
  }, [load]);

  async function upload(files: File[]) {
    if (!files.length) return;
    for (const file of files) {
      const name = file.name.toLowerCase();
      if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) throw new Error(`"${file.name}" no es un Excel (.xlsx o .xls).`);
    }
    const form = new FormData();
    for (const file of files) form.append("file", file);
    if (uploadMonth) {
      form.append("month", String(uploadMonth));
      form.append("year", String(data?.months.at(-1)?.year ?? new Date().getFullYear()));
    }
    setUploading(true);
    setNotice("Cargando evolución de clientes...");
    try {
      const res = await fetch("/api/evolution/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo cargar la evolución");
      const summaries: Array<{ year: number; month: number; monthLabel: string; branches: number; activeEnd: number; replaced: boolean }> = json.summaries;
      setNotice(
        summaries
          .map((item) => `${item.monthLabel}: ${item.branches} sedes, ${whole(item.activeEnd)} activos al cierre${item.replaced ? " (reemplazó la carga anterior)" : ""}`)
          .join(" · ")
      );
      await load();
      const last = summaries.at(-1);
      if (last) setSelectedKey(`${last.year}-${String(last.month).padStart(2, "0")}`);
      setUploadMonth(0);
    } finally {
      setUploading(false);
    }
  }

  const uploadControls = (
    <div className="evo-upload">
      <input
        ref={fileInput}
        type="file"
        accept=".xlsx,.xls"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.currentTarget.value = "";
          upload(files).catch((err) => setNotice(err.message));
        }}
      />
      <label className="member-cutoff-control">
        <span>Mes del archivo</span>
        <select value={uploadMonth} onChange={(event) => setUploadMonth(Number(event.target.value))} aria-label="Mes del archivo">
          <option value={0}>Automático (por nombre)</option>
          {MONTH_NAMES.map((name, index) => (
            <option key={name} value={index + 1}>{name}</option>
          ))}
        </select>
      </label>
      <button onClick={() => fileInput.current?.click()} disabled={uploading}>
        <Upload size={17} />
        <span>{uploading ? "Cargando..." : "Cargar evolución"}</span>
      </button>
    </div>
  );

  if (error && !data) return <div className="view evolution-view"><div className="empty">{error}</div></div>;
  if (!data) return <div className="view evolution-view"><div className="empty">Cargando evolución...</div></div>;

  const months = data.months;
  const selected = months.find((month) => month.key === selectedKey) ?? months.at(-1);

  if (!data.available || !selected) {
    return (
      <div className="view evolution-view">
        <section className="panel evo-head">
          <div className="panel-title">
            <div>
              <h2>Evolución de clientes</h2>
              <span>Aún no hay meses cargados. Sube el Excel mensual de EVO (activos, entradas y salidas por sede).</span>
            </div>
            <Activity size={18} />
          </div>
          {uploadControls}
        </section>
      </div>
    );
  }

  const selectedRows = data.rows.filter((row) => row.year === selected.year && row.month === selected.month && row.activeEnd + row.activeStart + row.totalEntries > 0);
  const totals = selected.totals;
  const growing = selectedRows.filter((row) => row.trend === "grows");
  const falling = selectedRows.filter((row) => row.trend === "falls");
  const bestBranch = selectedRows.slice().sort((a, b) => b.netEvolutionRate - a.netEvolutionRate)[0];
  const worstBranch = selectedRows.slice().sort((a, b) => a.netEvolutionRate - b.netEvolutionRate)[0];

  const totalTrend = months.map((month) => ({
    label: month.label,
    Activos: month.totals.activeEnd,
    Entradas: month.totals.totalEntries,
    Salidas: month.totals.totalExits
  }));
  const branchBars = selectedRows
    .slice()
    .sort((a, b) => b.netEvolutionRate - a.netEvolutionRate)
    .map((row) => ({
      name: shortBranch(row.branchName),
      net: row.netEvolution,
      rate: row.netEvolutionRate,
      label: `${signed(row.netEvolution)} (${signedPct(row.netEvolutionRate)})`,
      color: trendColor(row.netEvolution, row.netEvolutionRate)
    }));
  const branchLines = months.map((month) => {
    const point: Record<string, string | number> = { label: month.label };
    for (const branch of data.branches) {
      const row = data.rows.find((item) => item.branchId === branch.id && item.year === month.year && item.month === month.month);
      if (row && row.activeEnd > 0) point[shortBranch(branch.name)] = row.activeEnd;
    }
    return point;
  });
  const hasExtremeMonths = months.some((month) => Math.abs(month.totals.netEvolutionRate) > 0.3);

  const headline =
    `${selected.longLabel}: cerró con ${whole(totals.activeEnd)} clientes activos (${signed(totals.netEvolution)}, ${signedPct(totals.netEvolutionRate)} frente al inicio del mes). ` +
    (growing.length || falling.length
      ? `${growing.length} de ${selectedRows.length} sedes crecieron${falling.length ? ` y ${falling.length} cayeron` : ""}` +
        (bestBranch && worstBranch && bestBranch !== worstBranch
          ? `; la mejor fue ${bestBranch.branchName} (${signedPct(bestBranch.netEvolutionRate)}) y la más débil ${worstBranch.branchName} (${signedPct(worstBranch.netEvolutionRate)}).`
          : ".")
      : "Las sedes se mantuvieron estables.");

  const tooltipStyle = { background: "#1e2126", border: "1px solid #363b42", borderRadius: 10, color: "#f1f3f5", fontSize: 12 };

  return (
    <div className="view evolution-view">
      <section className="panel evo-head">
        <div className="panel-title">
          <div>
            <h2>Evolución de clientes</h2>
            <span>
              {months[0].longLabel} a {months.at(-1)?.longLabel} · {data.branches.length} sedes
              {data.updatedAt ? ` · actualizado ${new Date(String(data.updatedAt).replace(" ", "T") + "Z").toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}` : ""}
            </span>
          </div>
          <Activity size={18} />
        </div>
        {uploadControls}
        <div className="evo-months" role="tablist" aria-label="Mes a analizar">
          {months.map((month) => (
            <button
              key={month.key}
              role="tab"
              aria-selected={month.key === selected.key}
              className={month.key === selected.key ? "active" : ""}
              onClick={() => setSelectedKey(month.key)}
            >
              {month.label}
            </button>
          ))}
        </div>
        <p className="evo-headline">{headline}</p>
      </section>

      <div className="evo-kpis">
        <EvoKpi label="Clientes activos" value={whole(totals.activeEnd)} sub={`Inicio de mes: ${whole(totals.activeStart)}`} tone="blue" />
        <EvoKpi
          label="Crecimiento neto"
          value={signed(totals.netEvolution)}
          sub={`${signedPct(totals.netEvolutionRate)} sobre el inicio`}
          tone={totals.netEvolution >= 0 ? "green" : "red"}
        />
        <EvoKpi
          label="Entradas"
          value={whole(totals.totalEntries)}
          sub={`Nuevos ${whole(totals.newMembers)} · Renovados ${whole(totals.renewed)} · Reinscr. ${whole(totals.reinscriptions)}`}
          tone="green"
        />
        <EvoKpi
          label="Salidas"
          value={whole(totals.totalExits)}
          sub={`No renovados ${whole(totals.notRenewed)} · Vencidos ${whole(totals.expired)} · Bajas ${whole(totals.cancellations)}`}
          tone="red"
        />
        <EvoKpi label="Sedes creciendo" value={`${growing.length} de ${selectedRows.length}`} sub={`Salida bruta del mes: ${pct(totals.grossChurn)}`} tone="amber" />
      </div>

      <div className="evo-grid">
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Clientes activos al cierre de cada mes</h2>
              <span>Total de todas las sedes</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={totalTrend} margin={{ top: 22, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="evoActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GREEN} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={GREEN} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2e34" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ba3ab" }} padding={{ left: 22, right: 22 }} />
              <YAxis tickFormatter={compactNumber} width={44} tick={{ fontSize: 11, fill: "#9ba3ab" }} domain={["auto", "auto"]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => whole(Number(value))} />
              <Area type="monotone" dataKey="Activos" stroke={GREEN} strokeWidth={3} fill="url(#evoActive)" dot={{ r: 3, fill: GREEN }}>
                <LabelList dataKey="Activos" position="top" formatter={(value: any) => whole(Number(value))} fill="#f1f3f5" fontSize={11} />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Entradas vs. salidas por mes</h2>
              <span>Si las verdes superan a las rojas, la base crece</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={totalTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2e34" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ba3ab" }} />
              <YAxis tickFormatter={compactNumber} width={44} tick={{ fontSize: 11, fill: "#9ba3ab" }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => whole(Number(value))} cursor={{ fill: "rgba(255,255,255,.04)" }} />
              <Legend />
              <Bar dataKey="Entradas" fill={GREEN} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Salidas" fill={RED} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>¿Qué sedes crecen y cuáles caen en {selected.longLabel}?</h2>
            <span>Variación de clientes activos entre el inicio y el cierre del mes · verde crece, rojo cae, gris estable (±0,5%)</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(180, branchBars.length * 46 + 30)}>
          <BarChart data={branchBars} layout="vertical" margin={{ top: 4, right: 76, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#2a2e34" />
            <XAxis
              type="number"
              tickFormatter={compactNumber}
              tick={{ fontSize: 11, fill: "#9ba3ab" }}
              domain={[(min: number) => Math.min(0, Math.floor(min * 1.7)), (max: number) => Math.max(0, Math.ceil(max * 1.7))]}
            />
            <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12, fill: "#f1f3f5" }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => signed(Number(value))} cursor={{ fill: "rgba(255,255,255,.04)" }} />
            <Bar dataKey="net" name="Variación" radius={[0, 5, 5, 0]}>
              {branchBars.map((row) => (
                <Cell key={row.name} fill={row.color} />
              ))}
              <LabelList
                dataKey="label"
                content={(props: any) => {
                  const row = branchBars[props.index];
                  if (!row) return null;
                  const negative = row.net < 0;
                  const edge = negative ? Math.min(props.x, props.x + props.width) : Math.max(props.x, props.x + props.width);
                  return (
                    <text x={negative ? edge - 6 : edge + 6} y={props.y + props.height / 2} textAnchor={negative ? "end" : "start"} dominantBaseline="central" fill="#f1f3f5" fontSize={12}>
                      {row.label}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Mapa de crecimiento por sede y mes</h2>
            <span>Cada celda muestra la variación de clientes del mes y su % sobre el inicio · más intenso = cambio más fuerte</span>
          </div>
        </div>
        <div className="evo-table-wrap">
          <table className="evo-heatmap">
            <thead>
              <tr>
                <th>Sede</th>
                {months.map((month) => (
                  <th key={month.key} className={month.key === selected.key ? "selected" : ""}>{month.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.branches.map((branch) => (
                <tr key={branch.id}>
                  <th scope="row">{branch.name}</th>
                  {months.map((month) => {
                    const row = data.rows.find((item) => item.branchId === branch.id && item.year === month.year && item.month === month.month);
                    const hasData = Boolean(row && (row.activeStart > 0 || row.activeEnd > 0));
                    return (
                      <td key={month.key} style={heatStyle(row?.netEvolutionRate ?? 0, hasData)} className={month.key === selected.key ? "selected" : ""}>
                        {row && hasData ? (
                          <>
                            <b>{signed(row.netEvolution)}</b>
                            <small>{row.activeStart > 0 ? signedPct(row.netEvolutionRate) : "sede nueva"}</small>
                          </>
                        ) : (
                          <small>–</small>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="evo-total-row">
                <th scope="row">Total</th>
                {months.map((month) => (
                  <td key={month.key} style={heatStyle(month.totals.netEvolutionRate, true)} className={month.key === selected.key ? "selected" : ""}>
                    <b>{signed(month.totals.netEvolution)}</b>
                    <small>{signedPct(month.totals.netEvolutionRate)}</small>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        {hasExtremeMonths ? (
          <p className="evo-note">
            Hay meses con variaciones superiores al 30% en el total. Compáralos con cautela frente a los meses de crecimiento moderado.
          </p>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Clientes activos por sede</h2>
            <span>Cada línea es una sede; una línea que sube indica crecimiento sostenido</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={branchLines} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2e34" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ba3ab" }} />
            <YAxis tickFormatter={compactNumber} width={44} tick={{ fontSize: 11, fill: "#9ba3ab" }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => whole(Number(value))} />
            <Legend />
            {data.branches.map((branch, index) => (
              <Line
                key={branch.id}
                type="monotone"
                dataKey={shortBranch(branch.name)}
                stroke={BRANCH_COLORS[index % BRANCH_COLORS.length]}
                strokeWidth={2.4}
                dot={{ r: 2.5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Movimientos de {selected.longLabel}</h2>
            <span>Detalle completo por sede tal como llega de EVO</span>
          </div>
        </div>
        <div className="evo-table-wrap">
          <table className="evo-detail">
            <thead>
              <tr>
                <th>Sede</th>
                <th>Activo inicio</th>
                <th>Nuevos</th>
                <th>Renovados</th>
                <th>Reinscr.</th>
                <th>Regresos susp.</th>
                <th>Total entradas</th>
                <th>Bajas</th>
                <th>Vencidos</th>
                <th>No renovados</th>
                <th>Suspendidos</th>
                <th>Total salidas</th>
                <th>Activos fin</th>
                <th>Variación</th>
                <th>Salida bruta</th>
              </tr>
            </thead>
            <tbody>
              {selectedRows.map((row) => (
                <tr key={row.branchId}>
                  <th scope="row">{row.branchName}</th>
                  <td>{whole(row.activeStart)}</td>
                  <td>{whole(row.newMembers)}</td>
                  <td>{whole(row.renewed)}</td>
                  <td>{whole(row.reinscriptions)}</td>
                  <td>{whole(row.returnedFromSuspension)}</td>
                  <td className="evo-in">{whole(row.totalEntries)}</td>
                  <td>{whole(row.cancellations)}</td>
                  <td>{whole(row.expired)}</td>
                  <td>{whole(row.notRenewed)}</td>
                  <td>{whole(row.suspended)}</td>
                  <td className="evo-out">{whole(row.totalExits)}</td>
                  <td><b>{whole(row.activeEnd)}</b></td>
                  <td style={{ color: trendColor(row.netEvolution, row.netEvolutionRate) }}>
                    <b>{signed(row.netEvolution)}</b> <small>{signedPct(row.netEvolutionRate)}</small>
                  </td>
                  <td>{pct(row.grossChurn)}</td>
                </tr>
              ))}
              <tr className="evo-total-row">
                <th scope="row">Total</th>
                <td>{whole(totals.activeStart)}</td>
                <td>{whole(totals.newMembers)}</td>
                <td>{whole(totals.renewed)}</td>
                <td>{whole(totals.reinscriptions)}</td>
                <td>{whole(totals.returnedFromSuspension)}</td>
                <td className="evo-in">{whole(totals.totalEntries)}</td>
                <td>{whole(totals.cancellations)}</td>
                <td>{whole(totals.expired)}</td>
                <td>{whole(totals.notRenewed)}</td>
                <td>{whole(totals.suspended)}</td>
                <td className="evo-out">{whole(totals.totalExits)}</td>
                <td><b>{whole(totals.activeEnd)}</b></td>
                <td style={{ color: trendColor(totals.netEvolution, totals.netEvolutionRate) }}>
                  <b>{signed(totals.netEvolution)}</b> <small>{signedPct(totals.netEvolutionRate)}</small>
                </td>
                <td>{pct(totals.grossChurn)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel evo-guide">
        <div className="panel-title">
          <div>
            <h2>Cómo leer esta tabla</h2>
            <span>Así interpreta DashCom el reporte de evolución de EVO</span>
          </div>
          <Info size={18} />
        </div>
        <ul>
          <li><b>Activos fin = Activo inicio + Total de entradas − Total de salidas.</b> Al cargar un archivo se valida que esa cuenta cuadre en cada sede.</li>
          <li><b>Entradas</b> = Nuevos + Renovados + Reinscripciones + Regresos de suspensión. <b>Salidas</b> = Bajas + Vencidos + No renovados + Suspendidos.</li>
          <li><b>Variación</b> = Activos fin − Activo inicio; el % se calcula sobre el Activo inicio. El Activo inicio de un mes es el Activos fin del mes anterior.</li>
          <li><b>Salida bruta</b> = Total de salidas ÷ Activo inicio. Una sede está “estable” si su variación está dentro de ±0,5%.</li>
          <li>Para cargar un mes nuevo usa <b>Cargar evolución</b> con el Excel de EVO nombrado como “EVOLUCION SEPTIEMBRE 26.xlsx” (o elige el mes). Volver a cargar un mes lo reemplaza.</li>
        </ul>
      </section>
    </div>
  );
}
