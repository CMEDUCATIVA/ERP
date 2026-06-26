# Skill Desarrollo IA - ERP-DEEP

Guia operativa para que una IA edite esta aplicacion correctamente, sin romper el frontend, backend, datos locales ni el flujo de desarrollo.

## 1. Objetivo del skill

Cuando trabajes en este repo, actua como ingeniero pragmatico:

- Lee primero el codigo existente antes de proponer cambios.
- Cambia solo lo necesario para resolver el problema reportado.
- Respeta patrones locales de UI, API, React Query, FastAPI y SQLAlchemy.
- No borres ni reviertas cambios del usuario.
- No ejecutes pruebas, builds, migraciones destructivas ni comandos de limpieza si el usuario lo prohibe.
- Si hay un servidor activo, no lo mates sin revisar que proceso es y por que bloquea.

## 2. Estructura clave del proyecto

Raiz:

- `arrancar_servidor.md`: guia oficial local para levantar backend y frontend.
- `frontend/`: app React + Vite + TypeScript.
- `backend/`: FastAPI + PostgreSQL embebido.
- `data/`: catalogos y datos fuente.
- `docs/`: RFCs y notas tecnicas.
- `type_material.md`: contexto funcional del panel expandible por tipo de recurso.

Rutas importantes frontend:

- `frontend/src/app/App.tsx`: rutas principales.
- `frontend/src/shared/lib/api.ts`: cliente API base.
- `frontend/src/features/catalog/CatalogPage.tsx`: catalogo de recursos.
- `frontend/src/features/catalog/CategoryCombobox.tsx`: input/combobox de categorias.
- `frontend/src/features/assemblies/AssembliesPage.tsx`: listado `/assemblies`.
- `frontend/src/features/assemblies/AssemblyLibraryPage.tsx`: libreria `/assemblies/library`.
- `frontend/src/features/assemblies/AssemblyEditorPage.tsx`: editor `/assemblies/:assemblyId`.
- `frontend/src/features/assemblies/api.ts`: tipos y cliente API de assemblies.

Rutas importantes backend:

- `backend/app/cli.py`: comando `openconstructionerp`.
- `backend/app/main.py`: arranque FastAPI, modulos y health.
- `backend/app/core/embedded_pg.py`: PostgreSQL embebido.
- `backend/app/modules/catalog/`: API y modelo del catalogo.
- `backend/app/modules/assemblies/`: API y modelo de assemblies.

## 3. Levantar servidores

Usa la guia local:

```powershell
cd "D:\1-NUBE\ALMACENAMIENTO CENTRAL\CM\1-3-CMPROYECTOS\2-INSTALACIÓN-CMPROYECTOS-ERP\ERP-main\ERP-DEEP\backend"
openconstructionerp serve --port 8000
```

```powershell
cd "D:\1-NUBE\ALMACENAMIENTO CENTRAL\CM\1-3-CMPROYECTOS\2-INSTALACIÓN-CMPROYECTOS-ERP\ERP-main\ERP-DEEP\frontend"
npm.cmd run dev
```

Notas:

- En PowerShell, `npm run dev` puede fallar por `npm.ps1` bloqueado. Usa `npm.cmd run dev`.
- Backend local: `http://127.0.0.1:8000`.
- Frontend local: `http://127.0.0.1:5173/`.
- Health: `http://127.0.0.1:8000/api/health`.
- Swagger: `http://127.0.0.1:8000/api/docs`.

Si PostgreSQL embebido falla:

- Revisa procesos antes de matar nada:

```powershell
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -match 'openconstructionerp|python|postgres|node|cmd' } |
  Select-Object ProcessId,ParentProcessId,Name,CommandLine |
  Format-List
```

