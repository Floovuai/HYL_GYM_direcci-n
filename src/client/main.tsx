import React from "react";
import ReactDOM from "react-dom/client";
import {
  FileText,
  LogOut,
  Menu,
  RefreshCcw,
  Upload,
  X as CloseIcon
} from "lucide-react";
import { TabId, AppState, DashComMark, tabs, monthOptions, currency, coverageLabel, validateExcelFile, importSummaryNotice, currentPeriod } from "./common";
import "./styles.css";

// Cada vista se descarga solo cuando se abre (code splitting).
function lazyView<K extends string>(load: () => Promise<Record<K, React.ComponentType<any>>>, name: K) {
  return React.lazy(() => load().then((module) => ({ default: module[name] })));
}
const Dashboard = lazyView(() => import("./Dashboard"), "Dashboard");
const MonthProjection = lazyView(() => import("./Projection"), "MonthProjection");
const Advisors = lazyView(() => import("./Advisors"), "Advisors");
const Branches = lazyView(() => import("./Branches"), "Branches");
const Marketing = lazyView(() => import("./Marketing"), "Marketing");
const SalesTrends = lazyView(() => import("./Trends"), "SalesTrends");
const Direction = lazyView(() => import("./Direction"), "Direction");
const AiChat = lazyView(() => import("./Assistant"), "AiChat");
const Configuration = lazyView(() => import("./Configuration"), "Configuration");
const ConsultaApp = lazyView(() => import("./Consulta"), "ConsultaApp");
const Evolution = lazyView(() => import("./Evolution"), "Evolution");

