// Registro persistente de errores de plataforma (tabla app_errors).
// Extraido de index.ts sin cambios de comportamiento.
import { run } from "../db";

export async function recordAppError(input: {
  code: string;
  area: string;
  userMessage: string;
  technicalMessage: string;
  method?: string;
  path?: string;
  statusCode?: number;
  details?: unknown;
}) {
  try {
    await run(
      `INSERT INTO app_errors (code, area, user_message, technical_message, method, path, status_code, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.code,
        input.area,
        input.userMessage,
        input.technicalMessage,
        input.method ?? "",
        input.path ?? "",
        input.statusCode ?? 500,
        JSON.stringify(input.details ?? {})
      ]
    );
  } catch (logError) {
    console.warn("No se pudo registrar app_error", logError);
  }
}
