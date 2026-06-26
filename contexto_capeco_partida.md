# 🏗️ Contexto CAPECO — Estructura de una Partida (APU)

> Basado en:  
> - *"Costos y Presupuestos de Edificación"* — CAPECO, 8va Edición, Ing. Jesús Ramos Salazar  
> - *"Análisis de Precios Unitarios CAPECO"* — Compendio de partidas con APU completos  
> - Código fuente OpenConstructionERP v8.2.1  

---

## 1. ¿Qué es una Partida?

**Definición CAPECO** (Capítulo 1, pg. 7):

> *"PARTIDA.- Se denomina así a cada uno de los rubros o partes en que se divide convencionalmente una obra para fines de medición, evaluación y pago."*

Las partidas se organizan jerárquicamente:

```
12.00              Pisos y Pavimentos          ← Partida de 1er orden
12.02                Loseta                    ← Partida de 2do orden
12.02.02               Veneciana               ← Partida de 3er orden
12.02.02.01              De color claro 20×20  ← Partida de 4to orden
12.02.02.02              De color oscuro 20×20 ← Partida de 4to orden
```

---

## 2. Estructura del Análisis de Precio Unitario (APU)

### 2.1 Formato estándar CAPECO

Cada partida se descompone en un formato tabular con **3 secciones**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  ANÁLISIS DE COSTO UNITARIO                             │
│                                                                         │
│  Obra: _________________          Hoja N°: _____                        │
│  Propietario: ___________         Hecho por: _____                      │
│  Ubicación: _____________         Revisado por: ___                     │
│  Fecha: _________________                                               │
│                                                                         │
│  PARTIDA N°: [código]                                                   │
│  Descripción: [nombre de la partida]                                    │
│  Unidad: [m2, m3, ml, kg, pza...]                                      │
│  Especificaciones: [detalles técnicos]                                  │
│                                                                         │
│  Cuadrilla: [composición del equipo de trabajo]                         │
│  Rendimiento: [unidades/día]                                            │
│                                                                         │
├──────────┬────────┬──────────┬────────┬─────────┬────────┬─────────────┤
│ DESCRIP- │ UNIDAD │ CUADRILLA│ CANTI- │ PRECIO  │ PARCIAL│ I.U.        │
│ CIÓN     │        │ (crew)   │ DAD    │ UNIT.   │        │ (índice)    │
├──────────┼────────┼──────────┼────────┼─────────┼────────┼─────────────┤
│                  MATERIALES                                             │
│ Madera   │ p2     │    —     │ 3.70   │  4.30   │ 15.91  │    43       │
│ Clavos   │ kg     │    —     │ 0.18   │  5.20   │  0.94  │    02       │
│ Alambre  │ kg     │    —     │ 0.20   │  4.80   │  0.96  │    02       │
├──────────┴────────┴──────────┴────────┴─────────┼────────┼─────────────┤
│                     Costo de Material           │ 17.81  │             │
├──────────┬────────┬──────────┬────────┬─────────┼────────┼─────────────┤
│               MANO DE OBRA                                              │
│ Capataz  │ hh     │   0.10   │ 0.10   │ 12.50   │  1.25  │    47       │
│ Operario │ hh     │   1.00   │ 1.00   │ 10.04   │ 10.04  │    47       │
│ Oficial  │ hh     │   1.00   │ 1.40   │  9.08   │ 12.71  │    47       │
│ Peón     │ hh     │   2.00   │ 0.80   │  8.17   │  6.54  │    47       │
├──────────┴────────┴──────────┴────────┴─────────┼────────┼─────────────┤
│                 Costo de Mano de Obra           │ 30.54  │             │
├──────────┬────────┬──────────┬────────┬─────────┼────────┼─────────────┤
│             EQUIPO, HERRAMIENTAS                                        │
│ Herram.  │ %MO    │    —     │ 0.03   │ 30.54   │  0.92  │    37       │
│ Mezclad. │ hm     │   1.00   │ 0.32   │ 15.51   │  4.96  │    48       │
├──────────┴────────┴──────────┴────────┴─────────┼────────┼─────────────┤
│              Costo de Equipo, Herram.           │  5.88  │             │
├─────────────────────────────────────────────────┼────────┼─────────────┤
│                 TOTAL                           │ 54.23  │             │
└─────────────────────────────────────────────────┴────────┴─────────────┘
```

> Ejemplo real del PDF CAPECO — Partida: *Encofrado y desencofrado de caja de ascensor*  
> Unidad: m² | Cuadrilla: 0.1 cap + 1 op + 1 of + 2 pe | Rendimiento: 10 m²/día

---

## 3. Detalle de cada Sección del APU

### 3.1 MATERIALES

| Columna | Significado | Origen en OCE |
|---------|-------------|---------------|
| **Descripción** | Nombre del material | `CatalogResource.name` |
| **Unidad** | Unidad de medición | `CatalogResource.unit` |
| **Cuadrilla** | No aplica (—) | — |
| **Cantidad** | Cantidad de material por unidad de partida | Se calcula: `aporte_unitario × (1 + desperdicio/100)` |
| **Precio Unitario** | Precio del recurso | `CatalogResource.base_price` |
| **Parcial** | `Cantidad × Precio Unitario` | Calculado |
| **I.U.** | Índice Unificado para reajustes | `metadata.iucode` (propuesto) |

**APORTE UNITARIO**: Es la cantidad neta de material necesaria para 1 unidad de partida, **antes** de agregar desperdicio.

**Fórmula de cantidad final**:
```
Cantidad = Aporte Unitario × (1 + %Desperdicio/100)
```

**Tabla de desperdicios CAPECO** (pg. 71 del libro):

| Material | % Desperdicio |
|----------|:------------:|
| Mezcla para concreto | 5% |
| Mortero | 5% |
| Ladrillo para muros | 5% |
| Ladrillo para techos | 5% |
| Loseta para pisos | 5% |
| Mayólica | 5% |
| Clavos | 15% |
| Madera | 10% |
| Acero de refuerzo Ø 3/8" | 3% |
| Acero de refuerzo Ø 1/2" | 5% |
| Acero de refuerzo Ø 5/8" | 7% |
| Acero de refuerzo Ø 3/4" | 8% |
| Acero de refuerzo Ø 1" | 10% |

### 3.2 MANO DE OBRA

Categorías laborales CAPECO (pg. 72-75 del libro):

| Categoría | Código CAPECO | Jornal 2003 (S/) | Jornal 2024 ref (S/) |
|-----------|:------------:|:----------------:|:--------------------:|
| **Capataz** | 470101 | 47.00 | ~85-110 |
| **Operario** | 470201 | 47.00 | ~75-95 |
| **Oficial** | 470301 | 47.00 | ~60-80 |
| **Peón** | 470401 | 47.00 | ~50-65 |
| **Topógrafo** | — | 47.00 | ~90-120 |
| **Operador equipo liviano** | — | — | ~65-85 |
| **Operador equipo pesado** | — | — | ~85-110 |

**Fórmula para calcular HH (horas-hombre):**

```
                          8 horas/día × cantidad en cuadrilla
