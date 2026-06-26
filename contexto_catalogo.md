# 🏗️ Contexto del Catálogo — OpenConstructionERP

> Documento de referencia: estructura del catálogo de recursos, su lógica de negocio,  
> relación con el sistema de costos/APU, y mapeo al estándar CAPECO (Perú).

---

## 1. ¿Qué es el Catálogo?

El **Catálogo** (`/api/v1/catalog/`) es la base de datos maestra de **recursos hoja** — insumos individuales (un material, una mano de obra, un equipo, un operador) con un precio por región. No contiene partidas compuestas ni análisis de precios unitarios (APU); esos viven en el módulo de **Costos** (`/api/v1/costs/`).

### Analogía CAPECO

| Concepto CAPECO | Dónde está en OCE |
|----------------|-------------------|
| **Recurso** (material, MO, equipo) | `oe_catalog_resource` → `/api/v1/catalog/` |
| **Partida** (APU completo) | `oe_costs_item` → `/api/v1/costs/` |
| **Componentes de partida** (M, L, E) | `CostItem.components[]` — referencian recursos por `resource_code` |
| **Precio unitario** | `CostItem.rate` (calculado desde `components[]`) |

---

## 2. Estructura de la Tabla `oe_catalog_resource`

### 2.1 Columnas fijas (compartidas por los 6 tipos)

```
┌──────────────────────┬──────────────────────────────────────────────────┐
│ COLUMNA              │ DESCRIPCIÓN                                      │
├──────────────────────┼──────────────────────────────────────────────────┤
│ id (UUID, PK)        │ Identificador único                              │
│ resource_code        │ Código único por región, ej: CAT-MAT-LX3K2M      │
│ name                 │ Nombre: "Concreto premezclado C30/37"            │
│ resource_type        │ material | labor | equipment | operator          │
│                      │ subcontractor | overhead                         │
│ category             │ Categoría: "Concrete & Cement", "Cranes", etc.   │
│ unit                 │ Unidad: m3, kg, h, hh, m2, pza, gal, bol...     │
│ base_price           │ Precio principal (string para compatibilidad)     │
│ min_price            │ Precio mínimo del rango                          │
│ max_price            │ Precio máximo del rango                          │
│ currency             │ Código ISO 4217: PEN, EUR, USD, BRL...           │
│ usage_count          │ Cuántas partidas (CostItem) referencian este     │
│                      │ recurso por su resource_code                     │
│ source               │ "manual" | "cwicr_extraction"                    │
│ region               │ Región: CUSTOM | PE_LIMA | DE_BERLIN | USA_USD...│
│ is_active            │ Boolean                                          │
│ created_at           │ Fecha de creación                                │
│ updated_at           │ Fecha de última modificación                     │
├──────────────────────┼──────────────────────────────────────────────────┤
│ specifications (JSON)│ ⬅ CAMPOS TIPO-ESPECÍFICOS (ver sección 3)       │
│ metadata_ (JSON)     │ Metadatos adicionales                            │
└──────────────────────┴──────────────────────────────────────────────────┘
```

### 2.2 Código de recurso auto-generado

El frontend genera el `resource_code` al crear un recurso manual:

```
CAT-{tipo abreviado}-{timestamp base36}
```

| Tipo | Prefijo | Ejemplo |
|------|---------|---------|
| material | `CAT-MAT-` | `CAT-MAT-LX3K2M` |
| labor | `CAT-LAB-` | `CAT-LAB-AB7F3D` |
| equipment | `CAT-EQU-` | `CAT-EQU-9G2H1N` |
| operator | `CAT-OPE-` | `CAT-OPE-4K5J7M` |
| subcontractor | `CAT-SUB-` | `CAT-SUB-8L2M9P` |
| overhead | `CAT-OVE-` | `CAT-OVE-3N6R1S` |

---

## 3. Campos Tipo-Específicos en `specifications` (JSON)

Cada `resource_type` guarda distintos campos dentro del JSON `specifications`.
El backend los **trata como opacos** — no los valida ni interpreta; solo los persiste.

### 3.1 Tipo `material`

