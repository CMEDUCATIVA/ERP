# 🧩 Patrón de Panel Expandible por Tipo — Fase 1: Material

> Documento guía para replicar el diseño del panel de **Material** en los demás tipos:
> `labor`, `equipment`, `operator`, `subcontractor`, `overhead`.

---

## 1. Arquitectura del Panel

Cada componente en una partida tiene una fila principal (siempre visible) y un panel
expandible (toggle ▼/▲) que muestra **campos tipo-específicos** con datos que se jala
en vivo del catálogo vinculado (`catalog_resource_id`) o del `metadata` guardado.

```
┌── FILA PRINCIPAL (siempre visible) ──────────────────────────────────────────┐
│ ☰  Descripción  │ Type │ Factor │ Cantidad │ Unidad │ Unit Cost │ Total │ ⋮ │
└───────────────────────────────────────────────────────────────────────────────┘
                              ↓ click en ▼
┌── PANEL EXPANDIBLE — TIPO-ESPECÍFICO ────────────────────────────────────────┐
│  Campo 1 (editable)  │  Campo 2 (solo lectura)  │  Campo 3 (editable)  │ ... │
│  Imágenes (click → popup)   │   Fichas Técnicas (click → descarga)           │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Flujo de Datos

```
  ┌─────────────────────┐
  │   CATÁLOGO          │  oe_catalog_resource
  │   (recurso hoja)    │
  │                     │
  │  base_price  ──────────→ se usa para unit_cost (columna) ─── sincronizado vía eventos
  │  min_price   ──────────→ se lee en vivo al expandir
  │  max_price   ──────────→ se lee en vivo al expandir
  │  currency             → se muestra como referencia
  │                     │
  │  specifications ───────→ JSON con campos tipo-específicos:
  │    .description         → Especificaciones (editable en panel)
  │    .waste_pct           → % Desperdicio (editable, guarda en metadata)
  │    .images[] ──────────→ Imágenes (click → popup lightbox)
  │    .datasheets[] ──────→ Fichas técnicas (click → descarga)
  └─────────────────────┘
          │
          │  GET /api/v1/catalog/{catalog_resource_id}
          │  (solo cuando detailsOpen === true)
          ▼
  ┌─────────────────────┐
  │   PARTIDA            │  oe_assemblies_component
  │   (componente)       │
  │                     │
  │  catalog_resource_id  → FK al catálogo
  │  unit_cost            → precio unitario (sincronizado)
  │  metadata_ (JSON)     → snapshot + campos editables:
  │    .waste_pct          → editable por usuario
  │    .description        → editable por usuario
  │    ._catalog_base_price
  │    ._catalog_min_price
  │    ._catalog_max_price
  │    ._catalog_category
  └─────────────────────┘
