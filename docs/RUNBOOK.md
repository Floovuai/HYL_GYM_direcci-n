# Operacion local DashCom

Este runbook describe la instalacion actual de DashCom. La app ya se presenta como DashCom, pero la base, el contenedor y algunos scripts internos conservan nombres `hyl_*` por compatibilidad con datos HYL Gym existentes.

## Instalar

```bash
npm install
```

## Sembrar base

```bash
npm run db:reset
```

Esto crea `data/hyl_gym.db` con ventas junio 2026, metas historicas enero-junio, metas julio-diciembre 2026, planes, precios, campanas y tareas iniciales. El nombre `hyl_gym.db` es legado de la instalacion actual.

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
INICIAR_DASHCOM.bat
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

El servicio Docker se llama `hyl-gym` y el contenedor `hyl-gym-direccion` por compatibilidad operativa. No cambiar esos nombres sin plan de migracion de volumenes, backups y scripts.

Apagar:

```bash
docker compose down
```

La imagen ejecuta `npm run start:container`, sirve el cliente construido desde `dist/client` y mantiene persistencia con volumenes nombrados:

```text
hyl_data:/app/data
hyl_uploads:/app/uploads
```

El contenedor expone `/api/health` como healthcheck interno.

`docker compose config` es util para diagnostico local, pero expande el contenido de `.env`. No compartir esa salida cuando haya claves EVO o Groq configuradas.

Si Docker es la instancia principal y necesitas correr `npm run dev`, sincroniza antes la base del volumen Docker hacia `./data`:

```bash
npm run db:sync:from-docker
```

Si el comando avisa que `data/hyl_gym.db` esta en uso, cierra `npm run dev` u otro proceso local que este usando SQLite y vuelve a ejecutarlo.

## Cloudflare Tunnel

Para abrir la misma instancia desde cualquier dispositivo con HTTPS:

1. Crear un tunnel remoto en Cloudflare Zero Trust.
2. Publicar el hostname hacia el servicio interno:

```text
http://hyl-gym:4310
```

3. Guardar el token en `.env`:

```text
CLOUDFLARE_TUNNEL_TOKEN=...
```

4. Levantar Docker con el perfil Cloudflare:

```bash
docker compose --profile cloudflare up -d --build
```

5. Verificar:

```bash
docker compose ps
docker compose logs -f cloudflared
```

El servicio `cloudflared` es opcional y depende del healthcheck de `hyl-gym`.

## GitHub y actualizacion continua

Antes de cualquier cambio funcional, carga de datos masiva, ajuste de metas, comisiones, importadores o despliegue, crear un backup original:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-platform.ps1 -Mode pre-update
```

Antes de subir cambios:

```bash
npm test
npm run build
docker compose build
```

Despues de validar y dejar la plataforma funcionando, crear un backup con las actualizaciones aplicadas:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-platform.ps1 -Mode post-update
```

Despues:

```bash
git status
git add .
git commit -m "Descripcion corta del cambio"
git push
```

GitHub Actions valida tests, build y construccion Docker. Para actualizar la instancia publicada por Cloudflare, reconstruir el compose en el PC o servidor que conserva los volumenes:

```bash
docker compose --profile cloudflare up -d --build
```

Guia completa: `docs/DEPLOYMENT_SYNC.md`.

## Backups de la plataforma

La plataforma debe conservar dos respaldos por cada mantenimiento o cambio importante:

- **Backup original / pre-update**: estado exacto antes de modificar archivos, base de datos o configuracion operativa.
- **Backup actualizado / post-update**: estado final despues de aplicar cambios, correr pruebas y reconstruir Docker.

