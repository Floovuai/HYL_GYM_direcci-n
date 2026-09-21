# Analisis competitivo de DashCom

Fecha: 2026-09-20. Version de DashCom evaluada: 0.1.11.

## Alcance y limites de este informe

- La informacion sale de busquedas web y de paginas publicas de los fabricantes (lista de fuentes al final). Son textos comerciales: describen lo que cada empresa **afirma**, no lo que se pudo probar.
- El buscador solo cubre resultados de EE. UU.; la cobertura de proveedores locales de Colombia es parcial. No se encontraron datos verificables de Tecnofit, Sysfit ni Actionsoft.
- No se obtuvieron precios de los proveedores de Latinoamerica. Los precios citados son de proveedores de EE. UU. y sirven solo como referencia de orden de magnitud.
- No se probo ninguna herramienta competidora. Antes de tomar decisiones de producto conviene pedir demos de ABC Evo, Zenoti y una herramienta de comisiones.

## 1. Que es DashCom y donde compite

DashCom no es un sistema de gestion de gimnasio: es una **capa comercial y analitica** sobre los datos del gimnasio (ventas por sede y asesor, metas escalonadas, comisiones, score, presupuesto diario estacional, evolucion de miembros, mercadeo y competidores), alimentada por EVO y por Excel, con IA (Groq) y paneles de consulta para asesores y lideres de sede.

Por eso no tiene un unico competidor: compite con cuatro categorias, cada una por una parte de su valor.

## 2. Competidores por categoria

### A. Suites de gestion de gimnasio con reportes (competencia parcial y, a la vez, proveedor de datos)

| Proveedor | Lo que declara | Relevancia para DashCom |
|---|---|---|
| **ABC Evo** | Mayor software de gestion de clubes de Latinoamerica (~5.000 negocios); CRM con comunicaciones automaticas, inteligencia de negocio, agentes de IA "ABC AI Agents", modulo de entrenamiento personal. **No se menciona liquidacion de comisiones de ventas** en su pagina. | Es la fuente de datos de DashCom (integracion EVO) y su mayor riesgo: si mejora su BI y su IA, cubre parte de lo que hoy hace DashCom. |
| **Zenoti** | IA para seguimiento de prospectos, renovaciones, cobros fallidos, prevencion de fuga por patrones de asistencia, recepcionista IA 24/7, comisiones que fluyen desde sesiones completadas. | Referencia en IA operativa y en comisiones automaticas para entrenadores. |
| **Mindbody** | Multi-sede, reservas, facturacion; desde ~139 USD/mes. Pipeline de ventas poco profundo. | Referente de mercado; menos enfocado en ventas. |
| **ClubReady** | Clubes grandes: pipeline de ventas integrado, facturacion, responsabilidad del personal de ventas. | El mas cercano en "gestion del equipo comercial" de un gimnasio. |
| **Glofox, Perfect Gym, Virtuagym, PushPress, TeamUp, Zen Planner** | Suites de reservas y membresias para estudios; reportes de asistencia, ingresos y movimiento de miembros. | Poco solapamiento con comisiones y metas. |
| **Locales (Fitco, Gymsoft, GymGestion, Programa2, Xcore, ProGym)** | Control de acceso (huella, QR, rostro), facturacion electronica, tablero con graficos, avisos por WhatsApp (Xcore). | Compiten en el gimnasio pequeno; ninguno declara metas escalonadas ni comisiones por porcentaje de meta. |

### B. CRM de ventas para gimnasios

- **GymSales**: seguimiento automatico a prospectos (llamadas, mensajes, correos), visibilidad del pipeline y responsabilidad del equipo de ventas. Se detiene en la conversion.
- **FitBudd** (~79 USD/mes): CRM de ventas mas gestion de clientes y app de marca propia.
- **Real Gym CRM**: CRM con seguimiento de comisiones segun sus propios resumenes (no se pudo abrir la pagina para confirmarlo).

Su foco es **captar y convertir prospectos**. DashCom mide y motiva al equipo sobre **ventas ya cerradas**; son complementarios.

### C. Software de compensacion y comisiones de ventas (no especifico de gimnasios)

| Proveedor | Que ofrece | Precio de referencia |
|---|---|---|
| **CaptivateIQ** | Planes de comision flexibles tipo hoja de calculo, automatizacion sin codigo, capa de IA | Personalizado, por usuario mas costo de implantacion |
| **Performio** | Reportes historicos, integracion con Salesforce, planes complejos | Desde ~50 USD por usuario al mes |
| **Xactly** | Comisiones, pronosticos y territorios en empresas grandes | Hasta 500.000 USD o mas al ano |
| **Salesforce Spiff** | Paneles integrados, sin conocimientos tecnicos | ~75 USD por usuario al ano |
| **QuotaPath / Everstage** | Comisiones desde ~25 USD por usuario al mes; Everstage agrega marcadores y concursos | Segun plan |

Hacen muy bien el calculo, las **tablas de posiciones y los concursos** (los concursos con marcador en vivo cambian la conducta del vendedor). Estan pensadas para equipos SaaS, no para sedes de gimnasio con metas mensuales y estacionalidad.

### D. Inteligencia y KPI para gimnasios

Groe, WellnessLiving Analytics y proveedores de tableros para fitness ofrecen asistencia, ingresos por tipo de plan, movimiento neto de miembros y fallas de pago. Son la referencia de "buen reporte" (segun los articulos consultados, lo util es explicar retencion, ingresos y fuga, no solo listar cifras).

## 3. Comparacion de capacidades (segun lo declarado)

