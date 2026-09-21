import React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Check, Crosshair, ExternalLink, MapPin, RefreshCcw, Search, Upload, X as CloseIcon } from "lucide-react";
import { currency, dateTimeLabel, Empty, Kpi } from "./common";

type Mode = "" | "add" | "locate";

const STATUS_LABEL: Record<string, string> = { confirmado: "Confirmado", por_verificar: "Por verificar", cerrado: "Cerrado", descartado: "Descartado" };
const CONFIDENCE_LABEL: Record<string, string> = { alta: "Fuente directa", media: "Precio de marca / informe", baja: "Prensa o dato antiguo" };
const CHANGE_LABEL: Record<string, string> = {
  precio: "Cambio de precio",
  promocion: "Cambio de promoción",
  plan_nuevo: "Plan nuevo",
  plan_retirado: "Plan retirado",
  dato_actualizado: "Dato actualizado",
  competidor_nuevo: "Competidor nuevo"
};

const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string));

const km = (meters?: number | null) => (meters == null ? "-" : meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`);

function statusClass(status: string) {
  if (status === "confirmado") return "high";
  if (status === "por_verificar") return "medium";
  return "pending";
}

function markerStyle(competitor: any) {
  const base = competitor.type === "indirecto" ? "#f5b944" : "#ff6b5e";
  const pending = competitor.status === "por_verificar";
  return { color: pending ? "#7a1f18" : "#5a120c", fillColor: base, fillOpacity: pending ? 0.55 : 0.95, weight: 2, dashArray: pending ? "3 2" : undefined };
}

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(path, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "No se pudo completar la acción");
  return json;
}

const jsonBody = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export function Competition({ setNotice }: { setNotice: (value: string) => void }) {
  const [data, setData] = React.useState<any>(null);
  const [busy, setBusy] = React.useState("");
  const [branchId, setBranchId] = React.useState<number | "all">("all");
  const [mode, setMode] = React.useState<Mode>("");
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<any>(null);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/competition", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "No se pudo cargar Competencia");
    setData(json);
  }, []);

  React.useEffect(() => {
    load().catch((error) => setNotice(error.message));
  }, [load, setNotice]);

  React.useEffect(() => {
    const events = new EventSource("/api/events");
    let timer: number | undefined;
    events.addEventListener("competition_updated", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => load().catch(() => undefined), 500);
    });
    return () => {
      window.clearTimeout(timer);
      events.close();
    };
  }, [load]);

  async function run(key: string, action: () => Promise<string | void>) {
    setBusy(key);
    try {
      const message = await action();
      if (message) setNotice(message);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo completar la acción");
    } finally {
      setBusy("");
    }
  }

  const branches: any[] = data?.branches ?? [];
  const mappable = branches.filter((b) => b.lat != null && b.lng != null && !["cerrada", "sin_ubicacion"].includes(b.locationStatus));
  const pendingBranches = branches.filter((b) => b.active && (b.lat == null || b.lng == null) && !["cerrada", "sin_ubicacion"].includes(b.locationStatus));
  const selectedBranch = branchId === "all" ? null : branches.find((b) => b.id === branchId) ?? null;
  const allCompetitors: any[] = data?.competitors ?? [];
  const competitors = allCompetitors.filter((c) => branchId === "all" || c.branchId === branchId);
  const selected = allCompetitors.find((c) => c.id === selectedId) ?? null;

  // ---- Mapa ----
  const mapEl = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const layerRef = React.useRef<L.LayerGroup | null>(null);
  const boundsRef = React.useRef<L.LatLngBounds | null>(null);
  const userMovedRef = React.useRef(false);
  const lastFitRef = React.useRef<number | "all" | null>(null);
  const modeRef = React.useRef<Mode>("");
  const branchRef = React.useRef<any>(null);
  modeRef.current = mode;
  branchRef.current = selectedBranch;

  const ready = Boolean(data);

  React.useEffect(() => {
    if (!ready || !mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true }).setView([4.65, -74.1], 11);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; colaboradores de OpenStreetMap",
      ...({ referrerPolicy: "origin" } as object)
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.on("click", (event: L.LeafletMouseEvent) => {
      const lat = Number(event.latlng.lat.toFixed(6));
      const lng = Number(event.latlng.lng.toFixed(6));
      if (modeRef.current === "add") {
        setDraft({ name: "", segment: "Gimnasio tradicional", website: "", instagram: "", lat, lng });
      } else if (modeRef.current === "locate" && branchRef.current) {
        setMode("");
        api(`/api/competition/branches/${branchRef.current.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat, lng }) })
          .then(() => load())
          .then(() => setNotice(`Ubicación de ${branchRef.current.name} actualizada.`))
          .catch((error) => setNotice(error.message));
      }
    });
    mapRef.current = map;
    // El contenedor cambia de tamano durante la animacion de entrada y al redimensionar la ventana.
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
      if (!userMovedRef.current && boundsRef.current?.isValid()) map.fitBounds(boundsRef.current.pad(0.08), { maxZoom: 16, animate: false });
    });
    observer.observe(mapEl.current);
    const markMoved = () => { userMovedRef.current = true; };
    mapEl.current.addEventListener("wheel", markMoved, { passive: true });
    mapEl.current.addEventListener("mousedown", markMoved);
    mapEl.current.addEventListener("touchstart", markMoved, { passive: true });
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [ready, load, setNotice]);

  React.useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !data) return;
    layer.clearLayers();
    const bounds = L.latLngBounds([]);
    for (const b of mappable) {
      if (branchId !== "all" && b.id !== branchId) continue;
      const circle = L.circle([b.lat, b.lng], { radius: b.radiusM, color: "#0a8f5f", weight: 3, dashArray: "8 8", fillColor: "#33e6a4", fillOpacity: 0.12 }).addTo(layer);
      L.circleMarker([b.lat, b.lng], { radius: 11, color: "#0b0d0f", weight: 3, fillColor: "#33e6a4", fillOpacity: 1 })
        .bindTooltip(`<strong>${esc(b.name)}</strong><br>Radio ${km(b.radiusM)}`, { direction: "top" })
        .on("click", () => setBranchId(b.id))
        .addTo(layer);
      bounds.extend(circle.getBounds());
    }
    for (const c of competitors) {
      if (c.lat == null || c.lng == null || c.status === "cerrado") continue;
      L.circleMarker([c.lat, c.lng], { radius: 8, ...markerStyle(c) })
        .bindTooltip(`<strong>${esc(c.name)}</strong><br>${esc(c.segment)} · ${km(c.distanceM)}${c.status === "por_verificar" ? "<br>Por verificar" : ""}`, { direction: "top" })
        .on("click", () => setSelectedId(c.id))
        .addTo(layer);
      bounds.extend([c.lat, c.lng]);
    }
    map.invalidateSize({ animate: false });
    // Solo se re-encuadra al cambiar de sede o si la persona no ha movido el mapa: una recarga de datos no debe quitarle su zoom.
    if (lastFitRef.current !== branchId) userMovedRef.current = false;
    lastFitRef.current = branchId;
    boundsRef.current = bounds.isValid() ? bounds : null;
    if (bounds.isValid() && !userMovedRef.current) map.fitBounds(bounds.pad(0.08), { maxZoom: 16, animate: false });
  }, [data, branchId, mappable.length, competitors.length]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const el = mapEl.current;
    if (el) el.style.cursor = mode ? "crosshair" : "";
  }, [mode]);

  // ---- Acciones ----
  const discover = () =>
    run("discover", async () => {
      const json = await api("/api/competition/discover", jsonBody({ branchId: branchId === "all" ? undefined : branchId }));
      const ok = (json.results ?? []).filter((item: any) => !item.error);
      const failed = (json.results ?? []).filter((item: any) => item.error);
      const added = ok.reduce((sum: number, item: any) => sum + item.added, 0);
      return `Búsqueda terminada: ${added} competidores nuevos por verificar${failed.length ? ` · sin respuesta de OpenStreetMap en ${failed.map((f: any) => f.branch).join(", ")}` : ""}.`;
    });

  const checkPrices = () =>
    run("prices", async () => {
      const json = await api("/api/competition/check-prices", jsonBody({}));
      const s = json.summary;
      return `Precios revisados: ${s.updated} competidores actualizados, ${s.changes} cambios, ${s.unreadable} sin precio público legible${s.failed ? `, ${s.failed} con error` : ""}.`;
    });

  const patchCompetitor = (id: number, body: Record<string, unknown>, message?: string) =>
    run(`c${id}`, async () => {
      await api(`/api/competition/competitors/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return message;
    });

  const pending = allCompetitors.filter((c) => c.status === "por_verificar");
  const changes: any[] = data?.changes ?? [];
  const weeklyRun = data?.runs?.precios_semanal;
  const lastPrices = [weeklyRun?.finishedAt, data?.runs?.precios_manual?.finishedAt].filter(Boolean).sort().at(-1);
  const withoutLocation = allCompetitors.filter((c) => c.lat == null || c.lng == null).length;
  const recentChanges = allCompetitors.reduce((sum, c) => sum + (c.recentChanges || 0), 0);

  if (!data) return <div className="view"><div className="loader" /></div>;

  return (
    <div className="view competition-view">
      <div className="kpi-grid kpi-strip-6">
        <Kpi label="Competidores en seguimiento" value={String(allCompetitors.filter((c) => c.status !== "cerrado").length)} sub={`${mappable.length} sedes en el mapa`} tone="blue" />
        <Kpi label="Por verificar" value={String(pending.length)} sub="revisa y confirma" tone={pending.length ? "amber" : "green"} />
        <Kpi label="Cambios (30 días)" value={String(recentChanges)} sub="precios y promociones" tone={recentChanges ? "red" : "green"} />
        <Kpi label="Última revisión de precios" value={lastPrices ? dateTimeLabel(lastPrices).split(",")[0] : "-"} sub={data.groqConfigured ? "automática cada 7 días" : "requiere clave de Groq"} tone="blue" />
        <Kpi label="Sin ubicación" value={String(withoutLocation + pendingBranches.length)} sub="competidores o sedes" tone={withoutLocation + pendingBranches.length ? "amber" : "green"} />
      </div>

      <section className="panel competition-toolbar">
        <div className="panel-title">
          <div>
            <h2>Competencia</h2>
            <span className="chart-caption">Mapa de cada sede, competidores cercanos y seguimiento semanal de precios. Fuentes: OpenStreetMap, páginas públicas y tus informes; la IA (Groq) interpreta y tú confirmas.</span>
          </div>
          <MapPin size={18} />
        </div>
        <div className="competition-chips">
          <button className={branchId === "all" ? "chip active" : "chip"} onClick={() => setBranchId("all")}>Todas las sedes</button>
          {mappable.map((b) => (
            <button key={b.id} className={branchId === b.id ? "chip active" : "chip"} onClick={() => setBranchId(b.id)}>{b.name} · {allCompetitors.filter((c) => c.branchId === b.id).length}</button>
          ))}
          {pendingBranches.map((b) => (
            <button key={b.id} className={branchId === b.id ? "chip active warn" : "chip warn"} onClick={() => setBranchId(b.id)} title="Sede sin ubicación">{b.name} · ubicar</button>
          ))}
        </div>
        <div className="competition-actions">
          <button className="secondary-button" onClick={discover} disabled={Boolean(busy) || data.discovering || (branchId !== "all" && !selectedBranch?.lat)}>
            <Search size={15} /> {busy === "discover" ? "Buscando…" : branchId === "all" ? "Buscar competidores en todas las sedes" : `Buscar cerca de ${selectedBranch?.name}`}
          </button>
          <button className="secondary-button" onClick={checkPrices} disabled={Boolean(busy) || !data.groqConfigured} title={data.groqConfigured ? "" : "Configura la clave de Groq"}>
            <RefreshCcw size={15} /> {busy === "prices" ? "Revisando…" : "Actualizar precios ahora"}
          </button>
          <button className="secondary-button" onClick={() => setReportOpen(true)} disabled={Boolean(busy)}>
            <Upload size={15} /> Subir informe
          </button>
          <button className={mode === "add" ? "secondary-button active" : "secondary-button"} onClick={() => { setMode(mode === "add" ? "" : "add"); setSelectedId(null); }}>
            <Crosshair size={15} /> {mode === "add" ? "Haz clic en el mapa…" : "Agregar competidor en el mapa"}
          </button>
        </div>
        {data.discovering ? (
          <p className="competition-info"><span className="competition-spinner" /> Buscando competidores cerca de tus sedes en OpenStreetMap… Aparecerán aquí a medida que se encuentren (1 a 3 minutos la primera vez).</p>
        ) : !allCompetitors.length ? (
          <p className="competition-info">Todavía no hay competidores. La búsqueda automática se ejecuta al abrir DashCom con internet; también puedes iniciarla con «Buscar competidores».</p>
        ) : null}
        {!data.groqConfigured ? <p className="competition-warning">Falta la clave de Groq: sin ella no se interpretan informes ni se revisan precios. Configúrala en Configuración.</p> : null}
      </section>

      <div className="competition-grid">
        <section className="panel competition-map-panel">
          <div ref={mapEl} className="competition-map" />
          <div className="competition-legend">
            <span><i style={{ background: "#33e6a4" }} /> Sede propia y radio</span>
            <span><i style={{ background: "#ff6b5e" }} /> Competidor directo</span>
            <span><i style={{ background: "#f5b944" }} /> Indirecto (CrossFit, pilates, etc.)</span>
            <span><i className="hollow" /> Por verificar</span>
          </div>
        </section>

        <aside className="competition-side">
          {draft ? (
            <NewCompetitor draft={draft} onCancel={() => { setDraft(null); setMode(""); }} onSave={(body) => run("new", async () => {
              await api("/api/competition/competitors", jsonBody(body));
              setDraft(null);
              setMode("");
              return `${body.name} agregado al mapa.`;
            })} />
          ) : selected ? (
            <CompetitorDetail key={selected.id} competitor={selected} busy={busy} onClose={() => setSelectedId(null)} onPatch={patchCompetitor}
              onPrice={(body) => run(`p${selected.id}`, async () => {
                await api(`/api/competition/competitors/${selected.id}/prices`, jsonBody(body));
                return "Precio guardado.";
              })}
              onCheck={() => run(`k${selected.id}`, async () => {
                const json = await api("/api/competition/check-prices", jsonBody({ competitorId: selected.id }));
                return json.summary.updated ? "Precios revisados en su página." : selected.pricingUrl || selected.chain ? "No se encontraron precios públicos legibles en su página." : "Este competidor no tiene página de precios registrada.";
              })} />
          ) : selectedBranch ? (
            <BranchLocation key={selectedBranch.id} branch={selectedBranch} busy={busy} mode={mode} setMode={setMode}
              onSave={(body) => run("branch", async () => {
                await api(`/api/competition/branches/${selectedBranch.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                return `Sede ${selectedBranch.name} actualizada.`;
              })} />
          ) : (
            <div className="panel competition-hint">
              <h3>¿Cómo funciona?</h3>
              <ol>
                <li>Elige una sede para ver su radio y ajustarlo o ubicarla.</li>
                <li>«Buscar competidores» consulta OpenStreetMap y deja los hallazgos <b>por verificar</b>.</li>
                <li>Sube un informe: la IA actualiza los competidores que ya existen y crea los nuevos.</li>
                <li>Cada semana se revisan las páginas de precios registradas y se avisan los cambios.</li>
              </ol>
            </div>
          )}
        </aside>
      </div>

      {pending.length ? (
        <section className="panel">
          <div className="panel-title"><h2>Por verificar ({pending.length})</h2><span className="chart-caption">Hallazgos automáticos: confirma los que compiten de verdad y descarta el resto.</span></div>
          <div className="competition-queue">
            {pending.slice(0, 30).map((c) => (
              <article key={c.id} className="competition-queue-item">
                <div>
                  <strong>{c.name}</strong>
                  <small>{c.branchName || "Sin sede"} · {km(c.distanceM)} · {c.segment || "-"} · {c.source === "osm" ? "OpenStreetMap" : c.source}</small>
                  {c.notes && c.notes.startsWith("Coincide") ? <small className="competition-alert">{c.notes}</small> : null}
                </div>
                <div className="competition-queue-actions">
                  <button className="secondary-button" onClick={() => setSelectedId(c.id)}>Ver</button>
                  <button className="secondary-button" onClick={() => patchCompetitor(c.id, { status: "confirmado" }, `${c.name} confirmado.`)} disabled={Boolean(busy)}><Check size={14} /> Confirmar</button>
                  <button className="secondary-button" onClick={() => patchCompetitor(c.id, { status: "descartado" }, `${c.name} descartado.`)} disabled={Boolean(busy)}><CloseIcon size={14} /> Descartar</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Precios de la competencia {selectedBranch ? `· ${selectedBranch.name}` : ""}</h2>
            <span className="chart-caption">Precios observados con su fuente y fecha. «Precio de marca» puede variar por sede; lo que no es público queda sin dato.</span>
          </div>
        </div>
        {data.ownPlans?.length ? (
          <div className="competition-own">
            <strong>Tu oferta (mensual):</strong>
            {data.ownPlans.map((p: any) => <span key={p.name} className="chip static">{p.name} · {currency(p.monthly)}</span>)}
          </div>
        ) : null}
        <PriceTable competitors={competitors} onSelect={setSelectedId} />
      </section>

      <section className="panel">
        <div className="panel-title"><h2>Cambios recientes</h2><span className="chart-caption">Detectados en la revisión semanal, en informes o al editar.</span></div>
        {changes.length ? (
          <div className="table-wrap small">
            <table>
              <thead><tr><th>Fecha</th><th>Competidor</th><th>Tipo</th><th>Plan / dato</th><th>Antes</th><th>Ahora</th></tr></thead>
              <tbody>
                {changes.map((ch) => (
                  <tr key={ch.id}>
                    <td>{dateTimeLabel(ch.createdAt)}</td>
                    <td><button className="link-button" onClick={() => setSelectedId(ch.competitorId)}>{ch.competitor}</button></td>
                    <td><span className={`status ${ch.kind === "precio" ? "low" : ch.kind === "promocion" || ch.kind === "plan_nuevo" ? "medium" : "pending"}`}>{CHANGE_LABEL[ch.kind] ?? ch.kind}</span></td>
                    <td>{ch.plan || "-"}</td>
                    <td>{ch.oldValue || "-"}</td>
                    <td>{ch.newValue || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty />}
      </section>

      {reportOpen ? (
        <ReportDialog onClose={() => setReportOpen(false)} groqConfigured={data.groqConfigured} onDone={(message) => { setReportOpen(false); setNotice(message); load().catch(() => undefined); }} />
      ) : null}
    </div>
  );
}

function PriceTable({ competitors, onSelect }: { competitors: any[]; onSelect: (id: number) => void }) {
  if (!competitors.length) return <Empty />;
  return (
    <div className="table-wrap">
      <table className="competition-table">
        <thead>
          <tr><th>Competidor</th><th>Sede · distancia</th><th>Plan</th><th>Precio / mes</th><th>Matrícula</th><th>Promoción</th><th>Verificado</th></tr>
        </thead>
        <tbody>
          {competitors.map((c) => {
            const rows = c.prices.length ? c.prices : [null];
            return rows.map((p: any, index: number) => (
              <tr key={`${c.id}-${p?.id ?? "none"}`} className={index === 0 ? "competition-first" : ""}>
                {index === 0 ? (
                  <>
                    <td rowSpan={rows.length}>
                      <button className="link-button" onClick={() => onSelect(c.id)}><strong>{c.name}</strong></button>
                      <div className="competition-sub">
                        <span className={`status ${statusClass(c.status)}`}>{STATUS_LABEL[c.status] ?? c.status}</span>
                        {c.type === "indirecto" ? <span className="status pending">Indirecto</span> : null}
                        {c.recentChanges ? <span className="status low">{c.recentChanges} cambio{c.recentChanges > 1 ? "s" : ""}</span> : null}
                      </div>
                    </td>
                    <td rowSpan={rows.length}>{c.branchName || "-"}<div className="competition-sub">{km(c.distanceM)}</div></td>
                  </>
                ) : null}
                {p ? (
                  <>
                    <td>{p.plan}</td>
                    <td className="num">
                      {p.monthly != null ? currency(p.monthly) : p.price != null ? `${currency(p.price)} / ${p.period || "periodo"}` : "-"}
                      {p.monthly != null && p.price != null && Math.round(p.monthly) !== Math.round(p.price) ? <div className="competition-sub">({currency(p.price)} por {p.period})</div> : null}
                    </td>
                    <td className="num">{p.enrollmentFee != null ? currency(p.enrollmentFee) : "-"}</td>
                    <td>{p.promo || "-"}</td>
                    <td>
                      {new Date(p.observedAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                      <div className="competition-sub" title={CONFIDENCE_LABEL[p.confidence] ?? ""}>{p.source} · {p.confidence}
                        {p.sourceUrl ? <> · <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" title="Ver fuente"><ExternalLink size={11} /></a></> : null}
                      </div>
                    </td>
                  </>
                ) : (
                  <td colSpan={5} className="competition-nodata">Sin precio público verificado{c.lastCheckNote ? ` · ${c.lastCheckNote}` : ""}. Ábrelo para agregarlo o subir un informe.</td>
                )}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

function BranchLocation({ branch, busy, mode, setMode, onSave }: { branch: any; busy: string; mode: Mode; setMode: (mode: Mode) => void; onSave: (body: any) => void }) {
  const [mapsUrl, setMapsUrl] = React.useState(branch.mapsUrl || "");
  const [address, setAddress] = React.useState(branch.address || "");
  const [radius, setRadius] = React.useState(String(branch.radiusM));
  const located = branch.lat != null && branch.lng != null;
  return (
    <div className="panel competition-detail">
      <h3>{branch.name}</h3>
      <p className="chart-caption">
        {located ? `Ubicada: ${Number(branch.lat).toFixed(5)}, ${Number(branch.lng).toFixed(5)}` : "Sin ubicación: pega el enlace de Google Maps, escribe la dirección o marca el punto en el mapa."}
      </p>
      <label>Enlace de Google Maps
        <input value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} placeholder="https://maps.app.goo.gl/…" />
      </label>
      <label>Dirección
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle 24 # 73F-07, Bogotá" />
      </label>
      <div className="add-row">
        <button onClick={() => onSave({ mapsUrl: mapsUrl || undefined, address: !mapsUrl && address ? address : address || undefined })} disabled={Boolean(busy) || (!mapsUrl && !address)}>
          {busy === "branch" ? "Guardando…" : "Ubicar con enlace o dirección"}
        </button>
        <button className={mode === "locate" ? "secondary-button active" : "secondary-button"} onClick={() => setMode(mode === "locate" ? "" : "locate")}>
          <Crosshair size={14} /> {mode === "locate" ? "Haz clic en el mapa…" : "Marcar en el mapa"}
        </button>
      </div>
      <label>Radio de vigilancia (metros)
        <input type="number" min={300} max={5000} step={100} value={radius} onChange={(e) => setRadius(e.target.value)} />
      </label>
      <div className="add-row">
        <button onClick={() => onSave({ radiusM: Number(radius) })} disabled={Boolean(busy) || Number(radius) === branch.radiusM}>Guardar radio</button>
      </div>
      <p className="chart-caption">Bogotá densa: 1 a 1,5 km. Ciudades intermedias o zonas con pocos gimnasios: 2 a 3 km.</p>
    </div>
  );
}

function NewCompetitor({ draft, onCancel, onSave }: { draft: any; onCancel: () => void; onSave: (body: any) => void }) {
  const [form, setForm] = React.useState(draft);
  return (
    <div className="panel competition-detail">
      <h3>Nuevo competidor</h3>
      <p className="chart-caption">Punto marcado: {form.lat}, {form.lng}. Se asigna a la sede más cercana.</p>
      <label>Nombre<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></label>
      <label>Segmento
        <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}>
          <option>Gimnasio tradicional</option><option>Low cost</option><option>Premium</option><option>Funcional / CrossFit</option><option>Boutique (pilates / yoga)</option><option>Artes marciales / otros deportes</option>
        </select>
      </label>
      <label>Sitio web / página de planes<input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" /></label>
      <label>Instagram<input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@usuario" /></label>
      <div className="add-row">
        <button onClick={() => onSave({ ...form, pricingUrl: form.website })} disabled={!form.name.trim()}>Guardar</button>
        <button className="secondary-button" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function CompetitorDetail({ competitor: c, busy, onClose, onPatch, onPrice, onCheck }: {
  competitor: any; busy: string; onClose: () => void; onPatch: (id: number, body: Record<string, unknown>, message?: string) => void; onPrice: (body: any) => void; onCheck: () => void;
}) {
  const [form, setForm] = React.useState({
    name: c.name, segment: c.segment, website: c.website, pricingUrl: c.pricingUrl, instagram: c.instagram, facebook: c.facebook, whatsapp: c.whatsapp, phone: c.phone, notes: c.notes
  });
  const [price, setPrice] = React.useState({ plan: "", price: "", period: "mes", promo: "" });
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value });
  return (
    <div className="panel competition-detail">
      <div className="competition-detail-head">
        <h3>{c.name}</h3>
        <button className="icon-button" onClick={onClose} title="Cerrar"><CloseIcon size={16} /></button>
      </div>
      <p className="chart-caption">
        <span className={`status ${statusClass(c.status)}`}>{STATUS_LABEL[c.status] ?? c.status}</span>{" "}
        {c.branchName || "Sin sede"} · {km(c.distanceM)}{c.chain ? ` · cadena ${c.chain}` : ""}{c.verifiedAt ? ` · verificado ${new Date(c.verifiedAt).toLocaleDateString("es-CO")}` : ""}
      </p>
      {c.notes ? <p className="competition-alert">{c.notes}</p> : null}
      {c.lastCheckedAt ? <p className="chart-caption">Última revisión de su página: {dateTimeLabel(c.lastCheckedAt)} · {c.lastCheckNote}</p> : null}
      <div className="add-row">
        {c.status !== "confirmado" ? <button onClick={() => onPatch(c.id, { status: "confirmado" }, `${c.name} confirmado.`)} disabled={Boolean(busy)}><Check size={14} /> Confirmar</button> : null}
        <button className="secondary-button" onClick={() => onPatch(c.id, { status: "cerrado" }, `${c.name} marcado como cerrado.`)} disabled={Boolean(busy)}>Cerró</button>
        <button className="secondary-button" onClick={() => { onPatch(c.id, { status: "descartado" }, `${c.name} descartado.`); onClose(); }} disabled={Boolean(busy)}>Descartar</button>
      </div>
      <label>Nombre<input value={form.name} onChange={set("name")} /></label>
      <label>Segmento<input value={form.segment} onChange={set("segment")} /></label>
      <label>Sitio web<input value={form.website} onChange={set("website")} placeholder="https://" /></label>
      <label>Página de planes y precios (se revisa cada semana)<input value={form.pricingUrl} onChange={set("pricingUrl")} placeholder="https://" /></label>
      <div className="competition-two">
        <label>Instagram<input value={form.instagram} onChange={set("instagram")} placeholder="usuario" /></label>
        <label>Facebook<input value={form.facebook} onChange={set("facebook")} /></label>
        <label>WhatsApp<input value={form.whatsapp} onChange={set("whatsapp")} /></label>
        <label>Teléfono<input value={form.phone} onChange={set("phone")} /></label>
      </div>
      <label>Notas<textarea value={form.notes} onChange={set("notes")} rows={2} /></label>
      <div className="add-row">
        <button onClick={() => onPatch(c.id, form, "Datos guardados.")} disabled={Boolean(busy)}>Guardar datos</button>
        <button className="secondary-button" onClick={onCheck} disabled={Boolean(busy)}><RefreshCcw size={14} /> Revisar su página ahora</button>
      </div>
      <h4>Agregar precio observado</h4>
      <div className="competition-two">
        <label>Plan<input value={price.plan} onChange={(e) => setPrice({ ...price, plan: e.target.value })} placeholder="Mensual" /></label>
        <label>Precio (COP)<input value={price.price} onChange={(e) => setPrice({ ...price, price: e.target.value })} placeholder="99000" inputMode="numeric" /></label>
        <label>Periodo
          <select value={price.period} onChange={(e) => setPrice({ ...price, period: e.target.value })}>
            <option value="mes">Mensual</option><option value="trimestre">Trimestre</option><option value="semestre">Semestre</option><option value="ano">Año</option><option value="unico">Pago único</option>
          </select>
        </label>
        <label>Promoción<input value={price.promo} onChange={(e) => setPrice({ ...price, promo: e.target.value })} /></label>
      </div>
      <div className="add-row">
        <button onClick={() => { onPrice(price); setPrice({ plan: "", price: "", period: "mes", promo: "" }); }} disabled={Boolean(busy) || !price.plan.trim() || !price.price.trim()}>Guardar precio</button>
      </div>
    </div>
  );
}

function ReportDialog({ onClose, onDone, groqConfigured }: { onClose: () => void; onDone: (message: string) => void; groqConfigured: boolean }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState<any>(null);
  const input = React.useRef<HTMLInputElement | null>(null);

  async function send() {
    setSending(true);
    setError("");
    try {
      const form = new FormData();
      if (file) form.append("file", file);
      if (text.trim()) form.append("text", text.trim());
      const res = await fetch("/api/competition/report", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "No se pudo interpretar el informe");
      setResult(json.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo interpretar el informe");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="export-dialog competition-report">
        <header>
          <div><h2>Subir informe de competencia</h2><p>La IA lee el informe, actualiza los competidores que ya existen y crea los nuevos como «por verificar».</p></div>
          <button className="icon-button" onClick={onClose} title="Cerrar"><CloseIcon size={16} /></button>
        </header>
        {result ? (
          <div className="competition-result">
            <p><strong>{result.created}</strong> nuevos · <strong>{result.updated}</strong> actualizados · <strong>{result.prices}</strong> precios · <strong>{result.changes}</strong> cambios detectados</p>
            <ul>{result.competitors.map((item: any, i: number) => <li key={i}>{item.name} — {item.action}{item.plans ? ` (${item.plans} planes)` : ""}</li>)}</ul>
            {result.warnings?.length ? <p className="competition-alert">Advertencias de la IA: {result.warnings.join(" · ")}</p> : null}
            <footer><button onClick={() => onDone(`Informe procesado: ${result.created} competidores nuevos, ${result.updated} actualizados, ${result.prices} precios.`)}>Listo</button></footer>
          </div>
        ) : (
          <>
            {!groqConfigured ? <p className="competition-warning">Configura la clave de Groq en Configuración para interpretar informes.</p> : null}
            <div className="competition-upload">
              <input ref={input} type="file" accept=".xlsx,.csv,.txt,.md,.json,.tsv" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <button className="secondary-button" onClick={() => input.current?.click()}><Upload size={14} /> {file ? file.name : "Elegir archivo (.xlsx, .csv, .txt, .md)"}</button>
              <small>Para PDF o Word, copia el texto y pégalo abajo.</small>
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={9} placeholder="…o pega aquí el texto del informe (competidores, direcciones, redes, planes, precios y promociones)." />
            {error ? <p className="competition-warning">{error}</p> : null}
            <footer>
              <button className="secondary-button" onClick={onClose}>Cancelar</button>
              <button onClick={send} disabled={sending || !groqConfigured || (!file && text.trim().length < 20)}>{sending ? "Interpretando con IA…" : "Interpretar y actualizar"}</button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
