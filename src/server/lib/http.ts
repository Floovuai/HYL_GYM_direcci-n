// Helpers de errores HTTP compartidos por el servidor.
// Extraidos de index.ts sin cambios de comportamiento.
import multer from "multer";

export function httpError(message: string, statusCode = 400, code = "DC-REQ-400") {
  return Object.assign(new Error(message), { statusCode, code });
}

export function platformErrorCode(error: unknown, statusCode: number) {
  const explicit = (error as { code?: unknown })?.code;
  if (typeof explicit === "string" && explicit.startsWith("DC-")) return explicit;
  if (error instanceof multer.MulterError) return "DC-UPL-413";
  if (statusCode === 401) return "DC-AUTH-401";
  if (statusCode === 404) return "DC-REQ-404";
  if (statusCode < 500) return "DC-REQ-400";
  return "DC-SRV-500";
}

export function clientErrorMessage(code: string) {
  if (code.startsWith("DC-UPL")) return "No se pudo procesar el archivo cargado.";
  if (code.startsWith("DC-EVO")) return "No se pudo conectar con EVO.";
  if (code.startsWith("DC-GRQ")) return "No se pudo conectar con Groq.";
  if (code.startsWith("DC-CFG")) return "No se pudo guardar la configuracion.";
  if (code.startsWith("DC-DATA")) return "Hay datos comerciales que requieren revision.";
  return "La plataforma encontro un error y lo registro para revision.";
}
