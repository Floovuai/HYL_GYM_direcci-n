# QA de produccion

Fecha: 2026-06-30

## Datos

- Ventas cargadas: 3.622
- Total ventas junio 2026: 698.942.500 COP
- Sedes: 8
- Asesores: 19
- Planes: 45
- Metas mensuales: 96
- Duplicados por `sale_key`: 0
- Duplicados naturales: 0
- `sale_key` unicas: 3.622
- Filas sin asesor asignado: 40

## Verificaciones realizadas

- `npm run db:reset`: base inicial creada desde Excel semilla.
- `npm run seed`: reimportacion idempotente, sin duplicar ventas.
- `npm test`: reglas de comisiones y score.
- `npm run build`: TypeScript + build frontend.
- `npm audit`: 0 vulnerabilidades.
- `/api/health`: API responde con ventas cargadas.
- `/api/state`: KPI, scores, comisiones, QA y recomendaciones disponibles.
- `/api/quality/duplicates?year=2026&month=6`: estado `OK`, sin grupos duplicados.
- `/api/ai/health`: Groq responde `OK` con `llama-3.3-70b-versatile`.
- `/api/ai/ask`: consulta comercial real responde con acciones priorizadas sobre duplicados, score, metas y ventas.
- UI Direccion: muestra `Groq: configurado`, no expone patron de token `gsk_` en DOM ni inputs.
- UI Direccion > Configuracion: subpestana `Mecanica de comisiones` explica asesores, multiplicadores y bonos de director.
- `/api/export/gerencial.pdf`: descarga PDF gerencial con secciones seleccionables.
- `/api/export/gerencial.pdf&includeGroq=1`: descarga PDF con sugerencias Groq, sin exponer token.
- Render PDF con Poppler: portada, graficos, tablas diarias/mensuales/anuales y saltos de pagina revisados visualmente.
- Subida del mismo Excel de ventas por API: 0 ventas nuevas, 3.622 duplicados omitidos, total de ventas sin cambios.
- QA visual desktop: navegacion por Tablero, Asesores, Sedes, Mercadeo, Informes gerenciales, Direccion y Tareas.
- QA visual movil 390x844: sin desbordamiento horizontal y paneles consultables.

## Resultado

La plataforma queda lista para operacion local con importacion incremental, deduplicacion automatica y control visible de calidad de datos.
