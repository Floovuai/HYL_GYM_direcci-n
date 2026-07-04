import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import multer from "multer";
import { loadLocalEnv, resolveFromRoot } from "./env";
import { migrate } from "./schema";
import { all, get, run, saveDb, scalar, transaction } from "./db";
import {
  importSalesObjects,
  importSalesWorkbook,
  seedDefaults,
  updateEvaluation
} from "./importers";
import { createManagerPdf } from "./pdfReport";
import { buildAppState, buildManagerReport, buildQualityReport } from "./queries";

loadLocalEnv();

const app = express();
const port = Number(process.env.PORT || 4310);
const host = process.env.HOST || "0.0.0.0";
const uploadDir = resolveFromRoot(process.env.UPLOAD_DIR, "./uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 25 * 1024 * 1024 }
});

const EVO_DEFAULT_BASE_URL = "https://evo-integracao-api.w12app.com.br";
const EVO_SALES_PATH = "/api/v2/sales";
const EVO_SYNC_INTERVAL_MS = Math.max(15_000, Number(process.env.EVO_SYNC_INTERVAL_MS || 60_000));
const EVO_SYNC_WORKER_ENABLED = process.env.EVO_SYNC_WORKER !== "0";
const realtimeClients = new Set<express.Response>();
let evoWorkerRunning = false;

app.use(cors());
app.use(express.json({ limit: "3mb" }));

function publishRealtime(event: string, payload: unknown) {
  const body = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of realtimeClients) {
    client.write(body);
  }
}

function publicSettingRow(row: { key: string; value: string; secret?: number; updated_at?: string }) {
  const configured = row.secret
    ? Boolean(row.value) ||
      Boolean(row.key === "groq_api_key" && process.env.GROQ_API_KEY) ||
      Boolean(row.key === "evo_api_key" && (process.env.EVO_API_KEY || process.env.EVO_SECRET_KEY))
    : undefined;
  return {
    ...row,
    value: row.secret
      ? ""
      : row.key === "evo_base_url" && process.env.EVO_BASE_URL
        ? process.env.EVO_BASE_URL
        : row.key === "evo_dns" && process.env.EVO_DNS
          ? process.env.EVO_DNS
          : row.value,
    configured
  };
}

async function integrationSettings() {
  const rows = await all<{ key: string; value: string }>("SELECT key, value FROM settings");
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    ...settings,
    evo_base_url: String(process.env.EVO_BASE_URL || settings.evo_base_url || EVO_DEFAULT_BASE_URL).trim(),
    evo_dns: String(process.env.EVO_DNS || settings.evo_dns || "").trim(),
    evo_api_key: String(process.env.EVO_API_KEY || process.env.EVO_SECRET_KEY || settings.evo_api_key || "").trim(),
    groq_api_key: String(process.env.GROQ_API_KEY || settings.groq_api_key || "").trim(),
    groq_model: String(process.env.GROQ_MODEL || settings.groq_model || "llama-3.3-70b-versatile").trim()
  };
}

function currentBogotaPeriod() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day)
  };
}

function monthDateRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, month, 0));
  return {
    start,
    end: `${year}-${String(month).padStart(2, "0")}-${String(endDate.getUTCDate()).padStart(2, "0")}`
  };
}

