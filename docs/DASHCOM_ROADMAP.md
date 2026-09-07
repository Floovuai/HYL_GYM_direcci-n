# Roadmap de actualizacion DashCom

Actualizado: 2026-09-06.

## Estado actual de la transicion

Ya implementado en la instalacion actual:

- Marca visible `DashCom` en login, encabezado, titulo HTML, chat IA, PDF y logs.
- Paquete npm `dashcom`.
- Arranque local Windows con `INICIAR_DASHCOM.bat`.
- Backend Express, React/Vite, SQLite, importacion Excel, EVO, Groq, PDF, SSE, metric cache y backups operativos.
- Documentacion actualizada para distinguir producto DashCom de datos/reglas HYL.

Pendiente antes de vender o empaquetar:

- Migrar o encapsular nombres tecnicos heredados (`hyl_gym.db`, `hyl-gym-direccion`, volumenes, cookie).
- Separar reglas HYL de configuracion reusable por cliente.
- Crear base limpia/demo sin datos privados.
- Validar auditoria funcional completa con capturas actuales.
- Validar Excel con archivos reales recientes y casos limite.
- Preparar restauracion formal y ruta de instalacion estable.

## Objetivo

Preparar la plataforma para convertirse en DashCom: una aplicacion confiable, visualmente profesional y lista para venderse en version limpia, antes de trabajar en instalador, empaquetado o distribucion comercial.

Esta actualizacion se enfoca primero en la calidad de la app actual:

- Proteger la base de datos y archivos existentes.
- Validar que las cargas de Excel sean fiables.
- Mejorar experiencia visual y operativa.
- Separar datos reales de una version limpia o demo.
- Dejar el proyecto listo para una fase posterior de instalador y restauracion.

## Principio de trabajo

El instalador no debe ser la primera fase. Primero hay que asegurar que DashCom funcione bien como producto, porque un instalador solo empaqueta el estado actual de la plataforma.

Orden recomendado:

1. Seguridad y continuidad.
2. Auditoria funcional.
3. Fiabilidad de Excel.
4. Calidad de datos.
5. Mejoras visuales.
6. Reportes e integraciones.
7. Version comercial limpia.
8. Preparacion posterior para instalador.

## Fase 0: Seguridad antes de tocar

### Objetivo

Evitar perdida de datos antes de hacer cambios visuales, funcionales o comerciales.

### Tareas

- Confirmar que contenedor Docker esta usando la base esperada.
- Identificar volumenes Docker activos de datos y uploads.
- Crear backup actual desde Docker.
- Crear backup de uploads.
- Crear backup del codigo fuente y documentacion.
- Guardar una copia del backup fuera del computador principal.
- Verificar que el backup contiene la base real.
- Documentar pasos minimos para recuperar DashCom en otra PC.

### Entregables

- Backup actual completo.
- Registro de ubicacion de base y volumenes.
- Instrucciones de recuperacion iniciales.

### Criterio de cierre

Antes de modificar la app, debe existir al menos un backup recuperable de la instalacion actual.

## Fase 1: Auditoria funcional de la app

### Objetivo

Entender el estado real de la plataforma antes de redisenar o ampliar.

### Tareas

- Revisar flujo completo de login e inicio.
- Revisar navegacion principal y pestanas.
- Revisar tablero principal.
- Revisar filtros por ano, mes, sede y asesor.
- Revisar pantallas de reportes.
- Revisar pantalla de configuracion.
- Revisar integraciones EVO y Groq.
- Revisar errores del backend.
- Revisar errores de consola del navegador.
- Medir puntos lentos o pantallas pesadas.
- Priorizar problemas por impacto.

### Entregables

- Lista priorizada de hallazgos.
- Recomendaciones de ajuste por pantalla.
- Tareas separadas por funcionalidad, visual y datos.

### Criterio de cierre

Debe quedar claro que arreglos son bloqueantes, cuales son mejoras importantes y cuales pueden esperar.

## Fase 2: Fiabilidad de subida de Excel

### Objetivo

Asegurar que los botones de carga de archivos sean confiables para ventas, archivos EVO exportados y evolucion de miembros.

### Tareas

- Revisar boton de carga de ventas Excel.
- Revisar boton de carga de evolucion de miembros.
- Confirmar tipos de archivo permitidos.
- Validar estructura esperada de cada Excel.
- Detectar columnas faltantes antes de procesar.
- Mostrar errores claros cuando el archivo no corresponde.
- Mostrar estado de carga: esperando, subiendo, procesando, completado y error.
- Mostrar resumen posterior a la importacion:
  - Filas leidas.
  - Filas importadas.
  - Duplicados omitidos.
  - Filas ignoradas.
  - Motivos de rechazo.
