import React from "react";
import {
  Building2,
  CalendarDays,
  LineChart,
  Star
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
import { AppState, monthOptions, currency, compactCurrency, signedCompactCurrency, percent, compact, branchShortName, branchGoalStage, branchTargetGoals, SplitTick, Kpi, cleanRows } from "./common";

export function MonthProjection({ state, year, month }: { state: AppState; year: number; month: number }) {
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
          <div className="projection-chart-slot projection-chart-line">
          <ResponsiveContainer width="100%" height="100%">
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
          </div>

          <div className="panel-subtitle">
            <div>
              <h3>Proyección por sede</h3>
              <span>Venta actual, cierre proyectado y Meta 1</span>
            </div>
            <Building2 size={16} />
          </div>
          <div className="projection-chart-slot projection-chart-bars">
          <ResponsiveContainer width="100%" height="100%">
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
          </div>
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
          <p className="calendar-footnote">Mide venta diaria contra el mismo día del año anterior.</p>
        </section>
      </div>
    </div>
  );
}

export function buildProjectionInsights(state: AppState, year: number, month: number) {
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

export function CalendarHeatmap({ days, year, month, holidays, compact: compactMode = false, fillHeight = false }: { days: any[]; year: number; month: number; holidays?: Record<string, string>; compact?: boolean; fillHeight?: boolean }) {
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

export function budgetVariation(item: any) {
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

export function dayVariation(currentSales: number, previousSales: number) {
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

export function variationTitle(item: any, variation: ReturnType<typeof budgetVariation> | ReturnType<typeof dayVariation>, holiday?: string) {
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

