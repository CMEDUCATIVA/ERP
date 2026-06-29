# Permisos y niveles de usuario — Mediciones BIM 3D

> Roles en `backend/app/core/permissions.py`. Mapa en `bim_hub/permissions.py`
> (`register_bim_hub_permissions`). Gating por `_verify_project_access`/`_verify_model_access`.

## Jerarquía de roles
`FIELD_WORKER/FOREMAN/INSPECTOR` (<0) < **VIEWER (0)** < **EDITOR (1)** < **MANAGER (2)** < **ADMIN (3)**.
Superior hereda inferior; ADMIN bypassa. Alias: `estimator/qs/user`→EDITOR, `owner/superuser`→ADMIN,
`guest/readonly`→VIEWER.

## Permiso → rol mínimo (`bim_hub/permissions.py`)
| Permiso | Rol mínimo | Cubre |
|---|---|---|
| `bim.read` | **VIEWER** | listar/ver modelos y elementos, geometría, export, diff, similar, dataframe |
| `bim.create` | **EDITOR** | subir, crear modelo/links/reglas/grupos/federaciones, aplicar reglas |
| `bim.update` | **EDITOR** | editar modelo/grupos/federaciones/assets, retry, reindex |
| `bim.delete` | **MANAGER** | borrar modelo/federación (caro de recrear: conversión + geometría) |

> Nota: `delete` exige **MANAGER** (no EDITOR) — el upload BIM es costoso de recrear.

## Matriz rol ↔ acción
| Acción | VIEWER | EDITOR | MANAGER | ADMIN |
|---|:--:|:--:|:--:|:--:|
| Ver modelos/elementos, geometría, export, diff (`bim.read`) | ✅ | ✅ | ✅ | ✅ |
| Subir, vincular a BOQ, crear reglas/grupos/federaciones (`bim.create`) | ❌ | ✅ | ✅ | ✅ |
| Editar modelo/grupos/federaciones/assets (`bim.update`) | ❌ | ✅ | ✅ | ✅ |
| Borrar modelo/federación (`bim.delete`) | ❌ | ❌ | ✅ | ✅ |

## Reglas de aplicación
- **IDOR**: todo endpoint resuelve el proyecto y verifica acceso (`_verify_project_access`); para
  recursos de modelo, `_verify_model_access`. 404 indistinguible (no enumeración de UUID).
- El permiso es **global del rol**; el acceso real se restringe **por proyecto**.
- La federación hereda la propiedad del proyecto (sin tabla de permisos propia).
- **Registro**: `register_bim_hub_permissions()` registra el mapa en el `permission_registry` al cargar.
