# Comisiones y score

En la plataforma, esta mecanica esta disponible en `Configuracion > Mecanica de comisiones`.

## Asesores

La plataforma separa dos esquemas:

- Enero-junio 2026: bonificacion historica del archivo `BONIFICACION 2026`, sin multiplicadores de valoracion.
- Julio 2026 en adelante: esquema de rendimiento con activacion/bronce/plata y multiplicadores de calidad/gestion.

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

- Meta 1 de sede conserva la proyeccion oficial de crecimiento.
- Meta 1 de asesor se calibra por sede con desempeno real reciente de asesores productivos.
- La meta del asesor exige crecimiento sobre el promedio productivo, pero se limita contra el mejor resultado reciente para que sea retadora y realizable.

```text
Meta 1 asesor = meta calibrada entre promedio productivo x 1,10 y mejor asesor reciente x 1,15
Activacion = 60% de Meta 1 asesor
Bronce = 75% de Meta 1 asesor
Plata = 90% de Meta 1 asesor
Meta 2 = 110% de Meta 1 asesor
Meta 3 = 120% de Meta 1 asesor
Meta 4 = 130% de Meta 1 asesor
```

Formula:

```text
comision_base = ventas * porcentaje + bono_fijo
comision_final_julio_en_adelante = comision_base * multiplicador_calidad * multiplicador_gestion
comision_final_enero_junio = comision_base
```

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
- Meta 4: sin bono adicional definido en el Excel.

## Score sedes

```text
score_sede = puntaje_meta1 * 45%
           + puntaje_meta4 * 20%
           + score_prom_asesores * 15%
           + conversiones * 10%
           + control_descuentos * 5%
           + participacion_asesores * 5%
```