Cantidad (HH) = ──────────────────────────────────────────────────
                              Rendimiento (unid/día)
```

**Ejemplo**: Excavación de zanjas
- Cuadrilla: 0.1 capataz + 1 peón
- Rendimiento: 4.0 m³/día
- Capataz HH = (8 × 0.1) / 4.0 = **0.20 HH/m³**
- Peón HH = (8 × 1.0) / 4.0 = **2.00 HH/m³**

**Beneficios Sociales** (pg. 72-74):

| Concepto | % del jornal |
|----------|:-----------:|
| **Porcentajes fijos** | |
| CTS (Compensación por Tiempo de Servicios) | 15% |
| Vacaciones | 10% |
| Gratificación (Fiestas Patrias + Navidad) | 22.22% |
| Jornales por feriados | 3.33% |
| Seguro de Salud (ESSALUD) | 9% |
| SCTR (Seguro Complementario Trabajo Riesgo) | 1.30% |
| **Subtotal aproximado** | **~60-75%** |

**Cálculo del costo HH con beneficios:**
```
Costo_HH = Jornal_Diario / 8 × (1 + Beneficios_%/100)
```

### 3.3 EQUIPO, HERRAMIENTAS

| Elemento | Unidad | Fórmula |
|----------|--------|---------|
| **Herramientas manuales** | %MO | `3% × Costo Mano de Obra` |
| **Equipo mecánico** | HM (hora-máquina) | `(8 × cant_en_cuadrilla) / Rendimiento` |
| **Costo horario equipo** | S//HM | `depreciación + combustible + lubricantes + mantenimiento + operador` |

**Algunos equipos CAPECO con costos horarios de referencia:**

| Equipo | HM (S/) |
|--------|:------:|
| Mezcladora concreto tambor 18HP 11P3 | 15.51 |
| Mezcladora concreto trompo 8HP 9P3 | 4.96 |
| Camión volquete 4×2 140-210 HP 6M3 | 88.72 |
| Compresora neumática 93HP 335-375 PCM | 73.27 |
| Martillo neumático 29 Kg | 10.58 |
| Vibrador de concreto 4HP 2.40" | 5.93 |
| Teodolito | 30.00 |
| Wincha | 37.00 (índice) |
| Andamio | 37.00 (índice) |

---

## 4. Cálculo Completo del Precio Unitario

### 4.1 Fórmula general

```
PRECIO UNITARIO = Σ(Materiales) + Σ(Mano de Obra) + Σ(Equipo y Herramientas)
```

### 4.2 Estructura de desglose CAPECO

```
┌──────────────────────────────────────────────────────────────────────┐
│                    PRECIO UNITARIO (S/ × unidad)                     │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │   MATERIALES      │  │  MANO DE OBRA    │  │     EQUIPO       │   │
│  │                   │  │                  │  │                  │   │
│  │ aporte unitario   │  │ jornal diario    │  │ costo horario    │   │
│  │ × (1 + desperdicio)│ │ ÷ 8 × (1 + benef)│  │ × HM requeridas  │   │
│  │ × precio recurso  │  │ × HH requeridas  │  │                  │   │
│  │                   │  │                  │  │ + herramientas   │   │
│  │ = Σ cant × p.unit │  │ = Σ hh × p.hh   │  │   (3% M.O.)      │   │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘   │
│           │                     │                      │             │
│           ▼                     ▼                      ▼             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              COSTO DIRECTO (CD)  =  M + MO + E               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                +                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Gastos Generales (10-15% CD)                                 │   │
│  │  Utilidad (5-10% CD)                                          │   │
│  │  IGV (18% sobre CD + GG + Utilidad)                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                =                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              PRECIO DE VENTA                                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

