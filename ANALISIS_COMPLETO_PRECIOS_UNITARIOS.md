# 🏗️ Análisis Integral — Precios Unitarios (APU) según CAPECO

> ¿Qué falta en el software para un verdadero **Análisis de Precios Unitarios**  
> al estándar peruano (CAPECO)?

---

## 📐 ¿Qué es un APU?

El **Análisis de Precio Unitario (APU)** descompone el costo de una partida en sus componentes:

```
┌─────────────────────────────────────────────────────────────┐
│                 PRECIO UNITARIO (S/ x unidad)               │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  MATERIALES   │  │ MANO DE OBRA │  │   EQUIPO     │     │
│  │  + desperdicio│  │ + beneficios │  │ + operación  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │               │
│         ▼                 ▼                 ▼               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              COSTO DIRECTO (CD)                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                           +                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Gastos Generales + Utilidad + IGV                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                           =                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              PRECIO DE VENTA                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Lo que YA tenemos

| Concepto | Dónde está | Estado |
|----------|-----------|--------|
| Código de partida | `ordinal` / `reference_code` | ✅ |
| Descripción | `description` | ✅ |
| Unidad | `unit` (con guía CAPECO) | ✅ |
| Metrado | `quantity` | ✅ |
| Precio unitario | `unit_rate` | ✅ |
| Costo total | `total = quantity × unit_rate` | ✅ |
| Recursos/componentes | `metadata.resources[]` | ✅ |
| Tipo de recurso (M/L/E) | `resources[i].type` | ✅ |
| Precio de cada recurso | `resources[i].unit_rate` | ✅ |
| Cantidad por recurso | `resources[i].quantity` | ✅ |
| Clasificación | `classification` (DIN 276, etc.) | ✅ |
| Imágenes del recurso | `specifications.images[]` (catálogo) | ✅ |
| Fichas técnicas | `specifications.datasheets[]` (catálogo) | ✅ |

---

## ❌ Lo que FALTA — checklist completo

### 🔴 NIVEL 1: Esenciales

| # | Concepto | Explicación CAPECO | Dónde falta |
|---|----------|-------------------|------------|
| 1 | **Rendimiento** (H-H/unidad) | Cuántas horas-hombre por unidad de partida. Ej: 0.0699 HH/KG | `Position.metadata.productivity` |
| 2 | **Avance diario** (unidad/día) | Producción diaria de la cuadrilla. Ej: 240 KG/día | `Position.metadata.daily_output` |
| 3 | **Cuadrilla** (crew) | Composición: 0.1 Capataz + 1 Operario + 0.5 Oficial | `Position.metadata.crew[]` |
| 4 | **% Desperdicio** (waste) | Material adicional por pérdida. Ej: concreto 5%, mortero 10% | `resources[i].waste_pct` |
| 5 | **Beneficios Sociales** | CTS, gratificaciones, Essalud, SCTR (~72% sobre jornal) | `resources[i].burden_pct` |

### 🟡 NIVEL 2: Importantes

| # | Concepto | Explicación CAPECO | Dónde falta |
|---|----------|-------------------|------------|
| 6 | **Subtotal por tipo** (M / L / E) | Desglose visible: Materiales S/48.45 + MO S/65.00 + Equipo S/12.35 | UI — cálculo ya posible |
| 7 | **Costo horario equipo** | Depreciación + combustible + lubricantes + mantenimiento | `resources[i].hourly_cost` |
| 8 | **Herramientas** (% MO) | 1-5% del costo de mano de obra para desgaste de herramientas | `Position.metadata.tool_pct` |
| 9 | **Flete terrestre** | Transporte de materiales a obra (distancia, capacidad, costo/viaje) | `resources[i].transport` |

### 🟢 NIVEL 3: Complementarios

| # | Concepto | Explicación CAPECO | Dónde falta |
|---|----------|-------------------|------------|
| 10 | **Fórmula Polinómica** | Reajuste de precios por inflación (Índices Unificados INEI) | No existe |
| 11 | **Gastos Generales** (% del CD) | Costos indirectos: administrativos, oficina, seguros | `BOQ.markups` (parcial) |
| 12 | **Utilidad** (% del CD+GG) | Margen de ganancia del contratista | `BOQ.markups` (parcial) |
| 13 | **IGV** (18%) | Impuesto General a las Ventas | `BOQ.markups` (parcial) |
| 14 | **Jornal Básico** (diario) | Salario diario del trabajador según régimen peruano | No existe |

---

## 📊 Comparativa visual: APU CAPECO vs Nuestro Software

```
┌──────────────────────────────────────────────────────────────┐
│              ANÁLISIS DE PRECIO UNITARIO - CAPECO            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Partida:    050101 - ACERO DE REFUERZO FIERRO 5/8"         │
│  Rendimiento: 0.0699 H-H/KG    │ ✅ tenemos? ❌ NO          │
│  Avance:      240.00 KG/día    │ ✅ tenemos? ❌ NO          │
│  Unidad:      KG               │ ✅ tenemos? ✅ SI           │
│                                                              │
│  ┌─────────┬──────────────────┬────┬──────┬───────┬───────┐ │
│  │ CÓDIGO  │ DESCRIPCIÓN      │UND │ CANT │ P.UNIT│ TOTAL │ │
│  ├─────────┼──────────────────┼────┼──────┼───────┼───────┤ │
│  │ 021002  │ Alambre Negro #16│ KG │ 0.05 │  8.50 │  0.43 │ │ ✅
│  │ 030101  │ Fierro Corrugado │ KG │ 1.05 │  4.20 │  4.41 │ │ ✅
│  │ 470101  │ Capataz (0.1)    │ HH │ 0.10 │ 28.50 │  2.85 │ │ ⚠️
│  │ 470201  │ Operario (1.0)   │ HH │ 1.00 │ 25.00 │ 25.00 │ │ ⚠️
│  │ 470301  │ Oficial (0.5)    │ HH │ 0.50 │ 22.00 │ 11.00 │ │ ⚠️
│  │ 495005  │ Mezcladora conc  │ HM │ 0.05 │ 85.00 │  4.25 │ │ ⚠️
│  ├─────────┴──────────────────┴────┴──────┴───────┼───────┤ │
│  │                      TOTAL COSTO DIRECTO       │ 47.94 │ │ ✅
│  └────────────────────────────────────────────────┴───────┘ │
│                                                              │
│  ✅ = Lo tenemos    ⚠️ = Tenemos parcial    ❌ = Falta       │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎯 Resumen: ¿Qué falta para Precios Unitarios?

### Ya existe (backend + frontend):
- ✅ Partida con descripción, unidad, metrado, precio unitario
- ✅ Recursos compuestos (materiales, mano obra, equipo)
- ✅ Cálculo de total por partida

### Falta implementar:

| Orden | Qué | Impacto |
|-------|-----|---------|
| **1** | **Rendimiento** de la partida | Sin esto no hay APU real |
| **2** | **Cuadrilla** con roles (capataz, operario, oficial, peón) | Esencial para MO Perú |
| **3** | **Avance diario** (producción/día) | Cálculo de plazos |
| **4** | **% Desperdicio** por material | Cantidades reales |
| **5** | **Beneficios Sociales** (% sobre jornal) | Costo real HH Perú |
| **6** | **Subtotales M / L / E** visibles | Transparencia |
| **7** | **Herramientas** (% MO) | Costo completo |
| **8** | **Costo horario equipo** | Operación real |

---

*Generado: 23-Jun-2026*
