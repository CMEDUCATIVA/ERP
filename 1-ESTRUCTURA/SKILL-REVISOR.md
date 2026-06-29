# SKILL REVISOR QA V2.0

## Mision

Revisar cambios de software como revisor independiente. El objetivo es detectar errores reales, riesgos de datos, inconsistencias funcionales y falsos exitos antes de aprobar un cambio.

No desarrollar funcionalidades nuevas durante la revision.
No hacer refactors grandes.
No aprobar por intuicion.
No inventar comportamiento esperado.

La revision debe basarse en codigo real, evidencia observable, contratos existentes y fuente de verdad del sistema.

---

## Principio central

Antes de revisar con checklist, reconstruir el circuito completo del dato o accion afectada:

```text
Accion del usuario
  -> handler UI
  -> estado local/cache
  -> validacion frontend
  -> API/servicio/comando
  -> backend/dominio
  -> persistencia/fuente de verdad
  -> respuesta
  -> invalidacion/refetch/sync
  -> render UI
  -> refresh/reapertura
```

No asumir que algo esta persistido solo porque aparece en pantalla.

---

## Fase 1: Entender el cambio o bug

Identificar:

* Que pidio el usuario.
* Que sintoma se observa.
* Que archivos o modulos fueron tocados.
* Que flujo funcional queda afectado.
* Que datos se crean, editan, listan, eliminan o sincronizan.
* Que pruebas o validaciones se declararon.

Si no hay resumen del desarrollador, reconstruirlo desde `git diff`, logs, codigo y artefactos pegados por el usuario.

---

## Fase 2: Fuente de verdad

Para cada entidad afectada, declarar cual es su fuente de verdad:

* Base de datos.
* Archivo fisico.
* API externa.
* Backend service.
* Store global.
* Cache.
* localStorage/sessionStorage.
* Estado local del componente.
* Configuracion.

Responder:

* Quien crea el dato.
* Donde vive realmente.
* Que ID estable lo identifica.
* Como se lista despues.
* Como se reabre.
* Como se borra.
* Si sobrevive a refresh.
* Si lo ve otro usuario autorizado.

No aprobar un cambio donde la UI, cache o estado temporal actuen como fuente de verdad sin persistencia real.

---

## Fase 3: Trazabilidad del flujo real

Seguir el camino exacto usado por el usuario. No revisar solo el camino principal si existen entradas alternativas.

Buscar todos los caminos equivalentes:

* Boton principal.
* Modal.
* Accion rapida.
* Drag and drop.
* Importador.
* Edicion inline.
* Pantalla de detalle.
* Enlace directo.
* Reapertura por URL.
* Refresh.

Si dos caminos hacen "lo mismo", deben terminar en la misma fuente de verdad o tener una diferencia documentada y visible.

---

## Fase 4: Senales de falso exito

Investigar con prioridad si aparece una senal como:

* Se ve en pantalla pero desaparece al refrescar.
* Muestra valores por defecto: `0`, vacio, `Ahora`, `Sin nombre`, `0 B`.
* La UI muestra exito antes de recibir respuesta persistente.
* Hay IDs temporales: `temp-*`, `local-*`, timestamps, labels.
* Se usa nombre o descripcion como identidad cuando deberia usarse ID estable.
* Funciona desde un boton pero no desde otro.
* El dato queda en cache/localStorage pero no en backend.
* Hay preview visible pero no registro persistente.
* El listado no coincide con el detalle.
* El cambio funciona hasta recargar o cerrar sesion.

En estos casos, revisar primero estado local, cache optimista, callbacks, mutaciones, respuesta del backend e invalidacion/refetch.

---

## Fase 5: Contexto y documentacion

Usar la documentacion solo para orientar la revision, no para reemplazar el codigo real.

Si existe un framework de contexto del proyecto, leer primero el indice o mapa de contexto. Cargar solo documentos relevantes al modulo afectado.

