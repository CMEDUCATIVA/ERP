# Template: Documentación de Workflow

> Usar para documentar flujos completos. Copiar a `docs/workflows/<nombre>.md`.

## WF-XX: <Nombre del Workflow>

### Descripción

<Qué flujo de negocio describe>

### Actores

- <Actor 1>
- <Actor 2>

### Precondiciones

- <Condición 1>

### Diagrama de flujo

```
INICIO
  │
  ▼
[Paso 1: <descripción>]
  │  <API call, acción de usuario, etc.>
  ▼
[Paso 2: <descripción>]
  │
  ├── Rama A: <condición>
  │     └── <resultado>
  │
  └── Rama B: <condición>
        └── <resultado>
  ▼
FIN
```

### Postcondiciones

- <Qué queda en la base de datos>
- <Qué ve el usuario>

### Puntos de fallo

| Paso | Posible error | Manejo |
|---|---|---|
| <paso> | <error> | <cómo se maneja> |
