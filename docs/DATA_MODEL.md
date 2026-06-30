# Modelo de datos

## Tablas principales

- `branches`: sedes normalizadas. Codigos principales: `109`, `162`, `BUENOS AIRES`, `SANTA MATILDE`, `MODELIA`, `PRADO`, `VILLAVO`, `ONLINE`.
- `advisors`: asesores comerciales, sede principal y bandera de exclusion para usuarios de soporte.
- `plans`: planes, accesos, preventas y tarifas.
- `sales`: ventas atomicas importadas desde Excel/EVO.
- `sales.sale_key`: llave natural unica para omitir duplicados al reimportar Excel/EVO.
- `monthly_targets`: metas por sede, mes y ano; incluye metas de asesor derivadas.
- `advisor_evaluations`: calidad, gestion administrativa, puntajes y multiplicadores.
- `commission_tiers`: niveles de comision de asesor.
- `director_commission_tiers`: bonos del director comercial por sede.
- `settings`: parametros, EVO y Groq.
- `initiatives`: marketing, proyectos, convenios, requerimientos, planes e ideas.
- `todos`: tareas del dia a dia.
- `import_batches`: auditoria de importaciones.

## Deduplicacion

Cada venta se identifica con una llave compuesta por sede, asesor, plan, cliente externo, descripcion, fecha/hora de venta, valor y cantidad. La tabla `sales` tiene un indice unico sobre `sale_key`.

Cuando se carga un Excel o se sincroniza EVO:

- Las ventas nuevas se insertan.
- Las ventas ya existentes se omiten.
- El resumen de importacion reporta `duplicates_skipped`.

## Semillas

- Ventas reales junio 2026: `VENTAS GENERALES.xlsx`.
- Metas y mecanica julio-diciembre 2026: `Control_Comisiones_Anual_2026_FINAL.xlsx`.
- Precios, estrategias, preventas y tarifas: `METAS, PRECIOS, ESTRATEGIAS, TARIFAS BOLD HYL.xlsx`.

## Normalizacion clave

- `HYL CALLE 109` se guarda como `109`.
- `HYL COLORS 162` se guarda como `162`.
- `HYL PRADO VERANIEGO` se guarda como `PRADO`.
- `HYL VILLAVICENCIO` se guarda como `VILLAVO`.
- Asesores con codificacion rota se corrigen con alias, por ejemplo `ANG�LICA...` a `ANGELICA MARIA GUERRERO ISARIZA`.
