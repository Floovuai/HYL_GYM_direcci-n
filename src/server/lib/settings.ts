// Lectura de configuracion de integraciones (tabla settings + variables de entorno).
// Extraido de index.ts sin cambios de comportamiento.
import { all } from "../db";

export const EVO_DEFAULT_BASE_URL = "https://evo-integracao-api.w12app.com.br";

export function publicSettingRow(row: { key: string; value: string; secret?: number; updated_at?: string }) {
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

export async function integrationSettings() {
  const rows = await all<{ key: string; value: string }>("SELECT key, value FROM settings");
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    ...settings,
    evo_base_url: String(process.env.EVO_BASE_URL || settings.evo_base_url || EVO_DEFAULT_BASE_URL).trim(),
    evo_dns: String(process.env.EVO_DNS || settings.evo_dns || "").trim(),
    evo_api_key: String(process.env.EVO_API_KEY || process.env.EVO_SECRET_KEY || settings.evo_api_key || "").trim(),
    groq_api_key: String(process.env.GROQ_API_KEY || settings.groq_api_key || "").trim(),
    groq_model: String(process.env.GROQ_MODEL || settings.groq_model || "openai/gpt-oss-120b").trim()
  };
}
