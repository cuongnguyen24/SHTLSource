-- Bổ sung schema AXE (Loại tài liệu / Loại đồng bộ) cho Core_Stg + bảng phụ.
-- Chạy sau core_stg.sql (và core_cnf.sql nếu dùng separate_types / is_doc_type).

USE Core_Stg;
GO

/* ---- doc_types: cột bổ sung giống StgDocType AXE ---- */
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'core_stg.doc_types') AND name = N'parent_id')
    ALTER TABLE core_stg.doc_types ADD parent_id INT NOT NULL CONSTRAINT DF_dtp_parent2 DEFAULT (0);
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'core_stg.doc_types') AND name = N'parents')
    ALTER TABLE core_stg.doc_types ADD parents NVARCHAR(MAX) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'core_stg.doc_types') AND name = N'is_default')
    ALTER TABLE core_stg.doc_types ADD is_default BIT NOT NULL CONSTRAINT DF_dtp_isdef DEFAULT (0);
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'core_stg.doc_types') AND name = N'is_ocr_manual_zoned')
    ALTER TABLE core_stg.doc_types ADD is_ocr_manual_zoned BIT NOT NULL CONSTRAINT DF_dtp_ocrman DEFAULT (0);
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'core_stg.doc_types') AND name = N'field_quantity')
    ALTER TABLE core_stg.doc_types ADD field_quantity INT NOT NULL CONSTRAINT DF_dtp_fqty DEFAULT (0);
GO

IF OBJECT_ID(N'core_stg.stg_doc_fields', N'U') IS NULL
BEGIN
    CREATE TABLE core_stg.stg_doc_fields (
        id           INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        name         NVARCHAR(200) NOT NULL,
        title        NVARCHAR(500) NOT NULL,
        is_required  BIT NOT NULL CONSTRAINT DF_sdf_req DEFAULT (0),
        is_active    BIT NOT NULL CONSTRAINT DF_sdf_act DEFAULT (1),
        is_record    BIT NOT NULL CONSTRAINT DF_sdf_rec DEFAULT (0),
        datatype     NVARCHAR(50) NOT NULL,
        c_class      NVARCHAR(200) NULL
    );
END
GO

IF OBJECT_ID(N'core_stg.stg_doc_field_settings', N'U') IS NULL
BEGIN
    CREATE TABLE core_stg.stg_doc_field_settings (
        id                INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        id_type           INT NOT NULL,
        id_field          INT NOT NULL,
        id_pattern_type   INT NOT NULL CONSTRAINT DF_sdfs_pt DEFAULT (0),
        id_category_type  INT NOT NULL CONSTRAINT DF_sdfs_ct DEFAULT (0),
        id_field_group    INT NOT NULL CONSTRAINT DF_sdfs_fg DEFAULT (0),
        ocr_type          INT NOT NULL CONSTRAINT DF_sdfs_ocr DEFAULT (0),
        i_type            NVARCHAR(50) NULL,
        i_row             INT NOT NULL CONSTRAINT DF_sdfs_ir DEFAULT (0),
        i_col             INT NOT NULL CONSTRAINT DF_sdfs_ic DEFAULT (0),
        title             NVARCHAR(500) NULL,
        weight            INT NOT NULL CONSTRAINT DF_sdfs_w DEFAULT (0),
        is_multi          BIT NOT NULL CONSTRAINT DF_sdfs_mul DEFAULT (0),
        is_search         BIT NOT NULL CONSTRAINT DF_sdfs_sch DEFAULT (1),
        is_catalog        BIT NOT NULL CONSTRAINT DF_sdfs_cat DEFAULT (0),
        is_catalog_main   BIT NOT NULL CONSTRAINT DF_sdfs_cm DEFAULT (0),
        pattern_custom    NVARCHAR(MAX) NULL,
        fix_value         NVARCHAR(MAX) NULL,
        min_value         NVARCHAR(MAX) NULL,
        max_value         NVARCHAR(MAX) NULL,
        min_len           INT NOT NULL CONSTRAINT DF_sdfs_mnl DEFAULT (0),
        max_len           INT NOT NULL CONSTRAINT DF_sdfs_mxl DEFAULT (0),
        is_required       BIT NOT NULL CONSTRAINT DF_sdfs_req DEFAULT (0),
        is_read_only      BIT NOT NULL CONSTRAINT DF_sdfs_ro DEFAULT (0),
        is_upper_case     BIT NOT NULL CONSTRAINT DF_sdfs_u DEFAULT (0),
        is_capitalize     BIT NOT NULL CONSTRAINT DF_sdfs_cap DEFAULT (0),
        format            NVARCHAR(MAX) NULL,
        is_ocr_fix        BIT NOT NULL CONSTRAINT DF_sdfs_ocrf DEFAULT (0)
    );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_sdfs_type' AND object_id = OBJECT_ID(N'core_stg.stg_doc_field_settings'))
    CREATE INDEX ix_sdfs_type ON core_stg.stg_doc_field_settings(id_type);
GO

