# 🔍 Análisis: Formulario de Recurso — Faltantes para APU CAPECO

> Enfoque exclusivo en el **formulario de creación/edición de recursos del catálogo**  
> (nuestros "costos unitarios" como insumos de las partidas).

---

## 📋 Campos actuales del formulario

```
┌─────────────────────────────────────────────┐
│  Nombre *          [___________________]    │
│                                             │
│  Tipo     ▾        Categoría               │
│  [Material   ]     [___________________]    │
│                                             │
│  Unidad   ▾        Moneda  ▾               │
│  [M² (m cuadrado)] [PEN           ]        │
│                                             │
│  Price   │ Min Price  │ Max Price           │
│  [27.91] │ [20.00   ] │ [35.00   ]         │
│                                             │
│  Specifications (textarea)                  │
│                                             │
│  🖼️ Imágenes  [+ archivo]                  │
│  📄 Fichas Técnicas [+ archivo]            │
└─────────────────────────────────────────────┘
```

**Campos actuales:** 11 campos (nombre, tipo, categoría, unidad, precio, min, max, moneda, specs, imágenes, fichas)

---

## ❌ Qué falta en el formulario — por tipo de recurso

### 🔵 MATERIALES

| Campo CAPECO | Nuestro form | ¿Falta? |
|-------------|-------------|---------|
| Código | Auto-generado `CAT-MAT-XXXXXX` | ✅ |
| Nombre / Descripción | `name` | ✅ |
| Unidad | `unit` | ✅ |
| Precio unitario | `base_price` | ✅ |
| **% Desperdicio** | ❌ | 🔴 **FALTA** |
| **Peso unitario** (kg/unidad) | ❌ | 🟡 Opcional |
| **Rendimiento** (unidad/HH) | ❌ | 🟡 Para materiales que requieren instalación |

```json
// Propuesta: agregar al form cuando type = "material"
{
  "waste_pct": 5,          // % desperdicio (CAPECO tiene tabla estándar)
  "unit_weight_kg": 42.5   // peso unitario (útil para flete)
}
```

---

### 🟢 MANO DE OBRA

| Campo CAPECO | Nuestro form | ¿Falta? |
|-------------|-------------|---------|
| Código | Auto-generado `CAT-LAB-XXXXXX` | ✅ |
| Categoría / Rol | `category` (texto libre) | ⚠️ Debería ser select: Capataz, Operario, Oficial, Peón |
| Unidad | `unit` = HH (hora-hombre) | ✅ |
| **Jornal Básico** (diario) | ❌ | 🔴 **FALTA** |
| **Beneficios Sociales %** | ❌ | 🔴 **FALTA** |
| **Costo HH real** (calculado) | ❌ | 🔴 **FALTA** |
| **Rendimiento** (productividad) | ❌ | 🔴 **FALTA** |

**Explicación CAPECO:**
```
Costo HH = Jornal Básico Diario / 8h × (1 + Beneficios Sociales %)
         = S/ 65.00 / 8 × (1 + 0.72)
         = S/ 8.125 × 1.72
         = S/ 13.98 / HH
```

```json
// Propuesta: agregar al form cuando type = "labor"
{
  "daily_wage": 65.00,       // jornal básico diario (S/)
  "burden_pct": 72.5,        // % beneficios sociales (CTS + gratif + EsSalud + SCTR)
  "calculated_hh_cost": 13.98, // calculado: (daily_wage/8) * (1 + burden_pct/100)
  "role": "operario",         // capataz | operario | oficial | peón
  "productivity": 0.4,       // rendimiento (unidades/HH) — opcional, puede ir en la partida
  "productivity_unit": "m²/HH"
}
```

---

### 🟠 EQUIPO / MAQUINARIA

| Campo CAPECO | Nuestro form | ¿Falta? |
|-------------|-------------|---------|
| Código | Auto-generado `CAT-EQU-XXXXXX` | ✅ |
| Nombre | `name` | ✅ |
| Unidad | `unit` = HM (hora-máquina) | ✅ |
| Precio unitario | `base_price` | ✅ |
| **Costo de posesión** (diario) | ❌ | 🔴 **FALTA** |
| **Costo de operación** (combustible, lubricantes) | ❌ | 🔴 **FALTA** |
| **Costo de mantenimiento** | ❌ | 🟡 |
| **Vida útil** (horas) | ❌ | 🟡 |
| **Potencia** (HP/kW) | ❌ | 🟡 |