> **Nota**: En el libro CAPECO, el APU llega solo hasta el **Costo Directo**.  
> Los Gastos Generales, Utilidad e IGV se agregan al nivel del **Presupuesto**, no por partida.

---

## 5. Ejemplos Completos de Partidas CAPECO

### 5.1 Partida simple: Excavación de zanjas

```
PARTIDA N° 003: Excavación de zanjas para cimientos hasta 1.00 m
Unidad: m³
Especificaciones: Terreno normal seco, con pico y lampa
Cuadrilla: 0.1 capataz + 1 peón
Rendimiento: 4.0 m³/día

┌──────────────────┬──────┬──────────┬────────┬───────┬────────┐
│ Descripción      │ Unid │ Cuadrilla│ Cant.  │ P.Unit│ Parcial│
├──────────────────┼──────┼──────────┼────────┼───────┼────────┤
│ MATERIALES       │      │          │        │       │        │
│   (ninguno)      │      │          │        │       │  0.00  │
├──────────────────┼──────┼──────────┼────────┼───────┼────────┤
│ MANO DE OBRA     │      │          │        │       │        │
│   Capataz        │ hh   │  0.10    │  0.20  │ 12.50 │  2.50  │
│   Peón           │ hh   │  1.00    │  2.00  │  9.20  │ 18.40  │
├──────────────────┼──────┼──────────┼────────┼───────┼────────┤
│                  │      │ Subtotal MO       │       │ 20.90  │
├──────────────────┼──────┼──────────┼────────┼───────┼────────┤
│ EQUIPO, HERRAM.  │      │          │        │       │        │
│   Herramientas   │ %MO  │   —      │  0.03  │ 20.90 │  0.63  │
├──────────────────┼──────┼──────────┼────────┼───────┼────────┤
│ TOTAL            │      │          │        │       │ 21.53  │
└──────────────────┴──────┴──────────┴────────┴───────┴────────┘
```

