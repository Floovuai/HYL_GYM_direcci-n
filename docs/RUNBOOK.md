# Operacion local

## Instalar

```bash
npm install
```

## Sembrar base

```bash
npm run db:reset
```

Esto crea `data/hyl_gym.db` con ventas junio 2026, metas historicas enero-junio, metas julio-diciembre 2026, planes, precios, campanas y tareas iniciales.

## Desarrollo

En una terminal:

```bash
npm run dev
```

Abre:

```text
http://localhost:4310
```

En Windows tambien puedes usar:

```bat
INICIAR_HYL_GYM.bat
```

## Celular en la misma red

1. Mantener `npm run dev` corriendo.
2. Buscar la IP local del PC con `ipconfig`.
3. Abrir en el celular `http://IP_DEL_PC:4310`.

## Produccion local

```bash
npm run build
npm start
```

## Docker

Construir y levantar:

```bash
docker compose up -d --build
```

Abrir:

```text
http://localhost:4310
```

Si el puerto del host ya esta ocupado:

```bash
APP_PORT=4314 docker compose up -d --build
```

Ver estado:

```bash
docker compose ps
docker compose logs -f hyl-gym
```

Apagar:

```bash
docker compose down
```

La imagen ejecuta `npm run start:container`, sirve el cliente construido desde `dist/client` y mantiene persistencia con:

```text
./data:/app/data
./uploads:/app/uploads
```

El contenedor expone `/api/health` como healthcheck interno.

`docker compose config` es util para diagnostico local, pero expande el contenido de `.env`. No compartir esa salida cuando haya claves EVO o Groq configuradas.

## Actualizar ventas

- Boton de carga Excel en la barra superior.
- Formato esperado: igual a `VENTAS GENERALES.xlsx`.
- Al importar, la plataforma agrega solo ventas nuevas y omite duplicados exactos por `sale_key`.
- Los datos semilla no se reemplazan; quedan como base historica inicial.
- Cada importacion queda auditada en `import_batches`, incluyendo filas leidas, insertadas y duplicadas omitidas.
- La cabecera muestra cobertura del mes: ultimo dia con ventas positivas, dia pendiente e importacion mas reciente.
- Para el mes actual, la plataforma intenta sincronizar EVO automaticamente cada 5 minutos si EVO esta configurado.

## Exportar informe gerencial PDF

Usar el boton `PDF` en la barra superior. El selector permite incluir o excluir:

- Resumen ejecutivo.
- Graficos gerenciales.
- Informe diario.
- Informe mensual.
- Informe anual.
- Sedes.
- Asesores.
- Planes.
- Scores.
- Calidad de datos.
- Acciones sugeridas.
- Sugerencias guiadas por Groq.

La opcion de Groq es independiente y solo se incluye cuando se marca. El PDF se genera en el backend y se descarga en formato horizontal.

Los CSV antiguos fueron retirados. Cualquier ruta `/api/export/:kind.csv` responde `410`; el informe oficial es el PDF gerencial.

## API EVO

En `Configuracion > Integraciones`:

- `URL EVO`: base de EVO. Si no trae path, el backend usa `/api/v2/sales`.
- `DNS EVO`: tenant/DNS usado para autenticacion.
- `Clave API EVO`: token usado junto al DNS.

Variables equivalentes:

```text
EVO_BASE_URL=https://evo-integracao-api.w12app.com.br
EVO_DNS=...
EVO_API_KEY=...
```

La autorizacion enviada a EVO es `Basic base64(EVO_DNS:EVO_API_KEY)`. La sincronizacion pagina con `take=100`, `skip`, `dateSaleStart` y `dateSaleEnd`, acepta listas directas o propiedades como `data`, `items`, `sales`, `vendas`, `records`, `results`, `result` o `value`, y solo inserta ventas positivas nuevas.

Endpoints utiles:

```text
http://localhost:4310/api/evo/health
POST http://localhost:4310/api/evo/sync
```

## Groq

Configuracion recomendada en `.env`:

```text
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
```

El asistente usa los KPI y rankings filtrados por ano/mes.
Tambien recibe el reporte de calidad de datos, duplicados y recomendaciones comerciales calculadas por la plataforma.

La pantalla `Configuracion > Integraciones` muestra el estado de Groq sin devolver la clave cruda al navegador. Si se deja el campo `Clave API Groq` vacio al guardar integraciones, la clave existente no se borra.

Healthcheck:

```text
http://localhost:4310/api/ai/health
```

## Mejora de velocidad, tiempo real e IA

La version actual usa SQLite con `sql.js`, que carga la base en memoria y exporta el archivo completo al guardar. Para datos actuales funciona, pero si crece el historico o se sincroniza EVO en tiempo real conviene:

- Cambiar a SQLite nativo (`better-sqlite3`) o Postgres para consultas e indices reales.
- Crear tablas materializadas o cache de KPI por mes/sede/asesor.
- Agregar indices por `client_external_id`, `plan_id`, `sold_at`, `source_type` y `source_key`.
- Separar sincronizacion EVO en un worker con cola, checkpoint por fecha/id y reintentos.
- Emitir actualizaciones al navegador con Server-Sent Events o WebSocket cuando entren ventas nuevas.
- Mantener un registro de eventos comerciales para que la IA consulte contexto historico, calidad de datos, iniciativas, tareas y resultados sin recalcular todo.
