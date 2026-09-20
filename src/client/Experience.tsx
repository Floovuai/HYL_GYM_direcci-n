import React from "react";
import {
  BarChart3,
  Building2,
  CheckSquare,
  ClipboardList,
  AlertTriangle,
  ExternalLink,
  FileSpreadsheet,
  Megaphone,
  MessageCircle,
  RefreshCcw,
  Sparkles,
  Thermometer,
  TrendingUp
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { tabs, dateTimeLabel, ratePercent, wholeNumber, SplitTick, Kpi, Empty, normalizeText, scoreLabel } from "./common";

export function Experience() {
  const [data, setData] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<"resumen" | "sedes" | "oportunidades" | "plan">("resumen");

  const loadExperience = React.useCallback(async (refresh = false) => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/experience${refresh ? "?refresh=1" : ""}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "No se pudo cargar experiencia");
    setData(json);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadExperience().catch((currentError) => {
      setError(currentError.message);
      setLoading(false);
    });
  }, [loadExperience]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadExperience().catch((currentError) => setError(currentError.message));
      }
    }, 5 * 60_000);
    return () => window.clearInterval(timer);
  }, [loadExperience]);

  const deferredQuery = React.useDeferredValue(query);
  const branchRows = (data?.byBranch || []).filter((branch: any) => {
    if (!deferredQuery.trim()) return true;
    return normalizeText(branch.branch).includes(normalizeText(deferredQuery));
  });
  const sourceChart = (data?.sources || []).map((source: any) => ({
    ...source,
    averageScore: Number(source.averageScore || 0),
    shortName: source.label.replace("Encuesta ", "").replace("Comunicación", "Com.")
  }));
  const branchChart = branchRows
    .filter((branch: any) => branch.averageScore !== null)
    .slice(0, 8)
    .map((branch: any) => ({
      ...branch,
      chartName: branch.branch.length > 18 ? `${branch.branch.slice(0, 18)}...` : branch.branch,
      scoreLabel: scoreLabel(branch.averageScore)
    }));
  const advanced = data?.advanced || {};
  const categoryChart = (advanced.categoryComparison || []).filter((item: any) => item.branch !== "Sin sede");
  const opportunityChart = (advanced.personalizedOpportunity || []).slice(0, 8);
  const topicChart = (advanced.topicCounts || []).filter((item: any) => Number(item.mentions || 0) > 0);
  const playbookRows = (advanced.branchPlaybook || []).filter((branch: any) => {
    if (!query.trim()) return true;
    return normalizeText(branch.branch).includes(normalizeText(query));
  });

  const tabs = [
    { id: "resumen", label: "Resumen ejecutivo" },
    { id: "sedes", label: "Diagnóstico por sede" },
    { id: "oportunidades", label: "Oportunidades y temas" },
    { id: "plan", label: "Plan de acción" }
  ];

  if (loading && !data) {
    return <div className="view"><div className="loader" /></div>;
  }

  if (error && !data) {
    return (
      <div className="view">
        <section className="panel experience-empty">
          <AlertTriangle size={22} />
          <h2>No se pudo cargar Experiencia</h2>
          <p>{error}</p>
          <button onClick={() => loadExperience(true).catch((currentError) => setError(currentError.message))}>Reintentar</button>
        </section>
      </div>
    );
  }

  return (
    <div className="view experience-view">
      <section className={`experience-thermometer ${data?.tone || "pending"}`}>
        <div>
          <span className="eyebrow">Informe vivo de experiencia</span>
          <h2>{advanced.reportTitle || "Marketing y Comunicación por Sede"}</h2>
          <p>
            {data?.scoredResponses
              ? `${advanced.reportSubtitle || "Termómetro de experiencia actualizado"} · Promedio ${scoreLabel(data.averageScore)} sobre ${data.scoredResponses} respuestas calificables.`
              : "Las encuestas se leen, pero no se detectaron columnas calificables todavía."}
          </p>
        </div>
        <div className="thermometer-score">
          <Thermometer size={24} />
          <strong>{scoreLabel(data?.averageScore)}</strong>
          <span>última respuesta {dateTimeLabel(data?.latestDate)}</span>
        </div>
      </section>

      <div className="kpi-grid">
        <Kpi label="Respuestas totales" value={wholeNumber(data?.totalResponses || 0)} sub={`${wholeNumber(data?.recentResponses || 0)} últimos 30 días`} tone="green" />
        <Kpi label="Promedio experiencia" value={scoreLabel(data?.averageScore)} sub={data?.status || "Sin datos"} tone={data?.tone || "blue"} />
        <Kpi label="Falta seguimiento" value={ratePercent(advanced.commercialMetrics?.followUpGapRate || 0)} sub="percepción comercial" tone="amber" />
        <Kpi label="Oportunidad personalizado" value={wholeNumber(advanced.commercialMetrics?.personalizedCandidates || 0)} sub={advanced.commercialMetrics?.topOpportunityBranch ? `mayor bolsa: ${advanced.commercialMetrics.topOpportunityBranch}` : "clientes probables"} tone="blue" />
      </div>

      <div className="config-tabs experience-tabs" role="tablist" aria-label="Experiencia">
        {tabs.map((item) => (
          <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id as any)}>{item.label}</button>
        ))}
      </div>

      {data?.errors?.length ? (
        <section className="panel experience-errors">
          {data.errors.map((item: any) => (
            <article key={item.source}>
              <AlertTriangle size={18} />
              <div><strong>{item.source}</strong><span>{item.error}</span></div>
            </article>
          ))}
        </section>
      ) : null}

      {view === "resumen" ? (
        <>
          <section className="panel executive-panel">
            <div className="panel-title">
              <div>
                <h2>Resumen ejecutivo</h2>
                <span>{advanced.periodLabel || "Fuentes conectadas a Google Sheets"}</span>
              </div>
              <Sparkles size={18} />
            </div>
            <div className="executive-list">
              {(advanced.executiveSummary || []).map((item: string, index: number) => (
                <article key={index}>
                  <strong>{index + 1}</strong>
                  <p>{item}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="grid two experience-grid">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Indicadores comerciales clave</h2>
                  <span>Lectura directa de la encuesta de marketing.</span>
                </div>
                <BarChart3 size={18} />
              </div>
              <div className="experience-metric-grid">
                <article><span>Experiencia asesores buena/excelente</span><strong>{ratePercent(advanced.commercialMetrics?.commercialExperienceRate || 0)}</strong></article>
                <article><span>Comunicación asesores buena/excelente</span><strong>{ratePercent(advanced.commercialMetrics?.advisorCommunicationRate || 0)}</strong></article>
                <article><span>Se siente importante</span><strong>{ratePercent(advanced.commercialMetrics?.feelsImportantRate || 0)}</strong></article>
                <article><span>Quiere mejor acompañamiento</span><strong>{ratePercent(advanced.commercialMetrics?.wantsBetterAccompanimentRate || 0)}</strong></article>
                <article><span>Usa personalizado</span><strong>{ratePercent(advanced.commercialMetrics?.usesPersonalizedRate || 0)}</strong></article>
                <article><span>Probable contratar personalizado</span><strong>{ratePercent(advanced.commercialMetrics?.likelyPersonalizedRate || 0)}</strong></article>
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Fuentes conectadas</h2>
                  <span>Lectura desde Google Sheets, actualizada cada minuto.</span>
                </div>
                <RefreshCcw size={18} />
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={sourceChart} margin={{ top: 8, right: 18, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="shortName" />
                  <YAxis domain={[0, 5]} />
                  <Tooltip formatter={(value, name, props) => name === "averageScore" ? [`${scoreLabel(Number(value))}/5`, `${props.payload.rows} respuestas`] : value} />
                  <Bar dataKey="averageScore" name="averageScore" fill="#33e6a4" radius={[5, 5, 0, 0]}>
                    <LabelList dataKey="rows" position="top" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="source-links">
                {(data?.sources || []).map((source: any) => (
                  <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    <span>{source.label}</span>
                  </a>
                ))}
              </div>
            </section>
          </div>

          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Índice comparativo por sede</h2>
                <span>Escala 1 a 5 homologando respuestas cualitativas y numéricas.</span>
              </div>
              <Building2 size={18} />
            </div>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={categoryChart} margin={{ top: 8, right: 18, bottom: 42, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="branch" interval={0} tick={<SplitTick />} height={58} />
                <YAxis domain={[0, 5]} />
                <Tooltip formatter={(value) => scoreLabel(Number(value))} />
                <Bar dataKey="general" name="Índice general" fill="#33e6a4" radius={[5, 5, 0, 0]} />
                <Bar dataKey="commercial" name="Comercial" fill="#6ea8e0" radius={[5, 5, 0, 0]} />
                <Bar dataKey="installations" name="Instalaciones / aseo" fill="#f5b944" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </>
      ) : null}

      {view === "sedes" ? (
        <>
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Diagnóstico por sede</h2>
                <span>Lectura adaptada del informe, enriquecida con datos vivos.</span>
              </div>
              <Building2 size={18} />
            </div>
            <div className="catalog-toolbar experience-toolbar">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar sede" />
              <button onClick={() => loadExperience(true).catch((currentError) => setError(currentError.message))}>
                <RefreshCcw size={16} />
                <span>Actualizar</span>
              </button>
            </div>
            <div className="branch-diagnosis-grid">
              {playbookRows.map((branch: any) => (
                <article key={branch.branch} className={branch.general < 3.7 ? "alert" : ""}>
                  <header>
                    <div>
                      <strong>{branch.branch}</strong>
                      <span>{branch.responses} respuestas · índice {scoreLabel(branch.general)}</span>
                    </div>
                    <b>{branch.weakestArea}</b>
                  </header>
                  <p>{branch.diagnosis}</p>
                  <div className="branch-score-strip">
                    <span>Inst. {scoreLabel(branch.installations)}</span>
                    <span>Planta {scoreLabel(branch.plantTrainers)}</span>
                    <span>Pers. {scoreLabel(branch.personalized)}</span>
                    <span>Com. {scoreLabel(branch.commercial)}</span>
                  </div>
                  <footer>
                    <strong>Acción</strong>
                    <span>{branch.action}</span>
                  </footer>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Mensajes por sede</h2>
                <span>Diferencial, objeción y servicio a comunicar para guion comercial.</span>
              </div>
              <Megaphone size={18} />
            </div>
            <div className="table-wrap small">
              <table>
                <thead><tr><th>Sede</th><th>Mensaje sugerido</th><th>Servicio a comunicar</th><th>Objeción / duda</th></tr></thead>
                <tbody>
                  {playbookRows.map((branch: any) => (
                    <tr key={branch.branch}>
                      <td>{branch.branch}</td>
                      <td>{branch.message}</td>
                      <td>{branch.serviceToCommunicate || branch.highlightedServices || "Personalizado / valoración"}</td>
                      <td>{branch.objection || branch.risk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {view === "oportunidades" ? (
        <>
          <div className="grid two experience-grid">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Oportunidad de personalizado</h2>
                  <span>Clientes que no lo usan y son probables/muy probables.</span>
                </div>
                <TrendingUp size={18} />
              </div>
              <ResponsiveContainer width="100%" height={330}>
                <BarChart data={opportunityChart} layout="vertical" margin={{ top: 4, right: 34, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="branch" type="category" width={132} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value, name, props) => [`${value} clientes`, `${props.payload.responses} respuestas`]} />
                  <Bar dataKey="candidates" fill="#33e6a4" radius={[0, 6, 6, 0]}>
                    <LabelList dataKey="candidates" position="right" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Temas en comentarios abiertos</h2>
                  <span>Menciones detectadas en respuestas abiertas.</span>
                </div>
                <MessageCircle size={18} />
              </div>
              <ResponsiveContainer width="100%" height={330}>
                <BarChart data={topicChart} layout="vertical" margin={{ top: 4, right: 34, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="theme" type="category" width={156} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${value} menciones`, "Tema"]} />
                  <Bar dataKey="mentions" fill="#f5b944" radius={[0, 6, 6, 0]}>
                    <LabelList dataKey="mentions" position="right" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>

          <div className="grid two experience-grid">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Alertas de experiencia</h2>
                  <span>Prioridad por calificación baja, tendencia o falta de respuestas recientes.</span>
                </div>
                <AlertTriangle size={18} />
              </div>
              <div className="experience-alert-list">
                {data?.alerts?.length ? data.alerts.map((alert: any, index: number) => (
                  <article key={`${alert.title}-${index}`} className={alert.tone}>
                    <strong>{alert.title}</strong>
                    <span>{alert.detail}</span>
                  </article>
                )) : (
                  <article className="green">
                    <strong>Sin alertas críticas</strong>
                    <span>Las respuestas actuales no muestran caídas fuertes ni sedes por debajo del umbral.</span>
                  </article>
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Comentarios para revisar</h2>
                  <span>Comentarios recientes o de menor calificación detectados en las encuestas.</span>
                </div>
                <MessageCircle size={18} />
              </div>
              <div className="experience-comments">
                {data?.comments?.length ? data.comments.map((item: any, index: number) => (
                  <article key={`${item.comment}-${index}`}>
                    <p>{item.comment}</p>
                    <footer>
                      <span>{item.branch}</span>
                      <span>{item.sourceLabel}</span>
                      <strong>{scoreLabel(item.score)}</strong>
                    </footer>
                  </article>
                )) : <Empty />}
              </div>
            </section>
          </div>
        </>
      ) : null}

      {view === "plan" ? (
        <>
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Plan de acción recomendado</h2>
                <span>Secuencia de implementación 15, 45 y 90 días.</span>
              </div>
              <ClipboardList size={18} />
            </div>
            <div className="action-plan-grid">
              {(advanced.actionPlan || []).map((phase: any) => (
                <article key={phase.phase}>
                  <strong>{phase.phase}</strong>
                  <ul>
                    {phase.actions.map((action: string) => <li key={action}>{action}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <div className="grid two experience-grid">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Guion comercial recomendado</h2>
                  <span>Venta consultiva y cierre con siguiente paso concreto.</span>
                </div>
                <ClipboardList size={18} />
              </div>
              <div className="script-list">
                {(advanced.salesScript || []).map((item: string, index: number) => (
                  <article key={item}><strong>{index + 1}</strong><span>{item}</span></article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Indicadores de éxito</h2>
                  <span>Metas iniciales para seguimiento directivo.</span>
                </div>
                <CheckSquare size={18} />
              </div>
              <div className="table-wrap small">
                <table>
                  <thead><tr><th>Indicador</th><th>Meta inicial</th></tr></thead>
                  <tbody>
                    {(advanced.successIndicators || []).map((item: any) => (
                      <tr key={item.indicator}><td>{item.indicator}</td><td>{item.target}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Riesgos si no se actúa</h2>
                <span>Riesgos comerciales y de experiencia identificados en el informe.</span>
              </div>
              <AlertTriangle size={18} />
            </div>
            <div className="risk-grid">
              {(advanced.risks || []).map((risk: string) => <article key={risk}>{risk}</article>)}
            </div>
          </section>
        </>
      ) : null}

      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Detalle por sede</h2>
            <span>Base operativa para seguimiento semanal de experiencia.</span>
          </div>
          <FileSpreadsheet size={18} />
        </div>
        <div className="table-wrap small">
          <table>
            <thead>
              <tr>
                <th>Sede</th>
                <th>Estado</th>
                <th>Promedio</th>
                <th>Respuestas</th>
                <th>Última respuesta</th>
              </tr>
            </thead>
            <tbody>
              {branchRows.map((branch: any) => (
                <tr key={branch.branch}>
                  <td>{branch.branch}</td>
                  <td><span className={`status ${branch.tone === "green" ? "high" : branch.tone === "amber" ? "medium" : branch.tone === "red" ? "low" : "pending"}`}>{branch.status}</span></td>
                  <td>{scoreLabel(branch.averageScore)}</td>
                  <td>{branch.responses}</td>
                  <td>{dateTimeLabel(branch.lastDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

