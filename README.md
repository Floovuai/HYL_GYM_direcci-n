# HYL Gym Direccion Comercial

Plataforma local para gestionar ventas, metas, scores, comisiones, marketing, informes de junta, direccion y tareas operativas de HYL Gym.

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

## Base de datos

La informacion se guarda en:

```text
data/hyl_gym.db
```

Cada escritura se hace en transaccion y se persiste al archivo SQLite.

## IA Groq

En Direccion > Integraciones configura:

- `GROQ API key`
- `Modelo GROQ`

El contexto enviado a Groq incluye KPI, sedes, asesores, planes, reporte de duplicados y recomendaciones del sistema.

## Verificacion

```bash
npm test
npm run build
npm audit
```
