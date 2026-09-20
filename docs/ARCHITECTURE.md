# Arquitectura DashCom

Documento maestro de arquitectura de la plataforma. Documentos complementarios:

- `docs/DATA_MODEL.md`: detalle del modelo de datos.
- `docs/COMMISSIONS_AND_SCORE.md`: reglas de comisiones y score.
- `docs/GROWTH_AI_PERFORMANCE.md`: crecimiento, tiempo real e IA.
- `docs/DEPLOYMENT_SYNC.md`: sincronizacion plataforma / Docker / GitHub / Cloudflare.
- `docs/RUNBOOK.md`: operacion diaria.
- `docs/QA_REPORT.md`: verificaciones de calidad.
- `docs/ROADMAP.md`: evolucion planificada.
- `docs/DASHCOM_ROADMAP.md`: proceso de actualizacion para convertir la instalacion actual en producto DashCom vendible.

## Estado de marca y compatibilidad

DashCom es la marca del producto. La instalacion actual conserva datos, rutas y algunos identificadores tecnicos heredados de HYL Gym para no romper la base ni el despliegue existente:

- Base local y de contenedor: `data/hyl_gym.db` / `/app/data/hyl_gym.db`.
- Servicio Docker: `hyl-gym`.
- Contenedor e imagen local: `hyl-gym-direccion`.
- Cookie de sesion: `hyl_session`.
- Datos semilla y normalizacion de sedes: HYL Gym.

Estos nombres son compatibilidad operativa. La interfaz, login, PDF, IA y logs ya usan DashCom como producto.

## Objetivo

Plataforma local full stack para direccion comercial. Centraliza ventas, metas, comisiones, scores, campanas, mercadeo, competidores, informes gerenciales, direccion, configuracion, integraciones y tareas operativas.

La aplicacion esta pensada para operar en un PC o servidor con Docker y exponerse por red local o por Cloudflare Tunnel para consulta desde celular, tablet y otros PCs.

## Stack

- Frontend: React 18 + Vite, con `recharts` para visuales gerenciales y `lucide-react` para iconografia.
- Backend: Node.js + Express 4 + TypeScript (ejecutado con `tsx`).
- Base de datos: SQLite nativo con `better-sqlite3`, WAL y `busy_timeout`, guardado en `data/hyl_gym.db`.
- Importacion: Excel con `read-excel-file` (compatible con `VENTAS GENERALES.xlsx`) y sincronizacion EVO por API; subida de archivos con `multer`.
- IA: Groq compatible con Chat Completions para sugerencias comerciales, recomendaciones por sede y PDF.
- PDF: generacion backend con `pdfkit` en formato horizontal gerencial.
- Pruebas: `vitest` sobre las formulas de negocio (`tests/business.test.ts`).
- Publicacion segura: Docker Compose con perfil opcional `cloudflare` para `cloudflared`.
- CI: GitHub Actions (`.github/workflows/ci.yml`) valida tests, build y construccion de la imagen Docker en cada push/PR.

## Estructura del repositorio

```text
src/
  client/          React SPA: main.tsx (shell), una vista por modulo cargada bajo
                   demanda (Dashboard, Advisors, Branches, ...), common.tsx y styles.css
  server/          API Express, SQLite, importadores, PDF, worker EVO
    data/          datos estaticos versionados (estacionalidad diaria,
                   seguimiento de sedes agosto 2026) + copias de respaldo
  shared/          reglas de negocio y tipos compartidos cliente/servidor
tests/             pruebas vitest de formulas comerciales
scripts/           PowerShell: backup de plataforma y sync de DB desde Docker
tools/             utilitarios de extraccion/armado de estacionalidad (py/mjs)
docs/              documentacion funcional y tecnica
data/              base SQLite local (no versionada)
uploads/           archivos Excel subidos (no versionados)
dist/              build de produccion (cliente)
.github/workflows/ CI de GitHub Actions
docker-compose.yml, Dockerfile, INICIAR_DASHCOM.bat
```

## Arranque

1. `src/server/index.ts` carga `.env`, crea `uploads`, aplica migraciones y ejecuta `seedDefaults`.
2. `src/server/schema.ts` crea tablas e indices y normaliza `sale_key` para ventas existentes.
3. `src/server/importers.ts` siembra configuracion, tareas iniciales, ventas, metas, planes, precios, campanas y evaluaciones.
4. Express expone la API en `PORT` o `4310` y sirve `dist/client` cuando existe build.
5. En desarrollo, Vite sirve el frontend y el backend responde las rutas `/api`.