IF OBJECT_ID(N'core_stg.stg_doc_field_groups', N'U') IS NULL
BEGIN
    CREATE TABLE core_stg.stg_doc_field_groups (
        id          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        name        NVARCHAR(200) NOT NULL,
        group_name  NVARCHAR(200) NULL,
        weight      INT NOT NULL CONSTRAINT DF_sdgr_w DEFAULT (0),
        id_parent   INT NOT NULL CONSTRAINT DF_sdgr_p DEFAULT (0)
    );
END
GO

IF OBJECT_ID(N'core_stg.pattern_types', N'U') IS NULL
BEGIN
    CREATE TABLE core_stg.pattern_types (
        id          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        name        NVARCHAR(200) NOT NULL,
        [describe]  NVARCHAR(MAX) NULL,
        pattern     NVARCHAR(MAX) NULL,
        created     DATETIME2(7) NOT NULL CONSTRAINT DF_pt_c DEFAULT (SYSUTCDATETIME()),
        created_by  INT NOT NULL CONSTRAINT DF_pt_cb DEFAULT (0),
        updated     DATETIME2(7) NULL,
        updated_by  INT NOT NULL CONSTRAINT DF_pt_ub DEFAULT (0)
    );
END
GO

IF OBJECT_ID(N'core_stg.category_types', N'U') IS NULL
BEGIN
    CREATE TABLE core_stg.category_types (
        id          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        name        NVARCHAR(200) NOT NULL,
        [describe]  NVARCHAR(MAX) NULL,
        code        NVARCHAR(100) NULL,
        weight      INT NOT NULL CONSTRAINT DF_catt_w DEFAULT (0),
        status      INT NOT NULL CONSTRAINT DF_catt_st DEFAULT (1),
        search_meta NVARCHAR(MAX) NULL,
        created     DATETIME2(7) NOT NULL CONSTRAINT DF_catt_c DEFAULT (SYSUTCDATETIME()),
        created_by  INT NOT NULL CONSTRAINT DF_catt_cb DEFAULT (0),
        updated     DATETIME2(7) NULL,
        updated_by  INT NOT NULL CONSTRAINT DF_catt_ub DEFAULT (0)
    );
END
GO

IF OBJECT_ID(N'core_stg.stg_doc_type_separates', N'U') IS NULL
BEGIN
    CREATE TABLE core_stg.stg_doc_type_separates (
        id          BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        id_doctype  INT NOT NULL,
        x           INT NOT NULL CONSTRAINT DF_sts_x DEFAULT (0),
        y           INT NOT NULL CONSTRAINT DF_sts_y DEFAULT (0),
        width       INT NOT NULL CONSTRAINT DF_sts_w DEFAULT (0),
        height      INT NOT NULL CONSTRAINT DF_sts_h DEFAULT (0),
        weight      INT NOT NULL CONSTRAINT DF_sts_we DEFAULT (0)
    );
END
GO

IF OBJECT_ID(N'core_stg.stg_doc_sohoa_ocr_fix_types', N'U') IS NULL
BEGIN
    CREATE TABLE core_stg.stg_doc_sohoa_ocr_fix_types (
        id          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL CONSTRAINT DF_ocrft_ch DEFAULT (0),
        name        NVARCHAR(200) NOT NULL,
        code        NVARCHAR(100) NOT NULL
    );
END
GO

IF OBJECT_ID(N'core_stg.stg_doc_sohoa_ocr_fixes', N'U') IS NULL
BEGIN
    CREATE TABLE core_stg.stg_doc_sohoa_ocr_fixes (
        id              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id      INT NOT NULL,
        name            NVARCHAR(200) NOT NULL,
        [describe]      NVARCHAR(MAX) NULL,
        type            INT NOT NULL CONSTRAINT DF_ocrf_t DEFAULT (0),
        from_str        NVARCHAR(MAX) NULL,
        to_str          NVARCHAR(MAX) NULL,
        from_position   INT NULL,
        to_position     INT NULL,
        excepts         NVARCHAR(MAX) NULL,
        format          NVARCHAR(MAX) NULL,
        search_meta     NVARCHAR(MAX) NULL,
        created         DATETIME2(7) NOT NULL CONSTRAINT DF_ocrf_c DEFAULT (SYSUTCDATETIME()),
        created_by      INT NOT NULL CONSTRAINT DF_ocrf_cb DEFAULT (0),
        updated         DATETIME2(7) NULL,
        updated_by      INT NULL
    );
END
GO

IF OBJECT_ID(N'core_stg.stg_doc_type_ocr_fixes', N'U') IS NULL
BEGIN
    CREATE TABLE core_stg.stg_doc_type_ocr_fixes (
        id          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        id_doctype  INT NOT NULL,
        id_field    INT NOT NULL,
        id_ocr_fix  INT NOT NULL,
        weight      INT NOT NULL CONSTRAINT DF_docrf_w DEFAULT (0)
    );
END
GO

