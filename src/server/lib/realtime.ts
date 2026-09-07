// Canal SSE en memoria para notificaciones en tiempo real.
// Extraido de index.ts sin cambios de comportamiento.
import type express from "express";

export const realtimeClients = new Set<express.Response>();

export function publishRealtime(event: string, payload: unknown) {
  const body = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of realtimeClients) {
    client.write(body);
  }
}
