# Análisis de Faltantes — Partidas (BOQ Positions) vs CAPECO

> Comparación de nuestra estructura de **Partidas de Presupuesto** con el formato  
> de "Análisis de Costos Unitarios" de CAPECO.

---

## 📊 Nuestro modelo actual: `Position`

```python
class Position(Base):
    ordinal: str              # Número de orden (01, 01.01, etc.)
    description: str          # Descripción de la partida
    unit: str                 # Unidad (m2, m3, kg, etc.)
    quantity: str             # Metrado / cantidad
    unit_rate: str            # Precio unitario
    total: str                # Total = quantity × unit_rate
    metadata_: JSON           # Recursos compuestos y datos extra
    classification: JSON      # Clasificación (DIN 276, etc.)
    # ... otros campos administrativos
```

### `metadata_.resources[]` (partidas compuestas):
```json
[
  { "type": "material", "name": "Cemento", "code": "CEM-001",
    "unit": "bls", "quantity": 10, "unit_rate": 32.50 },
  { "type": "labor", "name": "Operario", "code": "LAB-001",
    "unit": "hh", "quantity": 2.5, "unit_rate": 25.00 }
]
```

---

## 📐 Formato CAPECO — Análisis de Costo Unitario

### Cabecera de la partida:

```
┌──────────────────────────────────────────────────────────────┐
│ PARTIDA N° 050101                                           │
│ ACERO DE REFUERZO - FIERRO 5/8"                             │
│                                                              │
│ Rendimiento:  0.0699 H-H/KG                                 │
│ Avance:       240.00 KG/día                                 │
│                                                              │
│ CÓDIGO    │ DESCRIPCIÓN        │ Unidad │ Cantidad │ Precio  │
│───────────┼───────────────────┼────────┼──────────┼─────────│
│ 021002    │ Alambre Negro #16 │ KG     │ 0.05     │ 8.50    │
│ 030101    │ Fierro Corrugado  │ KG     │ 1.05     │ 4.20    │
│ 470101    │ Capataz           │ HH     │ 0.10     │ 28.50   │
│ 470201    │ Operario          │ HH     │ 1.00     │ 25.00   │
│ 470301    │ Oficial           │ HH     │ 0.50     │ 22.00   │
│ 495005    │ Mezcladora concreto│ HM    │ 0.05     │ 85.00   │
│           │ TOTAL COSTO DIRECTO│       │          │ 125.80  │
└──────────────────────────────────────────────────────────────┘
```

---

## ❌ Lo que FALTA en nuestras partidas

### 1. RENDIMIENTO de la partida

**Qué es:** Cuánto recurso (horas-hombre, horas-máquina) se necesita por unidad de la partida.

**Ejemplo CAPECO:**
```
Rendimiento: 0.0699 H-H/KG
→ Significa: 0.0699 horas-hombre para producir 1 kg de acero
```

**Dónde falta:** En `Position.metadata_` o como campo propio.

```json
// Propuesta — en metadata de la partida:
{
  "productivity": 0.0699,
  "productivity_unit": "HH/KG"
}
```

---

### 2. AVANCE DIARIO (Daily Output)

**Qué es:** Cuánto produce la cuadrilla en un día de trabajo.

**Ejemplo CAPECO:**
```
Avance: 240.00 KG/día
→ Significa: En un día, la cuadrilla produce 240 kg de fierro trabajado
```

**Relación:** Avance = (Jornada 8h × tamaño cuadrilla) / Rendimiento

**Dónde falta:** En `Position.metadata_`

```json
{
  "daily_output": 240.00,
  "daily_output_unit": "KG/día"
}
```

---

### 3. CUADRILLA por partida

**Qué es:** Composición del equipo de trabajo para esta partida específica.

**Diferencia clave:** En CAPECO, cada PARTIDA tiene su propia cuadrilla. No es una propiedad del recurso "Operario" — es cuántos operarios necesita ESTA partida.

