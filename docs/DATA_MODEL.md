# Modelo de datos DashCom

La base actual de DashCom conserva el nombre `hyl_gym.db` y reglas de normalizacion HYL porque esta instalacion nacio sobre datos reales de HYL Gym. Para la version comercial limpia, estos nombres y reglas deben parametrizarse o migrarse sin alterar la base operativa.

## Tablas principales

- `branches`: sedes normalizadas. Codigos principales: `109`, `162`, `BUENOS AIRES`, `SANTA MATILDE`, `MODELIA`, `PRADO`, `VILLAVO`, `ONLINE`.
- `advisors`: asesores comerciales, sede principal y bandera de exclusion para usuarios de soporte.
- `plans`: planes, accesos, preventas y tarifas.
- `sales`: ventas atomicas importadas desde Excel/EVO.
- `sales.sale_key`: llave natural unica para omitir duplicados al reimportar Excel/EVO.
- `monthly_targets`: metas por sede, mes y ano; incluye metas de asesor y sede.
- `advisor_evaluations`: calidad, gestion administrativa, puntajes y multiplicadores.
- `commission_tiers`: niveles de comision de asesor.
- `director_commission_tiers`: bonos del director comercial por sede.
- `settings`: parametros, EVO y Groq; secretos marcados con `secret=1`.
- `initiatives`: marketing, proyectos, convenios, requerimientos, planes e ideas.
- `todos`: tareas del dia a dia.
- `import_batches`: auditoria de importaciones.
- `member_evolution`: evolucion mensual de miembros por sede; no se mezcla con ventas.
- `metric_cache`: cache de agregados por periodo con version de datos.
- `evo_sync_checkpoints`: estado del worker/sync EVO por mes.
- `ai_context_snapshots`: contexto compacto enviado a IA.
- `ai_insights`: respuestas generadas por IA por periodo.
- `ai_actions`: acciones sugeridas por IA para seguimiento.

## Compatibilidad HYL en la base actual

Elementos que aun son especificos de la instalacion HYL:

- Nombre de archivo por defecto: `data/hyl_gym.db`.
- Rutas de semillas en `.env.example` y `seed.ts` apuntan a libros historicos HYL cuando existen en el equipo original.
- Normalizacion de sedes HYL (`109`, `162`, `PRADO`, `VILLAVO`, etc.).
- Reglas puntuales de reasignacion de asesores desde julio/agosto 2026.
- Datos estaticos de estacionalidad historica en `src/server/data/`.

Para vender DashCom a otro cliente, estos puntos deben moverse a configuracion, plantilla demo o migracion inicial.

## Indices de rendimiento

La tabla `sales` tiene indices para lectura operacional:

- `idx_sales_period`: ano, mes y dia.
- `idx_sales_branch_period`: sede y periodo.
- `idx_sales_advisor_period`: asesor y periodo.
- `idx_sales_client_period`: cliente externo y periodo, usado para recompra/churn proxy.
- `idx_sales_plan_period`: plan y periodo.
- `idx_sales_sold_at`: fecha/hora de venta.
- `idx_sales_source`: fuente y llave de importacion.

## Deduplicacion

Cada venta se identifica con una llave compuesta por sede, asesor, plan, cliente externo, descripcion, fecha/hora de venta, valor y cantidad. La tabla `sales` tiene un indice unico sobre `sale_key`.

Desde el 16/07/2026 la sede efectiva de una venta puede venir de una regla de asignacion por asesor, sin modificar el payload original guardado en `raw_json`. Esto permite que julio conserve ventas historicas y que los cambios de sede de asesores afecten solo las ventas dentro de su vigencia. Las vistas mensuales de asesores agrupan por asesor+sede efectiva para que un cambio a mitad de mes no mezcle metas de sedes distintas.

Cuando se carga un Excel o se sincroniza EVO:

- Las ventas nuevas se insertan.
- Las ventas ya existentes se omiten.
- El resumen de importacion reporta `duplicates_skipped`.
- Las ventas EVO con valor menor o igual a cero no se insertan en `sales`.
- Las filas EVO descartadas quedan resumidas en `import_batches.details.ignoreReasons` para auditoria operativa.

## Calidad comercial de datos

El tablero expone una franja de salud comercial basada en `buildQualityReport`:

- ventas positivas sin asesor asignado;
- valor positivo sin asesor por sede;
- duplicados por `sale_key` y duplicados naturales;
- ventas positivas asociadas a usuarios de soporte EVO;
- ultima carga, duplicados omitidos y filas ignoradas.

Estos diagnosticos no modifican las tablas historicas. Sirven para corregir asignaciones, revisar importaciones y proteger comisiones antes de liquidar.