- El data dir por defecto es `C:\Users\Administrador\.openestimate`.
- Si existe una copia vieja del ERP usando el mismo `pgdata`, puede bloquear el backend actual.
- Si `postmaster.pid` apunta a un PID inexistente, es stale. Renombrar `postmaster.pid` y `log` a backup es menos destructivo que borrar `pgdata`.
- No borres `C:\Users\Administrador\.openestimate\pgdata` salvo autorizacion explicita.

## 4. Reglas de edicion

Antes de editar:

- Busca con `rg`, no con busquedas lentas.
- Abre el archivo y entiende el flujo antes de tocarlo.
- Identifica si el problema es render, estado, API, cache, permisos, ruta o datos.
- Si React falla con `Rendered more hooks than during the previous render`, revisa hooks despues de returns condicionales.
- Si falla `X is not defined`, busca si el JSX usa un componente/variable no declarada.

Backup obligatorio antes de editar archivos criticos:

- Antes de modificar archivos grandes o fragiles, crea una copia dentro del workspace.
- Aplica esta regla a:
  - `.tsx`, `.ts`, `.py`, `.sql`, migraciones, schemas, routers y servicios backend.
  - archivos de mas de 300 lineas.
  - archivos que ya tengan cambios locales.
  - archivos que controlen pantallas completas como `AssemblyEditorPage.tsx`, `CatalogPage.tsx` o `App.tsx`.
- Guarda backups en `_backups/` con fecha y hora. Ejemplo:

```powershell
New-Item -ItemType Directory -Force _backups
Copy-Item frontend\src\features\assemblies\AssemblyEditorPage.tsx _backups\AssemblyEditorPage.tsx.$(Get-Date -Format "yyyyMMdd-HHmmss").bak
```

- Si no puedes crear el backup por permisos, no edites el archivo. Informa el bloqueo.
- No guardes backups fuera del workspace.
- No uses el backup como fuente de verdad sin comparar primero con el archivo actual y con Git.

Durante la edicion:

- Usa `apply_patch` para cambios manuales.
- No uses scripts temporales para reescribir grandes zonas si un parche pequeno basta.
- Nunca uses escritura completa de archivo (`write file`, `Set-Content`, redireccion `>`, scripts que regeneran todo el archivo) para archivos grandes o criticos, salvo que el usuario pida explicitamente una regeneracion completa.
- Si una herramienta bloquea el parche con `read_before_edit_required`, vuelve a leer un rango pequeno que contenga el texto exacto y reintenta con un parche mas pequeno. No escales a reescritura completa.
- No cambies estilo global ni refactorices si el bug es local.
- Mantiene componentes auxiliares cerca de donde ya existen componentes similares.
- En TypeScript, actualiza interfaces si agregas campos al payload.
- En React Query, invalida query keys relacionadas despues de crear, editar o eliminar.
- No mezcles datos de `metadata`, `specifications` y columnas directas sin fallback claro.
- En TSX, nunca cierres un bloque grande "a ojo". Antes de aplicar el parche, identifica el par exacto de apertura/cierre de:
  - `.map((x) => { return (...) })`
  - condicionales `{condition && (...)}`
  - ternarios dentro de JSX
  - fragments `<>...</>`
  - tablas: `<table>`, `<thead>`, `<tbody>`, `<tfoot>`, `<tr>`, `<td>`
- Si editas una tabla con multiples `<tbody>`, cada grupo debe devolver un `<tbody>` completo y cerrado antes de renderizar el siguiente grupo o el `<tfoot>`.
- Si agregas una prop obligatoria a un componente local, actualiza todas sus llamadas en el mismo archivo antes de terminar.

Despues de editar:

- Revisa referencias con `rg`.
- Relee 30-80 lineas alrededor del parche y verifica visualmente que JSX/TSX queda balanceado.
- Si el error original era de Vite/Babel, revisa especificamente la linea reportada y 20 lineas antes: muchos errores aparecen unas lineas despues del cierre faltante real.
- Si el archivo quedo corrupto, truncado o con una sola linea accidental, no sigas editando. Detente y compara:
  - archivo actual,
  - backup en `_backups/`,
  - version Git con `git show HEAD:ruta/del/archivo`.