| Campo JSON | Significado CAPECO | Ejemplo |
|------------|-------------------|---------|
| `description` | Especificaciones técnicas | `"Cemento Portland Tipo I, ASTM C150"` |
| `waste_pct` | % Desperdicio | `5.0` (concreto 5%, mortero 10%) |
| `images[]` | Fotos del producto (base64) | `[{name: "cem.jpg", dataUrl: "data:..."}]` |
| `datasheets[]` | Fichas técnicas PDF (base64) | `[{name: "ficha.pdf", dataUrl: "data:..."}]` |

### 3.2 Tipos `labor` y `operator`

| Campo JSON | Significado CAPECO | Ejemplo |
|------------|-------------------|---------|
| `description` | Especificaciones | `"Operario especializado en encofrado"` |
| `labor_role` | Rol en cuadrilla | `"capataz"`, `"operario"`, `"oficial"`, `"peon"` |
| `daily_wage` | Jornal diario (sin beneficios) | `65.00` (S/ por día) |
| `burden_pct` | Beneficios sociales (%) | `72.5` (CTS, gratif., Essalud, SCTR) |
| `images[]` | Fotos | |
| `datasheets[]` | Documentos | |

> **Auto-cálculo del costo HH:**  
> Cuando `daily_wage > 0` y `burden_pct > 0`, el frontend calcula:
> ```
> base_price = (daily_wage / 8) × (1 + burden_pct / 100)
> ```
> Esto produce el **costo por hora-hombre (HH)** que se guarda en `base_price`.

### 3.3 Tipo `equipment`

| Campo JSON | Significado CAPECO | Ejemplo |
|------------|-------------------|---------|
| `description` | Especificaciones | `"Excavadora CAT 320D"` |
| `fuel_cost_per_hour` | Combustible por hora | `12.50` (S/ / hora) |
| `acquisition_value` | Valor de adquisición | `45000.00` (S/) |
| `useful_life_years` | Vida útil (años) | `5` |
| `maintenance_pct` | % Mantenimiento anual | `5` (% del valor adquisición) |
| `images[]` | Fotos | |
| `datasheets[]` | Fichas técnicas | |

### 3.4 Tipos `subcontractor` y `overhead`

Solo tienen: `description`, `images[]`, `datasheets[]` — sin campos especializados.

---

## 4. Relación Catálogo ↔ Costos (APU)

### 4.1 El flujo de datos

```
┌──────────────────────────┐     ┌──────────────────────────────────────┐
│   oe_catalog_resource     │────▶│        oe_costs_item                 │
│   (RECURSOS HOJA)         │     │        (PARTIDAS / APU)              │
│                           │     │                                      │
│  resource_code: "C-001"   │     │  code: "OE-03.01.01"                 │
│  name: "Concreto C30/37"  │     │  description: "Concreto en columnas" │
│  resource_type: material  │     │  unit: "m3"                          │
│  unit: "m3"              │     │  rate: "650.00"  ← precio unitario   │
│  base_price: "350.50"     │     │  components: [                       │
│  currency: "PEN"          │     │    {                                 │
│                           │     │      "code": "C-001",  ◀─ referencia │
│                           │     │      "type": "material",             │
│                           │     │      "description": "Concreto C30/37"│
│                           │     │      "quantity": 1.05,  (incl. 5%)   │
│                           │     │      "unit": "m3",                   │
│                           │     │      "unit_rate": "350.50",          │
│                           │     │      "cost": "368.03"                │
│                           │     │    },                                │
│                           │     │    {                                 │
│                           │     │      "code": "L-005",  ◀─ referencia │
│                           │     │      "type": "labor",                │
│                           │     │      ...                             │
│                           │     │    }                                 │
│                           │     │  ]                                   │
└──────────────────────────┘     └──────────────────────────────────────┘
```

### 4.2 La relación es por `resource_code`, no por FK

La tabla `CostItem` tiene una columna `components` (JSON) que almacena un array de objetos.  
Cada objeto referencia un recurso del catálogo por su **`code`** (que debe coincidir con `resource_code`).

No hay foreign key formal — la integridad se mantiene por convención y vía el endpoint inverso:

```
GET /api/v1/catalog/{resource_id}/used-by/
→ Devuelve todas las partidas (CostItems) que referencian este recurso
```

### 4.3 `usage_count`

- Al guardar/actualizar un `CostItem`, el backend recorre `components[]`
- Para cada `code` encontrado, incrementa `usage_count` en `oe_catalog_resource`
- Así se sabe cuántas partidas usan cada recurso

---

