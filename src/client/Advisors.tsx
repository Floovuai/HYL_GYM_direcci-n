import React from "react";
import {
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AppState, currency, compactCurrency, signedCompactCurrency, dateLabel, percent, compact, safeRatio, advisorPace, advisorDisplayName, advisorChartName, scoreValue, nextAdvisorGoal, AdvisorTick, scoreClass, Kpi, Progress, Empty } from "./common";

export function AdvisorSalesChart({
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
export const FORMER_ADVISORS = ["diana", "esteban", "alejandro leon", "sofia arias"];

export function isFormerAdvisor(name: any) {
  const normalized = String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  if (!normalized) return false;
  return FORMER_ADVISORS.some((former) =>
    former.includes(" ") ? normalized.includes(former) : normalized.split(/\s+/)[0] === former
  );
}

export function Advisors({ state, year, month, onReload }: { state: AppState; year: number; month: number; onReload: () => Promise<void> }) {
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