IF OBJECT_ID(N'core_stg.doc_type_sync_settings', N'U') IS NULL
BEGIN
    CREATE TABLE core_stg.doc_type_sync_settings (
        id                INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        id_type           INT NOT NULL,
        id_field          INT NOT NULL,
        id_pattern_type   INT NOT NULL CONSTRAINT DF_dss_pt DEFAULT (0),
        title             NVARCHAR(500) NULL,
        weight            INT NOT NULL CONSTRAINT DF_dss_w DEFAULT (0),
        is_catalog        BIT NOT NULL CONSTRAINT DF_dss_cat DEFAULT (0),
        pattern_custom    NVARCHAR(MAX) NULL,
        fix_value         NVARCHAR(MAX) NULL,
        min_value         NVARCHAR(MAX) NULL,
        max_value         NVARCHAR(MAX) NULL,
        min_len           INT NOT NULL CONSTRAINT DF_dss_mnl DEFAULT (0),
        max_len           INT NOT NULL CONSTRAINT DF_dss_mxl DEFAULT (0),
        is_required       BIT NOT NULL CONSTRAINT DF_dss_req DEFAULT (0)
    );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_dss_type' AND object_id = OBJECT_ID(N'core_stg.doc_type_sync_settings'))
    CREATE INDEX ix_dss_type ON core_stg.doc_type_sync_settings(id_type);
GO

/* Seed tối thiểu: nhóm trường + loại quy tắc OCR (REPLACE/REMOVE/...) */
IF NOT EXISTS (SELECT 1 FROM core_stg.stg_doc_field_groups WHERE channel_id = 0 AND name = N'Mặc định')
    INSERT INTO core_stg.stg_doc_field_groups (channel_id, name, group_name, weight, id_parent) VALUES (0, N'Mặc định', N'Default', 0, 0);
GO
IF NOT EXISTS (SELECT 1 FROM core_stg.stg_doc_sohoa_ocr_fix_types WHERE id = 1)
BEGIN
    SET IDENTITY_INSERT core_stg.stg_doc_sohoa_ocr_fix_types ON;
    INSERT INTO core_stg.stg_doc_sohoa_ocr_fix_types (id, channel_id, name, code) VALUES
    (1, 0, N'Thay thế chuỗi', N'REPLACE'),
    (2, 0, N'Xóa chuỗi', N'REMOVE'),
    (3, 0, N'Chèn trước', N'INSERT'),
    (4, 0, N'Viết hoa', N'UPPER'),
    (5, 0, N'Viết thường', N'LOWER'),
    (6, 0, N'Viết hoa chữ đầu', N'CAPITALIZE'),
    (7, 0, N'Chỉ số', N'ONLYNUMBER'),
    (8, 0, N'Chỉ chữ', N'ONLYLETTER'),
    (9, 0, N'Chữ và số', N'ONLYNUMBERANDLETTER'),
    (10, 0, N'Trim', N'TRIM');
    SET IDENTITY_INSERT core_stg.stg_doc_sohoa_ocr_fix_types OFF;
END
GO

/* Seed stg_doc_fields (global) — đủ datatype để UI giống AXE */
IF NOT EXISTS (SELECT 1 FROM core_stg.stg_doc_fields)
BEGIN
    INSERT INTO core_stg.stg_doc_fields (name, title, is_required, is_active, is_record, datatype, c_class) VALUES
    (N'dc_title', N'Tên', 0, 1, 0, N'dctext', NULL),
    (N'dc_symbol', N'Số ký hiệu', 0, 1, 0, N'dctext', NULL),
    (N'dc_receiver', N'Nơi nhận', 0, 1, 0, N'dctext', NULL),
    (N'dc_box', N'Hộp', 0, 1, 0, N'dctext', NULL),
    (N'dc_num1', N'Số nguyên mẫu', 0, 1, 0, N'dcnumber', NULL),
    (N'dc_date1', N'Ngày tháng mẫu', 0, 1, 0, N'dcdatetime', NULL),
    (N'dc_custom1', N'Tùy chỉnh', 0, 1, 0, N'dccustom', NULL),
    (N'dc_select1', N'Chọn', 0, 1, 0, N'dcselect', NULL),
    (N'fc_title', N'Tiêu đề hồ sơ', 0, 1, 0, N'fctext', NULL),
    (N'fc_end', N'Thời gian kết thúc', 0, 1, 0, N'fctext', NULL),
    (N'fc_lang', N'Ngôn ngữ', 0, 1, 0, N'fctext', NULL),
    (N'fc_start', N'Thời gian bắt đầu', 0, 1, 0, N'fctext', NULL),
    (N'fc_pages', N'Số lượng tờ', 0, 1, 0, N'fcnumber', NULL),
    (N'fc_store', N'Thời hạn lưu trữ', 0, 1, 0, N'fcnumber', NULL),
    (N'fc_dec1', N'Số thập phân', 0, 1, 0, N'fcdecimal', NULL),
    (N'fc_date1', N'Ngày mở rộng', 0, 1, 0, N'fcdatetime', NULL),
    (N'std_text', N'Trường text chuẩn', 0, 1, 0, N'text', NULL),
    (N'std_num', N'Số nguyên chuẩn', 0, 1, 0, N'number', NULL),
    (N'std_dec', N'Số thập phân chuẩn', 0, 1, 0, N'decimal', NULL),
    (N'std_date', N'Ngày chuẩn', 0, 1, 0, N'datetime', NULL);
END
GO