- Probar carga de archivo correcto.
- Probar carga del mismo archivo dos veces.
- Probar Excel con columnas faltantes.
- Probar Excel con filas vacias.
- Probar Excel con valores cero o negativos.
- Probar Excel exportado desde EVO.
- Confirmar que la app no duplica ventas.
- Documentar formatos aceptados.

### Entregables

- Importadores revisados.
- Mensajes de carga mejorados.
- Pruebas con archivos reales y casos limite.
- Documentacion de formato aceptado.

### Criterio de cierre

El usuario debe poder subir un archivo y saber exactamente que paso con la importacion, sin revisar consola ni base de datos.

## Fase 3: Calidad de datos

### Objetivo

Hacer visible la salud de los datos antes de calcular comisiones, reportes y decisiones gerenciales.

### Tareas

- Revisar ventas sin asesor.
- Revisar ventas sin sede.
- Revisar ventas sin plan.
- Revisar ventas con valor cero o negativo.
- Revisar duplicados naturales.
- Revisar ventas asociadas a usuarios de soporte o integracion.
- Mejorar bloque de salud comercial de datos.
- Agregar alertas visuales cuando una metrica dependa de datos incompletos.
- Separar errores criticos de advertencias.
- Dar acciones sugeridas para corregir datos.

### Entregables

- Diagnostico visible de calidad de datos.
- Alertas entendibles para usuarios no tecnicos.
- Base para validar comisiones y reportes.

### Criterio de cierre

La plataforma debe avisar cuando los datos cargados no son suficientes o confiables para liquidar comisiones o interpretar reportes.

## Fase 4: Experiencia visual DashCom

### Objetivo

Convertir la app en una experiencia visualmente profesional, clara y vendible bajo la marca DashCom.

### Tareas

- Definir identidad base de DashCom:
  - Nombre visible.
  - Tono de interfaz.
  - Colores principales.
  - Logo o identificador temporal.
- Reemplazar referencias visuales principales de la marca anterior por DashCom cuando correspondan.
- Mantener HYL como datos del cliente actual, no como nombre del producto, si aplica.
- Mejorar tablero principal.
- Refinar tarjetas, tablas, filtros y modales.
- Mejorar jerarquia visual de KPIs.
- Mejorar estados vacios.
- Mejorar estados de error.
- Mejorar botones de acciones principales.
- Revisar responsividad en laptop, monitor grande, tablet y celular.
- Evitar que textos se monten o queden cortados.
- Revisar consistencia de iconos, espaciados y titulos.

### Entregables

- Interfaz con marca DashCom.
- Pantallas principales refinadas.
- QA visual con capturas.
- Lista de ajustes pendientes.

### Criterio de cierre

La app debe sentirse lista para mostrar a un cliente potencial sin explicar que es un prototipo.

## Fase 5: Reportes y PDF

### Objetivo

Dejar los reportes confiables, claros y alineados con la marca DashCom.

### Tareas

- Revisar informe gerencial en pantalla.
- Validar filtros de periodo.
- Confirmar que las cifras coincidan con el tablero.
- Revisar PDF gerencial.
- Mejorar nombres de archivos exportados.
- Cambiar marca de exportes a DashCom donde corresponda.
- Mantener referencias al cliente dentro del contenido del reporte.
- Revisar secciones opcionales del PDF.
- Validar PDF con datos reales y con datos demo.

### Entregables

- Reporte en pantalla validado.
- PDF validado.
- Nombres de exportacion consistentes con DashCom.

### Criterio de cierre

Los reportes deben poder usarse en una reunion sin correcciones manuales.

## Fase 6: Configuracion e integraciones

### Objetivo

Hacer que las integraciones sean faciles de configurar y diagnosticar.

### Tareas

- Revisar configuracion EVO.
- Revisar prueba de conexion EVO.
- Revisar sincronizacion manual EVO.
- Revisar worker automatico EVO.
- Mejorar mensajes de credenciales invalidas.
- Mejorar resumen de ultima sincronizacion.
- Revisar configuracion Groq.
- Ocultar valores secretos.
- Mantener claves existentes cuando se guarden campos secretos vacios.
- Mostrar estados claros:
  - Conectado.
  - No configurado.
  - Error de credenciales.
  - Ultima sincronizacion.
  - Ultimo error.

### Entregables

- Pantalla de configuracion mas clara.
- Estados de integracion visibles.
- Diagnostico de errores no tecnico.

### Criterio de cierre