Scripts npm relevantes: `dev`, `build`, `start`, `start:container`, `seed`, `db:reset`, `db:sync:from-docker`, `test`.

## Autenticacion

- Login local en `GET/POST /login` con `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
- Sesion por cookie `httpOnly` firmada con `AUTH_SESSION_SECRET` y expiracion `AUTH_SESSION_TTL_MS` (12 horas por defecto), con limite basico de intentos.
- `ALL /logout` cierra la sesion.
- Un middleware protege todas las rutas excepto `/api/health`, `/login` y `/logout`.

## Flujo de datos

1. Las ventas entran por Excel manual o por EVO.
2. El importador normaliza sedes, asesores y planes; omite asesores de soporte/retiro y ventas EVO con valor menor o igual a cero.
3. Cada venta genera una `sale_key` natural unica. Si ya existe, se omite y se reporta como duplicada.
4. Las metas enero-junio 2026 vienen de la mecanica historica; desde julio 2026 se recalibran metas de asesor y sede con historico productivo reciente.
5. `buildAppState` agrega ventas, metas, comisiones, scores, calidad de datos, crecimiento inteligente, recomendaciones, reportes base y cobertura del mes.
6. La UI consume `/api/state?year=YYYY&month=M`. Si no se envia periodo, usa el mes actual en zona `America/Bogota`.
7. EVO se sincroniza con un worker interno con checkpoint por periodo; el render del tablero ya no bloquea esperando la API externa.
8. El navegador escucha `/api/events` por Server-Sent Events y refresca datos cuando entran ventas nuevas, catalogo EVO o evolucion de miembros.
9. El endpoint `/api/reports/gerencial` entrega el modelo JSON del informe; `/api/export/gerencial.pdf` genera el PDF con secciones seleccionables y Groq opcional.
10. En Docker, Cloudflare Tunnel puede publicar el servicio interno `http://hyl-gym:4310` sin abrir puertos.

Ademas de SQLite, `src/server/queries.ts` lee datos estaticos versionados en `src/server/data/`:

- `seasonalityDaily.json`: estacionalidad diaria historica para proyecciones.
- `branchTrackingAug2026.json`: seguimiento de sedes de agosto 2026.

Ambos se cachean en memoria al primer uso. Los utilitarios de `tools/` regeneran la estacionalidad a partir de los libros fuente.

## Modulos

- `src/server/schema.ts`: migraciones SQLite, indices y deduplicacion de `sale_key`.
- `src/server/db.ts`: apertura SQLite nativa, WAL, transacciones y health de persistencia.
- `src/server/env.ts`: lectura de `.env` y resolucion de rutas del proyecto.
- `src/server/importers.ts`: importacion Excel, EVO, metas motivacionales, precios, campanas, defaults y evaluaciones.
- `src/server/queries.ts`: agregaciones, estado de app, QA, recomendaciones, experiencia, competidores y modelo de informe gerencial.
- `src/server/pdfReport.ts`: PDF gerencial horizontal con tablas, graficos, calidad de datos y sugerencias.
- `src/server/index.ts`: API HTTP, login/sesiones, configuracion, salud, worker EVO, SSE, memoria Groq, exportes y bootstrap.
- `src/server/seed.ts`: siembra inicial (`npm run seed`) y reseteo (`npm run db:reset`).
- `src/shared/business.ts`: reglas de comisiones, metas, scores y niveles.
- `src/shared/types.ts`: tipos compartidos de negocio.
- `src/client/main.tsx`: aplicacion React, pestanas operativas, reportes en pantalla, configuracion e integraciones.
- `src/client/styles.css`: layout responsive, reportes, impresion y estados visuales.
- `tests/business.test.ts`: pruebas de formulas comerciales.

## Modelo de datos (tablas principales)

Detalle completo en `docs/DATA_MODEL.md`. Tablas creadas por `schema.ts`:

- Catalogo: `branches`, `advisors`, `plans`.
- Ventas y metas: `sales` (con `sale_key` unica), `monthly_targets`, `advisor_evaluations`.
- Comisiones: `commission_tiers`, `director_commission_tiers`.
- Operacion: `initiatives`, `todos`, `settings`, `import_batches`.
- Miembros: `member_evolution`, `member_evolution_daily_migration`.
- Rendimiento: `metric_cache` (agregados por periodo con version de ventas).
- EVO: `evo_sync_checkpoints`.
- IA: `ai_context_snapshots`, `ai_insights`, `ai_actions`.
- Competencia: `competitors`, `competitor_snapshots`.

## API principal

Autenticacion y salud:

- `GET/POST /login`, `ALL /logout`: sesion local con cookie `httpOnly`.
- `GET /api/health`: conteos basicos y salud local (unica ruta API publica).

Estado y tiempo real:

- `GET /api/state?year=&month=`: estado completo de tablero, ventas, metas, scores, QA, recomendaciones, settings publicos y cobertura de datos.
- `GET /api/experience?year=&month=`: indicadores de experiencia/retencion basados en evolucion de miembros.
- `GET /api/events`: canal SSE para ventas y sincronizacion EVO en tiempo real.
- `GET /api/quality/duplicates?year=&month=`: diagnostico de duplicados naturales y por `sale_key`.

Informes:

- `GET /api/reports/gerencial?year=&month=`: modelo JSON del informe gerencial anual hasta el mes seleccionado.
- `GET /api/export/gerencial.pdf`: descarga PDF gerencial.
- `GET /api/export/:kind.csv`: retirado; responde `410` porque los informes oficiales son PDF.

Configuracion:

- `GET /api/settings`: configuracion publica; los secretos vuelven vacios con bandera `configured`.
- `PUT /api/settings`: guarda settings; campos secretos vacios no borran el valor existente.

Importacion y EVO:

- `POST /api/import/sales-excel`: importa ventas desde Excel subido.
- `GET /api/evolution`: cierres mensuales por sede y totales para la pestana Evolucion.
- `POST /api/evolution/upload`: carga uno o varios Excel mensuales de EVO (`file`, opcional `month`/`year`); reemplaza el mes cargado.
- `POST /api/import/member-evolution-excel`: importa evolucion mensual de miembros por sede.
- `POST /api/evo/sync`: sincroniza ventas EVO del periodo indicado o del mes actual.
- `GET /api/evo/plans` y `POST /api/evo/plans/sync`: catalogo de planes EVO y su sincronizacion.
- `GET /api/evo/health`: prueba credenciales EVO contra ventas del mes actual.
- `GET /api/evo/status`: ultimo checkpoint del worker EVO.

IA:

- `POST /api/ai/ask` y `GET /api/ai/health`: consultas y verificacion Groq.
- `GET /api/ai/insights`: memoria de insights y acciones guardadas por periodo.
- `GET/POST /api/ai/branch-recommendations`: recomendaciones IA por sede (lectura y generacion).

Operacion diaria:

- `PUT /api/evaluations/:advisorId`: actualiza evaluacion mensual de asesor.
- `POST /api/initiatives`: registra iniciativas.
- `POST /api/todos`, `PATCH /api/todos/:id`, `DELETE /api/todos/:id`: tareas.
- `POST /api/competitors`, `PATCH /api/competitors/:id`, `DELETE /api/competitors/:id`, `POST /api/competitors/:id/snapshots`: seguimiento de competidores y sus fotos periodicas.

## Integracion EVO

La configuracion efectiva se toma de variables de entorno y, si faltan, de SQLite:

- `EVO_BASE_URL`: por defecto `https://evo-integracao-api.w12app.com.br`.
- `EVO_DNS`: DNS/tenant usado como usuario Basic.
- `EVO_API_KEY` o `EVO_SECRET_KEY`: token usado como password Basic.

El backend arma la ruta `/api/v2/sales` cuando la URL base no incluye path, envia `dateSaleStart`, `dateSaleEnd`, `take=100` y `skip`, y pagina hasta 5.000 registros. La autorizacion es `Basic base64(EVO_DNS:EVO_API_KEY)`.

El parser acepta listas directas o propiedades comunes (`data`, `items`, `sales`, `vendas`, `records`, `results`, `result`, `value`) y busca campos anidados para fecha, sede, asesor, plan, valor, cantidad y cliente.

