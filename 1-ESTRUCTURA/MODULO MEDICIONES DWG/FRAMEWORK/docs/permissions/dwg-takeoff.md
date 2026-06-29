# Permisos y niveles de usuario — Módulo DWG Takeoff

## Niveles de usuario (jerarquía de roles)
Definida en `backend/app/core/permissions.py`. Cada permiso exige un **rol mínimo**; un rol
superior **hereda** los permisos de los inferiores. `ADMIN` siempre pasa (bypass).

| Rol | Rango | Descripción |
|---|---|---|
| `ADMIN` | 3 | Acceso total (bypass de comprobaciones) |
| `MANAGER` | 2 | Gestión de proyecto/equipo |
| `EDITOR` | 1 | Crear y modificar contenido |
| `VIEWER` | 0 | Solo lectura |
| `SITE_INSPECTOR` | <0 | QA/HSE: lee amplio, escribe poco |
| `SITE_FOREMAN` | <0 | Capataz |
| `FIELD_WORKER` | <0 | Obrero (menor confianza) |

**Alias** (`ROLE_ALIASES`): `estimator`/`quantity_surveyor`/`qs`/`user` → **EDITOR**;
`superuser`/`owner` → **ADMIN**; `readonly`/`guest` → **VIEWER**. Los roles de campo quedan
**por debajo de VIEWER** → sin acceso a DWG Takeoff salvo concesión explícita.

> **Diferencia con el módulo PDF** (`oe_takeoff`): en DWG, `delete` exige **MANAGER**; en PDF
> exige solo **EDITOR**. El resto de mínimos coincide.

## Definición

```python
permission_registry.register_module_permissions(
    "dwg_takeoff",
    {
        "dwg_takeoff.create":  Role.EDITOR,
        "dwg_takeoff.read":    Role.VIEWER,
        "dwg_takeoff.update":  Role.EDITOR,
        "dwg_takeoff.delete":  Role.MANAGER,
    },
)
```

## Matriz de permisos

| Acción | VIEWER | EDITOR | MANAGER | ADMIN |
|---|---|---|---|---|
| Ver planos y entidades | ✅ | ✅ | ✅ | ✅ |
| Ver anotaciones | ✅ | ✅ | ✅ | ✅ |
| Ver escalas | ✅ | ✅ | ✅ | ✅ |
| Subir planos | ❌ | ✅ | ✅ | ✅ |
| Crear anotaciones | ❌ | ✅ | ✅ | ✅ |
| Crear grupos | ❌ | ✅ | ✅ | ✅ |
| Vincular a BOQ | ❌ | ✅ | ✅ | ✅ |
| Actualizar escala | ❌ | ✅ | ✅ | ✅ |
| Actualizar capas | ❌ | ✅ | ✅ | ✅ |
| Editar anotaciones propias | ❌ | ✅ | ✅ | ✅ |
| Eliminar planos | ❌ | ❌ | ✅ | ✅ |
| Eliminar anotaciones | ❌ | ❌ | ✅ | ✅ |
| Eliminar grupos | ❌ | ❌ | ✅ | ✅ |

## Políticas

1. **Project-scoped**: Todo acceso está limitado al proyecto del drawing. Ver IDOR protection.
2. **Cross-module**: `POST /compare/create-variation` requiere también `variations.create`
3. **Ownership**: Las anotaciones tienen `created_by` para auditoría
4. **Viewer safety**: VIEWER puede leer pero no modificar — seguro para stakeholders externos
5. **Registro**: `register_dwg_takeoff_permissions()` (en `dwg_takeoff/permissions.py`) registra
   el mapa permiso→rol en el `permission_registry` global al cargar el módulo. Sin esa llamada,
   los permisos no existen para el RBAC.
