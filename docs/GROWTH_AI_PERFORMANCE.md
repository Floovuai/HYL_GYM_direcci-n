# Crecimiento, tiempo real e IA

## Estado actual

La plataforma ya calcula KPI comerciales, metas, comisiones, score, calidad de datos y el modulo `Crecimiento`.

El modulo de crecimiento usa datos existentes:

- Ventas positivas por mes.
- `client_external_id` como proxy de miembro.
- Sede, asesor y plan.
- Tickets e ingresos por plan.

Esto permite retencion proxy, oportunidades por plan, simulaciones comerciales y recomendaciones operativas sin agregar nuevas tablas.

## Limites actuales

- `sql.js` carga SQLite en memoria y exporta el archivo al persistir. Es portable, pero no es ideal para sincronizacion continua.
- La sincronizacion EVO ocurre bajo demanda y con ventana minima de 5 minutos.
- El churn es proxy de recompra, no churn real de membresia.
- La IA recibe un resumen curado, no una memoria completa consultable.

## Plan para hacerla mas rapida

1. Migrar persistencia a `better-sqlite3` si se mantiene local.
2. Si se quiere multiusuario o nube, migrar a Postgres.
3. Agregar indices:
   - `sales(client_external_id, year, month)`
   - `sales(plan_id, year, month)`
   - `sales(source_type, source_key)`
   - `sales(sold_at)`
4. Crear cache de agregados por periodo:
   - ventas por sede
   - ventas por asesor
   - ventas por plan
   - recompra por mes
   - avance de metas
5. Invalidar cache solo cuando entra una venta nueva o se importa un Excel.

## Sincronizacion de ventas en tiempo real

EVO deberia correr como proceso independiente al render del tablero:

1. `sync_jobs`: estado de sincronizacion por fuente, mes y cursor.
2. Worker interno cada 30-60 segundos.
3. Checkpoint por `sold_at` y/o id externo.
4. Insercion idempotente usando `sale_key`.
5. Evento interno cuando hay ventas nuevas.
6. SSE o WebSocket para que el navegador reciba:
   - ventas nuevas
   - ultima sincronizacion
   - errores EVO
   - cambio en KPI principales

Flujo propuesto:

```text
EVO -> worker sync -> sales -> metric cache -> SSE/WebSocket -> navegador
```

## Integracion inteligente de IA

La IA deberia funcionar como analista contextual, no solo como chat.

Contexto disponible:

- KPI mensuales.
- Sedes y asesores.
- Planes y precios.
- Calidad de datos.
- Crecimiento inteligente.
- Iniciativas y tareas.
- Metas y comisiones.
- Importaciones y cobertura de datos.

Capas recomendadas:

1. `ai_context_snapshots`: snapshot mensual resumido.
2. `ai_insights`: recomendaciones generadas, estado y resultado.
3. `ai_actions`: acciones sugeridas que se convierten en tarea o iniciativa.
4. Busqueda semantica opcional para documentos, reportes y observaciones.

Primeras funciones inteligentes:

- Explicar por que una sede esta rezagada.
- Detectar asesores con baja recompra.
- Sugerir acciones por plan con mayor impacto simulado.
- Crear tareas desde recomendaciones.
- Comparar resultado real contra recomendacion anterior.

## Orden recomendado de implementacion

1. Indices y cache de metricas.
2. Worker EVO con checkpoint.
3. SSE para actualizaciones de tablero.
4. Registro de insights y acciones de IA.
5. Churn real cuando existan vencimientos/asistencia.