Un usuario debe poder saber si EVO o Groq estan configurados correctamente sin pedir soporte tecnico.

## Fase 7: Version comercial limpia

### Objetivo

Preparar una version de DashCom lista para vender, sin datos privados ni rutas personales.

### Tareas

- Separar instalacion personal de version comercial.
- Crear base limpia.
- Crear datos demo opcionales.
- Quitar rutas personales del `.env.example`.
- Quitar claves privadas.
- Revisar textos especificos de HYL que deban volverse configurables.
- Mantener posibilidad de usar HYL como cliente actual en tu instalacion.
- Definir datos minimos de primera instalacion.
- Definir usuario admin inicial.
- Documentar proceso para generar version limpia.

### Entregables

- Modo limpio o base limpia.
- Datos demo opcionales.
- Configuracion comercial no secreta.
- Checklist para entregar a cliente.

### Criterio de cierre

Debe ser posible preparar DashCom para un cliente nuevo sin incluir tus datos, tus ventas, tus archivos ni tus claves.

## Fase 8: Pruebas generales

### Objetivo

Validar que la plataforma queda estable antes de pensar en instalador.

### Tareas

- Probar arranque Docker.
- Probar login.
- Probar tablero.
- Probar carga de ventas Excel.
- Probar carga repetida sin duplicados.
- Probar carga de evolucion de miembros.
- Probar reportes.
- Probar PDF.
- Probar configuracion EVO.
- Probar configuracion Groq.
- Probar responsive.
- Ejecutar pruebas automatizadas.
- Ejecutar build de produccion.
- Construir Docker.

### Entregables

- Checklist de QA completado.
- Capturas de pantallas clave.
- Resultado de pruebas y build.
- Lista de riesgos restantes.

### Criterio de cierre

La version debe quedar estable para congelarla como candidata a empaquetado.

## Fase 9: Preparacion posterior para empaquetar

Esta fase queda en espera hasta terminar las mejoras de app.

### Objetivo

Dejar listo el camino para instalador, restaurador y distribucion.

### Tareas futuras

- Separar carpeta de aplicacion y carpeta de datos.
- Definir ubicacion estable de datos:
  - `C:\ProgramData\DashCom\data`
  - `C:\ProgramData\DashCom\uploads`
  - `C:\ProgramData\DashCom\backups`
- Crear backup DashCom formal.
- Crear restaurador DashCom.
- Crear instalador Windows.
- Crear version portable.
- Evaluar Electron para app de escritorio.
- Evaluar Docker Hub o GitHub Container Registry para distribuir imagenes.
- Evaluar Cloudflare Tunnel para acceso remoto opcional.
- Documentar actualizaciones sin borrar datos.

### Entregables futuros

- `DashCom-Setup.exe`
- `DashCom-Backup-YYYYMMDD.zip`
- `DashCom-Restore.ps1`
- Manual de instalacion y recuperacion.

## Orden de trabajo inmediato desde este punto

Para comenzar ahora, el orden sugerido es:

1. Ejecutar backup `pre-update` antes de nuevos cambios funcionales.
2. Cerrar Fase 1 con auditoria funcional real de la app actual.
3. Cerrar Fase 2 probando importadores Excel con archivos correctos, repetidos y defectuosos.
4. Cerrar Fase 3 revisando alertas de calidad de datos antes de comisiones.
5. Continuar Fase 4 con QA visual DashCom en desktop, tablet y movil.
6. Cerrar Fase 5 con validacion de reportes y PDF.
7. Cerrar Fase 6 con diagnostico claro de EVO/Groq.
8. Ejecutar Fase 7: base limpia/demo y parametrizacion de cliente.
9. Ejecutar Fase 8 antes de congelar candidata a empaquetado.

## Notas sobre Docker y alojamiento

En la version local vendible, Docker corre en el PC del cliente. La cuenta de Docker puede servir para descargar imagenes y actualizar DashCom, pero no debe ser el lugar donde vivan los datos.

Los datos deben mantenerse separados de la imagen y del contenedor:

- Base de datos del cliente.
- Archivos cargados.
- Configuracion.
- Backups.

La cuenta de Docker no reemplaza el backup. Si el computador falla, la recuperacion depende de tener una copia externa de base, uploads y configuracion.

## Decision pendiente

Antes de la fase de empaquetado se debe decidir:

- Si DashCom se vendera primero como instalacion local.
- Si cada cliente usara Docker Desktop.
- Si la base comercial inicial sera vacia o demo.
- Como se haran actualizaciones de version.
- Donde se guardaran backups externos.
- Si mas adelante se construira una version cloud multi-cliente.
