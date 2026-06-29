-- =============================================================================
-- BIM Hub (oe_bim_hub) — DDL estructurado (PostgreSQL)
-- Derivado de backend/app/modules/bim_hub/models.py (NO copiado de migración).
-- GUID()=uuid; JSON=jsonb; metadata_ del ORM = columna "metadata".
-- Geometría (GLB/DAE), elements.parquet y el CAD original NO van en BD (ver file_storage.py).
-- =============================================================================

-- 1) MODELO BIM/CAD ------------------------------------------------------------
CREATE TABLE oe_bim_model (
    id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          uuid         NOT NULL,
    name                varchar(255) NOT NULL,
    discipline          varchar(50),
    model_format        varchar(20),                       -- rvt|ifc|… (dwg/dxf/dgn se filtran del visor 3D)
    version             varchar(20)  NOT NULL DEFAULT '1',
    import_date         varchar(40),
    status              varchar(50)  NOT NULL DEFAULT 'processing',
    element_count       integer      NOT NULL DEFAULT 0,
    storey_count        integer      NOT NULL DEFAULT 0,
    bounding_box        jsonb,
    original_file_id    varchar(36),
    canonical_file_path varchar(500),
    parent_model_id     uuid         REFERENCES oe_bim_model(id) ON DELETE SET NULL,   -- versionado
    error_message       text,
    created_by          uuid,
    metadata            jsonb        NOT NULL DEFAULT '{}',
    created_at          timestamptz  NOT NULL DEFAULT now(),
    updated_at          timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_bim_model_project_id ON oe_bim_model(project_id);
CREATE INDEX ix_bim_model_parent     ON oe_bim_model(parent_model_id);

-- 2) ELEMENTO + REGISTRO DE ACTIVOS -------------------------------------------
CREATE TABLE oe_bim_element (
    id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id         uuid          NOT NULL REFERENCES oe_bim_model(id) ON DELETE CASCADE,
    stable_id        varchar(255)  NOT NULL,               -- GUID IFC / ElementId Revit
    element_type     varchar(100),                         -- IfcWall, IfcSlab…
    name             varchar(500),
    storey           varchar(255),
    discipline       varchar(50),
    properties       jsonb         NOT NULL DEFAULT '{}',
    quantities       jsonb         NOT NULL DEFAULT '{}',   -- canónico SI: area_m2, volume_m3, length_m, weight_kg, count
    geometry_hash    varchar(64),                          -- SHA-256 de vértices redondeados
    bounding_box     jsonb,
    mesh_ref         varchar(500),                         -- id de nodo COLLADA/GLB
    lod_variants     jsonb,
    metadata         jsonb         NOT NULL DEFAULT '{}',
    asset_info       jsonb         NOT NULL DEFAULT '{}',   -- manufacturer, serial, warranty_until…
    is_tracked_asset boolean       NOT NULL DEFAULT false,  -- filtra /assets
    created_at       timestamptz   NOT NULL DEFAULT now(),
    updated_at       timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX ix_bim_element_model_id      ON oe_bim_element(model_id);
CREATE INDEX ix_bim_element_model_stable  ON oe_bim_element(model_id, stable_id);
CREATE INDEX ix_bim_element_element_type  ON oe_bim_element(element_type);
CREATE INDEX ix_bim_element_storey        ON oe_bim_element(storey);
CREATE INDEX ix_bim_element_discipline    ON oe_bim_element(discipline);
CREATE INDEX ix_bim_element_tracked       ON oe_bim_element(is_tracked_asset);

-- 3) VÍNCULO ELEMENTO ↔ PARTIDA BOQ -------------------------------------------
CREATE TABLE oe_bim_boq_link (
    id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    boq_position_id  uuid         NOT NULL,                 -- → oe_boq_position (sin FK formal)
    bim_element_id   uuid         NOT NULL REFERENCES oe_bim_element(id) ON DELETE CASCADE,
    link_type        varchar(50)  NOT NULL DEFAULT 'manual',-- manual|rule|auto
    confidence       varchar(10),                          -- high|medium|low
    rule_id          varchar(100),
    created_by       uuid,
    metadata         jsonb        NOT NULL DEFAULT '{}',
    created_at       timestamptz  NOT NULL DEFAULT now(),
    updated_at       timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_bim_boq_link_pos_elem UNIQUE (boq_position_id, bim_element_id)
);
CREATE INDEX ix_bim_boq_link_position ON oe_bim_boq_link(boq_position_id);
CREATE INDEX ix_bim_boq_link_element  ON oe_bim_boq_link(bim_element_id);

