import React from "react";
import {
  CheckSquare,
  Radar
} from "lucide-react";
import { AppState, monthOptions, currency, displayStatus, displayArea, Kpi } from "./common";

export function Competitors({ state, year, month, onReload, setNotice }: { state: AppState; year: number; month: number; onReload: () => Promise<void>; setNotice: (value: string) => void }) {
  const competitors: any[] = state.competitors ?? [];
  const branches: any[] = state.branches ?? [];
  const [form, setForm] = React.useState({ name: "", brand: "", zone: "", branchId: "", segment: "Low cost" });
  const [snapshotFor, setSnapshotFor] = React.useState<number | null>(null);
  const [snapshot, setSnapshot] = React.useState({ monthlyPrice: "", enrollmentFee: "", promo: "", services: "", source: "" });
  const [historyFor, setHistoryFor] = React.useState<number | null>(null);

  const monthlyPlanPrices = (state.plans ?? [])
    .filter((plan: any) => Number(plan.active ?? 1) === 1 && Number(plan.cost_per_month || 0) > 0)
    .map((plan: any) => Number(plan.cost_per_month));
  const ourMonthlyAvg = monthlyPlanPrices.length
    ? monthlyPlanPrices.reduce((sum: number, value: number) => sum + value, 0) / monthlyPlanPrices.length
    : 0;

  const zonesCovered = new Set(competitors.map((item) => String(item.zone || "").trim()).filter(Boolean)).size;
  const freshCount = competitors.filter((item) => !item.stale).length;
  const withPrice = competitors.filter((item) => Number(item.latest?.monthly_price || 0) > 0);
  const competitorAvg = withPrice.length
    ? withPrice.reduce((sum, item) => sum + Number(item.latest.monthly_price), 0) / withPrice.length
    : 0;
  const priceGap = ourMonthlyAvg > 0 && competitorAvg > 0 ? (ourMonthlyAvg - competitorAvg) / competitorAvg : null;
  const periodLabel = `${monthOptions[month - 1]} ${year}`;

  async function addCompetitor() {
    if (!form.name.trim()) return;
    const res = await fetch("/api/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, branchId: form.branchId || null })
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setNotice(json.error || "No se pudo crear el competidor.");
      return;
    }
    setForm({ name: "", brand: "", zone: "", branchId: "", segment: "Low cost" });
    setNotice("Competidor registrado. Ahora registra su primer dato de precios.");
    await onReload();
  }

  async function saveSnapshot(competitorId: number) {
    const res = await fetch(`/api/competitors/${competitorId}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, ...snapshot })
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setNotice(json.error || "No se pudo guardar el dato de competencia.");
      return;
    }
    setSnapshotFor(null);
    setSnapshot({ monthlyPrice: "", enrollmentFee: "", promo: "", services: "", source: "" });
    setNotice(`Dato de competencia guardado para ${periodLabel}.`);
    await onReload();
  }

  async function removeCompetitor(competitorId: number, name: string) {
    if (!window.confirm(`¿Eliminar a ${name} y todo su historial de seguimiento?`)) return;
    await fetch(`/api/competitors/${competitorId}`, { method: "DELETE" });
    await onReload();
  }

  function openSnapshotForm(competitor: any) {
    setHistoryFor(null);
    setSnapshotFor(competitor.id);
    setSnapshot({
      monthlyPrice: competitor.latest?.monthly_price ? String(competitor.latest.monthly_price) : "",
      enrollmentFee: competitor.latest?.enrollment_fee ? String(competitor.latest.enrollment_fee) : "",
      promo: competitor.latest?.promo || "",
      services: competitor.latest?.services || "",
      source: ""
    });
  }

  return (
    <div className="view">
      <div className="kpi-grid">
        <Kpi label="Competidores monitoreados" value={String(competitors.length)} sub={`${zonesCovered} zonas cubiertas`} />
        <Kpi label="Actualizados (≤3 meses)" value={`${freshCount}/${competitors.length}`} sub="cadencia trimestral mínima" tone={freshCount === competitors.length && competitors.length > 0 ? "green" : "amber"} />
        <Kpi label="Precio promedio competencia" value={competitorAvg > 0 ? currency(competitorAvg) : "Sin datos"} sub={`${withPrice.length} con precio vigente`} tone="blue" />
        <Kpi
          label="Brecha vs nuestro precio"
          value={priceGap === null ? "Sin datos" : `${priceGap >= 0 ? "+" : ""}${Math.round(priceGap * 100)}%`}
          sub={ourMonthlyAvg > 0 ? `nuestro promedio ${currency(ourMonthlyAvg)}/mes` : "sin precio propio de referencia"}
          tone={priceGap !== null && priceGap > 0.15 ? "amber" : "green"}
        />
      </div>

      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Radar de competencia</h2>
            <span>Registro estructurado de precios, promociones y servicios por zona. Los datos se guardan sobre el periodo seleccionado arriba ({periodLabel}); actualiza mínimo cada trimestre.</span>
          </div>
          <Radar size={18} />
        </div>

        <div className="add-row">
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nombre del gimnasio (ej. Smart Fit Centro)" />
          <input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} placeholder="Cadena / marca" />
          <input value={form.zone} onChange={(event) => setForm({ ...form, zone: event.target.value })} placeholder="Zona o barrio" />
          <select value={form.branchId} onChange={(event) => setForm({ ...form, branchId: event.target.value })}>
            <option value="">Sede nuestra que compite</option>
            {branches.map((branch: any) => (
              <option key={branch.id} value={branch.id}>{branch.display_name || branch.name}</option>
            ))}
          </select>
          <select value={form.segment} onChange={(event) => setForm({ ...form, segment: event.target.value })}>
            <option>Low cost</option>
            <option>Medio</option>
            <option>Premium</option>
            <option>Boutique / estudio</option>
          </select>
          <button onClick={addCompetitor}>Agregar competidor</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Competidor</th>
                <th>Zona · Sede nuestra</th>
                <th>Segmento</th>
                <th>Precio mensual</th>
                <th>Δ vs registro anterior</th>
                <th>Inscripción</th>
                <th>Promoción vigente</th>
                <th>Última actualización</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {competitors.length === 0 && (
                <tr><td colSpan={9}>Aún no hay competidores registrados. Agrega Smart Fit, 24-7 y los gimnasios de cada zona para iniciar el seguimiento.</td></tr>
              )}
              {competitors.map((competitor) => (
                <React.Fragment key={competitor.id}>
                  <tr>
                    <td>
                      <strong>{competitor.name}</strong>
                      {competitor.brand ? <div><small>{competitor.brand}</small></div> : null}
                    </td>
                    <td>{[competitor.zone, competitor.branch_name].filter(Boolean).join(" · ") || "—"}</td>
                    <td>{competitor.segment || "—"}</td>
                    <td>{Number(competitor.latest?.monthly_price || 0) > 0 ? currency(Number(competitor.latest.monthly_price)) : "Sin dato"}</td>
                    <td>
                      {competitor.priceDelta === null || competitor.priceDelta === undefined
                        ? "—"
                        : competitor.priceDelta === 0
                          ? "Sin cambio"
                          : `${competitor.priceDelta > 0 ? "▲" : "▼"} ${currency(Math.abs(Number(competitor.priceDelta)))}`}
                    </td>
                    <td>{Number(competitor.latest?.enrollment_fee || 0) > 0 ? currency(Number(competitor.latest.enrollment_fee)) : "—"}</td>
                    <td>{competitor.latest?.promo || "—"}</td>
                    <td>
                      {competitor.latest ? competitor.latest.periodLabel : "Nunca"}
                      {" "}
                      <span className={`status ${competitor.stale ? "low" : "high"}`}>
                        {competitor.stale ? "Desactualizado" : "Vigente"}
                      </span>
                    </td>
                    <td>
                      <div className="add-row" style={{ margin: 0 }}>
                        <button onClick={() => openSnapshotForm(competitor)}>Actualizar</button>
                        <button onClick={() => { setSnapshotFor(null); setHistoryFor(historyFor === competitor.id ? null : competitor.id); }}>Historial</button>
                        <button onClick={() => removeCompetitor(competitor.id, competitor.name)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                  {snapshotFor === competitor.id && (
                    <tr>
                      <td colSpan={9}>
                        <div className="add-row">
                          <input type="number" value={snapshot.monthlyPrice} onChange={(event) => setSnapshot({ ...snapshot, monthlyPrice: event.target.value })} placeholder="Precio mensual" />
                          <input type="number" value={snapshot.enrollmentFee} onChange={(event) => setSnapshot({ ...snapshot, enrollmentFee: event.target.value })} placeholder="Inscripción" />
                          <input value={snapshot.promo} onChange={(event) => setSnapshot({ ...snapshot, promo: event.target.value })} placeholder="Promoción vigente" />
                          <input value={snapshot.services} onChange={(event) => setSnapshot({ ...snapshot, services: event.target.value })} placeholder="Servicios (clases, piscina, app...)" />
                          <input value={snapshot.source} onChange={(event) => setSnapshot({ ...snapshot, source: event.target.value })} placeholder="Fuente (web, visita, llamada)" />
                          <button onClick={() => saveSnapshot(competitor.id)}>Guardar {periodLabel}</button>
                          <button onClick={() => setSnapshotFor(null)}>Cancelar</button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {historyFor === competitor.id && (
                    <tr>
                      <td colSpan={9}>
                        {competitor.history?.length ? (
                          <div className="table-wrap small">
                            <table>
                              <thead>
                                <tr><th>Periodo</th><th>Precio mensual</th><th>Inscripción</th><th>Promoción</th><th>Servicios</th><th>Fuente</th></tr>
                              </thead>
                              <tbody>
                                {competitor.history.map((row: any) => (
                                  <tr key={row.id}>
                                    <td>{row.periodLabel}</td>
                                    <td>{Number(row.monthly_price || 0) > 0 ? currency(Number(row.monthly_price)) : "—"}</td>
                                    <td>{Number(row.enrollment_fee || 0) > 0 ? currency(Number(row.enrollment_fee)) : "—"}</td>
                                    <td>{row.promo || "—"}</td>
                                    <td>{row.services || "—"}</td>
                                    <td>{row.source || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <span>Sin historial: registra el primer dato con "Actualizar".</span>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function Todos({ state, onReload }: { state: AppState; onReload: () => Promise<void> }) {
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


