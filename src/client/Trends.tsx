import React from "react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CheckSquare,
  Clock,
  FileSpreadsheet,
  LineChart,
  RefreshCcw,
  Sparkles,
  TrendingUp
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AppState, currency, compactCurrency, dateLabel, percent, ratePercent, compact, wholeNumber, branchShortName, Kpi, Empty } from "./common";

export function IntelligentGrowth({ state }: { state: AppState }) {
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

export function SalesTrends({ state, onReload, setNotice }: { state: AppState; onReload: () => Promise<void>; setNotice: (value: string) => void }) {
  const [syncingCheckins, setSyncingCheckins] = React.useState(false);
  const trends = state.trends;
  if (!trends) return <Empty />;
  const bestWeekday = trends.bestWeekday;
  const bestMonthPart = trends.bestMonthPart;
  const nextKeyDate = trends.nextKeyDate;
  const monthlyComparison = trends.monthlyComparison;
  const accessTrends = trends.accessTrends;
  const daysInSelectedMonth = new Date(state.filters.selectedYear, state.filters.selectedMonth, 0).getDate();
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
            <div className="growth-chart"><div className="growth-chart-fill">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdayChartRows} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="chartName" interval={0} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={compact} width={48} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => currency(Number(value))} />
                <Bar dataKey="revenue" name="Ventas" fill="#33e6a4" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
</div>
          ) : <Empty />}
        </section>

        <section className="panel growth-panel">
          <div className="panel-title">
            <div>
              <h2>Hábito por tramo del mes</h2>
              <span className="chart-caption">Ejecutado vs. proyectado (estacional) · corte día {monthlyComparison?.cutoffDay ?? "-"}</span>
              <span className="chart-caption">Inicio: días 1-10 · Mitad: días 11-20 · Cierre: días 21-{daysInSelectedMonth}</span>
            </div>
            <CalendarDays size={18} />
          </div>
          {monthPartChartRows.length ? (
            <div className="growth-chart"><div className="growth-chart-fill">
            <ResponsiveContainer width="100%" height="100%">
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
            </div>
</div>
          ) : <Empty />}
        </section>

        <section className="panel growth-panel">
          <div className="panel-title"><h2>Mix de planes del período</h2><FileSpreadsheet size={18} /></div>
          {planMixChartRows.length ? (
            <div className="growth-chart"><div className="growth-chart-fill">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={planMixChartRows} margin={{ top: 8, right: 8, bottom: 26, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="chartName" interval={0} angle={-30} textAnchor="end" height={50} tick={{ fontSize: 9.5 }} />
                <YAxis tickFormatter={compact} width={48} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => currency(Number(value))} />
                <Bar dataKey="revenue" name="Ventas" fill="#f5b944" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
</div>
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

