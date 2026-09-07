# Comisiones y score

En DashCom, esta mecanica esta disponible en `Configuracion > Mecanica de comisiones`.

La mecanica documentada corresponde a la instalacion actual con datos HYL Gym. Para una version comercial limpia, los porcentajes, bonos, metas por sede y reglas de reasignacion deben quedar parametrizados por cliente.

## Asesores

La plataforma separa dos esquemas:

- Enero-junio 2026: bonificacion historica del archivo `BONIFICACION 2026`, sin multiplicadores de valoracion.
- Julio 2026 en adelante: esquema de rendimiento por meta alcanzada, sin multiplicadores sobre la liquidacion.

### Enero-junio 2026

| Nivel | Condicion | Comision |
| --- | --- | --- |
| Meta 1 | 100% de Meta 1 asesor | 0.40% |
| Meta 2 | 100% de Meta 2 asesor | 0.80% |
| Meta 3 | 100% de Meta 3 asesor | 1.20% |
| Meta 4 | 100% de Meta 4 asesor | 2.00% + 500.000 |

### Julio 2026 en adelante

| Nivel | Condicion | Comision |
| --- | --- | --- |
| Activacion | 60% de Meta 1 asesor | 0.15% |
| Bronce | 75% de Meta 1 asesor | 0.25% |
| Plata | 90% de Meta 1 asesor | 0.35% |
| Meta 1 | 100% de Meta 1 asesor | 0.50% |
| Meta 2 | 110% de Meta 1 asesor | 0.80% |
| Meta 3 | 120% de Meta 1 asesor | 1.20% |
| Meta 4 | 130% de Meta 1 asesor | 2.00% + 500.000 |

Las metas desde julio separan la exigencia de sede y la exigencia de asesor:

- Julio-diciembre 2026 usa la Meta 1 oficial por sede cargada en la plataforma.
- Meta 1 de asesor = Meta 1 oficial de sede / conteo oficial de asesores por sede.
- Si un periodo no tiene meta oficial, la plataforma usa un respaldo motivacional con desempeno reciente.
- Julio 2026 respeta vigencias: las ventas hasta el 15/07 se mantienen en su sede original y las ventas desde el 16/07 usan la nueva asignacion operativa.
- Desde agosto 2026 en adelante queda fijo el nuevo esquema de asesores: Alejandra Cuello en Colors 162, Fernanda Amaya en Prado Veraniego, Melissa Montoya en Modelia y Lina Alejandra Torres Leal en Buenos Aires.
- Excepcion puntual: las ventas de Xiomara Ochoa del 16/07/2026 se cargan a Calle 109; no se reescriben sus ventas de otros dias por esta regla.
- Para no romper julio, la plataforma conserva el asesor original de la venta y calcula sede/metas/comisiones por sede efectiva de la venta. Si un asesor tiene ventas en dos sedes dentro del mes, aparece separado por asesor+sede en el calculo mensual.

Estas reglas de vigencia son datos de negocio HYL. No deben tratarse como reglas universales de DashCom.

```text
Meta 1 asesor = Meta 1 sede oficial / conteo oficial de asesores
Activacion = 60% de Meta 1 asesor
Bronce = 75% de Meta 1 asesor
Plata = 90% de Meta 1 asesor
Meta 2 = 110% de Meta 1 asesor
Meta 3 = 120% de Meta 1 asesor
Meta 4 = 130% de Meta 1 asesor
```

Formula:

```text
comision_base = ventas_totales * porcentaje_del_nivel_alcanzado + bono_fijo_del_nivel_final
comision_final_julio_en_adelante = comision_base
comision_final_enero_junio = comision_base
```

La comision variable se calcula sobre el monto total vendido con el porcentaje de la meta alcanzada. Por ejemplo, si el asesor queda en Meta 3, toda su venta del mes se liquida al 1,20%. El bono fijo solo se suma cuando el asesor alcanza el nivel que lo tiene.

Multiplicadores:

| Calificacion | Puntaje | Multiplicador |
| --- | ---: | ---: |
| Malo | 60 | 0.60 |
| Regular | 75 | 0.85 |
| Bueno | 85 | 1.00 |
| Excelente | 100 | 1.15 |

## Score asesores

El score es acumulativo por componentes ponderados del periodo filtrado:

```text
score = puntaje_meta1 * 40%
      + puntaje_meta4 * 15%
      + calidad * 15%
      + gestion * 15%
      + conversiones * 10%
      + control_descuentos * 5%
```

Estado: Alto desde 80, Medio desde 60, Bajo debajo de 60, Pendiente sin ventas.

## Director comercial

Bonos por sede:

- Meta 1: 100.000
- Meta 2: 200.000
- Meta 3: 500.000
- Meta 4: 700.000

## Score sedes

```text
score_sede = puntaje_meta1 * 45%
           + puntaje_meta4 * 20%
           + score_prom_asesores * 15%
           + conversiones * 10%
           + control_descuentos * 5%
           + participacion_asesores * 5%
```
