# Arquitectura HYL Gym Direccion

## Objetivo

Plataforma local full stack para direccion comercial de HYL Gym. Centraliza ventas, metas, comisiones, scores, campanas, informes gerenciales, direccion, configuracion, integraciones y tareas operativas.

La aplicacion esta pensada para operar en un PC de la red local y exponerse por `http://IP_DEL_PC:4310` para consulta desde celular.

## Stack

- Frontend: React + Vite, con `recharts` para visuales gerenciales.
- Backend: Node.js + Express + TypeScript.
- Base de datos: SQLite nativo con `better-sqlite3`, WAL y `busy_timeout`, guardado en `data/hyl_gym.db`.
- Importacion: Excel compatible con `VENTAS GENERALES.xlsx` y sincronizacion EVO por API.
- IA: Groq compatible con Chat Completions para sugerencias comerciales y PDF.
- PDF: generacion backend con `pdfkit` en formato horizontal gerencial.

## Arranque

1. `src/server/index.ts` carga `.env`, crea `uploads`, aplica migraciones y ejecuta `seedDefaults`.
2. `src/server/schema.ts` crea tablas e indices y normaliza `sale_key` para ventas existentes.
3. `src/server/importers.ts` siembra configuracion, tareas iniciales, ventas, metas, planes, precios, campanas y evaluaciones.
4. Express expone la API en `PORT` o `4310` y sirve `dist/client` cuando existe build.
5. En desarrollo, Vite sirve el frontend y el backend responde las rutas `/api`.

## Flujo de datos

1. Las ventas entran por Excel manual o por EVO.
2. El importador normaliza sedes, asesores y planes; omite asesores de soporte/retiro y ventas EVO con valor menor o igual a cero.
3. Cada venta genera una `sale_key` natural unica. Si ya existe, se omite y se reporta como duplicada.
4. Las metas enero-junio 2026 vienen de la mecanica historica; desde julio 2026 se recalibran metas de asesor y sede con historico productivo reciente.
5. `buildAppState` agrega ventas, metas, comisiones, scores, calidad de datos, crecimiento inteligente, recomendaciones, reportes base y cobertura del mes.
6. La UI consume `/api/state?year=YYYY&month=M`. Si no se envia periodo, usa el mes actual en zona `America/Bogota`.
7. EVO se sincroniza con un worker interno con checkpoint por periodo; el render del tablero ya no bloquea esperando la API externa.
8. El navegador escucha `/api/events` por Server-Sent Events y refresca datos cuando entran ventas nuevas.
9. El endpoint `/api/reports/gerencial` entrega el modelo JSON del informe; `/api/export/gerencial.pdf` genera el PDF con secciones seleccionables y Groq opcional.

## Modulos

- `src/server/schema.ts`: migraciones SQLite, indices y deduplicacion de `sale_key`.
- `src/server/db.ts`: apertura SQLite nativa, WAL, transacciones y health de persistencia.
- `src/server/env.ts`: lectura de `.env` y resolucion de rutas del proyecto.
- `src/server/importers.ts`: importacion Excel, EVO, metas motivacionales, precios, campanas, defaults y evaluaciones.
- `src/server/queries.ts`: agregaciones, estado de app, QA, recomendaciones y modelo de informe gerencial.
- `src/server/pdfReport.ts`: PDF gerencial horizontal con tablas, graficos, calidad de datos y sugerencias.
- `src/server/index.ts`: API HTTP, configuracion, salud, worker EVO, SSE, memoria Groq, exportes y bootstrap.
- `src/shared/business.ts`: reglas de comisiones, metas, scores y niveles.
- `src/shared/types.ts`: tipos compartidos de negocio.
- `src/client/main.tsx`: aplicacion React, pestanas operativas, reportes en pantalla, configuracion e integraciones.
- `src/client/styles.css`: layout responsive, reportes, impresion y estados visuales.
- `tests/business.test.ts`: pruebas de formulas comerciales.

## API principal

