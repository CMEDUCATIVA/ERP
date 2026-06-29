# Formularios — PDF Takeoff

---

## F1. Calibración (`CalibrationDialog`)
Se abre tras 2 clics en modo Calibrate.
| Campo | Tipo | Validación |
|---|---|---|
| Longitud real conocida | número | > 0 |
| Unidad | select (m / ft / in) | se convierte a **metros** antes de derivar la escala |
- Resultado: `scale_pixels_per_unit` de la página (px por metro). La unidad original se
  muestra en el badge de calibración (no se pierde, pero internamente todo es métrico).

## F2. Ajuste de escala manual ("Scale")
- Presets `1:10 / 1:20 / 1:25 / 1:50` o entrada manual de ratio. Fija la escala de la página.

## F3. Editar nombre de medición (inline)
- Clic en el nombre → `<input>` inline (`editingAnnotationId`). Enter confirma
  (`commitEditAnnotation`), Esc cancela. Guarda en `annotation` (no en `label`).

## F4. Etiqueta de conteo (`countLabel`)
- Input para la **categoría** del conteo (default "Element"). Las marcas de conteo con la
  misma categoría se agrupan en una sola medición con varios puntos.

## F5. Selector "Link to BOQ" (formulario compuesto)
| Campo | Tipo | Notas |
|---|---|---|
| Proyecto | select | carga BOQs |
| BOQ | select | habilitado tras elegir proyecto; carga posiciones |
| Modo | toggle Pick existing / + Create new | |
| Búsqueda | input texto | filtra por ordinal/descripción |
| (Pick) Posición | lista clicable | avisa mismatch de unidad/dimensión |
| (Create) Descripción/Cantidad | derivadas de la medición | crea la posición |

## F6. Texto de anotación (herramienta Text)
- Input flotante posicionado en el punto del clic. Enter confirma, Esc cancela; guarda en
  `metadata.text`.