El worker EVO corre cada `EVO_SYNC_INTERVAL_MS` milisegundos si `EVO_SYNC_WORKER` no es `0`. Cada corrida queda registrada en `evo_sync_checkpoints` con estado, error, filas insertadas, duplicados y cursor JSON. Las rutas manuales usan el mismo checkpoint.

Cuando entran ventas nuevas, el backend emite `sales_updated` por `/api/events` para que el navegador recargue el estado sin refrescar la pagina manualmente.

Si EVO reconoce filas pero no inserta ventas, el checkpoint incluye `cursor_json.rowsIgnored` y `cursor_json.ignoreReasons`. El tablero lee el ultimo `import_batches.details` para mostrar al usuario si las filas fueron duplicadas, sin valor positivo, sin fecha o descartadas por reglas de asesores.

## Informes gerenciales

La pantalla `Informes gerenciales` ya no descarga CSV. Muestra el informe en pantalla con el mismo enfoque del PDF:

- Enero a mes seleccionado.
- Pulso mensual con proyeccion recomendada, rango probable y confianza.
- Dinero ingresado mensual y promedio.
- Sedes, asesores y planes con ventas positivas.
- Rendimiento diario mensual.
- Ventas sin asesor asignado y ventas positivas asociadas a SUPORTEEVO.

El PDF usa el modelo de `buildManagerReport` y puede incluir resumen, graficos, diario, mensual, anual, sedes, asesores, planes, scores, calidad, recomendaciones y sugerencias Groq.

La salud comercial de datos se calcula sin modificar historicos. El tablero muestra ventas positivas sin asesor, valor pendiente de asignacion y desglose por sede para revisar responsabilidad comercial antes de liquidar.

La proyeccion gerencial combina:

- Ritmo lineal actual: ventas acumuladas / dias cargados * dias del mes.
- Historico ajustado: participacion historica del mismo corte de dias sobre meses cerrados (usa `seasonalityDaily.json`).
- Rango probable: conservador a optimista segun percentiles historicos.
- Confianza: dias cargados, muestras historicas, dispersion y frescura de datos.

## Mercadeo

La pestana `Mercadeo` evita mezclar resultados reales con supuestos. El layout esta consolidado en tarjetas compactas (KPIs con el mismo tamano que el Tablero) para que la mayor parte de la informacion entre en una sola pantalla:

- KPIs superiores: planes activos, planes con venta del mes, adopcion promedio e ingreso mensualizado.
- Fila superior (dos columnas): "Tendencias de uso comercial" (facturacion y registros por dia, todas las etiquetas de dia visibles) y "Medios de pago por mes" (barras apiladas por metodo de pago).
- "Rentabilidad y adopcion por plan": una sola tarjeta con **3 pestanas internas**:
  - *Por plan*: ingreso mensualizado por plan (barra horizontal), coloreado segun el nivel de adopcion (verde/ambar/rojo) y con el nombre completo del plan + su adopcion en el eje.
  - *Por sede y plan*: top combinaciones sede+plan por ingreso mensualizado.
  - *Mix familia*: mix de ventas agrupado por familia de plan (duracion/tipo de membresia), fusionado aqui para liberar espacio en la pestana.
- "Oportunidades comerciales": una sola tarjeta con **3 pestanas internas**, cada una como lista compacta de tarjetas de maximo 2 lineas (nombre + metricas clave a la izquierda, valor principal a la derecha; el detalle largo, cuando existe, queda como tooltip al pasar el mouse):
  - *Oportunidad*: planes con venta o ticket relevante y adopcion menor a 75% de sedes activas.
  - *Catalogo*: buscador + tarjetas de planes activos con precio, venta, adopcion y cantidad de sedes (antes "Mapa visual del catalogo").
  - *Por sede*: sugerencias de plan por sede para cerrar brecha de meta (antes "Planes por sede para aumentar facturacion").

Rentabilidad comercial: ingreso mensualizado estimado por plan y por sede/plan usando ventas reales y `cost_per_month` cuando existe. No existe hoy una llave `campana -> venta`, por lo que Mercadeo no muestra atribucion de campanas. Tampoco hay costos reales por producto/sede; la rentabilidad es comercial/mensualizada, no margen financiero. Para habilitar margen real se requeriria ampliar el modelo con costos por sede/producto.

## Metas y comisiones

