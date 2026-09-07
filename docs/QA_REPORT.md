# QA de produccion DashCom

## Auditoria documental y estado observado 2026-09-06

Objetivo: dejar la documentacion alineada para continuar el proceso DashCom sin confundir marca de producto con datos HYL.

Estado observado en `data/hyl_gym.db` local:

- Ventas totales: 29.341.
- Sedes: 9.
- Asesores: 34.
- Planes: 96.
- Metas mensuales: 96.
- Importaciones auditadas: 323.
- Evolucion de miembros: 91 filas.
- Insights IA guardados: 10.
- Ultimos periodos con ventas:
  - Septiembre 2026: 1.092 registros, 151.521.445,5 COP.
  - Agosto 2026: 5.271 registros, 655.840.001 COP.
  - Julio 2026: 6.236 registros, 912.900.001 COP.
  - Junio 2026: 4.135 registros, 767.876.500 COP.

Cambios documentales aplicados:

- README actualizado como portada de DashCom.
- Arquitectura actualizada con estado de marca y compatibilidad HYL.
- Runbook actualizado para usar `INICIAR_DASHCOM.bat` y volumenes Docker nombrados.
- Sincronizacion/Cloudflare actualizada con estado actual de producto y nombres legados.
- Modelo de datos actualizado para marcar reglas y semillas HYL como especificas de la instalacion.
- Comisiones actualizadas como mecanica HYL dentro de DashCom, no regla universal del producto.
- Roadmaps actualizados para continuar auditoria, Excel, calidad de datos, visual DashCom, version limpia e instalador.

Verificacion tecnica ejecutada despues de actualizar documentacion:

- `npm test`: 1 archivo aprobado, 9 pruebas aprobadas.
- `npm run build`: TypeScript y Vite completaron correctamente.
- Advertencia residual: Vite informa un chunk mayor a 500 kB despues de minificar; no bloquea el build y queda como optimizacion pendiente.

Pendiente de QA funcional posterior:

- Ejecutar auditoria visual actual de todas las pantallas.
- Probar carga Excel correcta, repetida y defectuosa con archivos recientes.
- Validar PDF con marca DashCom y datos actuales.
- Validar EVO y Groq con credenciales reales/configuradas.
- Ejecutar backup `pre-update` antes del siguiente cambio funcional y `post-update` al cerrar.

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

## Auditoria funcional 2026-07-12

- Ventas actuales en `data/hyl_gym.db`: 18.217 filas.
- Periodo julio 2026: 1.992 registros, 285.821.000 COP.
- Ventas sin sede: 0.
- Ventas sin plan: 0.
- Ventas sin cliente externo: 0.
- Ventas sin asesor: 1.764 filas historicas; ahora se exponen en el tablero como alerta comercial para correccion operativa.
- `member_evolution`: 0 filas; ahora la UI permite cargar evolucion mensual desde `Sedes > Cargar evolucion`.
- `npm test`: 1 archivo, 7 pruebas aprobadas.
- `npm run build`: TypeScript y Vite completan correctamente; Vite conserva advertencia informativa por chunk mayor a 500 kB.
- Cambio agregado: `import_batches.details` registra `rowsIgnored` e `ignoreReasons` para cargas EVO, diferenciando duplicados de filas descartadas por valor no positivo, fecha ausente o asesor retirado.
- Cambio agregado: el tablero muestra salud comercial de datos con ventas positivas sin asesor, valor pendiente por sede, ultima carga y filas EVO ignoradas.

## Auditoria operativa 2026-07-11

- Instancia activa: Docker Compose, contenedor `hyl-gym-direccion`, imagen `hyl-gym-direccion:local`, estado `healthy`.
- Base activa en Docker: `/app/data/hyl_gym.db`.
- Backup previo a limpieza EVO: `/app/data/hyl_gym.before-evo-zero-clean-20260711153343.db`.
- Copias locales de respaldo: `data/hyl_gym.before-evo-zero-clean-20260711153343.db` y `data/hyl_gym.docker-after-evo-zero-clean-20260711153343.db`.
- Reparacion local: `data/hyl_gym.db` fue reemplazada por la copia limpia de Docker; los archivos anteriores quedaron como `data/hyl_gym.before-local-corrupt-20260711153343.db`, `data/hyl_gym.db-wal.before-20260711153343-local-corrupt` y `data/hyl_gym.db-shm.before-20260711153343-local-corrupt`.
- Limpieza aplicada: eliminadas 491 filas antiguas de `sales` con `source_type='evo'`, `value <= 0`, sin asesor, sin plan y sin descripcion.
- Ventas despues de limpieza: 18.217 filas.
- Ventas EVO despues de limpieza: 0 filas, 0 COP.
- Duplicados por `sale_key`: 0 grupos.
- Integridad SQLite del volumen Docker: `PRAGMA integrity_check = ok`.
- `/api/health`: responde `ok` con 18.217 ventas.
- `npm test`: 1 archivo, 7 pruebas aprobadas.
- `npm run build`: TypeScript y Vite completan correctamente; Vite mantiene advertencia informativa por chunk mayor a 500 kB.
- Docker verificado contra workspace: hashes de `src/server/importers.ts`, `src/server/index.ts`, `src/client/main.tsx` y `package.json` coinciden entre imagen activa y archivos locales.
- GitHub remoto: repositorio `Floovuai/HYL_GYM_direcci-n`, PR draft abierto `#1 Add protected Docker deployment`.
- Estado Git: la rama local `codex/docker-public-auth-deploy` esta alineada con su upstream, pero conserva cambios locales pendientes de commit/publicacion.
