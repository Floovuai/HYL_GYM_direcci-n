import React from "react";
import {
  Building2,
  ClipboardList,
  AlertTriangle
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
import { AppState, currency, compactCurrency, percent, ratePercent, compact, wholeNumber, branchChurnTrafficLight, advisorChartName, normalizeText, cleanRows } from "./common";

export function BoardReports({ state, year, month }: { state: AppState; year: number; month: number }) {
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

export function ReportChart({ title, data, dataKey, labelKey = "label" }: { title: string; data: any[]; dataKey: string; labelKey?: string }) {
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

export function ReportBar({
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

export function EmptyChart({ height = 300 }: { height?: number }) {
  return (
    <div className="empty-chart" style={{ minHeight: height }}>
      Sin datos para graficar
    </div>
  );
}

export function hasRows(value: any) {
  return Array.isArray(value)
    ? cleanRows(value).length > 0
    : Boolean(value && typeof value === "object" && Object.values(value).some((item) => item !== undefined && item !== null && item !== 0 && item !== ""));
}


export function reportPlanFamily(name: string) {
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

export function buildReportFallbackInsights(state: AppState, year: number, month: number) {
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

export function ReportTable({ rows, columns }: { rows: any[]; columns: Array<{ key: string; label: string; format?: (value: number) => string; value?: (row: any) => React.ReactNode }> }) {
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

