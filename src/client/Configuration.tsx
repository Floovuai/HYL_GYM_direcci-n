import React from "react";
import {
  Settings
} from "lucide-react";
import { AppState, tabs, monthOptions, currency, compactCurrency, ratePercent, compact, wholeNumber, advisorDisplayName, Empty, normalizeText, cleanRows } from "./common";

export function Configuration({ state, onReload, setNotice }: { state: AppState; onReload: () => Promise<void>; setNotice: (value: string) => void }) {
  const [settings, setSettings] = React.useState({
    evo_base_url: state.settings.evo_base_url || "",
    evo_dns: state.settings.evo_dns || "",
    evo_api_key: "",
    groq_api_key: "",
    groq_model: state.settings.groq_model || "llama-3.3-70b-versatile"
  });
  const [configTab, setConfigTab] = React.useState<"branches" | "targets" | "advisors" | "commissions" | "integrations" | "queryUsers" | "health" | "debug">("branches");
  const [branchForm, setBranchForm] = React.useState({ code: "", displayName: "" });
  const [advisorForm, setAdvisorForm] = React.useState({ name: "", branchId: "" });
  const [queryUsers, setQueryUsers] = React.useState<any[]>([]);
  const [queryUsersLoaded, setQueryUsersLoaded] = React.useState(false);
  const [queryUserForm, setQueryUserForm] = React.useState({ name: "", username: "", role: "asesor", advisorId: "", branchId: "" });
  const [lastIssuedPins, setLastIssuedPins] = React.useState<Record<number, string>>({});
  const [consultaLinks, setConsultaLinks] = React.useState<any>(null);
  const fallbackConsultaLink = `${window.location.origin}/consulta`;
  const consultaLink = consultaLinks?.recommended || fallbackConsultaLink;
  const currentConsultaLink = consultaLinks?.current || fallbackConsultaLink;
  const networkConsultaLink = consultaLinks?.network?.[0]?.url || "";
  const groqConfigured = state.settings.groq_api_key_configured === "true";
  const evoConfigured = state.settings.evo_api_key_configured === "true";
  const config = state.configuration || { branches: [], advisors: [], health: state.dataHealth || {}, debug: { errors: [] } };
  const configBranches = cleanRows(config.branches);
  const configAdvisors = cleanRows(config.advisors).sort((left: any, right: any) => {
    const activeCompare = Number(right.active || 0) - Number(left.active || 0);
    if (activeCompare !== 0) return activeCompare;
    const alertCompare = Number(Boolean(right.inactiveAlert)) - Number(Boolean(left.inactiveAlert));
    if (alertCompare !== 0) return alertCompare;
    const branchCompare = String(left.branchName || "Sin sede").localeCompare(String(right.branchName || "Sin sede"), "es");
    if (branchCompare !== 0) return branchCompare;
    return String(left.name || "").localeCompare(String(right.name || ""), "es");
  });
  const activeConfigAdvisors = configAdvisors.filter((advisor: any) => Number(advisor.active) === 1);
  const inactiveConfigAdvisors = configAdvisors.filter((advisor: any) => Number(advisor.active) !== 1);
  const health = config.health || state.dataHealth || {};

  React.useEffect(() => {
    setSettings({
      evo_base_url: state.settings.evo_base_url || "",
      evo_dns: state.settings.evo_dns || "",
      evo_api_key: "",
      groq_api_key: "",
      groq_model: state.settings.groq_model || "llama-3.3-70b-versatile"
    });
  }, [state.settings.evo_base_url, state.settings.evo_dns, state.settings.groq_model]);

  async function requestJson(url: string, options: RequestInit = {}) {
    const res = await fetch(url, options);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || json.userMessage || "No se pudo completar la accion");
    return json;
  }

  async function loadQueryUsers() {
    const json = await requestJson("/api/query-users");
    setQueryUsers(json.users || []);
    setQueryUsersLoaded(true);
  }

  React.useEffect(() => {
    if (configTab === "queryUsers" && !queryUsersLoaded) {
      loadQueryUsers().catch((error) => setNotice(error.message));
    }
    if (configTab === "queryUsers" && !consultaLinks) {
      requestJson("/api/consulta-links").then(setConsultaLinks).catch((error) => setNotice(error.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configTab]);

  async function copyToClipboard(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(successMessage);
    } catch {
      setNotice("No se pudo copiar automaticamente. Copia manualmente: " + text);
    }
  }

  function credentialsText(user: any, pin: string) {
    return [
      "Plataforma de consulta DashCom",
      `Link: ${consultaLink}`,
      `Usuario: ${user.username}`,
      `PIN: ${pin}`
    ].join("\n");
  }

  function queryUsernameFromName(value: string) {
    return normalizeText(value)
      .toLowerCase()
      .replace(/\s+/g, ".")
      .replace(/[^a-z0-9.]+/g, "")
      .replace(/\.+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 40);
  }

  function selectedQuerySubject() {
    if (queryUserForm.role === "asesor") {
      return activeConfigAdvisors.find((advisor: any) => String(advisor.id) === String(queryUserForm.advisorId));
    }
    return configBranches.find((branch: any) => String(branch.id) === String(queryUserForm.branchId));
  }

  function queryUserPayload() {
    const subject = selectedQuerySubject();
    const role = queryUserForm.role === "lider_sede" ? "lider_sede" : "asesor";
    const fallbackName = role === "asesor" ? subject?.name : subject?.displayName;
    const name = queryUserForm.name.trim() || String(fallbackName || "").trim();
    const username = queryUserForm.username.trim() || queryUsernameFromName(name);
    return {
      ...queryUserForm,
      role,
      branchId: role === "lider_sede" ? queryUserForm.branchId : "",
      advisorId: role === "asesor" ? queryUserForm.advisorId : "",
      name,
      username
    };
  }

  async function createQueryUser() {
    if (queryUserForm.role === "asesor" && !queryUserForm.advisorId) {
      setNotice("Selecciona el asesor para este acceso");
      return;
    }
    if (queryUserForm.role === "lider_sede" && !queryUserForm.name.trim()) {
      setNotice("Escribe el nombre del lider de sede");
      return;
    }
    if (queryUserForm.role === "lider_sede" && !queryUserForm.branchId) {
      setNotice("Selecciona la sede para este lider");
      return;
    }
    const payload = queryUserPayload();
    if (!payload.name || !payload.username) {
      setNotice("No se pudo generar el nombre de consulta. Revisa la selección.");
      return;
    }
    const json = await requestJson("/api/query-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setQueryUserForm({ name: "", username: "", role: "asesor", advisorId: "", branchId: "" });
    setLastIssuedPins((prev) => ({ ...prev, [json.user.id]: json.pin }));
    await loadQueryUsers();
    setNotice(`Usuario creado. PIN generado: ${json.pin}. Usa "Copiar datos" para compartirlo.`);
  }

  async function updateQueryUser(user: any, updates: Record<string, unknown>) {
    await requestJson(`/api/query-users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    await loadQueryUsers();
  }

  async function regeneratePin(user: any) {
    const alreadyIssued = Boolean(lastIssuedPins[user.id] || user.pinPlain);
    if (alreadyIssued && !window.confirm(`Regenerar el PIN de ${user.name}? El PIN anterior dejara de funcionar.`)) return;
    const json = await requestJson(`/api/query-users/${user.id}/regenerate-pin`, { method: "POST" });
    setLastIssuedPins((prev) => ({ ...prev, [user.id]: json.pin }));
    setNotice(`PIN generado para ${user.name}.`);
    return json.pin as string;
  }

  async function copyUserCredentials(user: any) {
    const pin = lastIssuedPins[user.id] || user.pinPlain || (await regeneratePin(user));
    if (!pin) return;
    await copyToClipboard(credentialsText(user, pin), `Datos de ${user.name} copiados al portapapeles.`);
  }

  async function removeQueryUser(user: any) {
    if (!window.confirm(`Eliminar el acceso de consulta de ${user.name}?`)) return;
    await requestJson(`/api/query-users/${user.id}`, { method: "DELETE" });
    setNotice("Acceso de consulta eliminado");
    await loadQueryUsers();
  }

  async function saveSettings() {
    await requestJson("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: settings })
    });
    setNotice("Integraciones guardadas");
    await onReload();
  }

  async function addBranch() {
    if (!branchForm.displayName.trim()) return;
    await requestJson("/api/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(branchForm)
    });
    setBranchForm({ code: "", displayName: "" });
    setNotice("Sede creada");
    await onReload();
  }

  async function updateBranch(branch: any, updates: Record<string, unknown>) {
    await requestJson(`/api/branches/${branch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: branch.code, displayName: branch.displayName, active: Number(branch.active) === 1, ...updates })
    });
    setNotice("Sede actualizada");
    await onReload();
  }

  async function removeBranch(branch: any) {
    if (!window.confirm(`Eliminar o desactivar la sede ${branch.displayName}?`)) return;
    const json = await requestJson(`/api/branches/${branch.id}`, { method: "DELETE" });
    setNotice(json.message || "Sede eliminada");
    await onReload();
  }

  async function addAdvisor() {
    if (!advisorForm.name.trim()) return;
    await requestJson("/api/advisors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: advisorForm.name, branchId: advisorForm.branchId || null })
    });
    setAdvisorForm({ name: "", branchId: "" });
    setNotice("Asesor creado");
    await onReload();
  }

  async function updateAdvisor(advisor: any, updates: Record<string, unknown>) {
    await requestJson(`/api/advisors/${advisor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: advisor.name,
        branchId: advisor.branchId || null,
        active: Number(advisor.active) === 1,
        excludedFromCommissions: Number(advisor.excludedFromCommissions || 0) === 1,
        inactiveSince: advisor.inactiveSince || "",
        inactiveReason: advisor.inactiveReason || "",
        ...updates
      })
    });
    setNotice("Asesor actualizado");
    await onReload();
  }

  async function removeAdvisor(advisor: any) {
    if (!window.confirm(`Eliminar o desactivar a ${advisorDisplayName(advisor.name)}?`)) return;
    const json = await requestJson(`/api/advisors/${advisor.id}`, { method: "DELETE" });
    setNotice(json.message || "Asesor eliminado");
    await onReload();
  }

  async function reassignInactiveSales(advisor: any) {
    if (!window.confirm(`Reasignar ventas nuevas de ${advisorDisplayName(advisor.name)} al asesor activo sugerido de cada sede?`)) return;
    const json = await requestJson(`/api/advisors/${advisor.id}/reassign-inactive-sales`, { method: "POST" });
    setNotice(`Reasignadas ${json.updated} ventas. Sin reasignar: ${json.skipped?.length || 0}`);
    await onReload();
  }

  async function resolveError(error: any) {
    await requestJson(`/api/debug/errors/${error.id}/resolve`, { method: "POST" });
    setNotice(`Error ${error.code} marcado como revisado`);
    await onReload();
  }

  async function syncEvo() {
    setNotice("Sincronizando EVO...");
    const res = await fetch("/api/evo/sync", { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "No se pudo sincronizar");
    setNotice(`EVO importó ${json.summary.rowsInserted} ventas nuevas. Duplicadas omitidas: ${json.summary.duplicatesSkipped}`);
    await onReload();
  }

  async function testGroq() {
    setNotice("Probando Groq...");
    const res = await fetch("/api/ai/health");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Groq no respondió");
    setNotice(`Groq conectado: ${json.model}`);
  }

  async function testEvo() {
    setNotice("Probando EVO...");
    const res = await fetch("/api/evo/health");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "EVO no respondió");
    setNotice(`EVO conectado: DNS ${json.dns}. Ventas reconocidas en prueba: ${json.itemsRecognized}`);
  }

  function renderAdvisorRows(rows: any[]) {
    return (
      <div className="advisor-config-table">
        {rows.map((advisor: any) => {
          const inactive = Number(advisor.active) !== 1;
          return (
            <article key={advisor.id} className={`advisor-config-row ${inactive ? "inactive" : ""} ${advisor.inactiveAlert ? "alert" : ""}`}>
              <div className="advisor-row-main">
                <strong>{advisorDisplayName(advisor.name)}</strong>
                <span>{advisor.branchName}</span>
              </div>
              <span>{advisor.salesRows} ventas</span>
              <span>{currency(advisor.sales || 0)}</span>
              <div className="advisor-row-status">
                {inactive ? <span className="retired-badge">Inactivo</span> : <span className="active-badge">Activo</span>}
                {advisor.inactiveAlert ? <span className="data-alert-badge">{advisor.inactiveAlert.rows} nuevas</span> : null}
              </div>
              {advisor.inactiveAlert ? (
                <button className="warning-action" title="Reasignar ventas" onClick={() => reassignInactiveSales(advisor).catch((error) => setNotice(error.message))}>Reasignar</button>
              ) : <span />}
              <select value={advisor.branchId || ""} onChange={(event) => updateAdvisor(advisor, { branchId: event.target.value || null }).catch((error) => setNotice(error.message))}>
                <option value="">Sin sede</option>
                {configBranches.map((branch: any) => (
                  <option key={branch.id} value={branch.id}>{branch.displayName}</option>
                ))}
              </select>
              <label className="toggle-row">
                <input type="checkbox" checked={!inactive} onChange={(event) => updateAdvisor(advisor, { active: event.target.checked }).catch((error) => setNotice(error.message))} />
                Activo
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={Number(advisor.excludedFromCommissions || 0) === 1} onChange={(event) => updateAdvisor(advisor, { excludedFromCommissions: event.target.checked }).catch((error) => setNotice(error.message))} />
                Excluir
              </label>
              <button className="danger-light" title="Eliminar asesor" onClick={() => removeAdvisor(advisor).catch((error) => setNotice(error.message))}>Borrar</button>
            </article>
          );
        })}
      </div>
    );
  }

  function advisorBranchGroups(rows: any[]) {
    const groups = rows.reduce((result: Record<string, any[]>, advisor: any) => {
      const branchName = advisor.branchName || "Sin sede";
      result[branchName] = result[branchName] || [];
      result[branchName].push(advisor);
      return result;
    }, {});

    return Object.entries(groups)
      .sort(([leftBranch], [rightBranch]) => leftBranch.localeCompare(rightBranch, "es"))
      .map(([branchName, advisors]) => ({
        branchName,
        advisors: advisors.sort((left: any, right: any) => {
          const alertCompare = Number(Boolean(right.inactiveAlert)) - Number(Boolean(left.inactiveAlert));
          if (alertCompare !== 0) return alertCompare;
          return String(left.name || "").localeCompare(String(right.name || ""), "es");
        })
      }));
  }

  function renderAdvisorBranchGroups(rows: any[], inactive?: boolean) {
    return (
      <div className="advisor-branch-groups">
        {advisorBranchGroups(rows).map((group) => (
          <section className={`advisor-branch-group ${inactive ? "inactive" : ""}`} key={group.branchName}>
            <header>
              <strong>{group.branchName}</strong>
              <span>{group.advisors.length} asesores</span>
            </header>
            {renderAdvisorRows(group.advisors)}
          </section>
        ))}
      </div>
    );
  }

  function branchTargetLabel(target: any) {
    if (!target?.loaded) return "-";
    return target.meta1 > 0 ? compactCurrency(target.meta1) : "$0";
  }

  return (
    <div className="view">
      <section className="panel config-panel">
        <div className="panel-title"><h2>Configuración de la plataforma</h2><Settings size={18} /></div>
        <div className="config-tabs" role="tablist" aria-label="Configuración">
          <button className={configTab === "queryUsers" ? "active" : ""} onClick={() => setConfigTab("queryUsers")}>Modo consulta</button>
          <button className={configTab === "branches" ? "active" : ""} onClick={() => setConfigTab("branches")}>Sedes</button>
          <button className={configTab === "advisors" ? "active" : ""} onClick={() => setConfigTab("advisors")}>Asesores</button>
          <button className={configTab === "commissions" ? "active" : ""} onClick={() => setConfigTab("commissions")}>Mecánica de comisiones</button>
          <button className={configTab === "health" ? "active" : ""} onClick={() => setConfigTab("health")}>Salud de datos</button>
          <button className={configTab === "integrations" ? "active" : ""} onClick={() => setConfigTab("integrations")}>Groq y EVO</button>
          <button className={configTab === "debug" ? "active" : ""} onClick={() => setConfigTab("debug")}>Debug</button>
        </div>

        {configTab === "branches" ? (
          <div className="config-section">
            <div className="config-add-row">
              <input value={branchForm.displayName} onChange={(event) => setBranchForm({ ...branchForm, displayName: event.target.value })} placeholder="Nombre de nueva sede" />
              <input value={branchForm.code} onChange={(event) => setBranchForm({ ...branchForm, code: event.target.value })} placeholder="Código opcional" />
              <button onClick={() => addBranch().catch((error) => setNotice(error.message))}>Crear sede</button>
            </div>
            <div className="branch-config-table-wrap">
              <table className="branch-config-table">
                <thead>
                  <tr>
                    <th>Sede</th>
                    <th>Código</th>
                    <th>Estado</th>
                    <th className="num">Ases.</th>
                    <th className="num">Reg.</th>
                    <th className="num">Venta hist.</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {configBranches.map((branch: any) => (
                    <tr key={branch.id} className={Number(branch.active) === 1 ? "" : "inactive"}>
                      <td>
                        <input
                          aria-label={`Nombre de ${branch.displayName}`}
                          defaultValue={branch.displayName}
                          onBlur={(event) => event.currentTarget.value !== branch.displayName ? updateBranch(branch, { displayName: event.currentTarget.value }).catch((error) => setNotice(error.message)) : undefined}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Código de ${branch.displayName}`}
                          defaultValue={branch.code}
                          onBlur={(event) => event.currentTarget.value !== branch.code ? updateBranch(branch, { code: event.currentTarget.value }).catch((error) => setNotice(error.message)) : undefined}
                        />
                      </td>
                      <td>
                        <label className="compact-toggle">
                          <input type="checkbox" checked={Number(branch.active) === 1} onChange={(event) => updateBranch(branch, { active: event.target.checked }).catch((error) => setNotice(error.message))} />
                          {Number(branch.active) === 1 ? "Act." : "Inact."}
                        </label>
                      </td>
                      <td className="num">{wholeNumber(branch.advisorsCount)}</td>
                      <td className="num">{wholeNumber(branch.salesRows)}</td>
                      <td className="num-strong">{compactCurrency(branch.sales || 0)}</td>
                      <td>
                        <button className="danger-light" onClick={() => removeBranch(branch).catch((error) => setNotice(error.message))}>Borrar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {configTab === "targets" ? (
          <div className="config-section">
            <div className="branch-config-table-wrap">
              <table className="branch-config-table">
                <thead>
                  <tr>
                    <th>Sede</th>
                    <th className="num">Meta anual 2026</th>
                    {monthOptions.map((monthName) => <th className="num" key={monthName}>{monthName.slice(0, 3)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {configBranches.map((branch: any) => (
                    <tr key={branch.id} className={Number(branch.active) === 1 ? "" : "inactive"}>
                      <td>{branch.displayName}</td>
                      <td className="num">
                        <span>{branch.annualTarget2026 ? compactCurrency(branch.annualTarget2026) : "-"}</span>
                        <small>{branch.loadedTargetMonths2026 || 0}/12 meses</small>
                      </td>
                      {(branch.targets2026 || []).map((target: any) => (
                        <td key={target.month} className={target.loaded ? "month-target" : "month-target missing-target"} title={`${target.label} 2026: ${branchTargetLabel(target)}`}>
                          {branchTargetLabel(target)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {configTab === "advisors" ? (
          <div className="config-section">
            <div className="config-add-row">
              <input value={advisorForm.name} onChange={(event) => setAdvisorForm({ ...advisorForm, name: event.target.value })} placeholder="Nombre del asesor" />
              <select value={advisorForm.branchId} onChange={(event) => setAdvisorForm({ ...advisorForm, branchId: event.target.value })}>
                <option value="">Sede</option>
                {configBranches.filter((branch: any) => Number(branch.active) === 1).map((branch: any) => (
                  <option key={branch.id} value={branch.id}>{branch.displayName}</option>
                ))}
              </select>
              <button onClick={() => addAdvisor().catch((error) => setNotice(error.message))}>Crear asesor</button>
            </div>
            <div className="advisor-status-groups">
              <section>
                <header><strong>Activos</strong><span>{activeConfigAdvisors.length} asesores</span></header>
                {activeConfigAdvisors.length ? renderAdvisorBranchGroups(activeConfigAdvisors) : <Empty />}
              </section>
              <section className="inactive">
                <header><strong>Inactivos</strong><span>{inactiveConfigAdvisors.length} asesores</span></header>
                {inactiveConfigAdvisors.length ? renderAdvisorBranchGroups(inactiveConfigAdvisors, true) : <Empty />}
              </section>
            </div>
          </div>
        ) : null}

        {configTab === "commissions" ? (
          <div className="config-section">
            <CommissionMechanics state={state} />
          </div>
        ) : null}

        {configTab === "integrations" ? (
          <div className="config-section">
            <div className="integration-grid">
              <section>
                <h3>API EVO</h3>
                <input value={settings.evo_base_url} onChange={(event) => setSettings({ ...settings, evo_base_url: event.target.value })} placeholder="URL EVO" />
                <input value={settings.evo_dns} onChange={(event) => setSettings({ ...settings, evo_dns: event.target.value })} placeholder="DNS EVO" />
                <input value={settings.evo_api_key} onChange={(event) => setSettings({ ...settings, evo_api_key: event.target.value })} placeholder={evoConfigured ? "Token EVO configurado" : "Token EVO"} type="password" />
                <div className="button-row">
                  <button onClick={saveSettings}>Guardar</button>
                  <button onClick={() => testEvo().catch((error) => setNotice(error.message))}>Probar EVO</button>
                  <button onClick={() => syncEvo().catch((error) => setNotice(error.message))}>Sincronizar</button>
                </div>
              </section>
              <section>
                <h3>Groq</h3>
                <input value={settings.groq_api_key} onChange={(event) => setSettings({ ...settings, groq_api_key: event.target.value })} placeholder={groqConfigured ? "Clave API Groq configurada" : "Clave API Groq"} type="password" />
                <input value={settings.groq_model} onChange={(event) => setSettings({ ...settings, groq_model: event.target.value })} placeholder="Modelo Groq" />
                <div className="button-row">
                  <button onClick={saveSettings}>Guardar</button>
                  <button onClick={() => testGroq().catch((error) => setNotice(error.message))}>Probar Groq</button>
                </div>
              </section>
            </div>
            <div className="integration-status">
              <span className={groqConfigured ? "ok" : "pending"}>Groq: {groqConfigured ? "clave guardada" : "pendiente"}</span>
              <span className={evoConfigured ? "ok" : "pending"}>EVO: {evoConfigured ? "token guardado" : "pendiente"}</span>
              <span className={settings.evo_dns ? "ok" : "pending"}>DNS EVO: {settings.evo_dns || "pendiente"}</span>
            </div>
            <div className="integration-note">
              Las claves se guardan como secretas. Por seguridad no se muestran completas en pantalla; si escribes una nueva y guardas, reemplaza la anterior.
            </div>
          </div>
        ) : null}

        {configTab === "queryUsers" ? (
          <div className="config-section">
            <div className="consulta-head">
              <h3>Modo consulta</h3>
              <div className="consulta-link-inline">
                <span className="consulta-link-label">{networkConsultaLink ? "Link para compartir" : "Link del panel"}</span>
                <input readOnly value={consultaLink} onFocus={(event) => event.currentTarget.select()} />
                <button onClick={() => copyToClipboard(consultaLink, "Link copiado al portapapeles")}>Copiar link</button>
              </div>
            </div>
            {networkConsultaLink && currentConsultaLink !== consultaLink ? (
              <small className="consulta-network-note">Comparte este enlace con equipos de la misma red. En Windows, configura esta red como privada y permite DashCom en el firewall.</small>
            ) : null}
            <div className="consulta-access-summary">
              <article className={queryUserForm.role === "asesor" ? "active" : ""}>
                <strong>Asesor</strong>
                <span>Consulta solo sus ventas y comisiones.</span>
              </article>
              <article className={queryUserForm.role === "lider_sede" ? "active" : ""}>
                <strong>Líder de sede</strong>
                <span>Consulta solo los indicadores de su sede.</span>
              </article>
            </div>
            <div className="config-add-row consulta-add-row">
              <select
                value={queryUserForm.role}
                onChange={(event) => setQueryUserForm({ ...queryUserForm, role: event.target.value, advisorId: "", branchId: "" })}
              >
                <option value="asesor">Rol: Asesor</option>
                <option value="lider_sede">Rol: Líder de sede</option>
              </select>
              <input
                value={queryUserForm.name}
                onChange={(event) => setQueryUserForm({ ...queryUserForm, name: event.target.value })}
                placeholder={queryUserForm.role === "lider_sede" ? "Nombre del líder" : "Nombre opcional"}
              />
              <select
                value={queryUserForm.advisorId}
                disabled={queryUserForm.role !== "asesor"}
                onChange={(event) => setQueryUserForm({ ...queryUserForm, advisorId: event.target.value })}
              >
                <option value="">Selecciona un asesor…</option>
                {activeConfigAdvisors.map((advisor: any) => (
                  <option key={advisor.id} value={advisor.id}>{advisor.name}</option>
                ))}
              </select>
              <select
                value={queryUserForm.branchId}
                disabled={queryUserForm.role !== "lider_sede"}
                onChange={(event) => setQueryUserForm({ ...queryUserForm, branchId: event.target.value })}
              >
                <option value="">Selecciona una sede…</option>
                {configBranches.filter((branch: any) => Number(branch.active) === 1).map((branch: any) => (
                  <option key={branch.id} value={branch.id}>{branch.displayName}</option>
                ))}
              </select>
              <div className="consulta-generated-user">
                <span>{queryUserForm.role === "lider_sede" ? "Acceso sede" : "Acceso asesor"}</span>
                <strong>{queryUserPayload().username || "se genera al seleccionar"}</strong>
              </div>
              <button onClick={() => createQueryUser().catch((error) => setNotice(error.message))}>Crear acceso y generar PIN</button>
            </div>
            <small className="consulta-scroll-hint">El PIN se muestra solo al generarlo. Usa "Copiar datos" para copiar link, usuario y PIN.</small>
            <div className="branch-config-table-wrap query-users-table-wrap">
              <table className="branch-config-table query-users-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Últ. ingreso</th>
                    <th>PIN</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {queryUsers.map((user: any) => (
                    <tr key={user.id} className={user.active ? "" : "inactive"}>
                      <td>{user.name}</td>
                      <td>{user.username}</td>
                      <td>
                        <strong>{user.role === "lider_sede" ? "Líder de sede" : "Asesor"}</strong>
                      </td>
                      <td>
                        <label className="compact-toggle">
                          <input type="checkbox" checked={Boolean(user.active)} onChange={(event) => updateQueryUser(user, { active: event.target.checked }).catch((error) => setNotice(error.message))} />
                          {user.active ? "Act." : "Inact."}
                        </label>
                      </td>
                      <td>{user.lastLoginAt ? String(user.lastLoginAt).slice(0, 10) : "Sin ingresos"}</td>
                      <td>{lastIssuedPins[user.id] || user.pinPlain ? <code>{lastIssuedPins[user.id] || user.pinPlain}</code> : <small>Regenerar</small>}</td>
                      <td>
                        <div className="button-row">
                          <button onClick={() => regeneratePin(user).catch((error) => setNotice(error.message))}>{lastIssuedPins[user.id] || user.pinPlain ? "Regenerar PIN" : "Generar PIN"}</button>
                          <button onClick={() => copyUserCredentials(user).catch((error) => setNotice(error.message))} title="Copiar link, usuario y PIN (genera un PIN nuevo si aun no tiene uno visible)">Copiar datos</button>
                          <button className="danger-light" onClick={() => removeQueryUser(user).catch((error) => setNotice(error.message))}>Borrar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!queryUsers.length ? <Empty /> : null}
            </div>
          </div>
        ) : null}

        {configTab === "health" ? (
          <div className="config-section">
            <div className={`data-health-console ${health.ok ? "ok" : "review"}`}>
              <div className="health-light-wrap">
                <span className={`health-light green ${health.ok ? "on" : ""}`} />
                <span className={`health-light red ${health.ok ? "" : "on"}`} />
              </div>
              <div>
                <strong>{health.ok ? "Calidad de datos OK" : "Datos por revisar"}</strong>
                <p>{health.ok ? "Sedes, asesores e importaciones no tienen alertas críticas visibles." : "Hay señales que pueden afectar la lectura comercial o la liquidación."}</p>
              </div>
            </div>
            <div className="mini-grid">
              <article><span>Alertas calidad</span><strong>{health.qualityIssues || 0}</strong><small>Duplicados, faltantes o soporte EVO</small></article>
              <article><span>Ventas en inactivos</span><strong>{health.inactiveSalesRows || 0}</strong><small>Requieren reasignación</small></article>
              <article><span>Errores abiertos</span><strong>{health.unresolvedErrors || 0}</strong><small>Debug sin resolver</small></article>
              <article><span>Errores críticos</span><strong>{health.criticalErrors || 0}</strong><small>Estado técnico</small></article>
            </div>
          </div>
        ) : null}

        {configTab === "debug" ? (
          <div className="config-section">
            <div className="debug-codebook">
              <article><strong>DC-UPL</strong><span>Cargas de Excel y archivos.</span></article>
              <article><strong>DC-EVO</strong><span>Conexión o sincronización EVO.</span></article>
              <article><strong>DC-GRQ</strong><span>Conexión o respuesta Groq.</span></article>
              <article><strong>DC-CFG</strong><span>Configuración de sedes, asesores o credenciales.</span></article>
              <article><strong>DC-DATA</strong><span>Calidad de datos o reasignaciones.</span></article>
              <article><strong>DC-SRV</strong><span>Error interno de servidor.</span></article>
            </div>
            <div className="debug-list">
              {(config.debug?.errors || []).length ? config.debug.errors.map((error: any) => (
                <article key={error.id} className={`debug-card ${Number(error.statusCode || 0) >= 500 ? "critical" : ""}`}>
                  <header>
                    <strong>{error.code}</strong>
                    <span>{error.area} · {error.method} {error.path}</span>
                  </header>
                  <p>{error.userMessage}</p>
                  <code>{error.technicalMessage}</code>
                  <footer>
                    <small>{error.createdAt}</small>
                    <button onClick={() => resolveError(error).catch((err) => setNotice(err.message))}>Marcar revisado</button>
                  </footer>
                </article>
              )) : <Empty />}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export const historicalAdvisorCommissionLevels = [
  { level: "Meta 1", condition: "100% de Meta 1 asesor", rate: 0.004, bonus: 0 },
  { level: "Meta 2", condition: "100% de Meta 2 asesor", rate: 0.008, bonus: 0 },
  { level: "Meta 3", condition: "100% de Meta 3 asesor", rate: 0.012, bonus: 0 },
  { level: "Meta 4", condition: "100% de Meta 4 asesor", rate: 0.02, bonus: 500000 }
];

export const advisorCommissionLevels = [
  { level: "Meta 1", condition: "Alcanza Meta 1 asesor", rate: 0.004, bonus: 0 },
  { level: "Meta 2", condition: "Alcanza Meta 2 asesor", rate: 0.008, bonus: 0 },
  { level: "Meta 3", condition: "Alcanza Meta 3 asesor", rate: 0.012, bonus: 0 },
  { level: "Meta 4", condition: "Alcanza Meta 4 asesor", rate: 0.02, bonus: 500000 }
];

export const directorCommissionLevels = [
  { level: "Meta 1", condition: "La sede alcanza Meta 1", bonus: 100000 },
  { level: "Meta 2", condition: "La sede alcanza Meta 2", bonus: 200000 },
  { level: "Meta 3", condition: "La sede alcanza Meta 3 o superior", bonus: 500000 }
];

export function CommissionMechanics({ state }: { state: AppState }) {
  const topAdvisor = state.advisors.find((advisor: any) => advisor.sales > 0);
  const topBranch = state.branches.find((branch: any) => branch.sales > 0);
  return (
    <div className="commission-guide">
      <div className="guide-summary">
        <article>
          <span>Comisiones asesores</span>
          <strong>{currency(state.kpis.totalAdvisorCommissions)}</strong>
          <small>Suma final del mes filtrado</small>
        </article>
        <article>
          <span>Comisiones director</span>
          <strong>{currency(state.kpis.totalDirectorCommissions)}</strong>
          <small>Suma de bonos por sede</small>
        </article>
      </div>

      <div className="guide-block">
        <h3>1. Mecánica general</h3>
        <p>La plataforma identifica el nivel más alto alcanzado contra las metas del asesor y aplica el porcentaje de ese nivel sobre el monto total vendido.</p>
        <code>Comisión base = ventas totales x porcentaje del nivel alcanzado + bono fijo</code>
        <p>La evaluación de calidad y gestión se conserva para score y seguimiento, pero no multiplica la liquidación de comisiones.</p>
        <code>Comisión final = comisión base</code>
      </div>

      <div className="guide-block">
        <h3>2. Niveles de asesor</h3>
      </div>
      <div className="table-wrap small">
        <table>
          <thead>
            <tr><th>Nivel</th><th>Condición</th><th>Porcentaje</th><th>Bono fijo</th></tr>
          </thead>
          <tbody>
            {advisorCommissionLevels.map((item) => (
              <tr key={item.level}>
                <td>{item.level}</td>
                <td>{item.condition}</td>
                <td>{ratePercent(item.rate)}</td>
                <td>{currency(item.bonus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="guide-block">
        <h3>3. Metas por sede y asesor</h3>
        <p>Meta 1 de sede usa la rampa oficial 2026 cargada en la plataforma para cada sede y mes. Esa meta mensual es la referencia de liquidación de sede.</p>
        <code>Meta 1 sede = meta oficial del informe para la sede y el mes filtrado</code>
        <p>La Meta 1 del asesor se calcula dividiendo la meta oficial de la sede entre el conteo oficial de asesores definido para esa sede. Si no hay meta oficial para un periodo, la plataforma usa una meta motivacional basada en desempeño reciente como respaldo.</p>
        <code>Meta 1 asesor = Meta 1 sede oficial / conteo oficial de asesores</code>
        <p>El porcentaje se aplica al monto total vendido según la meta alcanzada. Al llegar a Meta 4 se suma el bono fijo de $500.000.</p>
      </div>

      <div className="guide-block">
        <h3>4. Composición de metas</h3>
        <p>Meta 2 y Meta 3 siguen los escalones del archivo de metas, y Meta 4 se calcula como Meta 3 por 120%.</p>
        <code>Meta 1 oficial · Meta 2/3 escalonadas · Meta 4 = Meta 3 x 120%</code>
      </div>

      <div className="guide-block">
        <h3>5. Comisión director</h3>
        <p>Tu comisión se calcula por sede. Cada sede se evalúa contra sus metas del mes. Si una sede llega a Meta 1, Meta 2 o Meta 3, genera el bono fijo indicado. El total del director es la suma de los bonos de todas las sedes.</p>
      </div>
      <div className="table-wrap small">
        <table>
          <thead>
            <tr><th>Nivel sede</th><th>Condición</th><th>Bono director</th></tr>
          </thead>
          <tbody>
            {directorCommissionLevels.map((item) => (
              <tr key={item.level}>
                <td>{item.level}</td>
                <td>{item.condition}</td>
                <td>{currency(item.bonus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="guide-block">
        <h3>6. Comisión y score</h3>
        <p>La comisión paga el resultado económico según metas. La evaluación se puede editar y se conserva para score y seguimiento comercial, junto con avance a Meta 1, avance a Meta 4, conversiones y descuentos.</p>
      </div>

      <div className="example-grid">
        {topAdvisor ? (
          <article>
            <h3>Ejemplo actual de asesor</h3>
            <strong>{topAdvisor.name}</strong>
            <span>{topAdvisor.branchName}</span>
            <div className="metric-row"><span>Ventas mes</span><strong>{currency(topAdvisor.sales)}</strong></div>
            <div className="metric-row"><span>Nivel</span><strong>{topAdvisor.commission.level}</strong></div>
            <div className="metric-row"><span>Comisión final</span><strong>{currency(topAdvisor.commission.finalCommission)}</strong></div>
          </article>
        ) : null}
        {topBranch ? (
          <article>
            <h3>Ejemplo actual de sede</h3>
            <strong>{topBranch.name}</strong>
            <span>Director</span>
            <div className="metric-row"><span>Ventas mes</span><strong>{currency(topBranch.sales)}</strong></div>
            <div className="metric-row"><span>Nivel</span><strong>{topBranch.directorCommission.level}</strong></div>
            <div className="metric-row"><span>Bono director</span><strong>{currency(topBranch.directorCommission.bonus)}</strong></div>
          </article>
        ) : null}
      </div>
    </div>
  );
}