**Ejemplo CAPECO:**
```
Cuadrilla: 0.1 Capataz + 1 Operario + 0.5 Oficial
```

**Actualmente:** Nuestro sistema pone `quantity` en cada recurso (ej: 1.0 Operario con unit_rate 25.00). Pero no hay un concepto explícito de "cuadrilla" ni "categoría de trabajador".

**Dónde falta:** En `Position.metadata_`

```json
{
  "crew": [
    { "role": "capataz", "count": 0.1 },
    { "role": "operario", "count": 1.0 },
    { "role": "oficial", "count": 0.5 }
  ]
}
```

---

### 4. DESPERDICIO por recurso (dentro de la partida)

**Qué es:** El % adicional de material que se pierde al ejecutar ESTA partida.

**Ejemplo CAPECO:**
```
Fierro Corrugado: cantidad = 1.05 kg  (1 kg neto + 5% desperdicio)
```

**Actualmente:** Nuestro `quantity` ya incluye el desperdicio si el usuario lo calcula manualmente. Pero no hay un campo explícito para el % de desperdicio.

**Dónde falta:** En cada recurso de `metadata_.resources[]`

```json
{
  "type": "material",
  "name": "Fierro Corrugado",
  "quantity": 1.05,
  "waste_pct": 5,
  "net_quantity": 1.00
}
```

---

### 5. APORTE UNITARIO (Unit Contribution)

**Qué es:** Cuánto de cada recurso se necesita por UNA unidad de la partida.

**Ejemplo CAPECO:**
```
Por cada 1 KG de acero de refuerzo:
  - 0.05 kg de alambre negro
  - 1.05 kg de fierro corrugado
  - 0.0699 HH de mano de obra
```

**Actualmente:** Nuestro `quantity` en cada recurso YA representa esto. Pero no está explícitamente etiquetado como "aporte unitario".

**Dónde:** Ya existe como `quantity` en `metadata_.resources[i].quantity`. Solo falta etiquetarlo/visualizarlo como "Aporte unitario".

---

### 6. COSTO DIRECTO DESGLOSADO

**Qué es:** El subtotal de cada categoría de costo dentro de la partida.

**Ejemplo CAPECO:**
```
Materiales:     S/ 48.45
Mano de obra:   S/ 65.00
Equipo:         S/ 12.35
───
Total CD:       S/ 125.80
```

**Actualmente:** Podemos calcularlo sumando por `type`. Pero no se muestra en la UI.

**Dónde:** Cálculo — ya es posible, solo falta mostrarlo.

---

## 📊 Tabla resumen de faltantes en PARTIDAS

| # | Campo CAPECO | Estado actual | Dónde iría | Prioridad |
|---|-------------|--------------|-----------|-----------|
| 1 | **Rendimiento de partida** (H-H/unidad) | ❌ No existe | `metadata.productivity` | 🔴 Alta |
| 2 | **Avance diario** (unidad/día) | ❌ No existe | `metadata.daily_output` | 🔴 Alta |
| 3 | **Cuadrilla** (composición) | ❌ No existe explícito | `metadata.crew[]` | 🔴 Alta |
| 4 | **% Desperdicio por recurso** | ⚠️ Manual en quantity | `resources[i].waste_pct` | 🟡 Media |
| 5 | **Aporte unitario** | ✅ Ya es quantity | Solo renombrar UI | 🟢 Baja |
| 6 | **Subtotal por tipo** (M/L/E) | ⚠️ Calculable, no visible | UI dashboard | 🟡 Media |

---

## 🎯 Conclusión

Lo más urgente para partidas según CAPECO:

1. **Rendimiento** — el campo más importante para análisis de costos
2. **Cuadrilla** — esencial para mano de obra peruana
3. **Avance diario** — output diario de la cuadrilla

Todo esto se puede almacenar en `metadata_` JSON sin migraciones de BD.
Los formularios y vistas del BOQ Editor necesitarían adaptarse.

---

*Generado: 23-Jun-2026*
