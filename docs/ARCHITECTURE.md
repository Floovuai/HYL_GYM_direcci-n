# Arquitectura HYL Gym Direccion

## Objetivo

Plataforma local full stack para direccion comercial de HYL Gym. Centraliza ventas, metas, comisiones, scores, campanas, informes de junta, integraciones y tareas operativas.

## Stack

- Frontend: React + Vite, responsive para escritorio y celular en modo consulta.
- Backend: Node.js + Express + TypeScript.
- Base de datos: SQLite persistente con `sql.js`, guardado en `data/hyl_gym.db`.
- Importacion: Excel compatible con el formato de `VENTAS GENERALES.xlsx`; sincronizacion JSON generica para API EVO.
- IA: endpoint Groq compatible con Chat Completions, configurado por `.env`.
- PDF: generacion backend con `pdfkit` para informes gerenciales A4.

## Flujo de datos

1. Excel de ventas o API EVO entrega ventas con sede, asesor, plan, valor y fecha.
2. El backend normaliza sedes, asesores y planes.
3. SQLite guarda ventas atomicas y tablas maestras; cada venta tiene `sale_key` unico para evitar duplicados.
4. Las metas julio-diciembre 2026 se siembran desde `Control_Comisiones_Anual_2026_FINAL.xlsx`.
5. La API calcula comisiones, scores y reportes usando funciones TypeScript testeadas.
6. La UI consume `/api/state?year=YYYY&month=M`.
7. El endpoint `/api/export/gerencial.pdf` genera el PDF con secciones seleccionables y Groq opcional.

## Modulos

- `src/server/schema.ts`: migraciones SQLite.
- `src/server/importers.ts`: importacion Excel, EVO, metas, precios, campanas y evaluaciones.
- `src/server/queries.ts`: agregaciones y estado de la app.
- `src/server/queries.ts`: tambien entrega QA de duplicados y recomendaciones comerciales.
- `src/server/pdfReport.ts`: informe gerencial PDF con graficos, tablas y secciones configurables.
- `src/server/index.ts`: API HTTP.
- `src/shared/business.ts`: reglas de comisiones y score.
- `src/client/main.tsx`: interfaz principal.
- `tests/business.test.ts`: pruebas de formulas comerciales.

## Persistencia

La base queda en `data/hyl_gym.db`. Cada mutacion corre en transaccion y se guarda con escritura temporal + rename para reducir riesgo de archivo parcial.

La carga de ventas es incremental: no borra meses existentes. Si una fila ya existe, se omite por `sale_key`; si es nueva, se agrega.

## Seguridad local

La app esta pensada para red local. Groq se lee desde `GROQ_API_KEY` en `.env`, archivo ignorado por Git. Las claves configuradas desde UI quedan marcadas como secretas en SQLite y no se devuelven crudas en `/api/state`. Para una version multiusuario se recomienda agregar autenticacion, cifrado de secretos y roles por perfil.
