# Changelog

Solo se listan las versiones con instalador Desktop. Detalle de entrega en [docs/DESKTOP_RELEASE.md](docs/DESKTOP_RELEASE.md).

## 0.1.11 - 2026-09-20
- Asesores: el cartel **Bonificacion 2026 por porcentaje de meta alcanzada** pasa al hueco libre de la segunda fila de KPIs y los paneles **Distribucion de scores** y **Ritmo de venta de asesores** suben en la columna derecha.

## 0.1.10 - 2026-09-20
- Tendencias: los graficos **Habito por dia de semana**, **Habito por tramo del mes** y **Mix de planes del periodo** ocupan todo el ancho y el alto libre de su tarjeta (antes tenian 190 px fijos y dejaban un hueco inferior).

## 0.1.9 - 2026-09-20
- **Velocidad**: el estado de la plataforma se calcula una vez por cambio de datos y se sirve desde memoria con ETag; los refrescos repetidos responden en milisegundos (antes ~440 ms y 311 KB cada vez).
- **Carga inicial**: las vistas se descargan al abrirlas (JS inicial de 172 KB a 31 KB) y los archivos con hash se guardan en cache del navegador.
- Refrescos automaticos sin parpadeo y agrupados; los eventos en tiempo real generan una sola recarga.
- Tiempo real: el canal SSE ya no se comprime y envia latido para no cortarse.
- Base de datos: cache de paginas, statements reutilizables, dos indices de cobertura y calculo un ~40% mas rapido en frio.
- Correccion: la tabla de sedes de Configuracion multiplicaba ventas y registros por el numero de asesores; ahora muestra las cifras reales.
- Arranque de escritorio con sonda ligera (`/api/ping`). Detalle en [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

## 0.1.8 - 2026-09-20
- Nueva pestana **Evolucion**: clientes activos, entradas y salidas por sede, con historico enero-agosto 2026 precargado y carga mensual de Excel EVO (tabla `evolution_monthly`).
- Respaldo automatico de la base SQLite antes de aplicar migraciones.

## 0.1.0 - 0.1.7
- Empaquetado Electron/NSIS de DashCom, identidad visual, conservacion de datos en `%LOCALAPPDATA%\DashCom` y mejoras sucesivas de la plataforma.
