# Template: Documentación de Módulo

> Usar para cada nuevo módulo documentado. Copiar a `docs/modules/<nombre>/index.md`.

## Identidad

| Atributo | Valor |
|---|---|
| **Nombre técnico** | `oe_<nombre>` |
| **Nombre display** | <Nombre> |
| **Ruta frontend** | `/<ruta>` |
| **Categoría** | `extension|core` |
| **Dependencias** | `<lista>` |
| **Versión** | `x.y.z` |

## Objetivo

<Qué hace el módulo. Una frase.>

## Descripción

<Descripción funcional completa. Qué permite hacer al usuario.>

## Usuarios

- **<Rol>**: <Qué hace con este módulo>

## Responsabilidades

- <Responsabilidad 1>
- <Responsabilidad 2>

## Dependencias

### Internas
- `<modulo>` — <tipo de relación>

### Externas
- `<librería>` — <uso>

## Problemas que resuelve

1. <Problema 1>
2. <Problema 2>

## Riesgos

- <Riesgo 1>

## Estados

<Si el módulo tiene una máquina de estados, documentarla aquí>

## Archivos del módulo

### Backend
| Archivo | Función |
|---|---|
| `models.py` | ORM |
| `router.py` | API |
| `service.py` | Lógica |
| ... | ... |

### Frontend
| Archivo | Función |
|---|---|
| `Page.tsx` | Pantalla principal |
| `api.ts` | API calls |
| ... | ... |
