# Checklist — Nueva funcionalidad en PDF Takeoff

- [ ] Leer `modules/pdf-takeoff/index.md` + el doc del área (ui/api/logic…).
- [ ] ¿Nueva herramienta? → definir tipo, recompute server-side, formato de `label`,
      grupo/anotación, atajo, botón en toolbar.
- [ ] ¿Nuevo endpoint? → permiso + IDOR + schema + recompute + tabla.
- [ ] ¿Nueva acción UI? → botón documentado (plantilla), handler, feedback (toast), i18n.
- [ ] Persistencia: respetar clave por nombre + dual-key; setters estables.
- [ ] Borrados/undo coherentes con servidor.
- [ ] Tests (vitest) + typecheck.
- [ ] Actualizar SYSTEM-INDEX, KNOWLEDGE-GRAPH, CHANGELOG y el doc del área.