> **Cálculo**: Capataz HH = (8 × 0.1) / 4.0 = 0.20 | Peón HH = (8 × 1.0) / 4.0 = 2.00

### 5.2 Partida compuesta: Cimientos corridos

```
PARTIDA: Cimientos corridos mezcla 1:10 cemento-hormigón 30% piedra
Unidad: m³
Cuadrilla: 0.1 cap + 2 op + 1 of + 1 op.eq.liv + 8 pe
Rendimiento: 25 m³/día

┌──────────────────────┬──────┬──────────┬────────┬───────┬────────┐
│ Descripción          │ Unid │ Cuadrilla│ Cant.  │ P.Unit│ Parcial│
├──────────────────────┼──────┼──────────┼────────┼───────┼────────┤
│ MATERIALES           │      │          │        │       │        │
│ Piedra grande 8"     │ m³   │   —      │ 0.5000 │ 29.36 │ 14.68  │
│ Agua                 │ m³   │   —      │ 0.1800 │  9.00 │  1.62  │
│ Cemento Portland I   │ bol  │   —      │ 3.0500 │ 15.43 │ 47.06  │
│ Hormigón             │ m³   │   —      │ 0.8700 │ 18.49 │ 16.09  │
├──────────────────────┼──────┼──────────┼────────┼───────┼────────┤
│                      │ Subtotal Materiales │       │ 79.45  │
├──────────────────────┼──────┼──────────┼────────┼───────┼────────┤
│ MANO DE OBRA         │      │          │        │       │        │
│ Capataz              │ hh   │  0.10    │ 0.0320 │ 10.28 │  0.33  │
│ Operario             │ hh   │  2.00    │ 0.6400 │ 10.04 │  6.43  │
│ Oficial              │ hh   │  1.00    │ 0.3200 │  9.08 │  2.91  │
│ Operador eq. liviano │ hh   │  1.00    │ 0.3200 │  8.57 │  2.74  │
│ Peón                 │ hh   │  8.00    │ 2.5600 │  8.17 │ 20.92  │
├──────────────────────┼──────┼──────────┼────────┼───────┼────────┤
│                      │ Subtotal MO         │       │ 33.33  │
├──────────────────────┼──────┼──────────┼────────┼───────┼────────┤
│ EQUIPO, HERRAM.      │      │          │        │       │        │
│ Mezcladora 18HP 11P3 │ hm   │  1.00    │ 0.3200 │ 15.51 │  4.96  │
│ Herramientas manual. │ %MO  │   —      │ 0.0300 │ 33.33 │  1.00  │
├──────────────────────┼──────┼──────────┼────────┼───────┼────────┤
│ TOTAL                │      │          │        │       │118.74  │
└──────────────────────┴──────┴──────────┴────────┴───────┴────────┘
```

> Precios de referencia: CAPECO 2003-2004. En la práctica deben actualizarse con los índices unificados.

### 5.3 Partida con encofrado: Encofrado de escaleras