-- 4) REGLA DE CANTIDAD (BIM→BOQ) ----------------------------------------------
CREATE TABLE oe_bim_quantity_map (
    id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id             uuid,
    project_id         uuid,
    name               varchar(255) NOT NULL,
    name_translations  jsonb,
    element_type_filter varchar(100),                      -- IfcClass o '*'
    property_filter    jsonb,
    quantity_source    varchar(100) NOT NULL,              -- area_m2|volume_m3|property:xxx|count
    multiplier         varchar(20)  NOT NULL DEFAULT '1',  -- Decimal>0, finito, ≤1e15
    unit               varchar(20),
    waste_factor_pct   varchar(10)  NOT NULL DEFAULT '0',  -- 0..100
    boq_target         jsonb,                              -- {position_id}|{position_ordinal}|{auto_create}
    is_active          boolean      NOT NULL DEFAULT true,
    metadata           jsonb        NOT NULL DEFAULT '{}',
    created_at         timestamptz  NOT NULL DEFAULT now(),
    updated_at         timestamptz  NOT NULL DEFAULT now()
);

-- 5) DIFF ENTRE VERSIONES (cacheado) ------------------------------------------
CREATE TABLE oe_bim_model_diff (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    old_model_id  uuid        NOT NULL REFERENCES oe_bim_model(id) ON DELETE CASCADE,
    new_model_id  uuid        NOT NULL REFERENCES oe_bim_model(id) ON DELETE CASCADE,
    diff_summary  jsonb       NOT NULL,                     -- {unchanged, modified, added, deleted}
    diff_details  jsonb,
    metadata      jsonb       NOT NULL DEFAULT '{}',
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_bim_model_diff_pair UNIQUE (old_model_id, new_model_id)
);
CREATE INDEX ix_bim_model_diff_old ON oe_bim_model_diff(old_model_id);
CREATE INDEX ix_bim_model_diff_new ON oe_bim_model_diff(new_model_id);

-- 6) GRUPO DE ELEMENTOS (selección guardada) ----------------------------------
CREATE TABLE oe_bim_element_group (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      uuid         NOT NULL,
    model_id        uuid         REFERENCES oe_bim_model(id) ON DELETE CASCADE,  -- NULL = todo el proyecto
    name            varchar(255) NOT NULL,
    description     text,
    is_dynamic      boolean      NOT NULL DEFAULT true,     -- true→recalcula de filter_criteria
    filter_criteria jsonb        NOT NULL DEFAULT '{}',
    element_ids     jsonb        NOT NULL DEFAULT '[]',
    element_count   integer      NOT NULL DEFAULT 0,
    color           varchar(20),
    created_by      uuid,
    metadata        jsonb        NOT NULL DEFAULT '{}',
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_bim_element_group_project_name UNIQUE (project_id, name)
);
CREATE INDEX ix_bim_element_group_project ON oe_bim_element_group(project_id);

-- 7) FEDERACIÓN (N modelos coordinados) ---------------------------------------
CREATE TABLE oe_bim_federation (
    id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    uuid         NOT NULL,
    name          varchar(255) NOT NULL,
    description   text,
    origin_offset jsonb        NOT NULL DEFAULT '{"x":0,"y":0,"z":0}',
    shared_units  varchar(20)  NOT NULL DEFAULT 'm',
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_bim_federation_project ON oe_bim_federation(project_id);

-- 8) JOIN FEDERACIÓN ↔ MODELO (N:M) -------------------------------------------
CREATE TABLE oe_bim_federation_model (
    id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    federation_id uuid         NOT NULL REFERENCES oe_bim_federation(id) ON DELETE CASCADE,
    bim_model_id  uuid         NOT NULL REFERENCES oe_bim_model(id) ON DELETE CASCADE,
    discipline    varchar(50)  NOT NULL DEFAULT 'other',
    color_hint    varchar(20),
    visible       boolean      NOT NULL DEFAULT true,
    z_order       integer      NOT NULL DEFAULT 0,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_bim_federation_model_pair UNIQUE (federation_id, bim_model_id)
);
CREATE INDEX ix_bim_federation_model_fed   ON oe_bim_federation_model(federation_id);
CREATE INDEX ix_bim_federation_model_model ON oe_bim_federation_model(bim_model_id);

-- =============================================================================
-- Nota: oe_bim_boq_link.boq_position_id → oe_boq_position.id es un link lógico
-- (sin FK formal entre módulos). El evento boq.position.deleted no aplica aquí;
-- el cleanup de huérfanos lo hace el servicio al borrar elementos/modelos.
-- =============================================================================
