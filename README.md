# HYL Gym Direccion Comercial

Plataforma local para gestionar ventas, metas, scores, comisiones, mercadeo, informes gerenciales, direccion, configuracion y tareas operativas de HYL Gym.

## Iniciar

Opcion recomendada en Windows:

```bat
INICIAR_HYL_GYM.bat
```

Opcion manual:

```bash
npm install
npm run seed
npm run dev
```

Opcion Docker:

```bash
docker compose up -d --build
```

Antes de exponer la plataforma, configura credenciales en `.env`:

```text
ADMIN_USERNAME=admin
ADMIN_PASSWORD=usa-una-contrasena-larga
AUTH_SESSION_SECRET=usa-un-secreto-aleatorio-largo
```

Si el puerto `4310` ya esta ocupado en el PC:

```bash
APP_PORT=4314 docker compose up -d --build
```

Abrir:

```text
http://localhost:4310
```

Desde celular en la misma red:

```text
http://IP_DEL_PC:4310
```

## Actualizar ventas

Usa el boton **Excel** de la barra superior. El importador:

- Agrega solo ventas nuevas.
- Omite duplicados exactos mediante `sale_key`.
- Conserva datos semilla y datos historicos.
- Registra cada carga en `import_batches`.

La lectura de libros semilla usa hojas por nombre, por lo que integra correctamente `META 2026`, `PRECIOS`, `ESTRATEGIAS`, `PLANES PREVENTAS` y `BONIFICACION 2026`.

Si EVO esta configurado, un worker interno sincroniza automaticamente el mes actual sin bloquear el tablero. Tambien puede ejecutarse desde `Configuracion > Integraciones`.

## Base de datos

La informacion se guarda en:

```text
data/hyl_gym.db
```

La base usa SQLite nativo con `better-sqlite3`, WAL y transacciones directas.

En Docker, `data/` y `uploads/` usan volumenes Docker nombrados:

```text
hyl_data:/app/data
hyl_uploads:/app/uploads
```

Eso conserva la base y los archivos cargados aunque se reconstruya la imagen, y evita errores SQLite `SHMOPEN` comunes cuando la base vive en OneDrive o en bind mounts de Windows.

Para pasar una base local existente al volumen Docker:

```bash
docker compose up -d --build
docker cp data/hyl_gym.db hyl-gym-direccion:/app/data/hyl_gym.db
docker compose restart
```

No publiques `data/*.db`, `.env`, `uploads/` ni reportes generados en GitHub.

## Acceso publico seguro

GitHub puede ser publico para el codigo, pero la plataforma no debe ejecutarse desde GitHub Pages porque necesita backend, SQLite, sesiones y APIs.

Opciones recomendadas:

- **Cloudflare Tunnel** desde el PC o servidor: entrega un link HTTPS sin abrir puertos del router. Es la opcion mas simple para entrar desde celular, tablet y otros PCs.
- **VPS con Docker Compose + dominio + HTTPS**: mejor si quieres disponibilidad permanente.
- **Render/Railway/Fly.io**: viable si agregas volumen persistente para SQLite o migras a una base gestionada.

La app incluye login con cookie `httpOnly`, expiracion de sesion y limite basico de intentos. Para exponerla publicamente usa siempre HTTPS y una contraseña larga.

## Exportar PDF

Usa el boton **PDF** de la barra superior. Puedes seleccionar:

- Resumen ejecutivo.
- Graficos gerenciales.
- Informe diario, mensual y anual.
- Sedes, asesores y planes.
- Scores, calidad de datos y acciones sugeridas.
- Sugerencias guiadas por Groq, opcionales.

Endpoint directo:

```text
http://localhost:4310/api/export/gerencial.pdf?year=2026&month=7
```

Los exportes CSV anteriores ya no son oficiales; `/api/export/:kind.csv` responde `410`.

## EVO

Configuracion recomendada:

```text
EVO_BASE_URL=https://evo-integracao-api.w12app.com.br
EVO_DNS=...
EVO_API_KEY=...
```

La UI permite guardar URL, DNS y token. El backend consulta `/api/v2/sales` por rango mensual, pagina con `take=100`/`skip` y autentica con Basic usando `DNS:token`.

Verificacion rapida:

```text
http://localhost:4310/api/evo/health
```

## IA Groq

La clave recomendada vive en `.env` y no se publica en GitHub:

```text
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
```

La interfaz muestra `Groq: configurado` sin exponer el token. El contexto enviado a Groq incluye KPI, sedes, asesores, planes, reporte de duplicados y recomendaciones del sistema.
La plataforma guarda memoria de IA: snapshot de contexto, insight generado y acciones sugeridas para seguimiento.

La configuracion se gestiona en `Configuracion > Integraciones`. La explicacion de comisiones vive en `Configuracion > Mecanica de comisiones`.

Verificacion rapida:

```text
http://localhost:4310/api/ai/health
http://localhost:4310/api/ai/insights?year=2026&month=6
```

## Verificacion

```bash
npm test
npm run build
npm audit
```

Verificacion Docker:

```bash
APP_PORT=4314 docker compose up -d --build
curl http://localhost:4314/api/health
docker compose down
```

Nota: `docker compose config` puede imprimir variables de `.env`; no compartas esa salida si tienes claves EVO o Groq configuradas.
