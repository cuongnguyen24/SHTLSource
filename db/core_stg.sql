-- Core_Stg
CREATE SCHEMA IF NOT EXISTS core_stg;

CREATE TABLE IF NOT EXISTS core_stg.document_folders (
    id          BIGSERIAL PRIMARY KEY,
    channel_id  INT NOT NULL,
    parent_id   BIGINT NOT NULL DEFAULT 0,
    name        VARCHAR(255) NOT NULL,
    code        VARCHAR(100) NULL,
    describe    TEXT NULL,
    weight      INT NOT NULL DEFAULT 0,
    search_meta TEXT NULL,
    created     TIMESTAMP NOT NULL DEFAULT now(),
    created_by  INT NOT NULL DEFAULT 0,
    updated     TIMESTAMP NULL,
    updated_by  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS core_stg.documents (
    id              BIGSERIAL PRIMARY KEY,
    channel_id      INT NOT NULL,
    doc_type_id     INT NOT NULL DEFAULT 0,
    record_type_id  INT NOT NULL DEFAULT 0,
    content_type_id INT NOT NULL DEFAULT 0,
    sync_type_id    INT NOT NULL DEFAULT 0,
    folder_id       BIGINT NOT NULL DEFAULT 0,
    dept_id         INT NOT NULL DEFAULT 0,

    name            TEXT NOT NULL,
    describe        TEXT NULL,
    symbol_no       TEXT NULL,
    record_no       TEXT NULL,
    issued_by       TEXT NULL,
    issued          DATE NULL,
    issued_year     INT NOT NULL DEFAULT 0,
    author          TEXT NULL,
    signer          TEXT NULL,
    noted           TEXT NULL,
    summary         TEXT NULL,
    search_meta     TEXT NULL,

    file_name       TEXT NOT NULL,
    file_path       TEXT NOT NULL,
    path_original   TEXT NULL,
    thumb_path      TEXT NULL,
    extension       VARCHAR(20) NULL,
    file_size       BIGINT NOT NULL DEFAULT 0,
    page_count      INT NOT NULL DEFAULT 0,
    file_hash       TEXT NULL,
    is_color_scan   BOOLEAN NOT NULL DEFAULT FALSE,
    min_dpi         INT NOT NULL DEFAULT 0,
    max_dpi         INT NOT NULL DEFAULT 0,
    workstation_name TEXT NULL,

    status          SMALLINT NOT NULL DEFAULT 1,
    current_step    SMALLINT NOT NULL DEFAULT 1,
    version         INT NOT NULL DEFAULT 1,
    weight          INT NOT NULL DEFAULT 0,

    -- workflow flags / timestamps (subset)
    is_checked_scan1 BOOLEAN NOT NULL DEFAULT FALSE,
    checked_scan1_at TIMESTAMP NULL,
    checked_scan1_by INT NOT NULL DEFAULT 0,
    is_checked_scan2 BOOLEAN NOT NULL DEFAULT FALSE,
    checked_scan2_at TIMESTAMP NULL,
    checked_scan2_by INT NOT NULL DEFAULT 0,
    is_zoned         BOOLEAN NOT NULL DEFAULT FALSE,
    zoned_at         TIMESTAMP NULL,
    zoned_by         INT NOT NULL DEFAULT 0,
    status_ocr       SMALLINT NOT NULL DEFAULT 0,
    is_extracted     BOOLEAN NOT NULL DEFAULT FALSE,
    extracted_at     TIMESTAMP NULL,
    extracted_by     INT NOT NULL DEFAULT 0,
    is_checked1      BOOLEAN NOT NULL DEFAULT FALSE,
    checked1_at      TIMESTAMP NULL,
    checked1_by      INT NOT NULL DEFAULT 0,
    is_checked2      BOOLEAN NOT NULL DEFAULT FALSE,
    checked2_at      TIMESTAMP NULL,
    checked2_by      INT NOT NULL DEFAULT 0,
    is_checked_final BOOLEAN NOT NULL DEFAULT FALSE,
    checked_final_at TIMESTAMP NULL,
    checked_final_by INT NOT NULL DEFAULT 0,
    is_checked_logic BOOLEAN NOT NULL DEFAULT FALSE,
    export_status    SMALLINT NOT NULL DEFAULT 0,

    field1  TEXT NULL, field2  TEXT NULL, field3  TEXT NULL, field4  TEXT NULL, field5  TEXT NULL,
    field6  TEXT NULL, field7  TEXT NULL, field8  TEXT NULL, field9  TEXT NULL, field10 TEXT NULL,
    field11 TEXT NULL, field12 TEXT NULL, field13 TEXT NULL, field14 TEXT NULL, field15 TEXT NULL,
    field16 TEXT NULL, field17 TEXT NULL, field18 TEXT NULL, field19 TEXT NULL, field20 TEXT NULL,

    created         TIMESTAMP NOT NULL DEFAULT now(),
    created_by      INT NOT NULL DEFAULT 0,
    updated         TIMESTAMP NULL,
    updated_by      INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_documents_channel ON core_stg.documents(channel_id);
CREATE INDEX IF NOT EXISTS ix_documents_step ON core_stg.documents(channel_id, current_step);

CREATE TABLE IF NOT EXISTS core_stg.form_cells (
    id              BIGSERIAL PRIMARY KEY,
    channel_id      INT NOT NULL,
    document_id     BIGINT NOT NULL,
    cell            INT NOT NULL,
    cell_type       INT NOT NULL DEFAULT 0,
    group_cell      INT NOT NULL DEFAULT 0,
    field           VARCHAR(100) NULL,
    title           TEXT NULL,
    x               INT NOT NULL DEFAULT 0,
    y               INT NOT NULL DEFAULT 0,
    width           INT NOT NULL DEFAULT 0,
    height          INT NOT NULL DEFAULT 0,
    page            INT NOT NULL DEFAULT 1,
    page_width      INT NOT NULL DEFAULT 0,
    page_height     INT NOT NULL DEFAULT 0,
    cropped_path    TEXT NULL,
    value           TEXT NULL,

    extracted_value TEXT NULL,
    extracted_by    INT NOT NULL DEFAULT 0,
    extracted_at    TIMESTAMP NULL,
    checked1_value  TEXT NULL,
    checked1_by     INT NOT NULL DEFAULT 0,
    checked1_at     TIMESTAMP NULL,
    checked2_value  TEXT NULL,
    checked2_by     INT NOT NULL DEFAULT 0,
    checked2_at     TIMESTAMP NULL,

    created         TIMESTAMP NOT NULL DEFAULT now(),
    created_by      INT NOT NULL DEFAULT 0,
    updated         TIMESTAMP NULL,
    updated_by      INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_form_cells_doc ON core_stg.form_cells(channel_id, document_id);

-- Queues
CREATE TABLE IF NOT EXISTS core_stg.ocr_jobs (
    id          BIGSERIAL PRIMARY KEY,
    channel_id  INT NOT NULL,
    document_id BIGINT NOT NULL,
    type        SMALLINT NOT NULL DEFAULT 0,
    status      SMALLINT NOT NULL DEFAULT 0,
    priority    INT NOT NULL DEFAULT 0,
    message     TEXT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    processed_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS core_stg.export_jobs (
    id            BIGSERIAL PRIMARY KEY,
    channel_id    INT NOT NULL,
    export_type   INT NOT NULL DEFAULT 0,
    filter_json   TEXT NULL,
    status        SMALLINT NOT NULL DEFAULT 0,
    processed     INT NOT NULL DEFAULT 0,
    success       INT NOT NULL DEFAULT 0,
    error         INT NOT NULL DEFAULT 0,
    download_path TEXT NULL,
    message       TEXT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT now(),
    requested_by  INT NOT NULL DEFAULT 0,
    completed_at  TIMESTAMP NULL
);

