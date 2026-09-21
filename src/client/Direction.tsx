import React from "react";
import {
  Building2,
  Sparkles
} from "lucide-react";
import { AppState, currency, percent, Kpi, Progress, Empty } from "./common";

export function Direction({ state }: { state: AppState; year: number; month: number; onReload: () => Promise<void>; setNotice: (value: string) => void }) {
  const directorRows = state.branches
    .filter((branch: any) => branch.target)
    .slice()
    .sort((a: any, b: any) => {
      if (String(a.name).toLowerCase() === "online") return 1;
      if (String(b.name).toLowerCase() === "online") return -1;
      return Number(b.directorCommission?.bonus || 0) - Number(a.directorCommission?.bonus || 0)
        || Number(b.score?.progressMeta1 || 0) - Number(a.score?.progressMeta1 || 0);
    });
  const payingBranches = directorRows.filter((branch: any) => Number(branch.directorCommission?.bonus || 0) > 0).length;
  const nextBranches = directorRows
    .filter((branch: any) => Number(branch.directorCommission?.bonus || 0) <= 0)
    .slice()
    .sort((a: any, b: any) => Number(b.score?.progressMeta1 || 0) - Number(a.score?.progressMeta1 || 0))
    .slice(0, 4);
  const branchRecommendations = state.recommendations
    .filter((item: any) => String(item.title || "").startsWith("Ritmo comercial"))
    .slice(0, 5);
  const qualityIssues = [
    {
      label: "Duplicados",
      value: state.quality.duplicateGroups.length + state.quality.naturalDuplicateGroups.length,
      detail: "ventas repetidas detectadas"
    },
    {
      label: "Ventas positivas sin asesor",
      value: state.quality.orphanSales.missingAdvisorPositive ?? state.quality.orphanSales.missingAdvisor,
      detail: "afectan atribución comercial"
    },
    {
      label: "Ventas positivas en soporte",
      value: state.quality.orphanSales.supportAdvisorPositiveRows ?? 0,
      detail: currency(state.quality.orphanSales.supportAdvisorPositiveSales ?? 0)
    },
    {
      label: "Cortesías / valor cero",
      value: state.quality.orphanSales.zeroValue,
      detail: "informativo, no descuenta comisión"
    }
  ];

  return (
    <div className="view direction-view">
      <section className="panel direction-hero">
        <div>
          <span className="eyebrow">Comisión director</span>
          <h2>{state.filters.selectedMonthName} {state.filters.selectedYear}</h2>
          <p>Liquidación mensual por sede. No incluye comisiones de asesores.</p>
        </div>
        <div className="direction-hero-metrics">
          <Kpi label="Venta total" value={currency(state.kpis.totalSales)} sub={percent(state.kpis.targetProgress)} />
          <Kpi label="Comisión director" value={currency(state.kpis.totalDirectorCommissions)} sub={`${payingBranches} sedes pagan bono`} tone="blue" />
          <Kpi label="Meta 1 compañía" value={currency(state.kpis.totalTarget)} sub={`${directorRows.length} sedes con meta`} tone="amber" />
          {([2, 3, 4] as const).map((level) => (
            <Kpi
              key={level}
              label={`Meta ${level} compañía`}
              value={currency(directorRows.reduce((total: number, branch: any) => total + Number(branch.target?.[`meta${level}`] || 0), 0))}
              tone="amber"
            />
          ))}
        </div>
      </section>

      <section className="panel director-detail-panel">
        <div className="panel-title"><h2>Detalle por sede</h2><Building2 size={18} /></div>
        <div className="table-wrap">
          <table className="director-detail-table">
            <thead>
              <tr>
                <th>Sede</th>
                <th>Venta mes</th>
                <th>Metas sede</th>
                <th>Avance</th>
                <th>Nivel director</th>
                <th>Bono director</th>
                <th>Falta Meta 1</th>
              </tr>
            </thead>
            <tbody>
              {directorRows.map((branch: any) => (
                <tr key={branch.id}>
                  <td>{branch.name}</td>
                  <td>{currency(branch.sales)}</td>
                  <td>
                    <div className="director-targets">
                      {([1, 2, 3, 4] as const).map((level) => (
                        <span key={level}><b>M{level}</b>{currency(branch.target?.[`meta${level}`] || 0)}</span>
                      ))}
                    </div>
                  </td>
                  <td>{percent(branch.score?.progressMeta1 || 0)}</td>
                  <td>{branch.directorCommission?.level || "Sin meta"}</td>
                  <td>{currency(branch.directorCommission?.bonus || 0)}</td>
                  <td>{currency(Math.max((branch.target?.meta1 || 0) - Number(branch.sales || 0), 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="direction-secondary-grid">
      {nextBranches.length ? (
        <section className="panel direction-focus-panel">
          <div className="panel-title"><h2>Sedes más cercanas a bono</h2><Building2 size={18} /></div>
          <div className="focus-list">
            {nextBranches.map((branch: any) => (
              <article key={branch.id}>
                <div>
                  <strong>{branch.name}</strong>
                  <span>{currency(branch.sales)} de {currency(branch.target.meta1)}</span>
                </div>
                <strong>{percent(branch.score.progressMeta1)}</strong>
                <Progress value={branch.score.progressMeta1} />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel direction-quality-panel">
        <div className="panel-title"><h2>Calidad de datos y apoyo comercial</h2><Sparkles size={18} /></div>
        <div className="quality-grid">
          {qualityIssues.map((item) => (
            <div className="quality-card" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </div>
          ))}
        </div>
        <div className="recommendation-list">
          {branchRecommendations.length ? branchRecommendations.map((item: any, index: number) => (
            <article key={`${item.title}-${index}`} className="recommendation">
              <strong>{item.title}</strong>
              <span>{item.priority}</span>
              <p>{item.detail}</p>
              <small>{item.metric}</small>
            </article>
          )) : <Empty />}
        </div>
      </section>
      </div>
    </div>
  );
}