```
PARTIDA N° 030: Encofrado y desencofrado de escaleras
Unidad: m²
Especificaciones: Madera Tornillo en bruto
Cuadrilla: Encofrado: 0.10 cap + 1 op + 1 of | Habilitación: 0.10 cap + 1 op + 1 of
           Desencofrado: 1 of + 2 pe
Rendimiento: Habilitación: 28 m²/día | Encofrado: 6 m²/día | Desencofrado: 18 m²/día

┌──────────────────┬──────┬──────────┬────────┬───────┬────────┐
│ Descripción      │ Unid │ Cuadrilla│ Cant.  │ P.Unit│ Parcial│
├──────────────────┼──────┼──────────┼────────┼───────┼────────┤
│ MATERIALES       │      │          │        │       │        │
│ Madera Tornillo  │ p²   │   —      │ 6.71   │ 4.30  │ 28.85  │
│ Clavos de 3"     │ kg   │   —      │ 0.22   │ 5.20  │  1.14  │
│ Alambre negro #16│ kg   │   —      │ 0.10   │ 4.80  │  0.48  │
├──────────────────┼──────┼──────────┼────────┼───────┼────────┤
│                  │ Subtotal Materiales │       │ 30.47  │
├──────────────────┼──────┼──────────┼────────┼───────┼────────┤
│ MANO DE OBRA     │      │          │        │       │        │
│ Capataz          │ hh   │  0.10    │ 0.17   │ 12.50 │  2.13  │
│ Operario         │ hh   │  1.00    │ 1.69   │ 10.04 │ 16.97  │
│ Oficial          │ hh   │  1.00    │ 1.94   │  9.08 │ 17.62  │
│ Peón             │ hh   │  2.00    │ 0.89   │  8.17 │  7.27  │
├──────────────────┼──────┼──────────┼────────┼───────┼────────┤
│                  │ Subtotal MO         │       │ 43.99  │
├──────────────────┼──────┼──────────┼────────┼───────┼────────┤
│ EQUIPO, HERRAM.  │      │          │        │       │        │
│ Herramientas     │ %MO  │   —      │ 0.03   │ 43.99 │  1.32  │
├──────────────────┼──────┼──────────┼────────┼───────┼────────┤
│ TOTAL            │      │          │        │       │ 75.78  │
└──────────────────┴──────┴──────────┴────────┴───────┴────────┘
```

> El encofrado tiene 3 sub-fases (habilitación, encofrado, desencofrado) que suman horas-hombre.

---

## 6. Cálculo de Cantidades — Fórmulas Clave

### 6.1 Horas-Hombre (HH)

```
                N° de trabajadores en cuadrilla × 8 horas
HH/unidad = ──────────────────────────────────────────────────
                       Rendimiento (unidades/día)
```

### 6.2 Horas-Máquina (HM)

```
              N° de máquinas en cuadrilla × 8 horas
HM/unidad = ──────────────────────────────────────────────────
                    Rendimiento (unidades/día)
```

### 6.3 Materiales

```
Cantidad = Aporte unitario × (1 + %Desperdicio/100)
```

- **Aporte unitario**: es la cantidad neta, obtenida de tablas de diseño de mezclas, fichas técnicas, o reglamentos.
- **Desperdicio**: se aplica al aporte unitario para obtener la cantidad a presupuestar.

### 6.4 Herramientas

```
Costo herramientas = 3% × Costo total de Mano de Obra
```

> Este 3% es el estándar CAPECO. Para partidas muy intensivas en herramientas manuales se puede usar 5%.

---

## 7. Índices Unificados (I.U.)

Cada insumo tiene un código de **Índice Unificado** que permite reajustar precios automáticamente según la inflación del INEI.

| Código I.U. | Concepto | Ejemplos |
|:-----------:|----------|----------|
| **02** | Acero | Clavos, alambre, acero de refuerzo |
| **03** | Cemento | Cemento Portland |
| **05** | Agregados | Arena, piedra, hormigón |
| **21** | Madera | Madera tornillo, encofrados |
| **30** | Tuberías y accesorios | PVC, bronce, válvulas |
| **37** | Herramientas | Herramientas manuales |
| **43** | Madera en tablas | Madera para encofrados |
| **47** | Mano de obra | Jornales de todas las categorías |
| **48** | Maquinaria y equipo | Mezcladoras, volquetes, etc. |
| **72** | Concreto premezclado | Concreto bombeado |

---

## 8. Mapeo CAPECO → OpenConstructionERP

### 8.1 Dónde vive cada concepto de la partida

