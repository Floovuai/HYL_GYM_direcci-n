import React from "react";
import {
  BarChart3,
  Building2,
  Clock,
  LogOut,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { DashComMark, monthOptions, currency, compactCurrency, percent, wholeNumber, safeRatio, advisorPace, advisorDisplayName, scoreValue, nextAdvisorGoal, branchGoalStage, branchTargetGoals, scoreClass, Kpi, Progress, Empty, currentPeriod, formatUpdatedAt } from "./common";

export function ConsultaLogin({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [username, setUsername] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/panel/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "No se pudo iniciar sesion");
      await onSuccess();
    } catch (err: any) {
      setError(err.message || "No se pudo iniciar sesion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="consulta-login">
      <form className="consulta-login-card" onSubmit={submit}>
        <div className="brand">
          <DashComMark size={32} />
          <div>
            <strong>DashCom</strong>
            <span>Panel de consulta</span>
          </div>
        </div>
        <p>Ingresa tu usuario y PIN de consulta para ver tu rendimiento.</p>
        <label htmlFor="consulta-username">Usuario</label>
        <input
          id="consulta-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          autoFocus
          required
        />
        <label htmlFor="consulta-pin">PIN</label>
        <input
          id="consulta-pin"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={8}
          required
        />
        <button type="submit" disabled={loading || !username.trim() || !pin.trim()}>
          {loading ? "Ingresando..." : "Consultar"}
        </button>
        {error ? <div className="error">{error}</div> : null}
      </form>
    </div>
  );
}

export function ConsultaAdvisorCard({ advisor, year, month, readOnly = true }: { advisor: any; year: number; month: number; readOnly?: boolean }) {
  const nextGoal = nextAdvisorGoal(advisor);
  const pace = advisorPace(advisor, {}, year, month);
  const PaceIcon = pace.isPositive ? TrendingUp : TrendingDown;
  const targets = advisor.target
    ? [
        ["Meta 1", advisor.target.meta1],
        ["Meta 2", advisor.target.meta2],
        ["Meta 3", advisor.target.meta3],
        ["Meta 4", advisor.target.meta4]
      ]
    : [];
  return (
    <article className={`advisor-card${readOnly ? " consulta-readonly" : ""}`}>
      <header>
        <div>
          <strong>{advisorDisplayName(advisor.name)}</strong>
          <span>{advisor.branchName}</span>
        </div>
        <div className="advisor-badges">
          <span className={scoreClass(advisor.score?.status)}>{scoreValue(advisor.score)}</span>
          <span className={`pace-badge ${pace.hasGoal ? (pace.isPositive ? "positive" : "negative") : "neutral"}`} title={pace.title}>
            <PaceIcon size={14} />
            <b>{pace.label}</b>
            <em>{pace.detail}</em>
          </span>
          <small>{advisor.commission?.level}</small>
        </div>
      </header>

      <div className="advisor-metrics">
        <div><span>Ventas mes</span><strong>{currency(advisor.sales)}</strong></div>
        <div><span>Meta hoy</span><strong>{currency(advisor.dailyGoal)}</strong></div>
        <div><span>Debe llevar</span><strong>{currency(advisor.expectedSalesToDate)}</strong></div>
        <div><span>{advisor.monthlyGoalLabel || "Meta vigente"}</span><strong>{currency(advisor.monthlyGoal)}</strong></div>
        <div><span>Comisión</span><strong>{currency(advisor.commission?.finalCommission || 0)}</strong></div>
        <div><span>Ticket / registros</span><strong>{wholeNumber(advisor.rows)}</strong></div>
      </div>

      <div className="goal-progress">
        <div className="goal-progress-head">
          <span>Avance a {nextGoal.label}</span>
          <strong>{percent(nextGoal.progress)}</strong>
        </div>
        <Progress value={nextGoal.progress} />
        <small>Faltan {currency(nextGoal.missing)} para {nextGoal.label}. Nivel actual: {advisor.commission?.level || "Sin comisión"}.</small>
      </div>

      {targets.length ? (
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
      ) : null}
    </article>
  );
}

export function ConsultaHistoryBars({ history }: { history: Array<{ year: number; month: number; revenue: number }> }) {
  if (!history.length) return <Empty />;
  const max = Math.max(...history.map((item) => item.revenue), 1);
  return (
    <div className="consulta-history">
      {history.map((item) => (
        <div className="consulta-history-row" key={`${item.year}-${item.month}`}>
          <span>{monthOptions[item.month - 1]?.slice(0, 3)} {item.year}</span>
          <div className="consulta-history-track">
            <div className="consulta-history-fill" style={{ width: `${Math.max(safeRatio(item.revenue, max) * 100, item.revenue > 0 ? 3 : 0)}%` }} />
          </div>
          <strong>{compactCurrency(item.revenue)}</strong>
        </div>
      ))}
    </div>
  );
}

export function ConsultaPeriodBar({
  year,
  month,
  years,
  onYear,
  onMonth,
  onLogout,
  name,
  roleLabel
}: {
  year: number;
  month: number;
  years: number[];
  onYear: (value: number) => void;
  onMonth: (value: number) => void;
  onLogout: () => void;
  name: string;
  roleLabel: string;
}) {
  return (
    <header className="topbar consulta-topbar">
      <div>
        <h1>Panel de consulta</h1>
        <p>{name} · {roleLabel}</p>
      </div>
      <div className="actions">
        <select value={year} onChange={(event) => onYear(Number(event.target.value))}>
          {(years.length ? years : [year]).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={month} onChange={(event) => onMonth(Number(event.target.value))}>
          {monthOptions.map((item, index) => (
            <option key={item} value={index + 1}>{item}</option>
          ))}
        </select>
        <button className="logout" onClick={onLogout}>
          <LogOut size={18} />
          <span>Salir</span>
        </button>
      </div>
    </header>
  );
}

export function ConsultaAdvisorPanel({ session, onLogout }: { session: any; onLogout: () => void }) {
  const initialPeriod = React.useMemo(currentPeriod, []);
  const [year, setYear] = React.useState(initialPeriod.year);
  const [month, setMonth] = React.useState(initialPeriod.month);
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/panel/advisor?year=${year}&month=${month}&_=${Date.now()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "No se pudo cargar tu informacion");
      setData(json);
      setError("");
    } catch (err: any) {
      setError(err.message || "No se pudo cargar tu informacion");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  React.useEffect(() => {
    load();
  }, [load]);

  const pace = data ? advisorPace(data.advisor, {}, data.period.year, data.period.month) : null;

  return (
    <>
      <ConsultaPeriodBar
        year={year}
        month={month}
        years={data?.period?.years || []}
        onYear={setYear}
        onMonth={setMonth}
        onLogout={onLogout}
        name={session.name}
        roleLabel="Asesor"
      />
      {error ? <div className="notice">{error}</div> : null}
      {loading && !data ? <div className="loader" /> : null}
      {data ? (
        <div className="view consulta-view">
          <div className="kpi-grid dashboard-kpi-grid">
            <Kpi label="Ventas del mes" value={currency(data.advisor.sales)} sub={`${wholeNumber(data.advisor.rows)} registros`} />
            <Kpi label="Debe llevar" value={currency(data.advisor.expectedSalesToDate)} sub="a la fecha de corte" tone="blue" />
            <Kpi label="Score" value={scoreValue(data.advisor.score)} sub={data.advisor.score?.status || ""} tone="amber" />
            <Kpi
              label="Ritmo"
              value={pace!.label}
              sub={pace!.detail}
              tone={!pace!.hasGoal ? undefined : pace!.isPositive ? "green" : "red"}
            />
            <Kpi label="Comisión estimada" value={currency(data.advisor.commission?.finalCommission || 0)} sub={data.advisor.commission?.level} tone="green" />
          </div>

          <div className="consulta-columns">
            <section className="panel">
              <div className="panel-title"><h2>Tu avance en {data.period.label} {data.period.year}</h2><Clock size={16} /></div>
              <ConsultaAdvisorCard advisor={data.advisor} year={data.period.year} month={data.period.month} />
              <small className="consulta-updated">Última actualización de tus datos: {formatUpdatedAt(data.lastUpdatedAt)}</small>
            </section>

            <section className="panel">
              <div className="panel-title"><h2>Últimos 6 meses</h2><TrendingUp size={16} /></div>
              <ConsultaHistoryBars history={data.history} />
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ConsultaBranchPanel({ session, onLogout }: { session: any; onLogout: () => void }) {
  const initialPeriod = React.useMemo(currentPeriod, []);
  const [year, setYear] = React.useState(initialPeriod.year);
  const [month, setMonth] = React.useState(initialPeriod.month);
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/panel/branch?year=${year}&month=${month}&_=${Date.now()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "No se pudo cargar la informacion de la sede");
      setData(json);
      setError("");
    } catch (err: any) {
      setError(err.message || "No se pudo cargar la informacion de la sede");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  React.useEffect(() => {
    load();
  }, [load]);

  const goalStage = data ? branchGoalStage(data.branch) : null;
  const branchTracking = data?.branch?.tracking;
  const memberEvolution = data?.branch?.memberEvolution;
  const planMix = Array.isArray(data?.branch?.planMix) ? data.branch.planMix.slice(0, 8) : [];
  const directorCommission = data?.branch?.directorCommission;

  return (
    <>
      <ConsultaPeriodBar
        year={year}
        month={month}
        years={data?.period?.years || []}
        onYear={setYear}
        onMonth={setMonth}
        onLogout={onLogout}
        name={session.name}
        roleLabel="Líder de sede"
      />
      {error ? <div className="notice">{error}</div> : null}
      {loading && !data ? <div className="loader" /> : null}
      {data ? (
        <div className="view consulta-view">
          <div className="kpi-grid dashboard-kpi-grid">
            <Kpi label="Ventas de la sede" value={currency(data.branch.sales)} sub={`${wholeNumber(data.branch.rows)} registros`} />
            <Kpi label="Avance a meta" value={goalStage ? percent(goalStage.progress) : "-"} sub={goalStage?.label || "sin meta cargada"} tone="green" />
            <Kpi label="Proyección día" value={compactCurrency(branchTracking?.projected ?? 0)} sub={branchTracking?.cutoffDay ? `corte día ${branchTracking.cutoffDay}` : "ejecutado esperado"} tone="blue" />
            <Kpi label="Ritmo sede" value={compactCurrency(branchTracking?.diff ?? 0)} sub={(branchTracking?.diff ?? 0) >= 0 ? "sobre proyección" : "bajo proyección"} tone={(branchTracking?.diff ?? 0) >= 0 ? "green" : "red"} />
            <Kpi label="Clientes activos" value={memberEvolution?.available ? wholeNumber(memberEvolution.activeEnd) : "-"} sub={memberEvolution?.available ? "corte actual EVO" : "sin datos EVO"} tone="blue" />
            <Kpi label="Score de sede" value={scoreValue(data.branch.score)} tone="amber" />
          </div>

          <section className="panel">
            <div className="panel-title"><h2>Metas de {data.branch.name}</h2><Building2 size={16} /></div>
            <div className="goal-grid">
              {branchTargetGoals(data.branch).map((goal) => {
                const progressValue = safeRatio(data.branch.sales, goal.amount);
                const missing = Math.max(goal.amount - data.branch.sales, 0);
                return (
                  <div className={missing === 0 ? "reached" : ""} key={goal.label}>
                    <span>{goal.label}</span>
                    <strong>{currency(goal.amount)}</strong>
                    <small>{percent(progressValue)} · falta {currency(missing)}</small>
                  </div>
                );
              })}
            </div>
            <small className="consulta-updated">Última actualización de los datos de la sede: {formatUpdatedAt(data.lastUpdatedAt)}</small>
          </section>

          <section className="panel">
            <div className="panel-title"><h2>Resumen de sede</h2><TrendingUp size={16} /></div>
            <div className="goal-grid consulta-branch-summary">
              <div>
                <span>Ejecutado</span>
                <strong>{currency(branchTracking?.executed ?? data.branch.sales)}</strong>
                <small>{wholeNumber(data.branch.rows)} registros del periodo</small>
              </div>
              <div className={(branchTracking?.diff ?? 0) >= 0 ? "reached" : ""}>
                <span>Ritmo</span>
                <strong>{currency(branchTracking?.diff ?? 0)}</strong>
                <small>{percent(branchTracking?.progress ?? safeRatio(data.branch.sales, data.branch.target?.meta1 || 0))} de avance</small>
              </div>
              <div>
                <span>Clientes activos</span>
                <strong>{memberEvolution?.available ? wholeNumber(memberEvolution.activeEnd) : "-"}</strong>
                <small>{memberEvolution?.available ? `${Number(memberEvolution.netEvolution || 0) >= 0 ? "+" : ""}${wholeNumber(memberEvolution.netEvolution || 0)} neto del periodo` : "pendiente sincronización"}</small>
              </div>
              <div>
                <span>Comisión dirección</span>
                <strong>{currency(directorCommission?.bonus || 0)}</strong>
                <small>{directorCommission?.level || "sin nivel alcanzado"}</small>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-title"><h2>Mix de planes de la sede</h2><BarChart3 size={16} /></div>
            <div className="goal-grid consulta-branch-summary">
              {planMix.map((plan: any) => (
                <div key={plan.family || plan.plan || plan.name}>
                  <span>{plan.family || plan.plan || plan.name || "Plan"}</span>
                  <strong>{currency(plan.revenue || plan.sales || 0)}</strong>
                  <small>{wholeNumber(plan.rows || plan.count || 0)} ventas</small>
                </div>
              ))}
              {!planMix.length ? <Empty /> : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

export function ConsultaApp() {
  const [session, setSession] = React.useState<any>(null);

  const loadSession = React.useCallback(async () => {
    const res = await fetch("/api/panel/session", { cache: "no-store" });
    if (!res.ok) {
      setSession(false);
      return;
    }
    const json = await res.json();
    setSession(json);
  }, []);

  React.useEffect(() => {
    loadSession().catch(() => setSession(false));
  }, [loadSession]);

  async function logout() {
    await fetch("/api/panel/logout", { method: "POST" }).catch(() => undefined);
    setSession(false);
  }

  if (session === null) {
    return <div className="boot">Cargando panel de consulta</div>;
  }

  if (!session) {
    return <ConsultaLogin onSuccess={loadSession} />;
  }

  return (
    <main className="app consulta-app">
      <section className="workspace consulta-workspace">
        {session.role === "lider_sede"
          ? <ConsultaBranchPanel session={session} onLogout={logout} />
          : <ConsultaAdvisorPanel session={session} onLogout={logout} />}
      </section>
    </main>
  );
}

