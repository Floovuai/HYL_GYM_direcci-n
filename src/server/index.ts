import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import multer from "multer";
import { loadLocalEnv, resolveFromRoot } from "./env";
import { migrate } from "./schema";
import { all, run, saveDb, scalar, transaction } from "./db";
import {
  importSalesObjects,
  importSalesWorkbook,
  seedDefaults,
  updateEvaluation
} from "./importers";
import { buildAppState, buildQualityReport, exportRows, toCsv } from "./queries";

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

app.use(cors());
app.use(express.json({ limit: "3mb" }));

app.get("/api/health", async (_req, res, next) => {
  try {
    const sales = await scalar<number>("SELECT COUNT(*) FROM sales");
    res.json({ ok: true, salesRows: sales ?? 0, now: new Date().toISOString() });
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

app.get("/api/quality/duplicates", async (req, res, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;
    res.json(await buildQualityReport(year, month));
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings", async (_req, res, next) => {
  try {
    const rows = await all("SELECT key, value, secret, updated_at FROM settings ORDER BY key");
    res.json(rows);
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
        await run(
          `INSERT INTO settings (key, value, secret, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value, secret=excluded.secret, updated_at=CURRENT_TIMESTAMP`,
          [key, String(value ?? ""), secret]
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
    res.json({ ok: true, summary });
  } catch (error) {
    next(error);
  }
});

app.post("/api/evo/sync", async (_req, res, next) => {
  try {
    const settings = Object.fromEntries(
      (await all<{ key: string; value: string }>("SELECT key, value FROM settings")).map((row) => [row.key, row.value])
    );
    const baseUrl = String(settings.evo_base_url || "").trim();
    const apiKey = String(settings.evo_api_key || "").trim();
    if (!baseUrl) {
      res.status(400).json({ error: "Configura evo_base_url primero" });
      return;
    }

    const response = await fetch(baseUrl, {
      headers: {
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      }
    });
    if (!response.ok) {
      res.status(response.status).json({ error: `EVO respondio ${response.status}` });
      return;
    }
    const json = await response.json();
    const items = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.sales)
          ? json.sales
          : [];
    if (!items.length) {
      res.status(422).json({ error: "La respuesta EVO no contiene una lista de ventas reconocible", preview: json });
      return;
    }

    let summary;
    await transaction(async () => {
      summary = await importSalesObjects(items, {
        sourceType: "evo",
        sourceKey: `evo:${new Date().toISOString()}`,
        replaceMonths: false
      });
    });
    res.json({ ok: true, summary });
  } catch (error) {
    next(error);
  }
});

app.post("/api/ai/ask", async (req, res, next) => {
  try {
    const settings = Object.fromEntries(
      (await all<{ key: string; value: string }>("SELECT key, value FROM settings")).map((row) => [row.key, row.value])
    );
    const apiKey = String(settings.groq_api_key || "").trim();
    const model = String(settings.groq_model || "llama-3.1-70b-versatile").trim();
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
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "Eres un analista comercial senior de HYL Gym. Responde en espanol, con acciones concretas y priorizadas. Debes revisar calidad de datos, duplicados, score, metas, comisiones y rendimiento de asesores/sedes antes de sugerir acciones. Usa solo los datos entregados; no inventes cifras."
          },
          {
            role: "user",
            content: JSON.stringify({
              prompt,
              contexto: {
                filtros: state.filters,
                kpis: state.kpis,
                calidadDatos: state.quality,
                recomendacionesSistema: state.recommendations,
                sedes: state.branches,
                asesores: state.advisors.slice(0, 20),
                planes: state.plans.slice(0, 20)
              }
            })
          }
        ]
      })
    });
    const json = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: json?.error?.message || "Groq no pudo responder" });
      return;
    }
    res.json({ ok: true, answer: json.choices?.[0]?.message?.content ?? "" });
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

app.get("/api/export/:kind.csv", async (req, res, next) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());
    const month = Number(req.query.month || new Date().getMonth() + 1);
    const rows = await exportRows(req.params.kind, year, month);
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.attachment(`${req.params.kind}-${year}-${month}.csv`);
    res.send(toCsv(rows));
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
  app.listen(port, host);
}

bootstrap().catch(async (error) => {
  console.error(error);
  await saveDb().catch(() => undefined);
  process.exit(1);
});