- No uses `git checkout -- archivo` sin autorizacion explicita del usuario. Ese comando descarta cambios locales no commiteados.
- Si se requiere recuperar desde Git, prefiere explicar primero que se perderan cambios locales de ese archivo. Solo procede cuando el usuario confirme.
- Si el usuario permite pruebas, ejecuta el minimo necesario:

```powershell
cd frontend
npm.cmd run typecheck
```

```powershell
cd frontend
npm.cmd run build
```

Si el usuario dijo "no hagas prueba", no ejecutes tests/build. Puedes hacer lectura y revisiones estaticas.
Si el usuario dijo "no hagas verificaciones ni builds", no ejecutes `typecheck`, `build`, `test`, `lint`, `dev`, `preview` ni comandos equivalentes. Solo puedes leer archivos, usar `rg`, revisar diffs y explicar el riesgo pendiente.

## 5. Patrones frontend

Stack:

- React 18.
- TypeScript.
- Vite.
- React Query (`@tanstack/react-query`).
- Tailwind.
- `lucide-react` para iconos.
- `clsx` para clases condicionales.

API:

- Usa `apiGet`, `apiPost`, `apiPatch`, `apiPut`, `apiDelete` desde `@/shared/lib/api`.
- Las rutas frontend usan `/v1/...`; el proxy Vite las envia al backend.
- No uses `fetch` directo si ya existe helper local.

React Query:

```ts
const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: (payload) => apiPost('/v1/catalog/', payload),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['catalog'] });
  },
});
```

Hooks:

- Todos los hooks deben ejecutarse siempre en el mismo orden.
- No pongas `useMemo`, `useQuery`, `useState`, `useEffect` despues de:

```ts
if (isLoading) return ...
if (!data) return ...
```

Hazlo asi:

```ts
const items = data?.items ?? [];
const grouped = useMemo(() => group(items), [items]);

if (isLoading) return ...
if (!data) return ...
```

Inputs editables:

- Para inputs numericos que se guardan al blur, usa estado draft local.
- No conviertas a numero en cada `onChange` si el usuario necesita borrar temporalmente el valor.
- Commit en `onBlur` y `Enter`.
- Restaurar con `Escape`.

Ejemplo:

```tsx
const [draft, setDraft] = useState(String(value ?? ''));

<input
  type="number"
  value={draft}
  onChange={(e) => setDraft(e.target.value)}
  onBlur={() => onCommit(draft)}
  onKeyDown={(e) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  }}
/>
```

## 6. Catalogo y categorias

En `CatalogPage.tsx`:

- El listado principal consulta `/v1/catalog/`.
- Stats y categorias salen de `/v1/catalog/stats/`.
- El filtro de categoria debe incluir tambien la categoria activa para que no desaparezca durante refetch.
- Si se crean categorias locales sin recursos, guardarlas en `localStorage` es aceptable como puente UX, pero deben sincronizarse con backend cuando haya endpoint.
- Despues de crear, renombrar o eliminar categoria:

```ts
queryClient.invalidateQueries({ queryKey: ['catalog'] });
```

En `CategoryCombobox.tsx`:

- No ocultes acciones criticas solo en hover si el usuario necesita descubrir editar/eliminar.
- Mantiene botones de editar/eliminar accesibles y con `aria-label`.

## 7. Assemblies y recursos por tipo

Rutas:

- `/assemblies`: listado (`AssembliesPage`).
- `/assemblies/library`: libreria (`AssemblyLibraryPage`).
- `/assemblies/:assemblyId`: editor (`AssemblyEditorPage`).

Tipos validos:

```ts
type ResourceType =
  | 'material'
  | 'labor'
  | 'equipment'
  | 'operator'
  | 'subcontractor'
  | 'overhead';
```

En `AssemblyEditorPage.tsx`:

- `ComponentRow` renderiza cada componente.
- `DetailField` es editable.
- `ReadOnlyField` es solo lectura.
- Si agregas un componente JSX nuevo, define el componente o importalo.
- Si el panel expandible usa datos del catalogo, consulta en vivo solo al abrir:

```ts
const { data: catalogLive } = useQuery<CatalogResourceItem | null>({
  queryKey: ['catalog-live', component.catalog_resource_id],
  queryFn: async () => {
    if (!component.catalog_resource_id) return null;
    return apiGet<CatalogResourceItem>(`/v1/catalog/${component.catalog_resource_id}`);
  },
  enabled: detailsOpen && !!component.catalog_resource_id,
  staleTime: 30_000,
});
```

Regla de datos:

- Origen principal: `catalogLive`.
- Fallback: `component.metadata`.
- `unit_cost` viene de `catalog.base_price`.
- Min/max/currency se muestran como referencia.
- Campos editables guardan en `metadata`.

Fase 1 y fase 2 segun `type_material.md`:

- `material`: `waste_pct`, `description`, `min_price`, `max_price`, imagenes, fichas.
- `labor`: `burden_pct`, `daily_wage`, `labor_role`, `description`, precios, media.
- `equipment`: `fuel_cost_per_hour`, `acquisition_value`, `useful_life_years`, `maintenance_pct`, `description`, precios, media.
- `operator`: `burden_pct`, `daily_wage`, `description`, precios, media.
- `subcontractor`: `description`, precios, media.
- `overhead`: `description`, precios, media.

Al agregar recurso desde catalogo a una partida:

- Incluye `catalog_resource_id`.
- Copia snapshot de `specifications` a `metadata`.
- Guarda `_catalog_base_price`, `_catalog_min_price`, `_catalog_max_price`, `_catalog_category`, `_catalog_currency`, `_catalog_region`.
- Esto permite fallback si el catalogo tarda o falla.

## 8. Formulas de assemblies

Evita depender de totales persistidos obsoletos si el usuario edita factores en vivo.

Patron correcto:

- Calcular subtotal desde componentes actuales.
- Aplicar porcentajes de `metadata`.
- Aplicar `bid_factor`.
- Usar el calculo local para UI inmediata.

Si una formula no se aplica:

- Revisa si el input guarda en `metadata`.
- Revisa si el calculo lee esa misma key.
- Revisa si el total mostrado usa `assembly.total_rate` viejo en vez del calculo live.

## 9. Backend

Backend usa:

- FastAPI.
- SQLAlchemy async.
- PostgreSQL embebido por defecto.
- Alembic.
- Modulos bajo `backend/app/modules/...`.

Reglas:

- No agregues migraciones para campos que ya viven en JSON `metadata` o `specifications`.
- Si agregas columnas reales, revisa modelo, schema, router, service y migracion.
- Mantiene rutas bajo `/api/v1/...`.
- Verifica contratos con los tipos frontend si cambias payloads.
- No cambies seeds o datos demo salvo que el bug sea de seed.

Health puede salir `degraded` aunque la app funcione:

- `frontend_dist_present: false` es normal con Vite dev.
- `alembic_head_matches: false` indica desalineacion de migraciones; no ejecutar migraciones destructivas sin plan.
- `database: ok` es la senal principal de backend operativo.

## 10. Errores frecuentes y diagnostico

`ReadOnlyField is not defined`

- JSX usa un componente no declarado.
- Agrega funcion local o importa el componente.

`idx is not defined`

- Se usa `idx` dentro de `.map()` sin declararlo.
- Cambia:

```tsx
items.map((item) => ...)
```

a:

```tsx
items.map((item, idx) => ...)
```

`Rendered more hooks than during the previous render`

- Hay hooks ejecutandose solo despues de cierto render.
- Mueve hooks antes de returns condicionales.

Vite Babel syntax error

