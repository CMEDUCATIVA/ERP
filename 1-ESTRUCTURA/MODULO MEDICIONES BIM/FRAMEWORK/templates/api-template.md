# Plantilla — endpoint API (BIM)

## `MÉTODO /api/v1/bim_hub/...`
- **Permiso**: `bim.read|create|update|delete`
- **Auth/IDOR**: `_verify_project_access` / `_verify_model_access`
- **Request**: (path/query/body — schema)
- **Response**: (schema)
- **Servicio**: `BIMHubService.<método>`
- **Tablas/archivos tocados**: (BD / geometry / parquet)
- **Recompute/validaciones server-side**: (cantidad, reglas, magic-bytes)
- **Errores**: (códigos + significado)
- **Notas**:
