# Permisos y niveles de usuario — PDF Takeoff

> Roles en `backend/app/core/permissions.py`. Asignación del módulo en
> `backend/app/modules/takeoff/permissions.py` (`register_takeoff_permissions()`).
> Gating en `router.py` vía `RequirePermission(...)` + `verify_project_access` (IDOR).

---

## 1. Niveles de usuario (jerarquía de roles)
Cada permiso tiene un **rol mínimo**; un rol superior **hereda** todos los permisos de los
inferiores. `ADMIN` siempre pasa (bypass).

| Rol | Rango | Descripción |
|---|---|---|
| `ADMIN` | 3 | Acceso total (bypass de comprobaciones) |
| `MANAGER` | 2 | Gestión de proyecto/equipo |
| `EDITOR` | 1 | Crear y modificar contenido |
| `VIEWER` | 0 | Solo lectura |
| `SITE_INSPECTOR` | <0 | QA/HSE: lee amplio, escribe poco |
| `SITE_FOREMAN` | <0 | Capataz: firma partes de obreros |
| `FIELD_WORKER` | <0 | Obrero (menor confianza) |

**Alias de rol** (`ROLE_ALIASES`): `estimator` / `quantity_surveyor` / `qs` / `user` → **EDITOR**;
`superuser` / `owner` → **ADMIN**; `readonly` / `guest` → **VIEWER**.

## 2. Permiso → rol mínimo (módulo Takeoff)
Definido en `takeoff/permissions.py`:
| Permiso | Rol mínimo |
|---|---|
| `takeoff.read` | **VIEWER** |
| `takeoff.create` | **EDITOR** |
| `takeoff.update` | **EDITOR** |
| `takeoff.delete` | **EDITOR** |
| `variations.create` | (lo define el módulo `variations`; usado en `create-variation`) |

> Nota: a diferencia del módulo DWG (donde `delete` exige **MANAGER**), en PDF Takeoff
> `delete` solo exige **EDITOR**.

## 3. Matriz rol ↔ acción (qué puede hacer cada nivel)
| Acción (permiso) | VIEWER | EDITOR | MANAGER | ADMIN |
|---|:--:|:--:|:--:|:--:|
| Ver documentos/mediciones, exportar, comparar (`takeoff.read`) | ✅ | ✅ | ✅ | ✅ |
| Subir PDF, crear mediciones, Analizar IA, Extraer tablas (`takeoff.create`) | ❌ | ✅ | ✅ | ✅ |
| Editar/vincular a BOQ (`takeoff.update`) | ❌ | ✅ | ✅ | ✅ |
| Borrar medición/documento (`takeoff.delete`) | ❌ | ✅ | ✅ | ✅ |
| Crear variación desde compare (`variations.create`) | ❌ | depende* | depende* | ✅ |

\* `variations.create` se resuelve con el mínimo del módulo `variations` (típicamente EDITOR/MANAGER).
Los roles de campo (`field_worker`/`foreman`/`inspector`) quedan **por debajo de VIEWER** → sin
acceso a Takeoff salvo que se les conceda explícitamente.

## 4. Reglas de aplicación
- Todo endpoint de datos pasa por **`RequirePermission(perm)`** + **`verify_project_access(project_id, user)`**
  (y para documentos, `_verify_takeoff_doc_access`) — Audit B4/B5 (anti-IDOR y anti-exfiltración + cargos LLM).
- El permiso es **global del rol**; el acceso real al dato se restringe además **por proyecto**.
- El frontend no asume permisos; el backend es la autoridad.
- "Analizar con IA" exige además **proveedor LLM configurado por el usuario** (BYO key) —
  esto NO es un permiso de rol, es ajuste de IA del usuario.

## 5. Registro (recrear)
`register_takeoff_permissions()` registra el mapa permiso→rol en el `permission_registry`
global al cargar el módulo. Sin esa llamada, los permisos no existen para el RBAC.
