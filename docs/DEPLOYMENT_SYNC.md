# Sincronizacion DashCom

Esta guia mantiene alineados codigo, Docker, GitHub y Cloudflare sin mover la base SQLite fuera de la instancia que opera la plataforma.

## Estado actual

- Producto visible: DashCom.
- Paquete npm: `dashcom`.
- Servicio Docker actual: `hyl-gym`.
- Imagen/contenedor actual: `hyl-gym-direccion`.
- Base SQLite actual: `hyl_gym.db`.
- Puerto por defecto: `4310`.

Los nombres `hyl-*` se mantienen por compatibilidad con volumenes, scripts y datos del cliente HYL. La migracion de nombres tecnicos debe tratarse como una fase propia, con backup previo y prueba de restauracion.

## Principio operativo

- GitHub guarda el codigo y dispara validaciones.
- Docker ejecuta la plataforma con la misma configuracion local o productiva.
- Los volumenes Docker conservan `data/` y `uploads/`.
- Cloudflare Tunnel publica la instancia Docker por HTTPS sin abrir puertos del router.
- Las ventas, bases `.db`, `.env`, cargas y reportes generados no se suben a GitHub.

## Cambios funcionales recientes

La pestana **Mercadeo** ya no usa el bloque mecanico de planes por sede. Ahora muestra:

- Tendencias de uso comercial.
- Nivel de adopcion por plan.
- Rentabilidad comercial por plan y por sede/plan.
- Planes de oportunidad con baja adopcion.
- Mapa visual del catalogo con tarjetas compactas.

Regla de datos:

- **Observado**: viene directo de ventas, planes, sedes, asesores, metas o iniciativas.
- **Derivado**: cruza datos existentes, por ejemplo brecha contra Meta 1 o recompra proxy.
- **Simulado**: usa supuestos y debe mostrarse como escenario, no como resultado.

## Flujo por cada modificacion

1. Actualizar codigo y documentacion relacionada.

2. Validar localmente:

```bash
npm test
npm run build
```

3. Validar Docker:

```bash
docker compose build
docker compose up -d
docker compose ps
```

4. Revisar salud:

```bash
curl http://localhost:4310/api/health
```

5. Guardar en GitHub:

```bash
git status
git add .
git commit -m "Descripcion corta del cambio"
git push
```

6. Actualizar la instancia publicada:

```bash
docker compose --profile cloudflare up -d --build
```

7. Verificar tunnel:

```bash
docker compose logs -f cloudflared
```

## GitHub Actions

El workflow `.github/workflows/ci.yml` ejecuta en push y pull request:

- `npm ci`
- `npm test`
- `npm run build`
- `docker build -t hyl-gym-direccion:ci .`

El tag CI conserva el nombre legado del Dockerfile/compose actual. Cuando se prepare la version comercial limpia, cambiar imagen, servicio, contenedor, volumenes y documentacion en el mismo paquete de migracion.

Si una validacion falla, no actualizar la instancia publicada hasta corregirla.

## Cloudflare Tunnel

Configuracion recomendada:

1. Crear un tunnel remoto en Cloudflare Zero Trust.
2. Publicar el hostname hacia:

```text
http://hyl-gym:4310
```

3. Copiar el token en `.env`:

```text
CLOUDFLARE_TUNNEL_TOKEN=...
```

4. Levantar con perfil Cloudflare:

```bash
docker compose --profile cloudflare up -d --build
```

El servicio `cloudflared` depende del healthcheck de `hyl-gym`, por lo que espera a que la app este saludable antes de iniciar el tunnel.

## Respaldo de datos

Antes de cambios grandes o importaciones masivas:

```bash
docker compose stop hyl-gym
docker cp hyl-gym-direccion:/app/data/hyl_gym.db ./data/hyl_gym.backup.db
docker compose start hyl-gym
```

No subir backups a GitHub.

Para DashCom, el backup es parte del proceso de continuidad, no un extra opcional: antes de cada cambio grande debe existir un `pre-update` y al cerrar debe quedar un `post-update` validado.

## Politica de backup antes/despues

Cada cambio operativo debe dejar dos respaldos:

1. **Original (`pre-update`)** antes de tocar codigo, base de datos, metas, comisiones o importadores.
2. **Actualizado (`post-update`)** despues de aplicar el cambio, validar `npm test`, `npm run build` y dejar Docker saludable.

Comandos:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-platform.ps1 -Mode pre-update
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-platform.ps1 -Mode post-update
```

Los respaldos quedan comprimidos en `backups/platform/` e incluyen la base local, la base del contenedor Docker cuando esta activo, `uploads`, codigo/documentacion no secreta y un manifiesto.

Cuando haya Google Drive conectado o sincronizado en el equipo, copiar el `.zip` final a la carpeta externa de backups de la plataforma. Google Drive es respaldo externo, no runtime de la aplicacion.

## Variables sensibles

Mantener solo en `.env` o secretos del servidor:

- `ADMIN_PASSWORD`
- `AUTH_SESSION_SECRET`
- `EVO_API_KEY`
- `GROQ_API_KEY`
- `CLOUDFLARE_TUNNEL_TOKEN`

`.env.example` documenta nombres de variables sin secretos reales.