- Busca llaves dobles o cierres incompletos:
  - `mutate({{`
  - `onChange={(e) => ...` sin cerrar `}}`
  - bloques `.map()` sin cierre.
- Si el mensaje dice `Unterminated regular expression` en un `.tsx`, no asumas que hay una regex rota. Primero revisa si falta cerrar JSX justo antes de la linea marcada:
  - `.map((item) => { return (<Row />); })` debe cerrarse como `{items.map((item) => { ... })}`.
  - Si se usa `return (` dentro del `.map`, normalmente el cierre correcto cerca del final sera `);` para el `return`, luego `})}` para el `.map` dentro de JSX.
  - Un cierre incompleto como `})` antes de `</tbody>` suele hacer que Babel interprete `</tbody>` como una expresion regular.
- Antes de editar este tipo de error, copia mentalmente la pila de cierres desde la apertura:

```tsx
{groups.map((group) => {
  return (
    <tbody>
      {group.items.map((item) => {
        return <Row key={item.id} />;
      })}
    </tbody>
  );
})}
```

Categorias desaparecen

- La categoria activa no esta en el set del dropdown.
- Stats no incluyen categorias vacias.
- Falta invalidar `['catalog']`.
- Falta persistencia local o backend.

Backend no muestra datos

- Verifica backend con `/api/health`.
- Si endpoint directo da `401`, puede ser normal por auth.
- Revisa desde frontend autenticado o con token.

Servidor caido o puertos ocupados

```powershell
Get-NetTCPConnection -LocalPort 8000,5173 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess
```

## 11. UX y UI

Sigue el estilo existente:

- Botones con iconos de `lucide-react`.
- Paneles compactos, profesionales y densos.
- No agregues landing pages.
- No agregues textos explicativos largos dentro de la app.
- Usa tooltips/titles en iconos poco obvios.
- Mantiene inputs con alturas y anchos estables.
- No ocultes controles criticos si el usuario los necesita para editar/eliminar.
- Evita paletas nuevas y decoracion innecesaria.

## 12. Flujo recomendado para una IA

1. Repetir el problema en una frase concreta.
2. Buscar archivos relevantes con `rg`.
3. Leer el bloque exacto antes de tocarlo.
4. Crear backup si el archivo es critico, grande o tiene cambios locales.
5. Identificar causa probable.
6. Editar con parche pequeno.
7. Releer el bloque editado y revisar referencias con `rg`.
8. Si esta permitido, hacer verificacion minima.
9. Responder con:
   - Archivo cambiado.
   - Que se corrigio.
   - Si se creo backup y donde quedo.
   - Si se ejecuto o no verificacion.
   - URL local si aplica.

## 13. Comandos utiles

Crear backup antes de editar archivo critico:

```powershell
New-Item -ItemType Directory -Force _backups
Copy-Item frontend\src\features\assemblies\AssemblyEditorPage.tsx _backups\AssemblyEditorPage.tsx.$(Get-Date -Format "yyyyMMdd-HHmmss").bak
```

Buscar rutas:

```powershell
rg -n "/assemblies|AssemblyEditorPage|CatalogPage" frontend/src
```

Buscar errores de simbolos:

```powershell
rg -n "ReadOnlyField|idx|useMemo|useQuery" frontend/src/features/assemblies/AssemblyEditorPage.tsx
```

Ver frontend:

```powershell
cd frontend
npm.cmd run dev
```

Typecheck si esta permitido:

```powershell
cd frontend
npm.cmd run typecheck
```

Backend:

```powershell
cd backend
openconstructionerp serve --port 8000
```

Health:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/health | ConvertTo-Json -Depth 4
```

## 14. Regla final

La prioridad es mantener el ERP usable. Si un cambio arregla una pantalla pero rompe el arranque, el contrato API o la persistencia de datos, no esta terminado. Haz cambios pequenos, verifica lo justo y deja claro cualquier riesgo pendiente.