La plataforma separa:

- Esquema historico enero-junio 2026.
- Esquema de rendimiento desde julio 2026.

Desde julio, Meta 1 de asesor se calcula por sede con promedio de asesores productivos, piso sobre el mejor resultado reciente y tope contra ese mismo mejor resultado. Las metas 2, 3 y 4 son 110%, 120% y 130% de Meta 1. Bronce es 75% y Plata 90%.

Las metas de sede tambien se recalibran con ventas recientes de la sede. El score de sedes conserva comision de director en backend, pero la UI prioriza avance, registros y lectura operativa.

Detalle de formulas y niveles en `docs/COMMISSIONS_AND_SCORE.md`.

## Cache, IA y persistencia

La base queda en `data/hyl_gym.db`. `better-sqlite3` opera sobre el archivo real con WAL, `synchronous=NORMAL` y transacciones `BEGIN IMMEDIATE`.

La carga de ventas es incremental: no borra meses existentes. Si una fila ya existe, se omite por `sale_key`; si es nueva, se agrega. `import_batches` conserva auditoria de fuente, filas leidas, insertadas, valor total, duplicadas omitidas y detalle.

El estado de la app (`/api/state`) se cachea en memoria por periodo con ETag (`src/server/lib/stateCache.ts`) y se invalida con la version de datos de `db.ts`; detalle y mediciones en [PERFORMANCE.md](PERFORMANCE.md).

`metric_cache` guarda agregados costosos por periodo, empezando por el modulo de crecimiento. La version del cache se deriva de conteo, suma, max id y fecha maxima de ventas del periodo; si entra una venta nueva, se recalcula.

Groq guarda memoria operativa:

- `ai_context_snapshots`: contexto compacto enviado a IA.
- `ai_insights`: respuesta generada por periodo.
- `ai_actions`: acciones derivadas de recomendaciones y seguimiento.

Las recomendaciones IA por sede (`/api/ai/branch-recommendations`) se generan bajo demanda con el contexto comercial de la sede y quedan consultables por periodo.

## Despliegue y operacion

### Docker

`docker-compose.yml` define:

- Servicio `hyl-gym`: imagen local `hyl-gym-direccion:local`, `restart: unless-stopped`, healthcheck sobre `/api/health`, puerto `${PORT:-4310}`. El nombre es legado de la instalacion actual.
- Volumenes nombrados `hyl_data:/app/data` y `hyl_uploads:/app/uploads` (evitan errores SQLite `SHMOPEN` de OneDrive/bind mounts en Windows).
- `ADMIN_PASSWORD` y `AUTH_SESSION_SECRET` son obligatorios (`:?` en compose): sin ellos el stack no levanta.
- Servicio `cloudflared` en perfil opcional `cloudflare`, que publica `http://hyl-gym:4310` con `CLOUDFLARE_TUNNEL_TOKEN` sin abrir puertos.

### Scripts operativos

- `INICIAR_DASHCOM.bat`: arranque recomendado en Windows.
- `scripts/backup-platform.ps1`: backup de la plataforma.
- `scripts/sync-db-from-docker.ps1` (`npm run db:sync:from-docker`): copia la base del volumen Docker al entorno local antes de usar `npm run dev`.

### CI/CD

`.github/workflows/ci.yml` corre en cada push y pull request: tests (`vitest`), build (tsc + vite) y construccion de la imagen Docker. La instancia publicada por Cloudflare se actualiza reconstruyendo el compose en el equipo que mantiene la base SQLite (ver `docs/DEPLOYMENT_SYNC.md`).

## Seguridad

La app esta pensada para red local. Groq y EVO pueden configurarse por `.env` o desde UI. Las claves guardadas en UI quedan marcadas como secretas en SQLite y no se devuelven crudas en `/api/state` ni `/api/settings`.

La app incluye login local con cookie `httpOnly`, expiracion de sesion y limite basico de intentos. Si se publica por Cloudflare Tunnel, usar HTTPS, contrasena larga, `AUTH_SESSION_SECRET` unico y controles de acceso de Cloudflare cuando aplique.

No versionar `data/*.db`, `.env`, `uploads/` ni reportes generados.

Para una version multiusuario se recomienda agregar roles por perfil, bitacora por usuario, cifrado de secretos en reposo y backups automaticos.
