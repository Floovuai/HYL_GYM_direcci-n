# Modulo Competencia

Pestana **Competencia** (desde la version 0.1.12): mapa de cada sede con sus competidores cercanos, tabla de precios y promociones, seguimiento semanal automatico e importacion de informes interpretados con Groq. No modifica ventas, metas ni comisiones.

## Que hace

1. **Ubica cada sede** (coordenadas, direccion, enlace de Google Maps y radio de vigilancia propio).
2. **Encuentra gimnasios cercanos** dentro del radio de cada sede (OpenStreetMap) y los deja *por verificar*.
3. **Muestra un mapa** por sede o de todas, con marcadores por tipo y estado.
4. **Tabla de precios** debajo del mapa: plan, precio mensual, matricula, promocion, fecha, fuente y confianza, junto a tu propia oferta.
5. **Sigue los cambios**: cada semana revisa las paginas de planes registradas y registra cambios de precio, promocion, planes nuevos o retirados.
6. **Recibe informes**: el boton *Subir informe* interpreta un archivo o texto con Groq, actualiza los competidores que ya existen y crea los nuevos.

## Fuentes de datos (gratuitas y sin clave)

| Necesidad | Fuente | Limite |
|---|---|---|
| Mapa | Leaflet + mosaicos de OpenStreetMap | Uso ligero; requiere internet. Atribucion visible en el mapa. |
| Ubicar sedes | Coordenadas del enlace de Google Maps (sin API de Google) o direccion con Nominatim | Nominatim: 1 solicitud por segundo (la app lo respeta). |
| Buscar gimnasios | Overpass API (OpenStreetMap), etiquetas de gimnasio/centro fitness/CrossFit/yoga/pilates | Cobertura desigual: en Villavicencio no hay ningun gimnasio registrado en 2,5 km. |
| Precios | Paginas publicas de cada competidor + Groq | Solo lo que el sitio publica; Instagram/Facebook no se leen. |
| Interpretacion | Groq (clave ya configurada en la plataforma) | Sujeto a los limites de tu plan de Groq. |

## Como ubicar una sede

En la pestana, elige la sede (chip) y en el panel derecho:

- **Enlace de Google Maps**: pega el enlace (corto `maps.app.goo.gl` o largo). El servidor lo sigue y lee las coordenadas del lugar; solo se admiten enlaces de Google Maps.
- **Direccion**: se busca con Nominatim si no hay enlace.
- **Marcar en el mapa**: clic sobre el punto exacto.
- **Radio**: entre 300 m y 5 km por sede (1 a 1,5 km en Bogota densa; 2 a 3 km en zonas con pocos gimnasios).

Las sedes cerradas (p. ej. Calle 109) o sin ubicacion fisica (Online) no aparecen en el mapa.

## Flujo de trabajo recomendado

1. **Buscar competidores** (por sede o en todas). Los hallazgos quedan *por verificar*; los que caen a menos de 60 m de una de tus sedes se avisan como posible ficha antigua.
2. Revisar la lista **Por verificar**: *Confirmar* los que compiten, *Descartar* el resto.
3. Completar en cada competidor su **pagina de planes y precios**: desde ese momento se revisa cada semana.
4. **Subir informes** cuando el equipo tenga datos de campo (precios, promociones, redes).

## Estados y prioridad de la informacion

- Competidor: `por_verificar`, `confirmado`, `cerrado`, `descartado` (los descartados y cerrados salen del seguimiento).
- Origen: `osm` (automatico), `semilla`, `manual`, `informe`.
- Precio: fuente (`semilla`, `web`, `informe`, `manual`) y confianza (`alta`, `media`, `baja`). Un precio de marca o de prensa puede no coincidir con la sede.
- Nada automatico borra datos: una lectura nueva reemplaza el precio vigente y conserva el historial; los cambios quedan en *Cambios recientes*.
- Los precios de la semilla son una linea base: la primera lectura real de la pagina los reemplaza sin generar alertas de cambio.

## Semilla incluida

`src/server/data/competitionSeed.json` (se aplica al iniciar, sin pisar ediciones del usuario):

