# Modelo de datos

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

## Deduplicacion

Cada venta se identifica con una llave compuesta por sede, asesor, plan, cliente externo, descripcion, fecha/hora de venta, valor y cantidad. La tabla `sales` tiene un indice unico sobre `sale_key`.

Cuando se carga un Excel o se sincroniza EVO:

- Las ventas nuevas se insertan.
- Las ventas ya existentes se omiten.
- El resumen de importacion reporta `duplicates_skipped`.
- Las ventas EVO con valor menor o igual a cero no se insertan en `sales`.

## Semillas

- Ventas reales junio 2026: `VENTAS GENERALES.xlsx`.
- Metas y mecanica julio-diciembre 2026: `Control_Comisiones_Anual_2026_FINAL.xlsx`.
- Precios, estrategias, preventas y tarifas: `METAS, PRECIOS, ESTRATEGIAS, TARIFAS BOLD HYL.xlsx`.

## Metas

`monthly_targets` conserva metas de asesor y sede en la misma fila para cada sede/mes:

- `advisor_activation`, `advisor_bronze`, `advisor_silver`, `advisor_meta1..4`.
- `branch_activation`, `branch_bronze`, `branch_silver`, `branch_meta1..4`.
- Campos diarios y semanales de Meta 4 para asesor y sede.

Desde julio 2026, las metas importadas se recalibran antes de guardar:

- Meta 1 asesor usa historico de asesores productivos de la sede.
- Meta 1 sede usa ventas recientes de la sede.
- Bronce = 75%, Plata = 90%, Meta 2 = 110%, Meta 3 = 120% y Meta 4 = 130%.

## Settings publicos y secretos

Las claves sensibles (`evo_api_key`, `groq_api_key`) se guardan en `settings` con `secret=1`. Las respuestas publicas no devuelven el valor crudo; devuelven indicador de configuracion.

Variables de entorno tienen prioridad sobre SQLite para:

- `EVO_BASE_URL`
- `EVO_DNS`
- `EVO_API_KEY` o `EVO_SECRET_KEY`
- `GROQ_API_KEY`
- `GROQ_MODEL`

## Normalizacion clave

- `HYL CALLE 109` se guarda como `109`.
- `HYL COLORS 162` se guarda como `162`.
- `HYL PRADO VERANIEGO` se guarda como `PRADO`.
- `HYL VILLAVICENCIO` se guarda como `VILLAVO`.
- Asesores con codificacion rota se corrigen con alias, por ejemplo `ANGELICA...` a `ANGELICA MARIA GUERRERO ISARIZA`.
