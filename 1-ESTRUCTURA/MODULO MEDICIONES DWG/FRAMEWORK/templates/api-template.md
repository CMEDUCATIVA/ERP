# Template: Documentación de API

> Usar para documentar endpoints. Copiar a `docs/api/<modulo>.md`.

## Base URL

`/v1/<modulo>/`

## Endpoints

### <Grupo de endpoints>

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `GET` | `/resource/` | `<modulo>.read` | <desc> |
| `POST` | `/resource/` | `<modulo>.create` | <desc> |

### Request/Response

#### `<Nombre del Schema>`

```json
{
  "field": "type",
  "description": "..."
}
```

## Autenticación

<Bearer token, API key, etc.>

## Rate Limiting

<Si aplica>

## Errores

| Código | Significado |
|---|---|
| 404 | Recurso no encontrado o no autorizado (IDOR) |
| 422 | Validación fallida |
| 500 | Error interno |