**Explicación CAPECO:**
```
Costo Horario = (Costo Posesión + Costo Operación) / Horas efectivas

Donde:
  Costo Posesión = (Valor adquisición - Valor residual) / Vida útil (horas)
  Costo Operación = Combustible + Lubricantes + Mantenimiento + Operador
```

```json
// Propuesta: agregar al form cuando type = "equipment"
{
  "acquisition_value": 85000.00,  // valor de adquisición
  "residual_value": 8500.00,      // valor residual
  "useful_life_hours": 10000,     // vida útil en horas
  "fuel_cost_per_hour": 12.50,    // combustible por hora
  "lube_cost_pct": 10,            // lubricantes (% del combustible)
  "maintenance_pct": 5,           // mantenimiento (% del valor)
  "horsepower": 150               // potencia HP
}
```

---

### 🟣 OPERADOR

| Campo CAPECO | Nuestro form | ¿Falta? |
|-------------|-------------|---------|
| Código | Auto-generado `CAT-OPE-XXXXXX` | ✅ |
| Nombre / tipo | `name` | ✅ |
| Unidad | `unit` = HH (hora-hombre) | ✅ |
| **Jornal Básico** | ❌ | 🔴 **FALTA** |
| **Beneficios Sociales %** | ❌ | 🔴 **FALTA** |

Igual que Mano de Obra pero para operadores de equipo especializado.

---

## 📊 Resumen visual — Formulario actual vs propuesto

```
┌─────────────────────────────────────────────────────────────┐
│  FORMULARIO ACTUAL               │  FORMULARIO PROPUESTO    │
│                                  │                          │
│  Nombre *                        │  Nombre *                │
│  Tipo       Categoría            │  Tipo ▼    Categoría     │
│  Unidad     Moneda               │  Unidad ▼  Moneda ▼     │
│  Price  Min  Max                 │  Price  Min  Max         │
│  Specs (textarea)                │  Specs (textarea)        │
│  🖼️ Imágenes                     │  🖼️ Imágenes              │
│  📄 Fichas                       │  📄 Fichas               │
│                                  │                          │
│                                  │  ── DINÁMICO POR TIPO ── │
│                                  │                          │
│                                  │  🔵 MATERIAL:            │
│                                  │    % Desperdicio: [5]    │
│                                  │                          │
│                                  │  🟢 MANO DE OBRA:        │
│                                  │    Rol: [Operario  ▼]   │
│                                  │    Jornal diario: [65.00]│
│                                  │    Beneficios %: [72.5]  │
│                                  │    Costo HH real: 13.98  │
│                                  │                          │
│                                  │  🟠 EQUIPO:              │
│                                  │    Valor adquisición     │
│                                  │    Vida útil (horas)      │
│                                  │    Combustible/hora       │
│                                  │    Costo horario real     │
│                                  │                          │
│                                  │  🟣 OPERADOR:            │
│                                  │    Jornal diario: [80.00]│
│                                  │    Beneficios %: [72.5]  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Conclusión: 4 campos dinámicos por tipo

| Tipo | Campo 1 | Campo 2 | Campo 3 | Campo 4 |
|------|---------|---------|---------|---------|
| 🔵 Material | % Desperdicio | Peso unitario | — | — |
| 🟢 Mano Obra | Rol (select) | Jornal básico (S/) | Beneficios sociales (%) | Costo HH real (auto) |
| 🟠 Equipo | Valor adquisición | Vida útil (h) | Combustible/hora | Costo H-M real (auto) |
| 🟣 Operador | Jornal básico (S/) | Beneficios sociales (%) | Costo HH real (auto) | — |

**Todo se almacena en `specifications` JSON** — sin migraciones de BD. Solo frontend.

---

*Generado: 23-Jun-2026*
