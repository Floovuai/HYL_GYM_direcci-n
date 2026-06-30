# Operacion local

## Instalar

```bash
npm install
```

## Sembrar base

```bash
npm run db:reset
```

Esto crea `data/hyl_gym.db` con ventas junio 2026, metas julio-diciembre 2026, planes, precios, campanas y tareas iniciales.

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

## Actualizar ventas

- Boton de carga Excel en la barra superior.
- Formato esperado: igual a `VENTAS GENERALES.xlsx`.
- Al importar, la plataforma agrega solo ventas nuevas y omite duplicados exactos por `sale_key`.
- Los datos semilla no se reemplazan; quedan como base historica inicial.
- Cada importacion queda auditada en `import_batches`, incluyendo filas leidas, insertadas y duplicadas omitidas.

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

La opcion de Groq es independiente y solo se incluye cuando se marca. El PDF se genera en el backend y se descarga como archivo A4.

## API EVO

En Direccion > Integraciones:

- `URL EVO`: endpoint que devuelva JSON.
- `Clave API EVO`: token bearer opcional.

El sincronizador acepta una lista directa o propiedades `data` / `sales`.

## Groq

Configuracion recomendada en `.env`:

```text
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
```

El asistente usa los KPI y rankings filtrados por ano/mes.
Tambien recibe el reporte de calidad de datos, duplicados y recomendaciones comerciales calculadas por la plataforma.

La pantalla Direccion > Integraciones muestra el estado de Groq sin devolver la clave cruda al navegador. Si se deja el campo `Clave API Groq` vacio al guardar integraciones, la clave existente no se borra.

Healthcheck:

```text
http://localhost:4310/api/ai/health
```
