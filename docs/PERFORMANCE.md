# Rendimiento de DashCom

Guia de la capa de velocidad introducida en la version 0.1.9. Ninguna de estas mejoras cambia formulas, metas, comisiones ni la mecanica de la plataforma: las cifras que ve el usuario son las mismas; solo se calculan y transfieren menos veces.

## Medicion de referencia

Medido sobre una copia de `data/hyl_gym.db` (31.911 ventas), periodo agosto 2026, ejecutando `buildAppState` con Electron como Node.

| Medida | Antes (0.1.8) | Despues (0.1.9) |
|---|---|---|
| Calculo completo de `/api/state` (frio) | 439 - 631 ms | 138 - 220 ms |
| Lectura repetida de `/api/state` | 439 ms + 311 KB en cada llamada | 0 ms en servidor; `304` de ~300 bytes en ~5 ms |
| Solicitudes por 5 eventos de foco seguidos | 5 calculos completos | 1 solicitud, `304` |
| JS inicial de la aplicacion | 172 KB (todas las vistas) | 31 KB (las vistas se cargan al abrirlas) |
| Descarga de assets al reabrir | ~830 KB cada vez | 0 (cache inmutable) |

Los tiempos dependen del equipo; para reproducirlos use el encabezado `Server-Timing` de `/api/state` (ver abajo).

## Servidor

- **Cache del estado** (`src/server/lib/stateCache.ts`). `/api/state` guarda en memoria el JSON ya serializado por periodo (hasta 6 periodos) con su `ETag`. Se invalida cuando:
  - cambia la version de datos (`getDataVersion()` de `src/server/db.ts`, que sube con cada escritura que modifica filas; se excluyen `metric_cache`, `app_errors`, `ai_context_snapshots` y `ai_insights`);
  - cambia el dia calendario (varios indicadores dependen de la fecha);
  - pasan `STATE_CACHE_MAX_AGE_MS` (por defecto 120000 ms), como red de seguridad.
- **Calculo unico**: solicitudes simultaneas del mismo periodo comparten un solo calculo.
- **Precalculo**: al arrancar y 1,5 s despues de cada cambio de datos, el servidor recalcula en segundo plano los periodos consultados, de modo que la siguiente lectura ya esta lista.
- **Revalidacion**: `/api/state` responde `Cache-Control: private, no-cache` + `ETag`. El navegador siempre pregunta, y si no hubo cambios recibe `304` sin cuerpo. Nunca se muestran datos viejos.
- **`Server-Timing`**: cada respuesta de `/api/state` incluye `state;dur=<ms>;desc="cache|calculo"` y `build;dur=<ms>` (duracion del ultimo calculo). Se ve en la pestana Red de las herramientas del navegador.
- **SQLite** (`db.ts`): statements preparados reutilizables, `cache_size` 64 MB, `temp_store=MEMORY`, `mmap_size` 256 MB, `wal_autocheckpoint`, y `PRAGMA optimize` tras las migraciones.
- **Indices de cobertura** (migracion en `schema.ts`, se crean con `IF NOT EXISTS`): `idx_sales_year_advisor_value` e `idx_sales_period_payment_value`. Agregan ~2 MB a la base y aceleran las agregaciones anual por asesor y por medio de pago.
- **SSE** (`/api/events`): se excluye de la compresion (el buffer retenia eventos) y envia un latido `: ping` cada 25 s.
- **Estaticos**: los archivos de `assets/` (con hash en el nombre) se sirven `public, max-age=31536000, immutable`; `index.html`, `sw.js` y el manifest siguen en `no-store`. Las respuestas `/api/*` llevan `no-cache` por defecto.
- **Arranque de escritorio**: la ventana espera a `GET /api/ping` (no toca la base) cada 150 ms en lugar de `/api/health`. `/api/health` se mantiene para Docker.

## Cliente

- **Vistas bajo demanda**: `src/client/main.tsx` solo contiene el shell (`App`, exportacion PDF y arranque). Cada vista es un modulo (`Dashboard`, `Projection`, `Advisors`, `Branches`, `Trends`, `Marketing`, `Direction`, `Assistant`, `Configuration`, `Consulta`, `Evolution`) cargado con `React.lazy`. `common.tsx` reune tipos, formateadores y componentes compartidos. La libreria de graficos (`vendor-charts`) solo se descarga cuando una vista la usa.
- **Carga de estado** (`load` en `main.tsx`): los refrescos automaticos (cada 60 s, foco, visibilidad, eventos en tiempo real) se agrupan con una carga en curso, no muestran el indicador de carga y omiten el repintado si el `ETag` no cambio. Los eventos SSE se agrupan (400 ms). Las cargas explicitas (boton Actualizar, tras guardar) siempre consultan, y una respuesta vieja nunca reemplaza a una nueva.
- **Service worker**: ya no fuerza `no-store`; deja actuar a la cache HTTP para que los assets inmutables y el `ETag` funcionen.
- **Memoizacion**: `Kpi` y `Progress` usan `React.memo`; el buscador de Experiencia usa `useDeferredValue`.

## Diseno de los graficos de Tendencias

Las tarjetas de la primera fila de `growth-dashboard-grid` son columnas flex; el grafico va dentro de `.growth-chart` (`flex: 1`, minimo 190 px) y `.growth-chart-fill` (posicion absoluta) para que `ResponsiveContainer` use el alto restante de la tarjeta.

## Correccion asociada

La tabla de sedes de **Configuracion** calculaba ventas y registros unidos con asesores, por lo que cada venta se contaba tantas veces como asesores tiene la sede (p. ej. una sede con 5 asesores mostraba 5 veces sus ventas). Ahora usa subconsultas agregadas: las cifras son las reales y la consulta es ~5 veces mas rapida. No afecta comisiones, metas ni KPI del tablero (esos usan otras consultas).

## Ajustes por entorno

| Variable | Defecto | Uso |
|---|---|---|
| `STATE_CACHE_MAX_AGE_MS` | 120000 | Vida maxima del estado en cache (minimo 15000). |
| `EXPERIENCE_CACHE_TTL_MS` | 300000 | Cache de `/api/experience` (ya existente). |

## Pendiente (no incluido en 0.1.9)

- **Trabajos pesados en otro hilo** (importaciones Excel, PDF con pdfkit, IA): requiere mover el acceso a SQLite a un worker y empaquetar `better-sqlite3` para ese hilo. Es un cambio de arquitectura con riesgo; se recomienda hacerlo aparte y con pruebas de continuidad de datos.
- **Fusion de consultas de `buildAppState`**: hoy ejecuta ~55 consultas (~130 ms en frio). Fusionarlas exige verificar que las cifras queden identicas; con la cache activa el beneficio es menor.
- **Depuracion de CSS** (`styles.css`, 163 KB): requiere una herramienta de purga y revision visual completa de todas las pantallas.
- **Higiene del proyecto**: `data/` acumula copias `.db` antiguas y `desktop-build/`, `tmp/` y `outputs/` contienen pruebas; conviene archivarlas fuera de OneDrive (no afecta a la aplicacion instalada).
