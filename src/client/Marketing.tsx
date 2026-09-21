import React from "react";
import {
  FileSpreadsheet,
  LineChart,
  Megaphone,
  RefreshCcw,
  TrendingUp
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AppState, tabs, monthOptions, currency, compactCurrency, percent, ratePercent, compact, advisorDisplayName, branchShortName, SplitTick, VerticalSplitTick, OneLineTick, Kpi, Empty, normalizeText, cleanRows } from "./common";

export function Marketing({ state, onReload, setNotice }: { state: AppState; onReload: () => Promise<void>; setNotice: (value: string) => void }) {
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

export function buildBranchRevenuePlans(state: AppState, activePlans: any[]) {
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

export function buildMarketingAnalytics(state: AppState, activePlans: any[]) {
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

export function oneLineLabel(value: string, max = 22) {
  const text = String(value || "Sin dato").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function shortLabel(value: string, max = 18) {
  const text = String(value || "Sin dato");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function wrapTickLabel(value: string, maxLineLen = 9) {
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

export function paymentMethodKey(value: string) {
  return `payment_${normalizeText(value).replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "sin_medio"}`;
}

export function buildPaymentMethodHistory(state: AppState) {
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

export function marketingPlanFamily(name: string) {
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