## Evolucion de miembros

`member_evolution` se actualiza por `UNIQUE(year, month, branch_id)`. La carga desde `Sedes > Cargar evolucion` hace `upsert` de:

- activos inicio y fin;
- nuevos, renovados, reinscripciones y retornos;
- cancelaciones, vencidos, no renovados, suspendidos y salidas totales;
- evolucion neta y fuente del archivo.

La tabla permite calcular churn directo, salida bruta, retencion y evolucion neta sin alterar `sales`.

## Evolucion mensual (pestana Evolucion)

`evolution_monthly` guarda el cierre mensual por sede tal como lo exporta EVO, con `UNIQUE(year, month, branch_id)`:

- `active_start + total_entries - total_exits = active_end` (se valida al cargar).
- `total_entries = new_members + renewed + reinscriptions + returned_from_suspension`.
- `total_exits = cancellations + expired + not_renewed + suspended`.
- `net_evolution = active_end - active_start`; el % se calcula sobre `active_start`, y el `active_start` de un mes es el `active_end` del anterior.
- `source` es `seed` (historico incluido en el instalador) o `upload` (cargado por el usuario). El arranque solo siembra meses sin filas.

Es independiente de `member_evolution`, que conserva los cortes diarios usados por Sedes y Experiencia.

## Competencia (0.1.12)

`branches` suma `address`, `maps_url`, `latitude`, `longitude`, `radius_m` y `location_status` (`confirmada`, `pendiente`, `cerrada`, `sin_ubicacion`). `competitors` suma ubicacion, `distance_m`, redes, `pricing_url`, `competitor_type`, `chain`, `status`, `source`, `osm_id`, `verified_at` y datos de la ultima revision. Tablas nuevas: `competitor_price_obs` (historial de precios con `is_current`), `competitor_changes`, `competition_runs` y `competitor_brands` (perfiles de marca). Detalle en [COMPETENCIA.md](COMPETENCIA.md).

## Semillas

- Ventas reales junio 2026: `VENTAS GENERALES.xlsx`.
- Metas y mecanica julio-diciembre 2026: `Control_Comisiones_Anual_2026_FINAL.xlsx`.
- Precios, estrategias, preventas y tarifas: `METAS, PRECIOS, ESTRATEGIAS, TARIFAS BOLD HYL.xlsx`.

Estas semillas son utiles para la instalacion HYL. No deben incluirse como datos privados en una version comercial limpia.

## Metas

`monthly_targets` conserva metas de asesor y sede en la misma fila para cada sede/mes:

- `advisor_activation`, `advisor_bronze`, `advisor_silver`, `advisor_meta1..4`.
- `branch_activation`, `branch_bronze`, `branch_silver`, `branch_meta1..4`.
- Campos diarios y semanales de Meta 4 para asesor y sede.

Desde julio 2026, las metas importadas se recalibran antes de guardar:

- Meta 1 asesor usa historico de asesores productivos de la sede.
- Meta 1 sede usa ventas recientes de la sede.
- Meta 2 = 110%, Meta 3 = 120% y Meta 4 = 130%.

## Settings publicos y secretos

Las claves sensibles (`evo_api_key`, `groq_api_key`) se guardan en `settings` con `secret=1`. Las respuestas publicas no devuelven el valor crudo; devuelven indicador de configuracion.

Variables de entorno tienen prioridad sobre SQLite para:

- `EVO_BASE_URL`
- `EVO_DNS`
- `EVO_API_KEY` o `EVO_SECRET_KEY`
- `EVO_SYNC_WORKER`
- `EVO_SYNC_INTERVAL_MS`
- `GROQ_API_KEY`
- `GROQ_MODEL`

## Mercadeo y atribucion

`initiatives` permite registrar campanas de Marketing con `type`, `status`, `owner`, `channel`, `budget`, `expected_impact`, fechas y notas.

La tabla no tiene una relacion directa con `sales`, por lo que la plataforma no debe afirmar ventas atribuidas a una campana. Mercadeo puede cruzar datos observados de ventas, metas, sedes, planes y recompra proxy, pero cualquier impacto de campana debe quedar como esperado o simulado hasta crear una llave de atribucion.

## Normalizacion clave

- `HYL CALLE 109` se guarda como `109`.
- `HYL COLORS 162` se guarda como `162`.
- `HYL PRADO VERANIEGO` se guarda como `PRADO`.
- `HYL VILLAVICENCIO` se guarda como `VILLAVO`.
- Asesores con codificacion rota se corrigen con alias, por ejemplo `ANGELICA...` a `ANGELICA MARIA GUERRERO ISARIZA`.