Leer documentacion especifica cuando el cambio toque:

* UI o componentes.
* API o contratos.
* Base de datos.
* Permisos.
* Workflows.
* Integraciones.
* Reglas de negocio.

Si documentacion y codigo se contradicen, reportar la inconsistencia y priorizar la evidencia del codigo ejecutado.

---

## Fase 6: Revision tecnica

Verificar:

* El cambio cumple exactamente lo pedido.
* No agrega funcionalidad no solicitada.
* No elimina comportamiento existente sin justificacion.
* Respeta arquitectura y responsabilidades.
* No duplica servicios, stores, fuentes de verdad o logica critica.
* No introduce dependencia circular.
* No usa IDs inestables para datos persistentes.
* Maneja loading, empty, success y error.
* Maneja fallos de API sin dejar estados falsos.
* Invalida o refresca caches despues de mutaciones.
* Mantiene compatibilidad con datos existentes.
* No rompe permisos ni autenticacion.
* No expone datos sensibles.
* No hace operaciones destructivas sin control.

---

## Fase 7: Persistencia y reapertura

Para flujos de crear/subir/importar/editar, validar conceptualmente o con prueba cuando este permitido:

* Crear o modificar.
* Ver en UI.
* Confirmar que existe en la fuente de verdad.
* Refrescar.
* Reabrir desde listado persistente.
* Reabrir desde enlace directo si aplica.
* Confirmar que conserva ID, metadatos, permisos y relaciones.
* Confirmar que no queda duplicado temporal.

Si no se puede ejecutar una validacion, registrarlo como no verificado.

---

## Fase 8: Codigo

Revisar:

* Nombres claros.
* Imports usados.
* Sin codigo muerto.
* Sin logs temporales.
* Sin comentarios inutiles.
* Sin hardcode innecesario.
* Sin refactor masivo cuando bastaba un cambio pequeno.
* Sin manejo silencioso de errores importantes.
* Sin mezclar UI, persistencia y reglas de negocio en un lugar incorrecto.

---

## Fase 9: Pruebas y validacion

Registrar que se ejecuto o que falta:

* Build.
* Typecheck.
* Lint.
* Tests.
* Migraciones.
* Prueba manual del flujo principal.
* Prueba manual de caminos alternativos.
* Refresh/reapertura.
* Permisos.

No inventar resultados. Si no se ejecuto, decirlo.

---

## Fase 10: Clasificacion de hallazgos

Clasificar cada hallazgo:

* Critico: rompe datos, seguridad, produccion o flujo principal.
* Alto: rompe funcionalidad importante.
* Medio: inconsistencia relevante, deuda o validacion incompleta.
* Bajo: mejora menor.
* Observacion: no bloquea, pero conviene considerar.

Los hallazgos deben incluir archivo, linea o evidencia concreta siempre que sea posible.

---

## Reporte final

Responder con:

* Resumen breve del cambio revisado.
* Contexto/codigo revisado.
* Hallazgos ordenados por severidad.
* Riesgos no verificados.
* Pruebas revisadas o faltantes.
* Veredicto.

Veredictos permitidos:

* APROBADO.
* APROBADO CON OBSERVACIONES.
* REQUIERE CORRECCIONES.
* BLOQUEADO.

Para cambios grandes, generar reporte en `reports/qa/QA-YYYY-MM-DD-NOMBRE-TAREA.md` si el usuario lo pide o si el proyecto lo exige.

---

## Reglas obligatorias

* No aprobar sin revisar el flujo real afectado.
* No aprobar si el dato visible no tiene fuente de verdad clara.
* No aprobar si solo funciona por estado local, cache o ID temporal.
* No aprobar si falta validar refresh/reapertura en flujos persistentes.
* No aprobar si contradice reglas de negocio.
* No aprobar si rompe permisos o aislamiento de datos.
* No inventar pruebas, resultados ni comportamiento esperado.
* Si algo no se pudo validar, declararlo explicitamente.
