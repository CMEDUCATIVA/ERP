# Análisis de Faltantes — Catálogo de Recursos vs CAPECO

> Comparación de nuestro modelo de datos con la guía "Costos y Presupuestos de Edificación"  
> de CAPECO (Cámara Peruana de la Construcción), 8va edición, Ing. Jesús Ramos Salazar.

---

## ✅ Lo que YA tenemos

| Campo CAPECO | Nuestro campo | Estado |
|-------------|--------------|--------|
| **Código** (6 dígitos) | `resource_code` (CAT-MAT-000001) | ✅ Implementado |
| **Descripción** | `name` | ✅ |
| **Unidad** | `unit` + guía de unidades | ✅ |
| **Tipo** (material/mano obra/equipo) | `resource_type` | ✅ |
| **Categoría** | `category` | ✅ |
| **Precio base** | `base_price` | ✅ |
| **Moneda** | `currency` | ✅ |
| **Rango de precios** (min/max) | `min_price` / `max_price` | ✅ |
| **Región** | `region` | ✅ |
| **Especificaciones técnicas** | `specifications.description` | ✅ |
| **Imágenes del producto** | `specifications.images[]` | ✅ |
| **Fichas técnicas (PDF)** | `specifications.datasheets[]` | ✅ |
| **Uso (referencias)** | `usage_count` | ✅ |

---

## ❌ Lo que FALTA según CAPECO

### 1. RENDIMIENTO (Productivity / Yield)

**Definición CAPECO:** Cantidad de recurso necesario por unidad de partida.

| Tipo | Ejemplo | Significado |
|------|---------|-------------|
| Mano de obra | `0.0699 H-H/KG` | 0.0699 horas-hombre para producir 1 kg |
| Mano de obra | `240.00 KG/día` | Una cuadrilla produce 240 kg por día |
| Equipo | `0.05 H-M/m³` | 0.05 horas-máquina por m³ |

**Dónde iría:** En `specifications` como `productivity` y `productivity_unit`

```json
{
  "productivity": 0.0699,
  "productivity_unit": "HH/KG",
  "daily_output": 240.00
}
```

---

### 2. CUADRILLA (Crew Composition)

**Definición CAPECO:** Composición del equipo de trabajo para mano de obra.

| Cargo | Código CAPECO |
|-------|--------------|
| Capataz | 470101 |
| Operario | 470201 |
| Oficial | 470301 |
| Peón | 470401 |

Cada partida especifica cuántos de cada cargo componen la cuadrilla.
Ej: 0.1 Capataz + 1 Operario + 0.5 Peón = 1.6 HH

**Dónde iría:** En `specifications` como `crew[]`

```json
{
  "crew": [
    { "role": "capataz", "code": "470101", "count": 0.1 },
    { "role": "operario", "code": "470201", "count": 1.0 },
    { "role": "peon", "code": "470401", "count": 0.5 }
  ]
}
```

---

### 3. DESPERDICIO (Waste %)

**Definición CAPECO:** Porcentaje de material que se pierde durante la ejecución.

| Material | % Desperdicio |
|----------|--------------|
| Concreto | 5% |
| Acero de refuerzo | 5-8% |
| Ladrillos | 5-10% |
| Tuberías | 3-5% |
| Mortero | 10% |

CAPECO incluye una **Tabla de Porcentaje de Desperdicios** completa.

**Dónde iría:** En `specifications` como `waste_pct`

```json
{
  "waste_pct": 5
}
```

---

### 4. BENEFICIOS SOCIALES (Labor Burden / Social Charges)

**Definición CAPECO:** Cargas sociales que se añaden al jornal básico del trabajador peruano.

| Concepto | % del jornal |
|----------|-------------|
| CTS (Compensación tiempo de servicios) | ~8.33% |
| Gratificaciones (Julio/Diciembre) | ~16.67% |
| Vacaciones | ~8.33% |
| Essalud | 9% |
| SCTR (Seguro complementario trabajo riesgo) | variable |
| **Total carga social** | **~60-80% sobre jornal** |

El costo real de hora-hombre (HH) = jornal básico × (1 + carga_social%)

**Dónde iría:** En `specifications` como `burden_pct`

```json
{
  "base_wage": 25.00,
  "burden_pct": 72.5
}
```

---

### 5. COSTO DE OPERACIÓN DE EQUIPO (Equipment Operating Cost)

**Definición CAPECO:** Costo de poseer y operar un equipo.

| Componente | Descripción |
|-----------|-------------|
| Posesión (depreciación + inversión) | Costo diario del equipo |
| Operación (combustible, lubricantes) | Costo por hora de uso |
| Mantenimiento | % del valor |
| Operador | HH del operador |

**Dónde iría:** En `specifications` como campos de equipo

```json
{
  "hourly_rate": 85.00,
  "fuel_cost": 12.50,
  "rental_days": 0,
  "maintenance_pct": 5
}
```

---

### 6. FLETE TERRESTRE (Transport Cost)

**Definición CAPECO:** Costo de transporte de materiales desde el proveedor hasta la obra.

| Componente | Descripción |
|-----------|-------------|
| Distancia | km desde proveedor |
| Capacidad | toneladas por viaje |
| Costo por viaje | PEN/viaje |
| Tiempo de carga/descarga | horas |

**Dónde iría:** En `specifications` como `transport`

```json
{
  "transport_distance_km": 25,
  "transport_capacity_t": 15,
  "transport_cost_per_trip": 350.00
}
```

---

## 📊 Resumen

| # | Concepto CAPECO | Prioridad | Esfuerzo |
|---|----------------|-----------|----------|
| 1 | **Rendimiento / Productividad** | 🔴 Alta | Medio |
| 2 | **Cuadrilla** | 🔴 Alta | Medio |
| 3 | **Desperdicio %** | 🟡 Media | Bajo |
| 4 | **Beneficios Sociales** | 🔴 Alta | Bajo |
| 5 | **Costo de operación equipo** | 🟡 Media | Medio |
| 6 | **Flete terrestre** | 🟢 Baja | Bajo |

---

## 🎯 Recomendación

Implementar en orden de prioridad:

1. **Rendimiento + Cuadrilla** → Son los más críticos para el análisis de costos unitarios
2. **Beneficios Sociales** → Esencial para calcular el verdadero costo HH en Perú
3. **Desperdicio %** → Ajusta cantidades reales de materiales
4. **Costo de operación + Flete** → Completar el modelo de costos

Técnicamente, todos estos campos se pueden almacenar en el campo JSON `specifications` 
sin necesidad de migraciones de base de datos — solo cambios en frontend (formularios + display).