function evoSalesUrl(baseUrl: string, year: number, month: number, skip: number) {
  const normalizedBase = baseUrl.match(/^https?:\/\//i) ? baseUrl : `https://${baseUrl}`;
  const url = new URL(normalizedBase);
  if (!url.pathname || url.pathname === "/") {
    url.pathname = EVO_SALES_PATH;
  }
  const range = monthDateRange(year, month);
  url.searchParams.set("dateSaleStart", range.start);
  url.searchParams.set("dateSaleEnd", range.end);
  url.searchParams.set("take", "100");
  url.searchParams.set("skip", String(skip));
  return url;
}

function evoAuthorization(dns: string, apiKey: string) {
  return `Basic ${Buffer.from(`${dns}:${apiKey}`).toString("base64")}`;
}

function evoItemsFromPayload(payload: any): Record<string, unknown>[] {
  const candidates = [
    payload,
    payload?.data,
    payload?.items,
    payload?.sales,
    payload?.vendas,
    payload?.records,
    payload?.results,
    payload?.result,
    payload?.value
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (Array.isArray(candidate?.data)) return candidate.data;
    if (Array.isArray(candidate?.items)) return candidate.items;
    if (Array.isArray(candidate?.records)) return candidate.records;
  }
  return [];
}

function hasEvoSettings(settings: Record<string, any>) {
  return Boolean(String(settings.evo_base_url || "").trim() && String(settings.evo_dns || "").trim() && String(settings.evo_api_key || "").trim());
}

async function fetchEvoSales(settings: Record<string, any>, year: number, month: number) {
  const baseUrl = String(settings.evo_base_url || "").trim();
  const dns = String(settings.evo_dns || "").trim();
  const apiKey = String(settings.evo_api_key || "").trim();
  const items: Record<string, unknown>[] = [];
  let preview: unknown = null;

  for (let skip = 0; skip < 5000; skip += 100) {
    const response = await fetch(evoSalesUrl(baseUrl, year, month, skip), {
      headers: {
        Accept: "application/json",
        Authorization: evoAuthorization(dns, apiKey)
      }
    });
    if (!response.ok) {
      throw new Error(`EVO respondio ${response.status}`);
    }
    const json = await response.json();
    if (!preview) preview = json;
    const pageItems = evoItemsFromPayload(json);
    items.push(...pageItems);
    if (pageItems.length < 100) break;
  }

  return { items, preview };
}

async function updateEvoCheckpoint(input: {
  year: number;
  month: number;
  status: string;
  startedAt?: string;
  completedAt?: string | null;
  error?: string;
  rowsInserted?: number;
  duplicatesSkipped?: number;
  totalValue?: number;
  cursor?: Record<string, unknown>;
}) {
  await run(
    `INSERT INTO evo_sync_checkpoints (
      source, year, month, last_started_at, last_completed_at, last_status, last_error,
      last_rows_inserted, last_duplicates_skipped, last_total_value, cursor_json, updated_at
    ) VALUES ('evo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(source, year, month) DO UPDATE SET
      last_started_at=COALESCE(excluded.last_started_at, evo_sync_checkpoints.last_started_at),
      last_completed_at=COALESCE(excluded.last_completed_at, evo_sync_checkpoints.last_completed_at),
      last_status=excluded.last_status,
      last_error=excluded.last_error,
      last_rows_inserted=excluded.last_rows_inserted,
      last_duplicates_skipped=excluded.last_duplicates_skipped,
      last_total_value=excluded.last_total_value,
      cursor_json=excluded.cursor_json,
      updated_at=CURRENT_TIMESTAMP`,
    [
      input.year,
      input.month,
      input.startedAt ?? null,
      input.completedAt ?? null,
      input.status,
      input.error ?? "",
      input.rowsInserted ?? 0,
      input.duplicatesSkipped ?? 0,
      input.totalValue ?? 0,
      JSON.stringify(input.cursor ?? {})
    ]
  );
}

async function syncEvoSales(year: number, month: number, source = "manual") {
  const startedAt = new Date().toISOString();
  await updateEvoCheckpoint({
    year,
    month,
    status: "running",
    startedAt,
    cursor: { source, startedAt }
  });
  const settings = await integrationSettings();
  if (!hasEvoSettings(settings)) {
    await updateEvoCheckpoint({
      year,
      month,
      status: "skipped",
      startedAt,
      completedAt: new Date().toISOString(),
      error: "EVO no configurado",
      cursor: { source }
    });
    throw new Error("Configura evo_base_url, evo_dns y evo_api_key primero");
  }
  try {
    const { items, preview } = await fetchEvoSales(settings, year, month);
    if (!items.length) {
      const error = new Error("La respuesta EVO no contiene una lista de ventas reconocible");
      (error as Error & { preview?: unknown }).preview = preview;
      throw error;
    }

    let summary;
    await transaction(async () => {
      summary = await importSalesObjects(items, {
        sourceType: "evo",
        sourceKey: `evo:${source}:${year}-${String(month).padStart(2, "0")}:${new Date().toISOString()}`,
        replaceMonths: false
      });
    });
    const completedAt = new Date().toISOString();
    const safeSummary = summary as any;
    await updateEvoCheckpoint({
      year,
      month,
      status: "completed",
      startedAt,
      completedAt,
      rowsInserted: Number(safeSummary?.rowsInserted || 0),
      duplicatesSkipped: Number(safeSummary?.duplicatesSkipped || 0),
      totalValue: Number(safeSummary?.totalValue || 0),
      cursor: {
        source,
        itemsRecognized: items.length,
        completedAt
      }
    });
    publishRealtime("evo_sync", {
      year,
      month,
      source,
      summary: safeSummary,
      completedAt
    });
    if (Number(safeSummary?.rowsInserted || 0) > 0) {
      publishRealtime("sales_updated", {
        year,
        month,
        rowsInserted: Number(safeSummary.rowsInserted || 0),
        totalValue: Number(safeSummary.totalValue || 0)
      });
    }
    return summary;
  } catch (error) {
    await updateEvoCheckpoint({
      year,
      month,
      status: "error",
      startedAt,
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Error EVO",
      cursor: { source }
    });
    publishRealtime("evo_sync", {
      year,
      month,
      source,
      status: "error",
      error: error instanceof Error ? error.message : "Error EVO"
    });
    throw error;
  }
}

async function runEvoWorkerOnce() {
  if (evoWorkerRunning) return;
  evoWorkerRunning = true;
  try {
    const settings = await integrationSettings();
    if (!hasEvoSettings(settings)) return;
    const period = currentBogotaPeriod();
    await syncEvoSales(period.year, period.month, "worker");
  } catch (error) {
    console.warn("No se pudo sincronizar EVO en worker:", error instanceof Error ? error.message : error);
  } finally {
    evoWorkerRunning = false;
  }
}

function startEvoWorker() {
  if (!EVO_SYNC_WORKER_ENABLED) return;
  setTimeout(() => runEvoWorkerOnce(), 8_000);
  setInterval(() => runEvoWorkerOnce(), EVO_SYNC_INTERVAL_MS);
}

async function askGroq(apiKey: string, model: string, messages: Array<{ role: "system" | "user"; content: string }>, maxTokens = 900) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: maxTokens,
      messages
    })
  });
  const json = await response.json();
  return { response, json };
}