- `GET /api/health`: conteos basicos y salud local.
- `GET /api/state?year=&month=`: estado completo de tablero, ventas, metas, scores, QA, recomendaciones, settings publicos y cobertura de datos.
- `GET /api/events`: canal SSE para ventas y sincronizacion EVO en tiempo real.
- `GET /api/quality/duplicates?year=&month=`: diagnostico de duplicados naturales y por `sale_key`.
- `GET /api/reports/gerencial?year=&month=`: modelo JSON del informe gerencial anual hasta el mes seleccionado.
- `GET /api/settings`: configuracion publica; los secretos vuelven vacios con bandera `configured`.
- `PUT /api/settings`: guarda settings; campos secretos vacios no borran el valor existente.
- `POST /api/import/sales-excel`: importa ventas desde Excel subido.
- `POST /api/evo/sync`: sincroniza ventas EVO del periodo indicado o del mes actual.
- `GET /api/evo/health`: prueba credenciales EVO contra ventas del mes actual.
- `GET /api/evo/status`: ultimo checkpoint del worker EVO.
- `POST /api/ai/ask` y `GET /api/ai/health`: consultas y verificacion Groq.
- `GET /api/ai/insights`: memoria de insights y acciones guardadas por periodo.
- `PUT /api/evaluations/:advisorId`: actualiza evaluacion mensual de asesor.
- `POST /api/initiatives`, `POST /api/todos`, `DELETE /api/todos/:id`: operacion diaria.
- `GET /api/export/gerencial.pdf`: descarga PDF gerencial.
- `GET /api/export/:kind.csv`: retirado; responde `410` porque los informes oficiales son PDF.

## Integracion EVO

La configuracion efectiva se toma de variables de entorno y, si faltan, de SQLite:

- `EVO_BASE_URL`: por defecto `https://evo-integracao-api.w12app.com.br`.
- `EVO_DNS`: DNS/tenant usado como usuario Basic.
- `EVO_API_KEY` o `EVO_SECRET_KEY`: token usado como password Basic.

El backend arma la ruta `/api/v2/sales` cuando la URL base no incluye path, envia `dateSaleStart`, `dateSaleEnd`, `take=100` y `skip`, y pagina hasta 5.000 registros. La autorizacion es `Basic base64(EVO_DNS:EVO_API_KEY)`.

El parser acepta listas directas o propiedades comunes (`data`, `items`, `sales`, `vendas`, `records`, `results`, `result`, `value`) y busca campos anidados para fecha, sede, asesor, plan, valor, cantidad y cliente.

El worker EVO corre cada `EVO_SYNC_INTERVAL_MS` milisegundos si `EVO_SYNC_WORKER` no es `0`. Cada corrida queda registrada en `evo_sync_checkpoints` con estado, error, filas insertadas, duplicados y cursor JSON. Las rutas manuales usan el mismo checkpoint.

Cuando entran ventas nuevas, el backend emite `sales_updated` por `/api/events` para que el navegador recargue el estado sin refrescar la pagina manualmente.

## Informes gerenciales

La pantalla `Informes gerenciales` ya no descarga CSV. Muestra el informe en pantalla con el mismo enfoque del PDF:

- Enero a mes seleccionado.
- Dinero ingresado mensual y promedio.
- Sedes, asesores y planes con ventas positivas.
- Rendimiento diario mensual.
- Ventas sin asesor asignado y ventas positivas asociadas a SUPORTEEVO.

El PDF usa el modelo de `buildManagerReport` y puede incluir resumen, graficos, diario, mensual, anual, sedes, asesores, planes, scores, calidad, recomendaciones y sugerencias Groq.

## Metas y comisiones

La plataforma separa:

- Esquema historico enero-junio 2026.
- Esquema de rendimiento desde julio 2026.

Desde julio, Meta 1 de asesor se calcula por sede con promedio de asesores productivos, piso sobre el mejor resultado reciente y tope contra ese mismo mejor resultado. Las metas 2, 3 y 4 son 110%, 120% y 130% de Meta 1. Bronce es 75% y Plata 90%.

Las metas de sede tambien se recalibran con ventas recientes de la sede. El score de sedes conserva comision de director en backend, pero la UI prioriza avance, registros y lectura operativa.

## Cache, IA y persistencia

La base queda en `data/hyl_gym.db`. `better-sqlite3` opera sobre el archivo real con WAL, `synchronous=NORMAL` y transacciones `BEGIN IMMEDIATE`.

La carga de ventas es incremental: no borra meses existentes. Si una fila ya existe, se omite por `sale_key`; si es nueva, se agrega. `import_batches` conserva auditoria de fuente, filas leidas, insertadas, valor total, duplicadas omitidas y detalle.

`metric_cache` guarda agregados costosos por periodo, empezando por el modulo de crecimiento. La version del cache se deriva de conteo, suma, max id y fecha maxima de ventas del periodo; si entra una venta nueva, se recalcula.

Groq ahora guarda memoria operativa:

- `ai_context_snapshots`: contexto compacto enviado a IA.
- `ai_insights`: respuesta generada por periodo.
- `ai_actions`: acciones derivadas de recomendaciones y seguimiento.

## Seguridad local

La app esta pensada para red local. Groq y EVO pueden configurarse por `.env` o desde UI. Las claves guardadas en UI quedan marcadas como secretas en SQLite y no se devuelven crudas en `/api/state` ni `/api/settings`.

Para una version multiusuario se recomienda agregar autenticacion, cifrado de secretos en reposo, roles por perfil, bitacora por usuario y backups automaticos.
