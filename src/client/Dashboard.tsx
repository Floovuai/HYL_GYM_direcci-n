import React from "react";
import {
  Building2,
  CalendarDays,
  AlertTriangle,
  Maximize2,
  Users
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AppState, currency, compactCurrency, signedCompactCurrency, ratePercent, compact, wholeNumber, safeRatio, advisorDisplayName, consolidateAdvisorChartRows, Kpi } from "./common";
import { CalendarHeatmap } from "./Projection";
import { AdvisorSalesChart } from "./Advisors";

export function DashboardBranchTooltip({ active, payload }: any) {
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

export function Dashboard({ state }: { state: AppState }) {
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
  const activeAdvisorRows = state.advisors.filter((advisor: any) => Number(advisor.active) === 1);
  const advisorRowsWithSales = activeAdvisorRows.filter((advisor: any) => Number(advisor.sales || 0) > 0);
  const advisorChart = consolidateAdvisorChartRows(activeAdvisorRows);
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
        <p className="calendar-footnote">Mide venta diaria contra lo esperado; verde sobre ritmo y rojo por debajo.</p>
      </section>
    </div>
  );
}

