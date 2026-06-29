-- =============================================================================
-- PDF Takeoff (oe_takeoff) — DDL estructurado (PostgreSQL)
-- Derivado de backend/app/modules/takeoff/models.py (NO copiado de migración).
-- GUID() del ORM = uuid; JSON del ORM = jsonb. metadata_ del ORM = columna "metadata".
-- =============================================================================

-- 1) DOCUMENTO PDF -------------------------------------------------------------
CREATE TABLE oe_takeoff_document (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    filename        varchar(500)  NOT NULL,
    pages           integer       NOT NULL DEFAULT 0,
    size_bytes      integer       NOT NULL DEFAULT 0,
    content_type    varchar(100)  NOT NULL DEFAULT 'application/pdf',
    status          varchar(50)   NOT NULL DEFAULT 'uploaded',
    project_id      uuid          REFERENCES oe_projects_project(id) ON DELETE CASCADE,   -- nullable
    owner_id        uuid          NOT NULL REFERENCES oe_users_user(id) ON DELETE CASCADE,
    file_path       varchar(1000),
    extracted_text  text          NOT NULL DEFAULT '',
    page_data       jsonb         NOT NULL DEFAULT '[]',
    analysis        jsonb         NOT NULL DEFAULT '{}',
    metadata        jsonb         NOT NULL DEFAULT '{}',
    created_at      timestamptz   NOT NULL DEFAULT now(),
    updated_at      timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX ix_oe_takeoff_document_project_id ON oe_takeoff_document(project_id);
CREATE INDEX ix_oe_takeoff_document_owner_id   ON oe_takeoff_document(owner_id);

-- 2) MEDICIÓN / ANOTACIÓN ------------------------------------------------------
-- IMPORTANTE: document_id es texto libre SIN FK (clave por filename o UUID).
CREATE TABLE oe_takeoff_measurement (
    id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id             uuid         NOT NULL REFERENCES oe_projects_project(id) ON DELETE CASCADE,
    document_id            varchar(255),                                  -- SIN FK
    page                   integer      NOT NULL DEFAULT 1,
    type                   varchar(50)  NOT NULL,                         -- distance|polyline|area|volume|count|cloud|arrow|text|rectangle|highlight
    group_name             varchar(100) NOT NULL DEFAULT 'General',
    group_color            varchar(20)  NOT NULL DEFAULT '#3B82F6',
    annotation             varchar(500),                                  -- nombre editable
    points                 jsonb        NOT NULL DEFAULT '[]',            -- [{x,y},...]
    measurement_value      numeric,
    measurement_unit       varchar(20)  NOT NULL DEFAULT 'm',            -- m|m2|m3|pcs
    depth                  numeric,
    volume                 numeric,
    perimeter              numeric,
    count_value            integer,
    is_deduction           boolean      NOT NULL DEFAULT false,
    scale_pixels_per_unit  double precision,
    linked_boq_position_id varchar(255),
    source                 varchar(16)  NOT NULL DEFAULT 'manual',       -- manual|ai_plan_read
    confidence             double precision,
    review_status          varchar(16)  NOT NULL DEFAULT 'confirmed',    -- confirmed|proposed|rejected
    metadata               jsonb        NOT NULL DEFAULT '{}',           -- frontend_id, area, text, width, height, linked_*
    created_by             varchar(255) NOT NULL DEFAULT '',
    created_at             timestamptz  NOT NULL DEFAULT now(),
    updated_at             timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_oe_takeoff_measurement_project_id  ON oe_takeoff_measurement(project_id);
CREATE INDEX ix_oe_takeoff_measurement_document_id ON oe_takeoff_measurement(document_id);

-- 3) CORRIDA DE LECTURA DE PLANO POR IA ---------------------------------------
CREATE TABLE oe_ai_takeoff_run (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          uuid          NOT NULL REFERENCES oe_projects_project(id) ON DELETE CASCADE,
    document_id         varchar(255)  NOT NULL DEFAULT '',
    page                integer       NOT NULL DEFAULT 1,
    mode                varchar(16)   NOT NULL DEFAULT 'rooms',
    user_id             uuid          NOT NULL,
    created_by          varchar(64)   NOT NULL DEFAULT '',
    status              varchar(24)   NOT NULL DEFAULT 'queued',
    scale_pixels_per_unit double precision,
    do_cost_match       boolean       NOT NULL DEFAULT false,
    provider            varchar(40),
    model_used          varchar(120),
    total_tokens        integer       NOT NULL DEFAULT 0,
    cost_usd_estimate   double precision NOT NULL DEFAULT 0,
    duration_ms         integer       NOT NULL DEFAULT 0,
    proposal_count      integer       NOT NULL DEFAULT 0,
    accepted_count      integer       NOT NULL DEFAULT 0,
    validation_report   jsonb,
    failure_reason      varchar(255),
    metadata            jsonb         NOT NULL DEFAULT '{}',
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_at          timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX ix_ai_takeoff_run_project        ON oe_ai_takeoff_run(project_id);
CREATE INDEX ix_ai_takeoff_run_project_status ON oe_ai_takeoff_run(project_id, status);
CREATE INDEX ix_ai_takeoff_run_user           ON oe_ai_takeoff_run(user_id);
CREATE INDEX ix_ai_takeoff_run_user_created   ON oe_ai_takeoff_run(user_id, created_at);

-- 4) SESIÓN DE EXTRACCIÓN CAD (periferia compartida con CAD/BIM) ---------------
CREATE TABLE oe_takeoff_cad_session (
    id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       varchar(255)  NOT NULL UNIQUE,
    user_id          varchar(255)  NOT NULL DEFAULT '',
    filename         varchar(500)  NOT NULL,
    file_format      varchar(20)   NOT NULL,                              -- rvt|ifc|dwg|dgn
    element_count    integer       NOT NULL DEFAULT 0,
    extraction_time  double precision NOT NULL DEFAULT 0,
    elements_data    jsonb         NOT NULL DEFAULT '[]',
    columns_metadata jsonb         NOT NULL DEFAULT '{}',
    project_id       varchar(255),
    display_name     varchar(255),
    is_permanent     boolean       NOT NULL DEFAULT false,
    expires_at       timestamptz   NOT NULL,
    created_by       varchar(255)  NOT NULL DEFAULT '',
    session_ttl_days integer       DEFAULT 7,
    is_persistent    boolean       NOT NULL DEFAULT false,
    bim_model_id     varchar(36)
);
CREATE UNIQUE INDEX ix_oe_takeoff_cad_session_session_id ON oe_takeoff_cad_session(session_id);

-- =============================================================================
-- Relaciones LÓGICAS sin FK (mantener por convención):
--   oe_takeoff_measurement.document_id  ──▶  oe_takeoff_document.id::text  O  filename
--   oe_takeoff_measurement.linked_boq_position_id  ──▶  oe_boq_position.id  (módulo BOQ)
--   oe_ai_takeoff_run.document_id  ──▶  oe_takeoff_document.id::text
-- Por eso el borrado de documento NO cascada por FK a mediciones: se hace explícito
-- en TakeoffService.delete_document (por uuid Y por filename).
-- =============================================================================
