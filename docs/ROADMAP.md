# Epicas, roadmap y tareas DashCom

Este documento resume la evolucion funcional. Para el proceso de conversion comercial, instalador y version limpia, usar `docs/DASHCOM_ROADMAP.md` como guia principal.

## Epica 1: Fundacion comercial

- Base SQLite versionada por migraciones.
- Semilla desde Excel historico y comisiones 2026.
- Normalizacion de sedes, asesores y planes.
- Auditoria de importaciones.
- Separacion progresiva entre producto DashCom y datos/reglas del cliente HYL.

## Epica 2: Operacion diaria

- Tablero por sede y asesor.
- Calendario comercial del mes.
- Carga de Excel mensual.
- Sincronizacion EVO del mes actual.
- Lista de tareas con prioridades y responsables.

## Epica 3: Gobierno de comisiones

- Score de asesores.
- Score de sedes.
- Comisiones de asesores y director.
- Evaluacion mensual calidad/gestion.
- Informe gerencial en pantalla.
- Exportacion PDF gerencial con secciones seleccionables, graficos y Groq opcional.

## Epica 4: Mercadeo y crecimiento

- Planes y precios.
- Estrategias y campanas.
- Convenios y proyectos.
- Lectura de rendimiento por plan.

## Epica 5: Direccion e IA

- Direccion: comisiones, requerimientos, planes e ideas.
- Configuracion: EVO, Groq y mecanica de comisiones.
- Ideas y requerimientos asistidos por IA.
- Hoja de ruta operativa.

## Hoja de ruta sugerida

### Semana 1

- Validar importacion con 2 archivos reales adicionales.
- Validar sincronizacion EVO con credenciales reales, DNS, paginacion y rango mensual.
- Validar metas historicas enero-junio 2026 ya integradas desde `META 2026`.
- Revisar alias faltantes de asesores.

### Semana 2

- Revisar autenticacion local existente y preparar roles.
- Crear roles: Direccion, Mercadeo, Consulta.
- Agregar bitacora de cambios por usuario.
- Plantillas de PDF por perfil: junta, direccion y sede.

### Semana 3

- Forecast de cierre mensual.
- Alertas de ritmo comercial.
- Vistas comparativas ano a ano.
- Tablero de campanas activas.

### Semana 4

- Empaquetado local con instalador.
- Backup automatico de SQLite.
- Modo PWA para celular.
- Manual operativo final.

## Tareas de continuidad DashCom

- Renombrar identificadores tecnicos heredados solo despues de backup y prueba de restauracion.
- Parametrizar cliente, moneda, sedes, asesores, metas y comisiones.
- Crear base demo/limpia para nuevos clientes.
- Documentar formato aceptado de Excel por tipo de carga.
- Mantener HYL como cliente de referencia, no como nombre del producto.