| Concepto CAPECO | Tabla OCE | Campo |
|----------------|-----------|-------|
| **Partida** (APU) | `oe_costs_item` | Registro completo |
| Código de partida | `oe_costs_item` | `code` |
| Descripción | `oe_costs_item` | `description` |
| Unidad | `oe_costs_item` | `unit` |
| Precio unitario final | `oe_costs_item` | `rate` |
| Componentes (M, L, E) | `oe_costs_item` | `components[]` (JSON) |
| Recursos (materiales, MO, equipo) | `oe_catalog_resource` | Registro individual |
| Precio del recurso | `oe_catalog_resource` | `base_price` |
| % Desperdicio | `oe_catalog_resource` | `specifications.waste_pct` |
| Jornal diario | `oe_catalog_resource` | `specifications.daily_wage` |
| Beneficios % | `oe_catalog_resource` | `specifications.burden_pct` |
| Cuadrilla (rol) | `oe_catalog_resource` | `specifications.labor_role` |
| Combustible/hora | `oe_catalog_resource` | `specifications.fuel_cost_per_hour` |
| Valor adquisición | `oe_catalog_resource` | `specifications.acquisition_value` |
| Vida útil | `oe_catalog_resource` | `specifications.useful_life_years` |
| Mantenimiento % | `oe_catalog_resource` | `specifications.maintenance_pct` |
| Metrado (cantidad de partida) | `oe_boq_position` | `quantity` |
| Costo total de partida | `oe_boq_position` | `total = quantity × rate` |
| Índice Unificado | ❌ No existe | Pendiente |

### 8.2 Componentes de un CostItem (formato JSON real)

```json
{
  "code": "OE-03.01.01",
  "description": "Concreto en columnas f'c=210 kg/cm²",
  "unit": "m3",
  "rate": "650.00",
  "currency": "PEN",
  "region": "PE_LIMA",
  "components": [
    {
      "code": "CAT-MAT-00045",
      "type": "material",
      "description": "Concreto premezclado f'c=210 kg/cm²",
      "quantity": 1.05,
      "unit": "m3",
      "unit_rate": "420.00",
      "cost": "441.00"
    },
    {
      "code": "CAT-LAB-00012",
      "type": "labor",
      "description": "Operario",
      "quantity": 2.5,
      "unit": "hh",
      "unit_rate": "14.01",
      "cost": "35.03"
    },
    {
      "code": "CAT-LAB-00013",
      "type": "labor",
      "description": "Oficial",
      "quantity": 1.2,
      "unit": "hh",
      "unit_rate": "12.35",
      "cost": "14.82"
    },
    {
      "code": "CAT-LAB-00014",
      "type": "labor",
      "description": "Peón",
      "quantity": 8.0,
      "unit": "hh",
      "unit_rate": "9.20",
      "cost": "73.60"
    },
    {
      "code": "CAT-EQU-00007",
      "type": "equipment",
      "description": "Vibrador de concreto 4HP",
      "quantity": 1.0,
      "unit": "hm",
      "unit_rate": "15.51",
      "cost": "15.51"
    },
    {
      "type": "tools",
      "description": "Herramientas manuales (3% M.O.)",
      "quantity": 0.03,
      "unit": "%mo",
      "unit_rate": "123.45",
      "cost": "3.70"
    }
  ]
}
```

> `rate = Σ components[].cost = 441.00 + 35.03 + 14.82 + 73.60 + 15.51 + 3.70 = 583.66`  
> *Nota: el rate reportado (650) incluiría GG + Utilidad si se decidiera incluirlos aquí.*

---

## 9. Faltantes Detectados vs CAPECO

Comparando lo que ofrece el software actual vs lo que exige CAPECO:

