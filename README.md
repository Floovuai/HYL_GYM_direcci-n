# DashCom

DashCom es una plataforma local de direccion comercial para gestionar ventas, metas, scores, comisiones, mercadeo, informes gerenciales, integraciones, configuracion y tareas operativas.

La instalacion actual opera con datos de HYL Gym como cliente base. Por continuidad tecnica algunos nombres internos siguen usando `hyl_gym` o `hyl-gym-direccion`; esos identificadores son legados y no deben confundirse con la marca del producto.

## Estado para continuar DashCom

Fecha de actualizacion documental: 2026-09-06.

- Marca visible de la app: `DashCom` en login, encabezado, titulo HTML, chat IA, PDF y logs de backend.
- Paquete npm: `dashcom`.
- Arranque Windows actual: `INICIAR_DASHCOM.bat`.
- Base SQLite actual: `data/hyl_gym.db` por compatibilidad con la instalacion HYL.
- Contenedor Docker actual: `hyl-gym-direccion` por compatibilidad operativa.
- Puerto por defecto: `4310`.
- Siguiente proceso recomendado: completar auditoria funcional, fiabilidad de Excel, calidad de datos y version comercial limpia segun `docs/DASHCOM_ROADMAP.md`.

## Iniciar

Opcion recomendada en Windows:

```bat
INICIAR_DASHCOM.bat
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

El **Tablero** muestra una franja de salud comercial de datos con ventas positivas sin asesor, valor pendiente de asignacion, ultima carga y filas EVO ignoradas. Esto permite corregir comisiones y score sin tocar la estructura historica de `sales`.

## Evolucion de miembros

Usa `Sedes > Cargar evolucion` para importar el Excel mensual de activos, renovaciones, cancelaciones y salidas por sede. La carga:

- Actualiza por `ano + mes + sede`.
- No modifica ventas, metas ni comisiones.
- Alimenta clientes activos, churn directo, salida bruta y evolucion neta.
- Queda auditada en `import_batches` con fuente `member_evolution_upload`.

Si no se ha cargado evolucion de miembros, la plataforma mantiene ventas y comisiones operativas, pero churn, retencion real y experiencia por activos quedan marcados como `sin evolucion`.

## Mercadeo

La pestana **Mercadeo** separa tres niveles de informacion para evitar datos inventados:

- **Tendencias de uso comercial**: grafica diaria de facturacion y registros.
- **Nivel de adopcion por plan**: porcentaje de sedes activas donde cada plan tuvo ventas.
- **Rentabilidad comercial**: ingreso mensualizado estimado por plan y por combinacion sede/plan, usando ventas reales y precio mensualizado disponible.
- **Planes de oportunidad**: planes con ticket alto o buena venta, pero baja adopcion entre sedes.
- **Mapa visual del catalogo**: tarjetas compactas de venta, precio, adopcion y traccion por plan.

El antiguo bloque de planes por sede fue reemplazado por un tablero mayoritariamente grafico. La rentabilidad mostrada no es margen financiero; para eso se requieren costos reales por producto y sede.

## Proyeccion gerencial

La proyeccion del mes se calcula en backend y se reutiliza en la pestana **Proyeccion del mes**, informes gerenciales y PDF. En **Informes gerenciales** aparece como franja ejecutiva al inicio del informe y como detalle dentro del pulso mensual. Incluye:

- proyeccion lineal por ritmo actual
- proyeccion historica ajustada
- rango probable conservador/optimista
- nivel de confianza

Esto evita que el informe gerencial dependa de una unica regla lineal. Al exportar PDF, la proyeccion tambien se incluye cuando se selecciona `Resumen ejecutivo`, `Informe mensual` o `Graficos gerenciales`.

## Base de datos

La informacion se guarda en:

```text
data/hyl_gym.db
```

El nombre del archivo conserva el legado HYL para no romper la instalacion existente. La base usa SQLite nativo con `better-sqlite3`, WAL y transacciones directas.

En Docker, `data/` y `uploads/` usan volumenes Docker nombrados:

```text
hyl_data:/app/data
hyl_uploads:/app/uploads
```

Eso conserva la base y los archivos cargados aunque se reconstruya la imagen, y evita errores SQLite `SHMOPEN` comunes cuando la base vive en OneDrive o en bind mounts de Windows.

Si estas usando Docker como instancia principal y luego quieres abrir la plataforma con `npm run dev`, sincroniza primero la base local:

```bash
npm run db:sync:from-docker
```

La UI consulta `/api/state` sin cache, escucha eventos en tiempo real y se refresca cada minuto o al volver a enfocar la ventana, para que la cobertura de ventas refleje el ultimo import.

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

### Cloudflare Tunnel con Docker

1. Crea un tunnel remoto en Cloudflare Zero Trust y publica el hostname apuntando al servicio interno:

```text
http://hyl-gym:4310
```

2. Copia el token del tunnel en `.env`:

```text
CLOUDFLARE_TUNNEL_TOKEN=...
```

3. Levanta la app y el tunnel:

```bash
docker compose --profile cloudflare up -d --build
```

4. Revisa estado:

```bash
docker compose ps
docker compose logs -f cloudflared
```

Cloudflare recomienda tunnels administrados remotamente cuando se trabaja con Docker. El servicio `cloudflared` queda en un perfil opcional para que el entorno local pueda seguir funcionando sin publicar la app.

## Sincronizar cambios

Flujo recomendado para mantener plataforma, Docker, GitHub y Cloudflare alineados:

```bash
npm test
npm run build
docker compose build
git status
git add .
git commit -m "Describe el cambio"
git push
docker compose --profile cloudflare up -d --build
```

GitHub Actions valida en cada push o pull request: tests, build del frontend/backend y construccion de la imagen Docker. La instancia publicada por Cloudflare se actualiza reconstruyendo el compose en el PC o servidor que mantiene la base SQLite.

Mas detalle operativo: `docs/DEPLOYMENT_SYNC.md`.

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

Cuando EVO no inserta ventas nuevas, el checkpoint conserva cuantas filas fueron reconocidas, cuantas fueron ignoradas y por que, por ejemplo `non_positive_value`, `missing_date` o `removed_advisor`. Esa lectura aparece tambien en el tablero para diferenciar un mes sin novedades de una respuesta con filas descartadas.

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