function stableHash(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
}

async function saveAiContextSnapshot(year: number, month: number, payload: unknown) {
  const snapshotKey = `${year}-${String(month).padStart(2, "0")}:${stableHash(payload)}`;
  await run(
    `INSERT OR IGNORE INTO ai_context_snapshots (year, month, snapshot_key, payload)
     VALUES (?, ?, ?, ?)`,
    [year, month, snapshotKey, JSON.stringify(payload)]
  );
  const row = await get<{ id: number }>("SELECT id FROM ai_context_snapshots WHERE snapshot_key = ?", [snapshotKey]);
  return row?.id ?? null;
}

async function saveAiInsight(input: {
  year: number;
  month: number;
  snapshotId: number | null;
  prompt: string;
  answer: string;
}) {
  await run(
    `INSERT INTO ai_insights (year, month, snapshot_id, prompt, answer, status)
     VALUES (?, ?, ?, ?, ?, 'Generado')`,
    [input.year, input.month, input.snapshotId, input.prompt, input.answer]
  );
  return scalar<number>("SELECT last_insert_rowid()");
}

async function saveAiActions(insightId: number | null, actions: Array<{ title: string; priority?: string; notes?: string }>) {
  if (!insightId) return;
  for (const action of actions.slice(0, 8)) {
    await run(
      `INSERT INTO ai_actions (insight_id, title, priority, notes)
       VALUES (?, ?, ?, ?)`,
      [insightId, action.title, action.priority || "Media", action.notes || ""]
    );
  }
}

