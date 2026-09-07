# Crecimiento, tiempo real e IA en DashCom

## Estado actual

DashCom ya calcula KPI comerciales, metas, comisiones, score, calidad de datos y el modulo `Crecimiento`.

El modulo de crecimiento usa datos existentes:

- Ventas positivas por mes.
- `client_external_id` como proxy de miembro.
- Sede, asesor y plan.
- Tickets e ingresos por plan.

Esto permite retencion proxy, oportunidades por plan, simulaciones comerciales y recomendaciones operativas sin agregar nuevas tablas.

## Implementado

- SQLite nativo con `better-sqlite3`, WAL y transacciones directas sobre `data/hyl_gym.db`.
- Indices para cliente, plan, fuente, periodo, sede, asesor y fecha de venta.
- Cache de crecimiento en `metric_cache` con version de ventas por periodo.
- Worker EVO con checkpoint en `evo_sync_checkpoints`.
- Canal SSE `/api/events` para refrescar UI cuando entran ventas.
- Memoria IA con `ai_context_snapshots`, `ai_insights` y `ai_actions`.
- Marca DashCom aplicada al asistente conversacional y a las recomendaciones del PDF.

## Limites actuales

- El churn sigue siendo proxy de recompra porque faltan vencimientos reales y asistencia.
- El worker EVO depende de la granularidad disponible en la API; hoy sincroniza por rango mensual e idempotencia de `sale_key`.
- La IA ya tiene memoria consultable, pero aun no ejecuta acciones automaticamente sobre tareas/iniciativas sin confirmacion del usuario.
- Las reglas de negocio y algunos identificadores tecnicos siguen siendo de la instalacion HYL; para producto comercial deben moverse a configuracion o datos iniciales por cliente.

## Plan para hacerla mas rapida

1. Si se quiere multiusuario o nube, migrar a Postgres.
2. Expandir cache de agregados por periodo:
   - ventas por sede
   - ventas por asesor
   - ventas por plan
   - recompra por mes
   - avance de metas
3. Invalidar cache solo cuando entra una venta nueva o se importa un Excel.
4. Dividir el bundle frontend con imports dinamicos para bajar el JS inicial.

## Sincronizacion de ventas en tiempo real

EVO ahora corre separado del render del tablero:

1. `evo_sync_checkpoints`: estado de sincronizacion por mes y cursor.
2. Worker interno cada 60 segundos por defecto.
3. Insercion idempotente usando `sale_key`.
4. Evento interno cuando hay ventas nuevas.
5. SSE para que el navegador reciba:
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

Capas implementadas:

1. `ai_context_snapshots`: snapshot mensual resumido.
2. `ai_insights`: recomendaciones generadas, estado y resultado.
3. `ai_actions`: acciones sugeridas que se convierten en tarea o iniciativa.

Capa recomendada siguiente:

4. Busqueda semantica opcional para documentos, reportes y observaciones.

Primeras funciones inteligentes:

- Explicar por que una sede esta rezagada.
- Detectar asesores con baja recompra.
- Sugerir acciones por plan con mayor impacto simulado.
- Crear tareas desde recomendaciones.
- Comparar resultado real contra recomendacion anterior.

## Orden recomendado de implementacion

1. Convertir acciones IA seleccionadas en tareas con confirmacion.
2. Cachear estado completo por periodo y no solo crecimiento.
3. Churn real cuando existan vencimientos/asistencia.
4. Busqueda semantica sobre documentos y observaciones.