| # | Concepto CAPECO | Estado en OCE | Prioridad |
|---|----------------|:---:|:---:|
| 1 | Código de partida | ✅ `CostItem.code` | — |
| 2 | Descripción de partida | ✅ `CostItem.description` | — |
| 3 | Unidad de partida | ✅ `CostItem.unit` | — |
| 4 | Precio unitario | ✅ `CostItem.rate` | — |
| 5 | Componentes M / L / E | ✅ `CostItem.components[]` | — |
| 6 | Recursos con precio | ✅ `oe_catalog_resource` | — |
| 7 | % Desperdicio por material | ✅ `specifications.waste_pct` | — |
| 8 | Jornal diario | ✅ `specifications.daily_wage` | — |
| 9 | Beneficios sociales % | ✅ `specifications.burden_pct` | — |
| 10 | Combustible, adquisición, vida útil, mantenimiento | ✅ `specifications.*` | — |
| 11 | Metrado (cantidad) | ✅ `oe_boq_position.quantity` | — |
| 12 | HH auto-calculado | ✅ `(daily_wage/8)×(1+burden/100)` | — |
| 13 | Herramientas 3% MO | ❌ No se calcula automático | 🔴 ALTA |
| 14 | **Rendimiento (unid/día)** | ❌ No existe | 🔴 ALTA |
| 15 | **Cuadrilla completa** (array) | 🟡 Solo `labor_role` string | 🟡 MEDIA |
| 16 | **Aporte unitario materiales** | ❌ No hay separación de aporte vs cantidad final | 🟡 MEDIA |
| 17 | **Cálculo HH automático** (desde rendimiento) | ❌ Solo auto-calcula desde jornal | 🔴 ALTA |
| 18 | **HM auto-calculado** | ❌ No se calcula automático | 🟡 MEDIA |
| 19 | **Subtotales M / L / E visibles** | ❌ La UI no los desglosa | 🟡 MEDIA |
| 20 | **GG + Utilidad + IGV** | ❌ No hay campos para esto | 🔴 ALTA |
| 21 | **Índices Unificados (I.U.)** | ❌ No existe | 🟢 BAJA |
| 22 | **Fórmula polinómica** (reajustes) | ❌ No existe | 🟢 BAJA |
| 23 | **Costo horario equipo** (fórmula) | 🟡 Campos sueltos, sin fórmula integradora | 🟡 MEDIA |
| 24 | **Flete terrestre** | ❌ No existe | 🟢 BAJA |

---

## 10. Resumen: Lo que una Partida CAPECO necesita

Para que el software soporte verdaderamente el flujo CAPECO completo, cada **partida** (CostItem) debería tener:

### Encabezado
- ✅ Código, descripción, unidad, especificaciones
- 🔴 **Cuadrilla** (crew array con roles y cantidades)
- 🔴 **Rendimiento** (unidades/día, para auto-calcular HH y HM)

### Materiales (por cada material)
- ✅ Código de recurso, descripción, unidad
- ✅ Precio unitario del recurso
- 🔴 **Aporte unitario** (cantidad neta teórica)
- ✅ % Desperdicio → calcula cantidad final
- ✅ Cantidad final = aporte × (1 + desperdicio/100)
- ✅ Parcial = cantidad × precio unitario

### Mano de obra (por cada rol)
- ✅ Código de recurso, rol, jornal diario
- ✅ Beneficios sociales %
- ✅ Costo HH = (jornal/8) × (1 + beneficios/100)
- 🔴 **HH requeridas** = auto-cálculo desde cuadrilla y rendimiento
- ✅ Parcial = HH × costo HH

### Equipo (por cada equipo)
- ✅ Código de recurso, tipo
- ✅ Combustible/hora, valor adquisición, vida útil, mantenimiento %
- 🔴 **Costo horario HM** = fórmula integrada de los campos anteriores
- 🔴 **HM requeridas** = auto-cálculo desde cuadrilla y rendimiento
- ✅ Parcial = HM × costo horario

### Herramientas
- 🔴 Auto-cálculo: **3% × Σ(Mano de Obra)**

### Totales
- 🔴 **Subtotal Materiales**
- 🔴 **Subtotal Mano de Obra**
- 🔴 **Subtotal Equipo + Herramientas**
- ✅ **Costo Directo Total** (suma de los 3)

### Sobre el Costo Directo
- 🔴 **% Gastos Generales** (usualmente 10-15%)
- 🔴 **% Utilidad** (usualmente 5-10%)
- 🔴 **% IGV** (18% en Perú)
- 🔴 **Precio de Venta** = CD + GG + Utilidad + IGV

---

> **Documento de referencia para implementación CAPECO en ERP-DEEP.**  
> Fuentes: CAPECO 8va Edición (375 pp.) + Análisis de Precios Unitarios CAPECO (114 pp.)  
> Basado en el código de OpenConstructionERP v8.2.1