function App() {
  const initialPeriod = React.useMemo(currentPeriod, []);
  const [tab, setTab] = React.useState<TabId>("dashboard");
  const [state, setState] = React.useState<AppState | null>(null);
  const [year, setYear] = React.useState(initialPeriod.year);
  const [month, setMonth] = React.useState(initialPeriod.month);
  const [loading, setLoading] = React.useState(true);
  const [notice, setNotice] = React.useState("");
  const [exportOpen, setExportOpen] = React.useState(false);
  const [uploadingExcel, setUploadingExcel] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement | null>(null);

  const requestSeq = React.useRef(0);
  const hasState = React.useRef(false);
  const lastEtag = React.useRef({ key: "", etag: "" });
  const inFlight = React.useRef<{ key: string; promise: Promise<void> } | null>(null);

  // Carga del estado. Los refrescos automaticos (silent) se agrupan con una carga
  // ya en curso, no muestran el indicador y usan revalidacion ETag (304 si nada cambio).
  // Las cargas explicitas siempre consultan y una respuesta vieja nunca pisa a una nueva.
  const load = React.useCallback((options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    const key = `${year}-${month}`;
    if (silent && inFlight.current?.key === key) return inFlight.current.promise;
    const seq = ++requestSeq.current;
    if (!silent || !hasState.current) setLoading(true);
    const promise = (async () => {
      try {
        const res = await fetch(`/api/state?year=${year}&month=${month}`, { cache: "no-cache" });
        const etag = res.headers.get("etag") || "";
        // Mismo ETag para el mismo periodo: los datos no cambiaron, no se vuelve a pintar.
        if (res.ok && etag && hasState.current && lastEtag.current.key === key && lastEtag.current.etag === etag) return;
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "No se pudo cargar el estado");
        if (seq === requestSeq.current) {
          lastEtag.current = { key, etag };
          setState(json);
          hasState.current = true;
        }
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    })().finally(() => {
      if (inFlight.current?.promise === promise) inFlight.current = null;
    });
    inFlight.current = { key, promise };
    return promise;
  }, [year, month]);

  // Varios eventos en tiempo real seguidos (una importacion emite varios) generan una sola recarga.
  const reloadTimer = React.useRef<number | undefined>(undefined);
  const scheduleReload = React.useCallback(() => {
    window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => {
      load({ silent: true }).catch((error) => setNotice(error.message));
    }, 400);
  }, [load]);
  React.useEffect(() => () => window.clearTimeout(reloadTimer.current), []);

  React.useEffect(() => {
    load().catch((error) => {
      setNotice(error.message);
      setLoading(false);
    });
  }, [load]);

  React.useEffect(() => {
    function logClientError(message: string, details: Record<string, unknown> = {}) {
      fetch("/api/debug/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "DC-UI-001",
          userMessage: "La interfaz encontro un error.",
          technicalMessage: message,
          path: window.location.pathname,
          details
        })
      }).catch(() => undefined);
    }
    const onError = (event: ErrorEvent) => logClientError(event.message, { source: event.filename, line: event.lineno, column: event.colno });
    const onUnhandled = (event: PromiseRejectionEvent) => logClientError(String((event.reason as Error)?.message || event.reason || "Promesa rechazada"));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);

  React.useEffect(() => {
    const events = new EventSource("/api/events");
    events.addEventListener("sales_updated", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        const rows = Number(payload.rowsInserted ?? payload.summary?.rowsInserted ?? 0);
        setNotice(rows > 0 ? `Ventas actualizadas en tiempo real: ${rows} nuevas.` : "Sincronizacion de ventas revisada.");
      } catch {
        setNotice("Ventas actualizadas en tiempo real.");
      }
      scheduleReload();
    });
    events.addEventListener("evo_sync", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        if (payload.status === "ok") {
          const rows = Number(payload.summary?.rowsInserted ?? 0);
          if (rows > 0) setNotice(`EVO importó ${rows} ventas nuevas.`);
        }
      } catch {
        // Evento informativo no critico.
      }
    });
    events.addEventListener("catalog_updated", () => {
      setNotice("Catalogo de planes EVO actualizado.");
      scheduleReload();
    });
    events.addEventListener("member_evolution_updated", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        const rows = Number(payload.summary?.rowsInserted ?? 0);
        setNotice(`Evolución de miembros actualizada: ${rows} sedes.`);
      } catch {
        setNotice("Evolución de miembros actualizada.");
      }
      scheduleReload();
    });
    events.addEventListener("access_entries_updated", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        const rows = Number(payload.summary?.rowsInserted ?? 0);
        setNotice(rows > 0 ? `Entradas EVO actualizadas: ${rows} nuevas.` : "Entradas EVO revisadas.");
      } catch {
        setNotice("Entradas EVO actualizadas.");
      }
      scheduleReload();
    });
    events.onerror = () => {
      setNotice("Reconectando actualizaciones en tiempo real...");
    };
    return () => events.close();
  }, [scheduleReload]);

  React.useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        load({ silent: true }).catch((error) => setNotice(error.message));
      }
    }
    const timer = window.setInterval(() => {
      refreshWhenVisible();
    }, 60_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [load]);

  async function uploadExcel(file: File) {
    validateExcelFile(file);
    const data = new FormData();
    data.append("file", file);
    setUploadingExcel(true);
    setNotice(`Importando ${file.name}...`);
    try {
      const res = await fetch("/api/import/sales-excel", { method: "POST", body: data });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo importar");
      setNotice(importSummaryNotice("Ventas importadas", json.summary, `Valor: ${currency(json.summary.totalValue || 0)}`));
      await load();
    } finally {
      setUploadingExcel(false);
    }
  }

  if (!state && loading) {
    return <div className="boot">Cargando DashCom</div>;
  }

  return (
    <main className="app">
      <aside className={`sidebar${menuOpen ? " open" : ""}`}>
        <div className="brand">
          <DashComMark size={30} />
          <div>
            <strong>DashCom</strong>
            <span>Dashboard Comercial</span>
          </div>
          <button
            type="button"
            className="menu-toggle"
            aria-label={menuOpen ? "Cerrar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <CloseIcon size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <nav>
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={tab === item.id ? "active" : ""}
                onClick={() => {
                  setTab(item.id);
                  setMenuOpen(false);
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <button className="logout" onClick={() => { window.location.href = "/logout"; }}>
          <LogOut size={18} />
          <span>Salir</span>
        </button>
      </aside>
      {menuOpen ? <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" /> : null}

      <section className={`workspace ${tab === "dashboard" ? "dashboard-workspace" : ""} ${tab === "branches" ? "branches-workspace" : ""} ${tab === "projection" ? "projection-workspace" : ""} ${tab === "settings" ? "settings-workspace" : ""} ${tab === "assistant" ? "assistant-workspace" : ""}`}>
        <header className="topbar">
          <div>
            <h1>{tabs.find((item) => item.id === tab)?.label}</h1>
            <p>{state?.filters.selectedMonthName} {state?.filters.selectedYear}</p>
            {state ? <small className="data-coverage">{coverageLabel(state)}</small> : null}
          </div>
          <div className="actions">
            <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {(state?.filters.years?.length ? state.filters.years : [2026]).map((item: number) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
              {monthOptions.map((item, index) => (
                <option key={item} value={index + 1}>{item}</option>
              ))}
            </select>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadExcel(file).catch((error) => setNotice(error.message));
                event.currentTarget.value = "";
              }}
            />
            <button title="Cargar Excel" onClick={() => fileInput.current?.click()} disabled={uploadingExcel}>
              <Upload size={18} />
              <span>{uploadingExcel ? "Importando..." : "Excel"}</span>
            </button>
            <button title="Exportar PDF" onClick={() => setExportOpen(true)}>
              <FileText size={18} />
              <span>PDF</span>
            </button>
            <button title="Actualizar" onClick={() => load().catch((error) => setNotice(error.message))}>
              <RefreshCcw size={18} />
            </button>
          </div>
        </header>

        {notice ? <div className="notice">{notice}</div> : null}
        {loading ? <div className="loader" /> : null}
        {state ? (
          <React.Suspense fallback={<div className="loader" />}>
            {tab === "dashboard" && <Dashboard state={state} />}
            {tab === "projection" && <MonthProjection state={state} year={year} month={month} />}
            {tab === "advisors" && <Advisors state={state} year={year} month={month} onReload={load} />}
            {tab === "branches" && <Branches state={state} year={year} month={month} onReload={load} setNotice={setNotice} />}
            {tab === "evolution" && <Evolution setNotice={setNotice} />}
            {tab === "marketing" && <Marketing state={state} onReload={load} setNotice={setNotice} />}
            {tab === "trends" && <SalesTrends state={state} onReload={load} setNotice={setNotice} />}
            {tab === "direction" && <Direction state={state} year={year} month={month} onReload={load} setNotice={setNotice} />}
            {tab === "assistant" && <AiChat state={state} year={year} month={month} setNotice={setNotice} />}
            {tab === "settings" && <Configuration state={state} onReload={load} setNotice={setNotice} />}
            {exportOpen ? <ExportDialog state={state} year={year} month={month} onClose={() => setExportOpen(false)} /> : null}
          </React.Suspense>
        ) : null}
      </section>
    </main>
  );
}

const pdfSections = [
  { id: "summary", label: "Resumen ejecutivo", description: "KPI principales, hallazgos y lectura general." },
  { id: "charts", label: "Graficos gerenciales", description: "Visuales de sedes, asesores, planes y tendencia." },
  { id: "daily", label: "Informe diario", description: "Ventas por dia y mejores dias del mes." },
  { id: "monthly", label: "Informe mensual", description: "Evolucion mes a mes con metas y avance." },
  { id: "churn", label: "Churn y miembros", description: "Evolución de activos, churn directo y salida bruta por sede." },
  { id: "annual", label: "Informe anual", description: "Acumulado del ano y comparativos clave." },
  { id: "branches", label: "Sedes", description: "Rendimiento mensual, anual, meta y score." },
  { id: "advisors", label: "Asesores", description: "Ventas, comisiones y score comercial." },
  { id: "plans", label: "Planes", description: "Ventas por plan, registros y score del plan." },
  { id: "scores", label: "Scores", description: "Score de sedes, asesores y planes." },
  { id: "quality", label: "Calidad de datos", description: "Duplicados, llaves unicas y datos por revisar." },
  { id: "recommendations", label: "Acciones sugeridas", description: "Recomendaciones calculadas por la plataforma." }
];

function ExportDialog({ state, year, month, onClose }: { state: AppState; year: number; month: number; onClose: () => void }) {
  const [selected, setSelected] = React.useState(() => new Set(pdfSections.map((item) => item.id)));
  const [includeGroq, setIncludeGroq] = React.useState(false);
  const groqConfigured = state.settings.groq_api_key_configured === "true";

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = selected.size === pdfSections.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(pdfSections.map((item) => item.id)));
  }

  function exportPdf() {
    const sections = Array.from(selected);
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
      sections: sections.join(","),
      includeGroq: includeGroq ? "1" : "0"
    });
    window.open(`/api/export/gerencial.pdf?${params.toString()}`, "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="export-dialog">
        <header>
          <div>
            <h2>Exportar informe PDF</h2>
            <p>{state.filters.selectedMonthName} {state.filters.selectedYear}</p>
          </div>
          <button className="icon-button" onClick={onClose} title="Cerrar">X</button>
        </header>
        <div className="export-select-all">
          <button className="secondary-button" onClick={toggleAll}>{allSelected ? "Desmarcar todo" : "Marcar todo"}</button>
          <span>{selected.size} de {pdfSections.length} secciones seleccionadas</span>
        </div>
        <div className="export-grid">
          {pdfSections.map((item) => (
            <label key={item.id} className="check-row">
              <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </label>
          ))}
        </div>
        <label className="check-row ai-option">
          <input type="checkbox" checked={includeGroq} onChange={(event) => setIncludeGroq(event.target.checked)} disabled={!groqConfigured} />
          <span>
            <strong>Incluir sugerencias guiadas por Groq</strong>
            <small>{groqConfigured ? "Agrega analisis ejecutivo generado con IA al PDF." : "Groq no esta configurado."}</small>
          </span>
        </label>
        <footer>
          <button className="secondary-button" onClick={onClose}>Cancelar</button>
          <button className="silver-button" onClick={exportPdf} disabled={!selected.size}>Generar PDF</button>
        </footer>
      </section>
    </div>
  );
}


const isConsultaRoute = window.location.pathname === "/consulta" || window.location.pathname.startsWith("/consulta/");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <React.Suspense fallback={<div className="boot">Cargando DashCom</div>}>
      {isConsultaRoute ? <ConsultaApp /> : <App />}
    </React.Suspense>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  let refreshedByServiceWorker = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshedByServiceWorker) return;
    refreshedByServiceWorker = true;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      const applyWaitingWorker = () => registration.waiting?.postMessage({ type: "SKIP_WAITING" });
      const checkForUpdate = () => registration.update().then(applyWaitingWorker).catch(() => undefined);

      applyWaitingWorker();
      await checkForUpdate();

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
      window.addEventListener("focus", checkForUpdate);
    } catch {
      // La app debe seguir funcionando aunque el navegador bloquee SW.
    }
  });
}

