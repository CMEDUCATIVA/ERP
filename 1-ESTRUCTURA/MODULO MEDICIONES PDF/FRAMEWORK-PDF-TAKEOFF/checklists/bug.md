# Checklist — Bug en PDF Takeoff

- [ ] Clasificar: ¿render / estado / API / persistencia / IA / permisos?
- [ ] Leer el doc según CONTEXT-MAP.
- [ ] Si es "no se ven / no guardan / reaparecen al refrescar" → revisar `useMeasurementPersistence`:
      clave por nombre, dual-key load, setters estables, `cancelled` race, reconstrucción de `label`.
- [ ] Si es borrado → confirmar que llama a `DELETE` del backend (las 3 rutas).
- [ ] Si es IA → confirmar feedback (toast), proveedor conectado, desenvolver array, fencing.
- [ ] Reproducir; añadir log temporal si hace falta (frontend→archivo vía endpoint debug, o
      log backend); leer evidencia (DB con `embedded_pg.boot(~/.openestimate)`).
- [ ] Parche pequeño; mantener JSX balanceado.
- [ ] Validar: `vitest` del hook + `typecheck` + prueba manual del workflow.
- [ ] Actualizar CHANGELOG (D-TKC-*) y el doc afectado.
