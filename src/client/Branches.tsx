import React from "react";
import {
  BarChart3,
  RefreshCw,
  Sparkles,
  Thermometer,
  Upload
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AppState, currency, compactCurrency, dateLabel, signedPercent, ratePercent, percentagePointDelta, compact, wholeNumber, validateExcelFile, importSummaryNotice, safeRatio, branchShortName, SplitTick, Progress } from "./common";

export function Branches({
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
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartRows} margin={{ top: 8, right: 14, left: 0, bottom: 18 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" interval={0} tick={<SplitTick />} height={58} />
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
          <div className="empty">Aún no hay recomendaciones para este periodo.</div>
        ) : null}
      </section>
    </div>
  );
}


export function trendLabel(delta: number) {
  if (Math.abs(Number(delta || 0)) < 0.1) return "0.0";
  return `${delta > 0 ? "+" : ""}${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(delta)}`;
}