## 5. Mapeo Completo CAPECO ↔ OpenConstructionERP

### 5.1 Estructura del APU según CAPECO

```
┌──────────────────────────────────────────────────────────────────┐
│                    PRECIO UNITARIO (S/ x unidad)                  │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐     │
│  │   MATERIALES    │  │  MANO DE OBRA  │  │    EQUIPO      │     │
│  │  + desperdicio  │  │ + beneficios   │  │ + operación    │     │
│  │                 │  │ sociales       │  │                │     │
│  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘     │
│          │                   │                    │              │
│          ▼                   ▼                    ▼              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              COSTO DIRECTO (CD)                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            +                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Gastos Generales + Utilidad + IGV (18%)                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            =                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              PRECIO DE VENTA                              │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Checklist CAPECO — Lo que ya existe ✅

| # | Concepto CAPECO | Campo en OCE | Dónde | Estado |
|---|----------------|-------------|-------|--------|
| 1 | **Código de recurso** (6 dígitos) | `resource_code` | `oe_catalog_resource` | ✅ |
| 2 | **Descripción** | `name` | `oe_catalog_resource` | ✅ |
| 3 | **Unidad** | `unit` | `oe_catalog_resource` | ✅ |
| 4 | **Tipo** (M / L / E) | `resource_type` | `oe_catalog_resource` | ✅ |
| 5 | **Categoría** | `category` | `oe_catalog_resource` | ✅ |
| 6 | **Precio base** | `base_price` | `oe_catalog_resource` | ✅ |
| 7 | **Rango de precios** (min/max) | `min_price` / `max_price` | `oe_catalog_resource` | ✅ |
| 8 | **Moneda** | `currency` | `oe_catalog_resource` | ✅ |
| 9 | **Región** | `region` | `oe_catalog_resource` | ✅ |
| 10 | **% Desperdicio** (materiales) | `specifications.waste_pct` | JSON en `oe_catalog_resource` | ✅ |
| 11 | **Rol laboral** | `specifications.labor_role` | JSON en `oe_catalog_resource` | ✅ |
| 12 | **Jornal diario** | `specifications.daily_wage` | JSON en `oe_catalog_resource` | ✅ |
| 13 | **Beneficios sociales %** | `specifications.burden_pct` | JSON en `oe_catalog_resource` | ✅ |
| 14 | **Costo HH** (auto-calculado) | → `base_price` | `oe_catalog_resource` | ✅ |
| 15 | **Combustible/hora** | `specifications.fuel_cost_per_hour` | JSON en `oe_catalog_resource` | ✅ |
| 16 | **Valor adquisición** | `specifications.acquisition_value` | JSON en `oe_catalog_resource` | ✅ |
| 17 | **Vida útil (años)** | `specifications.useful_life_years` | JSON en `oe_catalog_resource` | ✅ |
| 18 | **% Mantenimiento** | `specifications.maintenance_pct` | JSON en `oe_catalog_resource` | ✅ |
| 19 | **Código de partida** | `code` | `oe_costs_item` | ✅ |
| 20 | **Descripción de partida** | `description` | `oe_costs_item` | ✅ |
| 21 | **Unidad de partida** | `unit` | `oe_costs_item` | ✅ |
| 22 | **Metrado** | `quantity` | `oe_costs_item` (vía BOQ) | ✅ |
| 23 | **Precio unitario de partida** | `rate` | `oe_costs_item` | ✅ |
| 24 | **Componentes** (recursos M/L/E) | `components[]` | `oe_costs_item` (JSON) | ✅ |
| 25 | **Imágenes del recurso** | `specifications.images[]` | JSON en `oe_catalog_resource` | ✅ |
| 26 | **Fichas técnicas** | `specifications.datasheets[]` | JSON en `oe_catalog_resource` | ✅ |

### 5.3 Checklist CAPECO — Lo que FALTA ❌ / 🟡

| # | Concepto CAPECO | Problema | Prioridad |
|---|----------------|----------|-----------|
| 1 | **Rendimiento (HH/unidad)** | No existe campo `productivity`. Se necesita para saber cuántas HH se consumen por unidad de partida. Ej: 0.0699 HH/KG | 🔴 ALTA |
| 2 | **Avance diario** (unidad/día) | No existe campo `daily_output`. Complementa al rendimiento. Ej: 240 KG/día | 🔴 ALTA |
| 3 | **Cuadrilla completa** (crew array) | Solo existe `labor_role` (un string). CAPECO pide un array con composición: 0.1 Capataz + 1 Operario + 0.5 Peón | 🟡 MEDIA |
| 4 | **Costo horario equipo** (fórmula compuesta) | Los campos están (combustible, adquisición, vida útil, mantenimiento) pero no hay una fórmula que unifique todo en un `hourly_cost` calculado | 🟡 MEDIA |
| 5 | **Herramientas (% MO)** | No existe `tool_pct`. CAPECO asigna 1-5% del costo de MO para desgaste de herramientas | 🟡 MEDIA |
| 6 | **Flete terrestre** | No existe `transport`. Transporte de materiales a obra (distancia, capacidad, costo/viaje) | 🟢 BAJA |
| 7 | **Subtotales M / L / E en UI** | Los datos están en `components[]` pero la UI no muestra el desglose visual: Materiales S/48.45 + MO S/65.00 + Equipo S/12.35 | 🟡 MEDIA |
| 8 | **Gastos generales + Utilidad + IGV** | No hay campos explícitos para `overhead_pct`, `profit_pct`, `tax_pct` a nivel de partida. El `rate` es un número plano. | 🔴 ALTA |

---

## 6. API del Catálogo — Endpoints Relevantes

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/catalog/` | Buscar/listar recursos (con filtros: q, resource_type, category, region, unit, min_price, max_price) |
| `GET` | `/api/v1/catalog/stats/` | Estadísticas: total, por tipo, por categoría |
| `GET` | `/api/v1/catalog/regions/` | Regiones cargadas con conteos |
| `GET` | `/api/v1/catalog/{id}` | Obtener un recurso por ID |
| `GET` | `/api/v1/catalog/{id}/used-by/` | Partidas (CostItems) que usan este recurso |
| `POST` | `/api/v1/catalog/` | **Crear recurso personalizado** (manual) |
| `PATCH` | `/api/v1/catalog/{id}` | Actualizar recurso |
| `POST` | `/api/v1/catalog/import/{region}` | Importar catálogo regional desde GitHub (CWICR) |
| `DELETE` | `/api/v1/catalog/region/{region}` | Eliminar todos los recursos de una región |
| `PATCH` | `/api/v1/catalog/adjust-prices/` | Ajuste masivo de precios por factor |