async function recentAiMemory(year: number, month: number) {
  const insights = await all<{ id: number; prompt: string; answer: string; created_at: string }>(
    `SELECT id, prompt, answer, created_at
     FROM ai_insights
     WHERE year = ? AND month = ?
     ORDER BY created_at DESC
     LIMIT 5`,
    [year, month]
  );
  if (!insights.length) return [];
  const ids = insights.map((item) => item.id);
  const placeholders = ids.map(() => "?").join(", ");
  const actions = await all(
    `SELECT * FROM ai_actions
     WHERE insight_id IN (${placeholders})
     ORDER BY created_at DESC`,
    ids
  );
  return insights.map((insight) => ({
    ...insight,
    actions: actions.filter((action: any) => Number(action.insight_id) === Number(insight.id))
  }));
}

function compactAiContext(state: any, aiMemory: any[]) {
  return {
    filtros: state.filters,
    kpis: state.kpis,
    calidadDatos: {
      status: state.quality.status,
      totalRows: state.quality.totalRows,
      duplicateGroups: state.quality.duplicateGroups.length,
      naturalDuplicateGroups: state.quality.naturalDuplicateGroups.length,
      orphanSales: state.quality.orphanSales
    },
    crecimiento: state.growth
      ? {
          retention: state.growth.retention,
          opportunities: state.growth.opportunities,
          simulator: state.growth.simulator,
          ltvScenarios: state.growth.ltvScenarios,
          recommendations: state.growth.recommendations
        }
      : null,
    recomendacionesSistema: state.recommendations.slice(0, 8),
    sedes: state.branches.slice(0, 12).map((branch: any) => ({
      name: branch.name,
      sales: branch.sales,
      rows: branch.rows,
      score: branch.score?.score,
      status: branch.score?.status,
      progressMeta1: branch.score?.progressMeta1,
      targetMeta1: branch.target?.meta1
    })),
    asesores: state.advisors.slice(0, 16).map((advisor: any) => ({
      name: advisor.name,
      branchName: advisor.branchName,
      sales: advisor.sales,
      rows: advisor.rows,
      conversions: advisor.conversions,
      score: advisor.score?.score,
      status: advisor.score?.status,
      commissionLevel: advisor.commission?.level,
      missingMeta1: advisor.commission?.missingMeta1
    })),
    planes: state.plans.slice(0, 18).map((plan: any) => ({
      name: plan.name,
      category: plan.category,
      sales: plan.sales,
      rows: plan.rows,
      cashPrice: plan.cash_price,
      avgScore: plan.score?.score
    })),
    iniciativas: state.initiatives.slice(0, 12).map((item: any) => ({
      title: item.title,
      status: item.status,
      type: item.type,
      owner: item.owner
    })),
    tareas: state.todos.slice(0, 12).map((todo: any) => ({
      title: todo.title,
      status: todo.status,
      priority: todo.priority,
      owner: todo.owner
    })),
    importaciones: state.imports.slice(0, 5).map((item: any) => ({
      sourceType: item.source_type,
      rowsInserted: item.rows_inserted,
      duplicatesSkipped: item.duplicates_skipped,
      totalValue: item.total_value,
      importedAt: item.imported_at
    })),
    memoriaIa: aiMemory.map((memory: any) => ({
      prompt: memory.prompt,
      createdAt: memory.created_at,
      actions: memory.actions?.map((action: any) => ({
        title: action.title,
        status: action.status,
        priority: action.priority
      }))
    }))
  };
}

