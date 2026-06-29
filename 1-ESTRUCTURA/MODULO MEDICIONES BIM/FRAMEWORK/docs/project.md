# Proyecto — contexto del módulo BIM 3D

Parte de **OpenConstructionERP / ERP-DEEP** (ERP de construcción open-source, personalizado por
**CMPROYECTOS BIM**). El módulo **Mediciones BIM 3D** (`oe_bim_hub`) cubre la importación,
visualización y **cuantificación 5D** de modelos BIM/CAD 3D, alimentando el presupuesto (BOQ) con
cantidades extraídas de los elementos.

- **Usuarios**: estimadores/QS, coordinadores BIM, arquitectos/ingenieros, gestores de activos.
- **Por qué existe**: medir y cuantificar directamente sobre el modelo 3D; conectar geometría ↔ costo
  (5D) y cronograma (4D); coordinar disciplinas (federaciones); gestionar activos (ISO 19650).
- **Encaje**: aguas arriba del BOQ/Costos; comparte converters DDC con DWG/PDF takeoff; complementa el
  módulo **DWG** (2D) — dwg/dxf/dgn se excluyen del visor 3D.
- **Arrancar**: backend `openconstructionerp serve --port 8000`; frontend `npm run dev`
  (http://127.0.0.1:5173). Login demo: demo@openconstructionerp.com / DemoPass1234!