---

## 7. Flujo Completo: Añadir un Recurso Personalizado

### 7.1 Formulario Frontend → POST /api/v1/catalog/

```json
{
  "resource_code": "CAT-MAT-LX3K2M",
  "name": "Concreto premezclado C30/37",
  "resource_type": "material",
  "category": "Concrete & Cement",
  "unit": "m3",
  "base_price": 350.50,
  "min_price": 320.00,
  "max_price": 400.00,
  "currency": "PEN",
  "source": "manual",
  "region": "CUSTOM",
  "usage_count": 0,
  "specifications": {
    "description": "Concreto premezclado resistencia 30 MPa",
    "waste_pct": 5,
    "images": [],
    "datasheets": []
  }
}
```

### 7.2 Formulario Frontend → POST /api/v1/catalog/ (labor)

```json
{
  "resource_code": "CAT-LAB-AB7F3D",
  "name": "Operario",
  "resource_type": "labor",
  "category": "Labor - General",
  "unit": "hh",
  "base_price": 14.01,
  "min_price": 14.01,
  "max_price": 14.01,
  "currency": "PEN",
  "source": "manual",
  "region": "CUSTOM",
  "usage_count": 0,
  "specifications": {
    "description": "Operario de construcción general",
    "labor_role": "operario",
    "daily_wage": 65.00,
    "burden_pct": 72.5,
    "images": [],
    "datasheets": []
  }
}
```

> `base_price = (65.00 / 8) × (1 + 72.5/100) = 8.125 × 1.725 = 14.01 PEN/HH`

---

## 8. Esquema Relacional Simplificado