Comando para backup manual:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-platform.ps1 -Mode manual
```

El backup queda en:

```text
backups/platform/
```

Cada paquete incluye:

- `hyl_gym.local.db`, si existe `data/hyl_gym.db`.
- `hyl_gym.docker.db`, si el contenedor `hyl-gym-direccion` esta activo.
- `uploads-*.zip`, con archivos subidos.
- `platform-source-*.zip`, con codigo, documentacion, scripts y configuracion no secreta.
- `MANIFEST.txt`, con fecha, modo, estado Git y estado Docker.

No incluir `.env` en backups compartidos. Ese archivo contiene secretos de login, EVO, Groq o tunel. Si se necesita recuperar en otro equipo, guardar las claves en un gestor seguro o documentarlas fuera del repositorio.

Cuando Google Drive este conectado o exista Google Drive for Desktop sincronizado, copiar el `.zip` final a una carpeta externa, por ejemplo:

```text
Google Drive/HYL GESTION COMERCIAL/BACKUPS PLATAFORMA/
```

En una instalacion comercial nueva, usar una carpeta equivalente con el nombre del cliente o `Google Drive/DashCom/BACKUPS PLATAFORMA/`.

Regla minima de continuidad:

- Hacer backup `pre-update` antes de empezar.
- Hacer backup `post-update` al terminar.
- Mantener al menos una copia fuera del computador principal.
- Verificar periodicamente que el `.zip` se pueda abrir y que contiene una base `.db`.

## Actualizar ventas

- Boton de carga Excel en la barra superior.
- Formato esperado: igual a `VENTAS GENERALES.xlsx`.
- Al importar, la plataforma agrega solo ventas nuevas y omite duplicados exactos por `sale_key`.
- Los datos semilla no se reemplazan; quedan como base historica inicial.
- Cada importacion queda auditada en `import_batches`, incluyendo filas leidas, insertadas y duplicadas omitidas.
- La cabecera muestra cobertura del mes: ultimo dia con ventas positivas, dia pendiente e importacion mas reciente.
- Para el mes actual, la plataforma sincroniza EVO desde un worker interno configurable.
- La sincronizacion automatica no bloquea la carga del tablero y deja checkpoint por periodo.

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

## Proyecciones gerenciales

La plataforma calcula una proyeccion recomendada en backend y la reutiliza en:

- `Proyeccion del mes`
- `Informes gerenciales`
- PDF gerencial

En `Informes gerenciales` se ve al inicio como `Proyeccion gerencial de cierre`, con venta actual, rango probable y brecha proyectada. En el PDF se incluye si el usuario selecciona `Resumen ejecutivo`, `Informe mensual` o `Graficos gerenciales`.

El modelo muestra:

- proyeccion lineal por ritmo actual
- proyeccion historica ajustada
- rango conservador/optimista
- confianza de la proyeccion

Para julio 2026, por ejemplo, la lectura puede diferir de la proyeccion lineal si los primeros dias del mes historicamente representan una proporcion distinta del cierre mensual.

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
http://localhost:4310/api/evo/status
POST http://localhost:4310/api/evo/sync
```

Variables de tiempo real:

```text
EVO_SYNC_WORKER=1
EVO_SYNC_INTERVAL_MS=60000
```

El navegador escucha `/api/events` por SSE. Cuando el worker o una carga Excel insertan ventas nuevas, se emite `sales_updated` y la UI recarga el estado.
Ademas, `/api/state` responde con cabeceras `no-store` y la UI consulta con `cache: no-store`, timestamp de version, refresco cada minuto y recarga al volver a enfocar la ventana.

## Groq

Configuracion recomendada en `.env`:

```text
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
```

El asistente usa los KPI y rankings filtrados por ano/mes.
Tambien recibe el reporte de calidad de datos, duplicados y recomendaciones comerciales calculadas por la plataforma.
El contexto enviado se compacta para respetar limites de tokens: incluye KPI, calidad, crecimiento, top sedes/asesores/planes, tareas, iniciativas, importaciones y memoria previa.

La pantalla `Configuracion > Integraciones` muestra el estado de Groq sin devolver la clave cruda al navegador. Si se deja el campo `Clave API Groq` vacio al guardar integraciones, la clave existente no se borra.

Healthcheck:

```text
http://localhost:4310/api/ai/health
```

Memoria de IA:

```text
http://localhost:4310/api/ai/insights?year=2026&month=6
```

Cada consulta guarda:

- snapshot compacto en `ai_context_snapshots`
- respuesta en `ai_insights`
- acciones de seguimiento en `ai_actions`

## Mejora de velocidad, tiempo real e IA

La version actual ya usa SQLite nativo con `better-sqlite3`, WAL, indices reales, cache de crecimiento por periodo, worker EVO con checkpoint y memoria de IA. Para la siguiente etapa conviene:

- Migrar a Postgres si se requiere multiusuario, nube o concurrencia alta.
- Expandir cache a KPI por mes/sede/asesor y no solo crecimiento.
- Agregar cola persistente de reintentos EVO si la API empieza a entregar cursor incremental por venta.
- Convertir acciones IA aprobadas en tareas/iniciativas con auditoria.
- Agregar busqueda semantica para documentos, observaciones y resultados historicos.

## Mercadeo sin datos inventados

La pestana Mercadeo separa:

- Tendencias de uso comercial: facturacion y registros diarios.
- Adopcion por plan: sedes con venta sobre sedes activas.
- Rentabilidad comercial: ingreso mensualizado estimado por plan y por sede/plan.
- Planes de oportunidad: baja adopcion con venta o ticket relevante.

No reportar impacto real de campanas hasta que exista una relacion de datos `campana -> venta` o una metodologia de atribucion registrada. La pestana no muestra campanas como bloque operativo.
