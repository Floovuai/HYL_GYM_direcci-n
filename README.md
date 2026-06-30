# HYL Gym Dirección Comercial

Plataforma local para gestionar ventas, metas, scores, comisiones, mercadeo, informes gerenciales, dirección, configuración y tareas operativas de HYL Gym.

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

## Base de datos

La informacion se guarda en:

```text
data/hyl_gym.db
```

Cada escritura se hace en transaccion y se persiste al archivo SQLite.

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
http://localhost:4310/api/export/gerencial.pdf?year=2026&month=6
```

## IA Groq

La clave recomendada vive en `.env` y no se publica en GitHub:

```text
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
```

La interfaz muestra `Groq: configurado` sin exponer el token. El contexto enviado a Groq incluye KPI, sedes, asesores, planes, reporte de duplicados y recomendaciones del sistema.

La configuración se gestiona en `Configuración > Integraciones`. La explicación de comisiones vive en `Configuración > Mecánica de comisiones`.

Verificacion rapida:

```text
http://localhost:4310/api/ai/health
```

## Verificacion

```bash
npm test
npm run build
npm audit
```
