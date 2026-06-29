-- =============================================================================
-- DWG Takeoff (oe_dwg_takeoff) — DDL estructurado (PostgreSQL)
-- Derivado de backend/app/modules/dwg_takeoff/models.py (NO copiado de migración).
-- GUID() del ORM = uuid; JSON del ORM = jsonb; metadata_ del ORM = columna "metadata".
-- Numeric(18,6) en medidas y Numeric(10,6) en escalas/grosor: evitan deriva de float
-- al acumular cantidades en los totales del BOQ.
-- =============================================================================

-- 1) PLANO DWG/DXF SUBIDO -----------------------------------------------------
CREATE TABLE oe_dwg_takeoff_drawing (
    id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id        uuid          NOT NULL REFERENCES oe_projects_project(id) ON DELETE CASCADE,
    name              varchar(500)  NOT NULL,
    filename          varchar(500)  NOT NULL,
    file_format       varchar(10)   NOT NULL DEFAULT 'dxf',          -- dxf | dwg
    file_path         varchar(1000) NOT NULL,
    size_bytes        integer       NOT NULL DEFAULT 0,
    status            varchar(50)   NOT NULL DEFAULT 'uploaded',     -- uploaded|processing|ready|empty|needs_conversion|error
    discipline        varchar(100),
    sheet_number      varchar(100),
    thumbnail_key     varchar(500),
    error_message     text,
    scale_denominator numeric(10,6) NOT NULL DEFAULT 1.0,            -- 1.0 = unidades DXF crudas (metros); 50 = 1:50
    scale_mode        varchar(30)   NOT NULL DEFAULT 'preset',       -- preset | calibrated | per_annotation
    metadata          jsonb         NOT NULL DEFAULT '{}',
    created_by        varchar(255)  NOT NULL DEFAULT '',
    created_at        timestamptz   NOT NULL DEFAULT now(),
    updated_at        timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX ix_oe_dwg_takeoff_drawing_project_id ON oe_dwg_takeoff_drawing(project_id);
CREATE INDEX ix_dwg_drawing_project_status        ON oe_dwg_takeoff_drawing(project_id, status);

-- 2) VERSIÓN PARSEADA (capas + entidades extraídas) ---------------------------
CREATE TABLE oe_dwg_takeoff_drawing_version (
    id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    drawing_id     uuid         NOT NULL REFERENCES oe_dwg_takeoff_drawing(id) ON DELETE CASCADE,
    version_number integer      NOT NULL DEFAULT 1,
    layers         jsonb        NOT NULL DEFAULT '[]',               -- [{name,color,visible,entity_count}]
    entities_key   varchar(500),                                    -- ruta al blob de entidades en disco
    entity_count   integer      NOT NULL DEFAULT 0,
    extents        jsonb        NOT NULL DEFAULT '{}',               -- bounding box del dibujo
    units          varchar(50),                                     -- mm|cm|m|inches|feet ($INSUNITS)
    status         varchar(50)  NOT NULL DEFAULT 'processing',      -- processing | ready
    metadata       jsonb        NOT NULL DEFAULT '{}',
    created_at     timestamptz  NOT NULL DEFAULT now(),
    updated_at     timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_oe_dwg_takeoff_drawing_version_drawing_id ON oe_dwg_takeoff_drawing_version(drawing_id);

-- 3) ANOTACIÓN / MEDICIÓN DEL USUARIO -----------------------------------------
-- Los 3 cross-links (boq/task/punch) son varchar(255) SIN FK (acoplamiento laxo).
CREATE TABLE oe_dwg_takeoff_annotation (
    id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id             uuid          NOT NULL REFERENCES oe_projects_project(id) ON DELETE CASCADE,
    drawing_id             uuid          NOT NULL REFERENCES oe_dwg_takeoff_drawing(id) ON DELETE CASCADE,
    drawing_version_id     uuid          REFERENCES oe_dwg_takeoff_drawing_version(id) ON DELETE SET NULL,
    annotation_type        varchar(50)   NOT NULL,                  -- text_pin|arrow|rectangle|distance|area|circle|polyline|line
    geometry               jsonb         NOT NULL DEFAULT '{}',     -- {points:[[x,y]], radius?, ...}
    text                   text,
    color                  varchar(20)   NOT NULL DEFAULT '#3b82f6',
    line_width             integer       NOT NULL DEFAULT 2,        -- legacy entero
    thickness              numeric(10,6) NOT NULL DEFAULT 2.0,      -- grosor fraccionable (px lógicos)
    layer_name             varchar(100)  NOT NULL DEFAULT 'USER_MARKUP',
    measurement_value      numeric(18,6),
    measurement_unit       varchar(20),                             -- m | m2 ...
    scale_override         numeric(10,6),                           -- escala propia (detalle a otra escala en la misma lámina)
    linked_boq_position_id varchar(255),                            -- → BOQ (sin FK)
    linked_task_id         varchar(255),                            -- → Schedule (sin FK)
    linked_punch_item_id   varchar(255),                            -- → Punchlist (sin FK)
    created_by             varchar(255)  NOT NULL DEFAULT '',
    metadata               jsonb         NOT NULL DEFAULT '{}',
    created_at             timestamptz   NOT NULL DEFAULT now(),
    updated_at             timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX ix_oe_dwg_takeoff_annotation_project_id ON oe_dwg_takeoff_annotation(project_id);
CREATE INDEX ix_oe_dwg_takeoff_annotation_drawing_id ON oe_dwg_takeoff_annotation(drawing_id);
CREATE INDEX ix_oe_dwg_takeoff_annotation_version_id ON oe_dwg_takeoff_annotation(drawing_version_id);
CREATE INDEX ix_dwg_annotation_drawing_type          ON oe_dwg_takeoff_annotation(drawing_id, annotation_type);
CREATE INDEX ix_dwg_annotation_linked_task           ON oe_dwg_takeoff_annotation(linked_task_id);
CREATE INDEX ix_dwg_annotation_linked_punch          ON oe_dwg_takeoff_annotation(linked_punch_item_id);

-- 4) GRUPO DE ENTIDADES GUARDADO (RFC 11) -------------------------------------
CREATE TABLE oe_dwg_entity_group (
    id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    drawing_id uuid         NOT NULL REFERENCES oe_dwg_takeoff_drawing(id) ON DELETE CASCADE,
    name       varchar(200) NOT NULL,
    entity_ids jsonb        NOT NULL DEFAULT '[]',                  -- bag de ids de entidad
    metadata   jsonb        NOT NULL DEFAULT '{}',
    created_by varchar(255) NOT NULL DEFAULT '',
    created_at timestamptz  NOT NULL DEFAULT now(),
    updated_at timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_dwg_entity_group_drawing ON oe_dwg_entity_group(drawing_id);

-- =============================================================================
-- RELACIONES
--   oe_projects_project (1) ──CASCADE── (N) oe_dwg_takeoff_drawing
--   oe_dwg_takeoff_drawing (1) ──CASCADE── (N) oe_dwg_takeoff_drawing_version
--   oe_dwg_takeoff_drawing (1) ──CASCADE── (N) oe_dwg_takeoff_annotation
--   oe_dwg_takeoff_drawing_version (1) ──SET NULL── (N) oe_dwg_takeoff_annotation
--   oe_dwg_takeoff_drawing (1) ──CASCADE── (N) oe_dwg_entity_group
-- LINKS LÓGICOS sin FK (acoplamiento laxo, varchar):
--   annotation.linked_boq_position_id  ──▶ oe_boq_position.id        (módulo BOQ)
--   annotation.linked_task_id          ──▶ actividad de cronograma    (módulo Schedule)
--   annotation.linked_punch_item_id    ──▶ punch item                 (módulo Punchlist)
-- El evento boq.position.deleted limpia linked_boq_position_id colgante (events.py).
-- =============================================================================
