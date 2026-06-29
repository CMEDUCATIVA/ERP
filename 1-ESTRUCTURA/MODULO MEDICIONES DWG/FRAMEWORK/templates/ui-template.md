# Template: Documentación de UI

> Usar para documentar pantallas. Copiar a `docs/ui/<nombre>.md`.

## Pantalla: `/<ruta>`

### Layout

```
<diagrama ASCII de la pantalla>
```

### Estados

| Estado | Condición | UI |
|---|---|---|
| Loading | ... | Spinner |
| Empty | ... | Empty state |
| Error | ... | Error card |
| Ready | ... | Contenido normal |

### Navegación

- **Desde**: <rutas que llevan aquí>
- **Hacia**: <rutas a las que se navega desde aquí>

### Componentes principales

| Componente | Función |
|---|---|
| `<Componente>` | <qué hace> |

### Herramientas / Botones

| Botón | Acción | API llamada |
|---|---|---|
| `<Botón>` | <qué hace> | `<endpoint>` |