```

### Reglas de sincronización

| Campo | Origen primario | ¿Se sincroniza? | ¿Editable en panel? |
|-------|:---:|:---:|:---:|
| `unit_cost` | `catalog.base_price` | ✅ Evento automático | ✅ En fila principal |
| `% Desperdicio` | `catalog.spec.waste_pct` | ❌ Solo al añadir | ✅ En panel (guarda a `metadata`) |
| `Especificaciones` | `catalog.spec.description` | ❌ Solo al añadir | ✅ En panel (guarda a `metadata`) |
| `Precio mínimo` | `catalog.min_price` | ✅ Fetch en vivo | ❌ Solo lectura |
| `Precio máximo` | `catalog.max_price` | ✅ Fetch en vivo | ❌ Solo lectura |
| `Imágenes` | `catalog.spec.images[]` | ✅ Fetch en vivo | ❌ Solo lectura (popup) |
| `Fichas Técnicas` | `catalog.spec.datasheets[]` | ✅ Fetch en vivo | ❌ Solo lectura (download) |

---

## 3. Query en vivo

Cada `ComponentRow` ejecuta este hook al abrir el panel (`detailsOpen`):

```typescript
const { data: catalogLive } = useQuery<CatalogResourceItem | null>({
  queryKey: ['catalog-live', component.catalog_resource_id],
  queryFn: async () => {
    if (!component.catalog_resource_id) return null;
    return await apiGet<CatalogResourceItem>(
      `/v1/catalog/${component.catalog_resource_id}`,
    );
  },
  enabled: detailsOpen && !!component.catalog_resource_id,
  staleTime: 30_000,
});
```

Variables derivadas (con fallback al `metadata`):

```typescript
const liveSpecs = (catalogLive?.specifications ?? {}) as Record<string, unknown>;
const liveWastePct = (liveSpecs.waste_pct as number) ?? (meta.waste_pct as number);
const liveBasePrice = catalogLive?.base_price ?? (meta._catalog_base_price as number);
const liveMinPrice = catalogLive?.min_price ?? (meta._catalog_min_price as number);
const liveMaxPrice = catalogLive?.max_price ?? (meta._catalog_max_price as number);
const liveDescription = (liveSpecs.description as string) ?? (meta.description as string) ?? '';
const liveImages = (liveSpecs.images as Array<{ name: string; dataUrl: string }>) ?? [];
const liveDatasheets = (liveSpecs.datasheets as Array<{ name: string; dataUrl: string }>) ?? [];
const liveCurrency = catalogLive?.currency ?? 'PEN';
```

---

## 4. Estructura del Panel — MATERIAL (ya implementado)

```tsx
{resType === 'material' && (
  <>
    {/* Fila 1: % Desperdicio editable + Precios solo lectura */}
    <DetailField  // editable number
      label="% Desperdicio"
      type="number"
      value={liveWastePct ?? ''}
      onCommit={(v) => patchMeta('waste_pct', v)}
    />
    <ReadOnlyField label="Precio mínimo"
      value={liveMinPrice ? `${Number(liveMinPrice).toFixed(2)} ${liveCurrency}` : '—'} />
    <ReadOnlyField label="Precio máximo"
      value={liveMaxPrice ? `${Number(liveMaxPrice).toFixed(2)} ${liveCurrency}` : '—'} />

    {/* Fila 2: Especificaciones editable */}
    <DetailField  // editable text
      label="Especificaciones"
      type="text"
      value={liveDescription ?? ''}
      onCommit={(v) => patchMeta('description', v)}
      span="sm:col-span-2"
    />

    {/* Imágenes: click → popup lightbox */}
    {liveImages.length > 0 && (
      <div className="block sm:col-span-2">
        <div className="label">Imágenes</div>
        <div className="flex flex-wrap gap-1">
          {liveImages.map(img => (
            <img src={img.dataUrl} onClick={() => setImageModal(img.dataUrl)}
                 className="h-14 w-14 ... cursor-pointer hover:opacity-80" />
          ))}
        </div>
      </div>
    )}

    {/* Fichas Técnicas: click → descarga */}
    {liveDatasheets.length > 0 && (
      <div className="block sm:col-span-2">
        <div className="label">Fichas Técnicas</div>
        <div className="space-y-0.5">
          {liveDatasheets.map(ds => (
            <button onClick={() => handleDownloadDatasheet(ds)}
                    className="text-xs text-oe-blue hover:underline">
              📄 {ds.name}
            </button>
          ))}
        </div>
      </div>
    )}
  </>
)}
```

### Componentes usados

| Componente | Props | Uso |
|-----------|-------|-----|
| `<DetailField>` | `label, type, value, onCommit, hint?, span?` | Campo editable (number o text). `onCommit` llama a `patchMeta(clave, valor)` |
| `<ReadOnlyField>` | `label, value, span?` | Campo solo lectura (badge gris) |
| `<img>` con `onClick` | `src, alt, className, onClick` | Thumbnail clickable → `setImageModal(dataUrl)` |

### Estados globales en ComponentRow

```typescript
const [detailsOpen, setDetailsOpen] = useState(false);
const [imageModal, setImageModal] = useState<string | null>(null);

const handleDownloadDatasheet = (ds: { name: string; dataUrl: string }) => {
  const a = document.createElement('a');
  a.href = ds.dataUrl;
  a.download = ds.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};
```

### Modal de imagen (al final del return, justo antes de `</>`)

```tsx
{imageModal && (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 cursor-pointer"
       onClick={() => setImageModal(null)}>
    <img src={imageModal} alt="Preview"
         className="max-h-[85vh] max-w-[90vw] rounded-lg shadow-2xl object-contain"
         onClick={(e) => e.stopPropagation()} />
  </div>
)}
```

---

## 5. Plantilla para replicar en OTROS TIPOS

### 5.1 `labor` (Mano de obra)

| Campo en panel | Tipo | Origen catálogo | Metadata key | Editable |
|---------------|------|----------------|-------------|:---:|
| % Beneficios sociales | number | `specs.burden_pct` | `burden_pct` | ✅ |
| Jornal diario | number | `specs.daily_wage` | `daily_wage` | ✅ |
| Rol | text | `specs.labor_role` | `labor_role` | ✅ |
| Especificaciones | text | `specs.description` | `description` | ✅ |
| Precio mínimo | readonly | `min_price` | `_catalog_min_price` | ❌ |
| Precio máximo | readonly | `max_price` | `_catalog_max_price` | ❌ |
| Imágenes | popup | `specs.images[]` | — | ❌ |
| Fichas Técnicas | download | `specs.datasheets[]` | — | ❌ |

Variables live necesarias:

```typescript
const liveBurdenPct = (liveSpecs.burden_pct as number) ?? (meta.burden_pct as number);
const liveDailyWage = (liveSpecs.daily_wage as number) ?? (meta.daily_wage as number);
const liveLaborRole = (liveSpecs.labor_role as string) ?? (meta.labor_role as string) ?? '';
```

Sección labor:

```tsx
{resType === 'labor' && (
  <>
    <DetailField label="% Beneficios sociales" type="number"
      value={liveBurdenPct ?? ''} onCommit={(v) => patchMeta('burden_pct', v)} />
    <DetailField label="Jornal diario (S/)" type="number"
      value={liveDailyWage ?? ''} onCommit={(v) => patchMeta('daily_wage', v)} />
    <DetailField label="Rol" type="text"
      value={liveLaborRole} onCommit={(v) => patchMeta('labor_role', v)} />
    <ReadOnlyField label="Precio mínimo"
      value={liveMinPrice ? `${Number(liveMinPrice).toFixed(2)} ${liveCurrency}` : '—'} />
    <ReadOnlyField label="Precio máximo"
      value={liveMaxPrice ? `${Number(liveMaxPrice).toFixed(2)} ${liveCurrency}` : '—'} />
    <DetailField label="Especificaciones" type="text" span="sm:col-span-2"
      value={liveDescription} onCommit={(v) => patchMeta('description', v)} />
    {/* Imágenes + Fichas (igual que material) */}
  </>
)}
```

### 5.2 `equipment` (Equipo)

| Campo en panel | Tipo | Origen catálogo | Metadata key | Editable |
|---------------|------|----------------|-------------|:---:|
| Combustible/hora | number | `specs.fuel_cost_per_hour` | `fuel_cost_per_hour` | ✅ |
| Valor adquisición | number | `specs.acquisition_value` | `acquisition_value` | ✅ |
| Vida útil (años) | number | `specs.useful_life_years` | `useful_life_years` | ✅ |
| % Mantenimiento | number | `specs.maintenance_pct` | `maintenance_pct` | ✅ |
| Especificaciones | text | `specs.description` | `description` | ✅ |
| Precio mínimo | readonly | `min_price` | `_catalog_min_price` | ❌ |
| Precio máximo | readonly | `max_price` | `_catalog_max_price` | ❌ |
| Imágenes | popup | `specs.images[]` | — | ❌ |
| Fichas Técnicas | download | `specs.datasheets[]` | — | ❌ |

Variables live necesarias:

```typescript
const liveFuelPerHour = (liveSpecs.fuel_cost_per_hour as number) ?? (meta.fuel_cost_per_hour as number);
const liveAcqValue = (liveSpecs.acquisition_value as number) ?? (meta.acquisition_value as number);
const liveLifeYears = (liveSpecs.useful_life_years as number) ?? (meta.useful_life_years as number);
const liveMaintPct = (liveSpecs.maintenance_pct as number) ?? (meta.maintenance_pct as number);
```

### 5.3 `operator` (Operador)

| Campo en panel | Tipo | Origen | Metadata key | Editable |
|---------------|------|--------|-------------|:---:|
| % Beneficios | number | `specs.burden_pct` | `burden_pct` | ✅ |
| Jornal diario | number | `specs.daily_wage` | `daily_wage` | ✅ |
| Especificaciones | text | `specs.description` | `description` | ✅ |
| Precio mín/máx | readonly | `min/max_price` | — | ❌ |
| Imágenes + Fichas | popup/dl | `specs.images/datasheets` | — | ❌ |

> Similar a `labor` pero sin `labor_role` (no tiene cuadrilla).

### 5.4 `subcontractor` (Subcontratista)

| Campo en panel | Tipo | Origen | Metadata key | Editable |
|---------------|------|--------|-------------|:---:|
| Especificaciones | text | `specs.description` | `description` | ✅ |
| Precio mín/máx | readonly | `min/max_price` | — | ❌ |
| Imágenes + Fichas | popup/dl | `specs.images/datasheets` | — | ❌ |

> El más simple. Solo specs + precios + media.

### 5.5 `overhead` (Gastos Generales)

| Campo en panel | Tipo | Origen | Metadata key | Editable |
|---------------|------|--------|-------------|:---:|
| Especificaciones | text | `specs.description` | `description` | ✅ |
| Precio mín/máx | readonly | `min/max_price` | — | ❌ |
| Imágenes + Fichas | popup/dl | `specs.images/datasheets` | — | ❌ |

> Similar a subcontractor.

---

## 6. Checklist de implementación por tipo

### 📋 `labor`

- [ ] Agregar variables `liveBurdenPct`, `liveDailyWage`, `liveLaborRole`
- [ ] Reemplazar sección `{resType === 'labor' && (` actual
- [ ] Quitar `Vendor`, `Crew size`, `Productivity`, `Median price` viejos
- [ ] Agregar `% Beneficios sociales`, `Jornal diario`, `Rol`
- [ ] Agregar `Precio mínimo`, `Precio máximo` (solo lectura)
- [ ] Agregar `Especificaciones` (editable)
- [ ] Agregar `Imágenes` + `Fichas Técnicas`
- [ ] Quitar `Notes` para labor (ya se hizo condicional `resType !== 'material'`, extender a `resType !== 'material' && resType !== 'labor'`)

### 📋 `equipment`

- [ ] Agregar variables `liveFuelPerHour`, `liveAcqValue`, `liveLifeYears`, `liveMaintPct`
- [ ] Reemplazar sección `{resType === 'equipment' && (` actual
- [ ] Quitar `Rental days`, `Hourly rate`, `Fuel / day`, `Machine class`, `Elec. kWh/hr`
- [ ] Agregar `Combustible/hora`, `Valor adquisición`, `Vida útil`, `% Mantenimiento`
- [ ] Agregar `Precio mínimo`, `Precio máximo` (solo lectura)
- [ ] Agregar `Especificaciones` (editable)
- [ ] Agregar `Imágenes` + `Fichas Técnicas`
- [ ] Extender condición de `Notes`

### 📋 `operator`

- [ ] Agregar variables live necesarias
- [ ] Reemplazar sección actual
- [ ] Campos: `% Beneficios`, `Jornal diario`, `Especificaciones`, `Precio mín/máx`, `Imágenes`, `Fichas`
- [ ] Extender condición de `Notes`

### 📋 `subcontractor` y `overhead`

- [ ] Campos: `Especificaciones`, `Precio mín/máx`, `Imágenes`, `Fichas`
- [ ] Extender condición de `Notes`

---

## 7. Notas para Notes

La condición actual es:

```tsx
{resType !== 'material' && (
  <DetailField label="Notes" ... />
)}
```

Al replicar a otros tipos, extender:

```tsx
{resType !== 'material' && resType !== 'labor' && resType !== 'equipment'
 && resType !== 'operator' && resType !== 'subcontractor' && resType !== 'overhead' && (
  <DetailField label="Notes" ... />
)}
```

O más limpio: simplemente eliminar el bloque de Notes definitivamente y que cada
tipo tenga su propio campo de notas si lo necesita.

---

> **Documento generado para el proyecto ERP-DEEP.**
> Basado en la implementación de la Fase 1 (Material) en `AssemblyEditorPage.tsx`.