app.get("/api/health", async (_req, res, next) => {
  try {
    const sales = await scalar<number>("SELECT COUNT(*) FROM sales");
    const settings = await integrationSettings();
    res.json({
      ok: true,
      salesRows: sales ?? 0,
      groqConfigured: Boolean(settings.groq_api_key),
      groqModel: settings.groq_model,
      now: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/state", async (req, res, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;
    res.json(await buildAppState(year, month));
  } catch (error) {
    next(error);
  }
});

app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, now: new Date().toISOString() })}\n\n`);
  realtimeClients.add(res);
  req.on("close", () => {
    realtimeClients.delete(res);
  });
});

app.get("/api/quality/duplicates", async (req, res, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;
    res.json(await buildQualityReport(year, month));
  } catch (error) {
    next(error);
  }
});

app.get("/api/reports/gerencial", async (req, res, next) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());
    const month = Number(req.query.month || new Date().getMonth() + 1);
    res.json(await buildManagerReport(year, month));
  } catch (error) {
    next(error);
  }
});

app.get("/api/evo/status", async (req, res, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;
    const where = year && month ? "WHERE year = ? AND month = ?" : "";
    const params = year && month ? [year, month] : undefined;
    const rows = await all(
      `SELECT * FROM evo_sync_checkpoints ${where}
       ORDER BY updated_at DESC
       LIMIT 12`,
      params
    );
    res.json({ workerEnabled: EVO_SYNC_WORKER_ENABLED, intervalMs: EVO_SYNC_INTERVAL_MS, checkpoints: rows });
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings", async (_req, res, next) => {
  try {
    const rows = await all<{ key: string; value: string; secret?: number; updated_at?: string }>("SELECT key, value, secret, updated_at FROM settings ORDER BY key");
    res.json(rows.map(publicSettingRow));
  } catch (error) {
    next(error);
  }
});

app.put("/api/settings", async (req, res, next) => {
  try {
    const values = req.body?.values as Record<string, unknown>;
    if (!values || typeof values !== "object") {
      res.status(400).json({ error: "values es requerido" });
      return;
    }
    await transaction(async () => {
      for (const [key, value] of Object.entries(values)) {
        const secret = key.includes("api_key") ? 1 : 0;
        const textValue = String(value ?? "").trim();
        if (secret && !textValue) continue;
        await run(
          `INSERT INTO settings (key, value, secret, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value, secret=excluded.secret, updated_at=CURRENT_TIMESTAMP`,
          [key, textValue, secret]
        );
      }
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/import/sales-excel", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Archivo Excel requerido" });
      return;
    }
    const originalName = req.file.originalname || "ventas.xlsx";
    const safeName = `${Date.now()}-${originalName.replace(/[^\w.\- ]+/g, "_")}`;
    const target = path.join(uploadDir, safeName);
    fs.renameSync(req.file.path, target);
    let summary;
    await transaction(async () => {
      summary = await importSalesWorkbook(target, {
        sourceType: "excel_upload",
        sourceKey: `excel_upload:${safeName}`,
        replaceMonths: false
      });
    });
    publishRealtime("sales_updated", {
      source: "excel_upload",
      summary,
      importedAt: new Date().toISOString()
    });
    res.json({ ok: true, summary });
  } catch (error) {
    next(error);
  }
});

app.post("/api/evo/sync", async (req, res, next) => {
  try {
    const period = currentBogotaPeriod();
    const year = Number(req.body?.year) || period.year;
    const month = Number(req.body?.month) || period.month;
    const summary = await syncEvoSales(year, month, "manual");
    res.json({ ok: true, summary });
  } catch (error) {
    const status = error instanceof Error && error.message.includes("lista de ventas reconocible") ? 422 : 400;
    res.status(status).json({ error: error instanceof Error ? error.message : "No se pudo sincronizar EVO" });
  }
});

app.post("/api/ai/ask", async (req, res, next) => {
  try {
    const settings = await integrationSettings();
    const apiKey = String(settings.groq_api_key || "").trim();
    const model = String(settings.groq_model || "llama-3.3-70b-versatile").trim();
    const prompt = String(req.body?.prompt || "").trim();
    if (!apiKey) {
      res.status(400).json({ error: "Configura groq_api_key primero" });
      return;
    }
    if (!prompt) {
      res.status(400).json({ error: "prompt es requerido" });
      return;
    }
    const state = await buildAppState(Number(req.body?.year) || undefined, Number(req.body?.month) || undefined);
    const year = Number(state.filters.selectedYear);
    const month = Number(state.filters.selectedMonth);
    const aiMemory = await recentAiMemory(year, month);
    const contexto = compactAiContext(state, aiMemory);
    const snapshotId = await saveAiContextSnapshot(year, month, { prompt, contexto });
    const { response, json } = await askGroq(apiKey, model, [
      {
        role: "system",
        content:
          "Eres un analista comercial senior de HYL Gym. Responde en espanol, con acciones concretas y priorizadas. Debes revisar calidad de datos, duplicados, score, metas, comisiones, crecimiento, recompra, planes y rendimiento de asesores/sedes antes de sugerir acciones. Usa solo los datos entregados; no inventes cifras. Si hay memoria de IA previa, compara contra acciones anteriores."
      },
      {
        role: "user",
        content: JSON.stringify({
          prompt,
          contexto
        })
      }
    ]);
    if (!response.ok) {
      res.status(response.status).json({ error: json?.error?.message || "Groq no pudo responder" });
      return;
    }
    const answer = json.choices?.[0]?.message?.content ?? "";
    const insightId = await saveAiInsight({ year, month, snapshotId, prompt, answer });
    await saveAiActions(insightId, [
      ...(state.growth?.recommendations ?? []).map((item: any) => ({
        title: item.title,
        priority: item.priority,
        notes: `${item.detail} (${item.metric})`
      })),
      ...state.recommendations.slice(0, 4).map((item: any) => ({
        title: item.title,
        priority: item.priority,
        notes: `${item.detail} (${item.metric})`
      }))
    ]);
    res.json({ ok: true, answer, insightId, snapshotId });
  } catch (error) {
    next(error);
  }
});

app.get("/api/ai/insights", async (req, res, next) => {
  try {
    const period = currentBogotaPeriod();
    const year = Number(req.query.year || period.year);
    const month = Number(req.query.month || period.month);
    res.json({ year, month, insights: await recentAiMemory(year, month) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/ai/health", async (_req, res, next) => {
  try {
    const settings = await integrationSettings();
    if (!settings.groq_api_key) {
      res.status(400).json({ ok: false, error: "GROQ_API_KEY no configurada" });
      return;
    }
    const { response, json } = await askGroq(
      settings.groq_api_key,
      settings.groq_model,
      [
        { role: "system", content: "Responde solo con OK." },
        { role: "user", content: "Prueba de conexion HYL Gym" }
      ],
      20
    );
    if (!response.ok) {
      res.status(response.status).json({ ok: false, model: settings.groq_model, error: json?.error?.message || "Groq no pudo responder" });
      return;
    }
    res.json({ ok: true, model: settings.groq_model, answer: json.choices?.[0]?.message?.content ?? "" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/evo/health", async (_req, res, next) => {
  try {
    const settings = await integrationSettings();
    const baseUrl = String(settings.evo_base_url || "").trim();
    const dns = String(settings.evo_dns || "").trim();
    const apiKey = String(settings.evo_api_key || "").trim();
    if (!baseUrl || !dns || !apiKey) {
      res.status(400).json({ ok: false, error: "EVO no esta configurado completo" });
      return;
    }
    const period = currentBogotaPeriod();
    const response = await fetch(evoSalesUrl(baseUrl, period.year, period.month, 0), {
      headers: {
        Accept: "application/json",
        Authorization: evoAuthorization(dns, apiKey)
      }
    });
    if (!response.ok) {
      res.status(response.status).json({ ok: false, error: `EVO respondio ${response.status}` });
      return;
    }
    const json = await response.json();
    res.json({ ok: true, dns, itemsRecognized: evoItemsFromPayload(json).length });
  } catch (error) {
    next(error);
  }
});

app.put("/api/evaluations/:advisorId", async (req, res, next) => {
  try {
    await transaction(async () => {
      await updateEvaluation({
        year: Number(req.body?.year),
        month: Number(req.body?.month),
        advisorId: Number(req.params.advisorId),
        qualityRating: String(req.body?.qualityRating || ""),
        adminRating: String(req.body?.adminRating || ""),
        observations: String(req.body?.observations || "")
      });
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/initiatives", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    await transaction(async () => {
      await run(
        `INSERT INTO initiatives (area, type, title, status, owner, channel, budget, expected_impact, start_date, end_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          body.area || "Direccion",
          body.type || "Idea",
          body.title || "Nueva iniciativa",
          body.status || "Backlog",
          body.owner || "",
          body.channel || "",
          Number(body.budget || 0),
          body.expectedImpact || "",
          body.startDate || null,
          body.endDate || null,
          body.notes || ""
        ]
      );
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/todos", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    await transaction(async () => {
      await run(
        `INSERT INTO todos (title, status, priority, owner, due_date, area, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          body.title || "Nueva tarea",
          body.status || "Pendiente",
          body.priority || "Media",
          body.owner || "",
          body.dueDate || null,
          body.area || "Direccion",
          body.notes || ""
        ]
      );
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/todos/:id", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    await transaction(async () => {
      await run(
        `UPDATE todos
         SET title=COALESCE(?, title),
             status=COALESCE(?, status),
             priority=COALESCE(?, priority),
             owner=COALESCE(?, owner),
             due_date=?,
             area=COALESCE(?, area),
             notes=COALESCE(?, notes),
             updated_at=CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          body.title ?? null,
          body.status ?? null,
          body.priority ?? null,
          body.owner ?? null,
          body.dueDate ?? null,
          body.area ?? null,
          body.notes ?? null,
          Number(req.params.id)
        ]
      );
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/todos/:id", async (req, res, next) => {
  try {
    await transaction(async () => {
      await run("DELETE FROM todos WHERE id = ?", [Number(req.params.id)]);
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/export/:kind.csv", (_req, res) => {
  res.status(410).json({ error: "Los informes gerenciales solo se exportan en PDF." });
});

app.get("/api/export/gerencial.pdf", async (req, res, next) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());
    const month = Number(req.query.month || new Date().getMonth() + 1);
    const report = await buildManagerReport(year, month);
    const rawSections = String(req.query.sections || "").split(",").map((item) => item.trim()).filter(Boolean);
    const sections = new Set(
      rawSections.length
        ? rawSections
        : ["summary", "charts", "daily", "monthly", "annual", "branches", "advisors", "plans", "scores", "quality", "recommendations"]
    );
    const includeGroq = String(req.query.includeGroq || "0") === "1";
    let groqInsights = "";

    if (includeGroq) {
      const settings = await integrationSettings();
      if (settings.groq_api_key) {
        const { response, json } = await askGroq(
          settings.groq_api_key,
          settings.groq_model,
          [
            {
              role: "system",
              content:
                "Eres un director comercial senior de gimnasios. Entrega recomendaciones ejecutivas en espanol para un informe gerencial. Se directo, accionable y basado solo en los datos."
            },
            {
              role: "user",
              content: JSON.stringify({
                objetivo: "Generar sugerencias de accion para el PDF gerencial de HYL Gym.",
                periodo: report.state.filters,
                kpis: report.state.kpis,
                calidadDatos: report.state.quality,
                sedes: report.annualByBranch.slice(0, 10),
                asesores: report.annualByAdvisor.slice(0, 12),
                planes: report.annualByPlan.slice(0, 12),
                recomendacionesSistema: report.state.recommendations
              })
            }
          ],
          1100
        );
        groqInsights = response.ok
          ? json.choices?.[0]?.message?.content ?? ""
          : `Groq no pudo generar sugerencias: ${json?.error?.message || response.status}`;
      } else {
        groqInsights = "Groq no esta configurado para esta instalacion.";
      }
    }

    const pdf = await createManagerPdf(report, {
      year,
      month,
      monthName: report.state.filters.selectedMonthName,
      sections,
      includeGroq,
      groqInsights
    });
    res.header("Content-Type", "application/pdf");
    res.attachment(`informe-gerencial-hyl-gym-${year}-${String(month).padStart(2, "0")}.pdf`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

const clientDist = path.resolve(process.cwd(), "dist", "client");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  const message = error instanceof Error ? error.message : "Error inesperado";
  res.status(500).json({ error: message });
});

async function bootstrap() {
  await migrate();
  await transaction(async () => {
    await seedDefaults();
  });
  const sales = (await scalar<number>("SELECT COUNT(*) FROM sales")) ?? 0;
  console.log(`HYL Gym Direccion API lista en http://localhost:${port} (${sales} ventas)`);
  app.listen(port, host, () => {
    startEvoWorker();
  });
}

bootstrap().catch(async (error) => {
  console.error(error);
  await saveDb().catch(() => undefined);
  process.exit(1);
});