| Capacidad | DashCom | ABC Evo | Zenoti | ClubReady | Herramientas de comisiones |
|---|---|---|---|---|---|
| Metas escalonadas por sede y asesor | Si | No declarado | No declarado | No verificado | Si |
| Comision por % de meta alcanzada | Si | No declarado | Si (por sesion) | No verificado | Si |
| Presupuesto diario estacional | Si | No declarado | No declarado | No declarado | No declarado |
| Evolucion de miembros / churn | Si (proxy y EVO) | Si | Si | No verificado | No |
| Prediccion de fuga con IA | Parcial | Declarado | Declarado | No declarado | No |
| Seguimiento de prospectos | No | Si | Si | Si | No |
| Marcadores y concursos | No | No declarado | No declarado | No declarado | Si |
| Panel movil para asesores | Si | No declarado | No verificado | No verificado | No verificado |
| Comparacion con competidores | Si | No declarado | No declarado | No declarado | No declarado |
| Informes gerenciales en PDF | Si | No verificado | No verificado | No verificado | No verificado |

"No declarado" significa que no aparece en las paginas consultadas; "No verificado" que no se reviso esa capacidad. Ninguna de las dos prueba que no exista. Solo las celdas de DashCom son verificadas (codigo propio).

## 4. Fortalezas de DashCom

1. **Especializacion**: une metas, comisiones, presupuesto estacional y ritmo por asesor, algo que las suites de gimnasio no destacan y las herramientas de comisiones no adaptan a sedes.
2. **Instalacion local y datos propios**: no depende de una nube de terceros (ver la salvedad de datos enviados a Groq).
3. **Cruce de mercadeo, competidores y ventas** en un solo lugar.
4. **Costo y velocidad de adaptacion**: cada regla de negocio del cliente se implementa sin esperar la hoja de ruta de un proveedor global.

## 5. Debilidades y riesgos

1. **Dependencia de EVO**: ABC Evo es fuente de datos y competidor a la vez. Su IA (agentes, prediccion de fuga, campanas de reactivacion) ya se anuncia.
2. **Sin captacion de prospectos**: los competidores de las categorias A y B automatizan el seguimiento; DashCom empieza despues de la venta.
3. **Sin motivacion visible**: faltan marcadores, rachas y concursos, que las herramientas de comisiones tratan como parte central.
4. **Fuga aun por proxy**: la propia documentacion lo reconoce; los competidores usan patrones de asistencia.
5. **Confianza del instalador**: sin firma de codigo, los antivirus (AVG en su caso) vuelven a alertar en cada version.
6. **Un solo cliente**: no hay multi-cliente, ni soporte, ni contrato de servicio que un comprador externo exigiria.

## 6. Oportunidades priorizadas

| Prioridad | Oportunidad | Por que |
|---|---|---|
| 1 | Simulador "que pasa si" de metas y comisiones | Ninguna suite de gimnasio lo destaca; reutiliza las formulas existentes. |
| 2 | Alertas y coach diario por asesor (movil o mensajeria) | Aumenta el uso diario y usa el ritmo estacional que solo DashCom calcula. |
| 3 | Marcadores, rachas y concursos entre sedes | Es lo que mas diferencia a las herramientas de comisiones y aqui no existe. |
| 4 | Fuga con asistencia real de EVO y lista de llamadas del dia | Iguala la propuesta de ABC y Zenoti con datos que ya se sincronizan. |
| 5 | Firma de codigo del instalador | Elimina una barrera de confianza inmediata. |
| 6 | Multi-gimnasio (solo si se decide comercializar) | Cambia el modelo de producto; decidir antes de invertir en mas funciones especificas de un cliente. |

## 7. Conclusion

DashCom ocupa un espacio que las fuentes consultadas no muestran cubierto por ninguna categoria por separado: **comisiones por meta con presupuesto estacional y seguimiento por sede para gimnasios**. Su ventaja es real pero estrecha: depende de que ABC Evo y las suites con IA no lleguen a la misma capa. La respuesta mas defendible es reforzar lo que solo DashCom hace bien (simulador, ritmo, coach) y cerrar las brechas que los competidores ya publicitan (fuga con asistencia, motivacion visible).

## Fuentes

- [ABC Evo](https://abcfitness.com/evo/)
- [ABC Fitness: software para gimnasios multi-sede](https://abcfitness.com/abc-articles/gym-management-software-multi-location/)
- [Zenoti: IA para gimnasios](https://www.zenoti.com/fitness-center-membership-software/ai-for-gyms-and-clubs)
- [Zenoti: software de gestion de gimnasios 2026](https://www.zenoti.com/thecheckin/gym-management-software)
- [Glofox: gestion de gimnasios en 2026](https://www.glofox.com/blog/gym-management/)
- [FitBudd: alternativas a GymSales](https://www.fitbudd.com/insights/gymsales-alternatives)
- [Fitco: como elegir software de gestion para gimnasios](https://www.fitcolatam.com/elegir-el-mejor-software-de-gestion-para-gimnasios/)
- [CaptivateIQ: mejor software de compensacion 2026](https://www.captivateiq.com/blog/best-sales-compensation-software)
- [Performio: mejor software de comisiones](https://www.performio.co/blog/best-sales-commission-software)
- [Everstage: gestion del rendimiento de ventas](https://www.everstage.com/sales-compensation/right-sales-performance-management-software-for-your-revenue-team)
- [Exercise.com: software para gimnasios en Brasil](https://www.exercise.com/grow/best-gym-management-software-in-brazil/)
- [Groe: KPI para gimnasios](https://www.groe.solutions/blog/best-gym-kpi-tracking-software)
