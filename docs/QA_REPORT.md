# QA de produccion

Fecha: 2026-06-30

## Datos

- Ventas cargadas: 3.618
- Total ventas junio 2026: 698.566.500 COP
- Comisiones asesores junio 2026: 4.200.530 COP
- Comision director junio 2026: 500.000 COP
- Sedes: 8
- Asesores activos/comisionables: 16
- Planes: 45
- Metas mensuales: 96
- Duplicados por `sale_key`: 0
- Duplicados naturales: 0
- `sale_key` unicas: 3.618
- Filas sin asesor asignado: 40

## Verificaciones realizadas

- `npm run db:reset`: base inicial creada desde Excel semilla.
- `npm run seed`: reimportacion idempotente, sin duplicar ventas.
- `npm test`: reglas de comisiones y score, incluyendo bonificacion historica enero-junio 2026.
- `npm run build`: TypeScript + build frontend.
- `npm audit`: 0 vulnerabilidades.
- `/api/health`: API responde con ventas cargadas.
- `/api/state`: KPI, scores, comisiones, QA y recomendaciones disponibles.
- `/api/quality/duplicates?year=2026&month=6`: estado `OK`, sin grupos duplicados.
- Depuracion asesores no activos: 2 asesores retirados eliminados de asesores, ventas asociadas y futuras importaciones.
- Barrido exacto en base de datos: 0 apariciones de los nombres retirados solicitados en columnas de texto.
- `/api/ai/health`: Groq responde `OK` con `llama-3.3-70b-versatile`.
- `/api/ai/ask`: consulta comercial real responde con acciones priorizadas sobre duplicados, score, metas y ventas.
- UI Direccion: separada de Configuracion; contiene comisiones, requerimientos, planes, ideas y apoyo comercial.
- UI Configuracion > Integraciones: muestra `Groq: configurado`, no expone patron de token `gsk_` en DOM ni inputs.
- UI Configuracion > Mecanica de comisiones: explica bonificacion historica enero-junio, nuevo esquema desde julio, multiplicadores y bonos de director.
- `/api/export/gerencial.pdf`: descarga PDF gerencial con secciones seleccionables.
- `/api/export/gerencial.pdf&includeGroq=1`: descarga PDF con sugerencias Groq, sin exponer token.
- Render PDF con Poppler: portada, graficos, tablas diarias/mensuales/anuales y saltos de pagina revisados visualmente.
- Subida del mismo Excel de ventas por API: 0 ventas nuevas, 3.618 duplicados omitidos, total de ventas sin cambios.
- QA visual desktop 1280px: Tablero sin desbordamiento horizontal; nombres de sedes visibles; nombres de asesores formateados; score visible junto a barras.
- QA visual Asesores: tarjetas sin scroll horizontal con ventas mes/ano, meta diaria, meta mes, meta anual, Meta 1-4, porcentaje de avance y faltante.
- QA visual Direccion/Configuracion: rutas separadas y sin campos de configuracion dentro de Direccion.
- QA visual movil 390x844: sin desbordamiento horizontal; menu responsive sin scroll horizontal; paneles y tarjetas consultables.

## Resultado

La plataforma queda lista para operacion local con importacion incremental, deduplicacion automatica y control visible de calidad de datos.
