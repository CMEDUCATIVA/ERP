# Checklists — ERP-DEEP Context Engineering Framework

---

## 🆕 Nueva Funcionalidad (`checklists/feature.md`)

- [ ] Leer `CONTEXT-MAP.md` para cargar contexto mínimo
- [ ] Leer `docs/modules/<modulo>/index.md`
- [ ] Leer `docs/logic/<modulo>.md` (reglas que no deben romperse)
- [ ] Leer `docs/dependencies/<modulo>.md` (impacto)
- [ ] Si toca DB: Leer `docs/database/<modulo>.md`
- [ ] Si toca API: Leer `docs/api/<modulo>.md` + `docs/permissions/<modulo>.md`
- [ ] Si toca UI: Leer `docs/ui/<modulo>.md` + `docs/components/<modulo>.md`
- [ ] Implementar siguiendo `docs/coding-standards.md`
- [ ] Agregar tests (unit + e2e si aplica)
- [ ] Actualizar documentación del módulo afectado
- [ ] Actualizar `CHANGELOG.md` del framework

---

## 🐛 Bug Fix (`checklists/bug.md`)

- [ ] Leer `docs/modules/<modulo>/index.md`
- [ ] Leer `docs/logic/<modulo>.md`
- [ ] Leer `docs/workflows/<modulo>.md` (si es bug de flujo)
- [ ] Identificar causa raíz en código
- [ ] Verificar que la fix no rompe reglas de negocio documentadas
- [ ] Agregar test que reproduzca el bug y verifique la fix
- [ ] Actualizar documentación si la fix cambia comportamiento
- [ ] Actualizar `CHANGELOG.md`

---

## 🔄 Refactor (`checklists/refactor.md`)

- [ ] Leer `docs/architecture.md`
- [ ] Leer `docs/coding-standards.md`
- [ ] Leer `docs/dependencies/<modulo>.md`
- [ ] Identificar todos los consumidores del código a refactorizar
- [ ] Verificar que los contratos (API, eventos, schemas) no cambian
- [ ] Si cambian contratos: actualizar `docs/api/<modulo>.md` y `docs/events/<modulo>.md`
- [ ] Correr todos los tests existentes
- [ ] Actualizar `CHANGELOG.md`

---

## 🌐 Nueva API (`checklists/api.md`)

- [ ] Definir endpoint en `docs/api/<modulo>.md`
- [ ] Definir schema request/response (Pydantic)
- [ ] Agregar permiso en `docs/permissions/<modulo>.md`
- [ ] Implementar IDOR protection (gate helper)
- [ ] Documentar en `docs/workflows/<modulo>.md` si cambia flujos
- [ ] Tests de integración
- [ ] Actualizar `CHANGELOG.md`

---

## 🎨 Nueva Pantalla (`checklists/screen.md`)

- [ ] Leer `docs/ui/<modulo>.md`
- [ ] Documentar layout, estados, navegación
- [ ] Documentar componentes, botones, formularios
- [ ] Verificar responsive y accesibilidad
- [ ] E2E test con Playwright
- [ ] Actualizar `CHANGELOG.md`

---

## 🧩 Nuevo Componente (`checklists/component.md`)

- [ ] Leer `docs/components/<modulo>.md`
- [ ] Documentar props, eventos, estados
- [ ] Reutilizar shared/ui cuando exista
- [ ] Unit test (Vitest)
- [ ] Actualizar árbol de componentes en `docs/components/<modulo>.md`
- [ ] Actualizar `CHANGELOG.md`

---

## 🗄️ Nueva Tabla (`checklists/database.md`)

- [ ] Documentar en `docs/database/<modulo>.md`
- [ ] Columna, tipo, nullable, default, FK, índice
- [ ] Actualizar diagrama de relaciones
- [ ] Verificar impacto en dependencias (`docs/dependencies/<modulo>.md`)
- [ ] Migración con Alembic
- [ ] Actualizar `CHANGELOG.md`

---

## ⚡ Optimización (`checklists/optimization.md`)

- [ ] Identificar bottleneck (profiling)
- [ ] Leer `docs/architecture.md` y `docs/dependencies/<modulo>.md`
- [ ] Verificar que la optimización no cambia semántica
- [ ] Medir antes/después
- [ ] Actualizar documentación si cambian patrones
- [ ] Actualizar `CHANGELOG.md`