- Las 6 sedes con coordenadas tomadas de los enlaces de Google Maps publicados en hylgym.com/sedes-web y radios iniciales editables (Buenos Aires 1,2 km; Villavicencio 2,5 km; resto 1,5 km).
- Calle 109 marcada como cerrada y Online como sin ubicacion.
- Perfiles de marca con fuente y fecha: **Smart Fit** (sitio oficial, redes y planes), **Bodytech** y **Spinning Center** (tarifas de prensa de enero de 2026, confianza baja) y **Fitness24Seven** (ubicaciones publicas de su sitio).
- Las redes que no se pudieron verificar quedan vacias: se completan con informes o a mano. No se inventa ningun dato.

## Informes

Boton **Subir informe**: archivos `.xlsx` (hojas 1 a 3), `.csv`, `.tsv`, `.txt`, `.md`, `.json` o texto pegado. PDF y Word aun no se leen: copia el texto y pegalo. Se procesan hasta ~42.000 caracteres.

- Groq extrae competidores, direccion, redes, telefono, segmento y planes con precio, periodo, matricula y promocion.
- Si el competidor **ya existe** (mismo nombre, o el de la sede indicada cuando la cadena tiene varias), se actualizan sus datos y se agregan los precios; cada cambio queda registrado. Si no existe, se crea *por verificar* y se ubica de forma aproximada por su direccion.
- El texto del informe se trata como dato: las instrucciones que contenga no se ejecutan.
- La IA puede equivocarse: por eso todo queda con fuente, fecha y estado, y lo nuevo requiere confirmacion.

## Revision semanal de precios

- Solo trabaja mientras DashCom esta abierto: se revisa 90 segundos despues de iniciar y cada 6 horas si pasaron 7 dias desde la ultima revision correcta. Para que corra sin depender del equipo, usa el despliegue Docker siempre encendido.
- Requiere la clave de Groq. Puede desactivarse con `COMPETITION_WEEKLY=0`.
- Limites reales: si el precio se carga con JavaScript, esta en Instagram/WhatsApp o dice "cotiza", la pagina queda como *sin precio publico legible* y se ingresa a mano o por informe.
- Solo se leen paginas publicas (`http`/`https`, nunca direcciones locales o de red privada).

## Tablas

`branches` (agrega `address`, `maps_url`, `latitude`, `longitude`, `radius_m`, `location_status`), `competitors` (agrega ubicacion, distancia, redes, `pricing_url`, `status`, `source`, `osm_id`, revision), `competitor_price_obs` (precios observados con historial), `competitor_changes`, `competition_runs` y `competitor_brands` (perfiles de marca de la semilla). Las tablas y columnas se crean con `IF NOT EXISTS` en la migracion; el respaldo previo del instalador protege los datos.

## API

Todas requieren sesion como el resto de `/api`:

- `GET /api/competition`: estado completo de la pantalla.
- `POST /api/competition/resolve-maps`: coordenadas de un enlace de Google Maps.
- `PUT /api/competition/branches/:id`: ubicacion y radio de una sede.
- `POST /api/competition/discover`: busca competidores (`branchId` opcional).
- `POST /api/competition/competitors`, `PATCH /api/competition/competitors/:id`: alta y edicion.
- `POST /api/competition/competitors/:id/prices`: precio manual.
- `POST /api/competition/check-prices`: revision de precios (`competitorId` opcional).
- `POST /api/competition/report`: informe (multipart `file` o campo `text`).
- Evento SSE `competition_updated` para refrescar la pantalla.

## Privacidad

Con la clave de Groq configurada, el texto de los informes y de las paginas de competidores se envia a Groq para interpretarlo. No se envian datos de clientes ni de ventas. Nominatim y Overpass reciben coordenadas o direcciones de sedes y competidores.

## Pruebas

`tests/competition.test.ts` cubre lectura de enlaces de Maps, distancias, clasificacion, coincidencia de nombres y cadenas, conversion de precios, deteccion de cambios, lectura de paginas, extraccion de JSON de la IA y bloqueo de destinos no publicos.
