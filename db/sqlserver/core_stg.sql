-- Core_Stg — SQL Server
-- CREATE DATABASE Core_Stg; rồi chạy script trong database đó.

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'core_stg')
    EXEC(N'CREATE SCHEMA [core_stg]');
GO

IF OBJECT_ID(N'core_stg.document_folders', N'U') IS NULL
BEGIN
    CREATE TABLE core_stg.document_folders (
        id          BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        parent_id   BIGINT NOT NULL CONSTRAINT DF_df_parent DEFAULT (0),
        name        NVARCHAR(255) NOT NULL,
        code        NVARCHAR(100) NULL,
        [describe]  NVARCHAR(MAX) NULL,
        weight      INT NOT NULL CONSTRAINT DF_df_weight DEFAULT (0),
        search_meta NVARCHAR(MAX) NULL,
        created     DATETIME2(7) NOT NULL CONSTRAINT DF_df_created DEFAULT (SYSUTCDATETIME()),
        created_by  INT NOT NULL CONSTRAINT DF_df_cby DEFAULT (0),
        updated     DATETIME2(7) NULL,
        updated_by  INT NOT NULL CONSTRAINT DF_df_uby DEFAULT (0)
    );
END
GO

IF OBJECT_ID(N'core_stg.documents', N'U') IS NULL
BEGIN
    CREATE TABLE core_stg.documents (
        id              BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id      INT NOT NULL,
        doc_type_id     INT NOT NULL CONSTRAINT DF_doc_dtype DEFAULT (0),
        record_type_id  INT NOT NULL CONSTRAINT DF_doc_rtype DEFAULT (0),
        content_type_id INT NOT NULL CONSTRAINT DF_doc_ctype DEFAULT (0),
        sync_type_id    INT NOT NULL CONSTRAINT DF_doc_stype DEFAULT (0),
        folder_id       BIGINT NOT NULL CONSTRAINT DF_doc_folder DEFAULT (0),
        dept_id         INT NOT NULL CONSTRAINT DF_doc_dept DEFAULT (0),

        name            NVARCHAR(MAX) NOT NULL,
        [describe]      NVARCHAR(MAX) NULL,
        symbol_no       NVARCHAR(MAX) NULL,
        record_no       NVARCHAR(MAX) NULL,
        issued_by       NVARCHAR(MAX) NULL,
        issued          DATE NULL,
        issued_year     INT NOT NULL CONSTRAINT DF_doc_iy DEFAULT (0),
        author          NVARCHAR(MAX) NULL,
        signer          NVARCHAR(MAX) NULL,
        noted           NVARCHAR(MAX) NULL,
        summary         NVARCHAR(MAX) NULL,
        search_meta     NVARCHAR(MAX) NULL,

        file_name       NVARCHAR(MAX) NOT NULL,
        file_path       NVARCHAR(MAX) NOT NULL,
        path_original   NVARCHAR(MAX) NULL,
        thumb_path      NVARCHAR(MAX) NULL,
        extension       NVARCHAR(20) NULL,
        file_size       BIGINT NOT NULL CONSTRAINT DF_doc_fsize DEFAULT (0),
        page_count      INT NOT NULL CONSTRAINT DF_doc_pgc DEFAULT (0),
        file_hash       NVARCHAR(MAX) NULL,
        is_color_scan   BIT NOT NULL CONSTRAINT DF_doc_color DEFAULT (0),
        min_dpi         INT NOT NULL CONSTRAINT DF_doc_mind DEFAULT (0),
        max_dpi         INT NOT NULL CONSTRAINT DF_doc_maxd DEFAULT (0),
        workstation_name NVARCHAR(MAX) NULL,

        status          TINYINT NOT NULL CONSTRAINT DF_doc_stat DEFAULT (1),
        current_step    TINYINT NOT NULL CONSTRAINT DF_doc_step DEFAULT (1),
        version         INT NOT NULL CONSTRAINT DF_doc_ver DEFAULT (1),
        weight          INT NOT NULL CONSTRAINT DF_doc_weight DEFAULT (0),

        is_checked_scan1 BIT NOT NULL CONSTRAINT DF_doc_cs1 DEFAULT (0),
        checked_scan1_at DATETIME2(7) NULL,
        checked_scan1_by INT NOT NULL CONSTRAINT DF_doc_cs1b DEFAULT (0),
        is_checked_scan2 BIT NOT NULL CONSTRAINT DF_doc_cs2 DEFAULT (0),
        checked_scan2_at DATETIME2(7) NULL,
        checked_scan2_by INT NOT NULL CONSTRAINT DF_doc_cs2b DEFAULT (0),
        is_zoned         BIT NOT NULL CONSTRAINT DF_doc_zone DEFAULT (0),
        zoned_at         DATETIME2(7) NULL,
        zoned_by         INT NOT NULL CONSTRAINT DF_doc_zb DEFAULT (0),
        status_ocr       TINYINT NOT NULL CONSTRAINT DF_doc_ocr DEFAULT (0),
        is_extracted     BIT NOT NULL CONSTRAINT DF_doc_ext DEFAULT (0),
        extracted_at     DATETIME2(7) NULL,
        extracted_by     INT NOT NULL CONSTRAINT DF_doc_eb DEFAULT (0),
        is_checked1      BIT NOT NULL CONSTRAINT DF_doc_c1 DEFAULT (0),
        checked1_at      DATETIME2(7) NULL,
        checked1_by      INT NOT NULL CONSTRAINT DF_doc_c1b DEFAULT (0),
        is_checked2      BIT NOT NULL CONSTRAINT DF_doc_c2 DEFAULT (0),
        checked2_at      DATETIME2(7) NULL,
        checked2_by      INT NOT NULL CONSTRAINT DF_doc_c2b DEFAULT (0),
        is_checked_final BIT NOT NULL CONSTRAINT DF_doc_cf DEFAULT (0),
        checked_final_at DATETIME2(7) NULL,
        checked_final_by INT NOT NULL CONSTRAINT DF_doc_cfb DEFAULT (0),
        is_checked_logic BIT NOT NULL CONSTRAINT DF_doc_cl DEFAULT (0),
        export_status    TINYINT NOT NULL CONSTRAINT DF_doc_exps DEFAULT (0),

        field1  NVARCHAR(MAX) NULL, field2  NVARCHAR(MAX) NULL, field3  NVARCHAR(MAX) NULL, field4  NVARCHAR(MAX) NULL, field5  NVARCHAR(MAX) NULL,
        field6  NVARCHAR(MAX) NULL, field7  NVARCHAR(MAX) NULL, field8  NVARCHAR(MAX) NULL, field9  NVARCHAR(MAX) NULL, field10 NVARCHAR(MAX) NULL,
        field11 NVARCHAR(MAX) NULL, field12 NVARCHAR(MAX) NULL, field13 NVARCHAR(MAX) NULL, field14 NVARCHAR(MAX) NULL, field15 NVARCHAR(MAX) NULL,
        field16 NVARCHAR(MAX) NULL, field17 NVARCHAR(MAX) NULL, field18 NVARCHAR(MAX) NULL, field19 NVARCHAR(MAX) NULL, field20 NVARCHAR(MAX) NULL,

        created         DATETIME2(7) NOT NULL CONSTRAINT DF_doc_created DEFAULT (SYSUTCDATETIME()),
        created_by      INT NOT NULL CONSTRAINT DF_doc_cby DEFAULT (0),
        updated         DATETIME2(7) NULL,
        updated_by      INT NOT NULL CONSTRAINT DF_doc_uby DEFAULT (0)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_documents_channel' AND object_id = OBJECT_ID(N'core_stg.documents'))
    CREATE INDEX ix_documents_channel ON core_stg.documents(channel_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_documents_step' AND object_id = OBJECT_ID(N'core_stg.documents'))
    CREATE INDEX ix_documents_step ON core_stg.documents(channel_id, current_step);
GO

IF OBJECT_ID(N'core_stg.form_cells', N'U') IS NULL
BEGIN
    CREATE TABLE core_stg.form_cells (
        id              BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id      INT NOT NULL,
        document_id     BIGINT NOT NULL,
        cell            INT NOT NULL,
        cell_type       INT NOT NULL CONSTRAINT DF_fc_ct DEFAULT (0),
        group_cell      INT NOT NULL CONSTRAINT DF_fc_gc DEFAULT (0),
        field           NVARCHAR(100) NULL,
        title           NVARCHAR(MAX) NULL,
        x               INT NOT NULL CONSTRAINT DF_fc_x DEFAULT (0),
        y               INT NOT NULL CONSTRAINT DF_fc_y DEFAULT (0),
        width           INT NOT NULL CONSTRAINT DF_fc_w DEFAULT (0),
        height          INT NOT NULL CONSTRAINT DF_fc_h DEFAULT (0),
        page            INT NOT NULL CONSTRAINT DF_fc_page DEFAULT (1),
        page_width      INT NOT NULL CONSTRAINT DF_fc_pw DEFAULT (0),
        page_height     INT NOT NULL CONSTRAINT DF_fc_ph DEFAULT (0),
        cropped_path    NVARCHAR(MAX) NULL,
        value           NVARCHAR(MAX) NULL,

        extracted_value NVARCHAR(MAX) NULL,
        extracted_by    INT NOT NULL CONSTRAINT DF_fc_eb DEFAULT (0),
        extracted_at    DATETIME2(7) NULL,
        checked1_value  NVARCHAR(MAX) NULL,
        checked1_by     INT NOT NULL CONSTRAINT DF_fc_c1b DEFAULT (0),
        checked1_at     DATETIME2(7) NULL,
        checked2_value  NVARCHAR(MAX) NULL,
        checked2_by     INT NOT NULL CONSTRAINT DF_fc_c2b DEFAULT (0),
        checked2_at     DATETIME2(7) NULL,

        created         DATETIME2(7) NOT NULL CONSTRAINT DF_fc_created DEFAULT (SYSUTCDATETIME()),
        created_by      INT NOT NULL CONSTRAINT DF_fc_cby DEFAULT (0),
        updated         DATETIME2(7) NULL,
        updated_by      INT NOT NULL CONSTRAINT DF_fc_uby DEFAULT (0)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_form_cells_doc' AND object_id = OBJECT_ID(N'core_stg.form_cells'))
    CREATE INDEX ix_form_cells_doc ON core_stg.form_cells(channel_id, document_id);
GO

IF OBJECT_ID(N'core_stg.ocr_jobs', N'U') IS NULL
BEGIN
    CREATE TABLE core_stg.ocr_jobs (
        id          BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        document_id BIGINT NOT NULL,
        type        TINYINT NOT NULL CONSTRAINT DF_ocr_type DEFAULT (0),
        status      TINYINT NOT NULL CONSTRAINT DF_ocr_stat DEFAULT (0),
        priority    INT NOT NULL CONSTRAINT DF_ocr_pri DEFAULT (0),
        message     NVARCHAR(MAX) NULL,
        created_at  DATETIME2(7) NOT NULL CONSTRAINT DF_ocr_cat DEFAULT (SYSUTCDATETIME()),
        processed_at DATETIME2(7) NULL
    );
END
GO

IF OBJECT_ID(N'core_stg.export_jobs', N'U') IS NULL
BEGIN
    CREATE TABLE core_stg.export_jobs (
        id            BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id    INT NOT NULL,
        export_type   INT NOT NULL CONSTRAINT DF_ej_et DEFAULT (0),
        filter_json   NVARCHAR(MAX) NULL,
        status        TINYINT NOT NULL CONSTRAINT DF_ej_stat DEFAULT (0),
        processed     INT NOT NULL CONSTRAINT DF_ej_proc DEFAULT (0),
        success       INT NOT NULL CONSTRAINT DF_ej_ok DEFAULT (0),
        error         INT NOT NULL CONSTRAINT DF_ej_err DEFAULT (0),
        download_path NVARCHAR(MAX) NULL,
        message       NVARCHAR(MAX) NULL,
        created_at    DATETIME2(7) NOT NULL CONSTRAINT DF_ej_cat DEFAULT (SYSUTCDATETIME()),
        requested_by  INT NOT NULL CONSTRAINT DF_ej_rb DEFAULT (0),
        completed_at  DATETIME2(7) NULL
    );
END
GO