```
┌──────────────────────────────────────────────────────────────────────┐
│                        SISTEMA DE CATÁLOGO                           │
│                                                                      │
│  ┌─────────────────────────┐     ┌──────────────────────────────┐   │
│  │  oe_catalog_resource     │     │  oe_costs_item               │   │
│  │  (≈55K filas regionales) │     │  (partidas / APU)            │   │
│  │                          │     │                              │   │
│  │  resource_code ◄─────────┼─────│  components[i].code           │   │
│  │  name                    │     │  components[i].type           │   │
│  │  resource_type           │     │  components[i].quantity       │   │
│  │  unit                    │     │  components[i].unit_rate      │   │
│  │  base_price              │     │  components[i].cost           │   │
│  │  specifications (JSON)   │     │                              │   │
│  │    ├ waste_pct           │     │  code                         │   │
│  │    ├ labor_role          │     │  description                  │   │
│  │    ├ daily_wage          │     │  unit                         │   │
│  │    ├ burden_pct          │     │  rate (precio unitario)       │   │
│  │    ├ fuel_cost_per_hour  │     │  currency                     │   │
│  │    ├ acquisition_value   │     │  region                       │   │
│  │    ├ useful_life_years   │     │  classification (JSON)        │   │
│  │    └ maintenance_pct     │     └──────────────────────────────┘   │
│  └─────────────────────────┘                                         │
│                                                                      │
│  ┌─────────────────────────┐     ┌──────────────────────────────┐   │
│  │  oe_costs_catalog        │     │  oe_boq_position             │   │
│  │  (catálogos nombrados)   │     │  (posiciones en presupuesto) │   │
│  │                          │     │                              │   │
│  │  id                      │     │  cost_item_id ──────────────▶│   │
│  │  name                    │     │  quantity (metrado)          │   │
│  │  items[] ───────────────▶│     │  total = quantity × rate     │   │
│  └─────────────────────────┘     └──────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 9. Regiones Soportadas (31 regiones)

El catálogo se sincroniza desde GitHub con catálogos CWICR regionales:

| Código | Ciudad/Región | Código | Ciudad/Región |
|--------|--------------|--------|---------------|
| `AR_DUBAI` | Dubái | `MX_MEXICOCITY` | Ciudad de México |
| `AU_SYDNEY` | Sídney | `NG_LAGOS` | Lagos |
| `BG_SOFIA` | Sofía | `NL_AMSTERDAM` | Ámsterdam |
| `CS_PRAGUE` | Praga | `NZ_AUCKLAND` | Auckland |
| `DE_BERLIN` | Berlín | **`PE_LIMA`** | **Lima, Perú** ✅ |
| `ENG_TORONTO` | Toronto | `PL_WARSAW` | Varsovia |
| `SP_BARCELONA` | Barcelona | `PT_SAOPAULO` | São Paulo |
| `FR_PARIS` | París | `RO_BUCHAREST` | Bucarest |
| `HI_MUMBAI` | Mumbai | `RU_STPETERSBURG` | San Petersburgo |
| `HR_ZAGREB` | Zagreb | `SV_STOCKHOLM` | Estocolmo |
| `ID_JAKARTA` | Yakarta | `TH_BANGKOK` | Bangkok |
| `IT_ROME` | Roma | `TR_ISTANBUL` | Estambul |
| `JA_TOKYO` | Tokio | `UK_GBP` | Reino Unido |
| `KO_SEOUL` | Seúl | `USA_USD` | EE.UU. |
| `VI_HANOI` | Hanói | `ZA_JOHANNESBURG` | Johannesburgo |
| `ZH_SHANGHAI` | Shanghái | | |

---

## 10. Resumen: Lógica de Negocio

1. **Recursos** = insumos individuales con precio (material, MO, equipo, etc.)
2. **Partidas (CostItem)** = APU compuesto por `components[]` que referencian recursos por `code`
3. **Relación**: Catálogo → Costos es por **referencia de código** (no FK en BD)
4. **Campos CAPECO**: los específicos (desperdicio, jornal, beneficios, combustible) se guardan en el JSON `specifications` de forma opaca
5. **Auto-cálculo**: mano de obra → `base_price = (daily_wage / 8) × (1 + burden_pct/100)`
6. **Regiones**: cada recurso pertenece a una región (`PE_LIMA` para Perú)
7. **Recursos manuales**: se crean con `source=manual`, `region=CUSTOM`, código auto-generado
8. **Sincronización**: catálogos oficiales CWICR se descargan desde GitHub vía `POST /import/{region}`

---

> **Documento generado para el proyecto ERP-DEEP.**  
> Basado en el código fuente de OpenConstructionERP v8.2.1.
