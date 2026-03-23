-- AXE: SeparateType + cờ is_doc_type trên content_types (loại trích xuất).
USE Core_Cnf;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'core_cnf.content_types') AND name = N'is_doc_type')
    ALTER TABLE core_cnf.content_types ADD is_doc_type BIT NOT NULL CONSTRAINT DF_ct_doctype DEFAULT (0);
GO

IF OBJECT_ID(N'core_cnf.separate_types', N'U') IS NULL
BEGIN
    CREATE TABLE core_cnf.separate_types (
        id          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        name        NVARCHAR(200) NOT NULL,
        code        NVARCHAR(100) NULL,
        code_type   NVARCHAR(100) NULL,
        path        NVARCHAR(MAX) NULL,
        created     DATETIME2(7) NOT NULL CONSTRAINT DF_sep_c DEFAULT (SYSUTCDATETIME()),
        created_by  INT NOT NULL CONSTRAINT DF_sep_cb DEFAULT (0),
        updated     DATETIME2(7) NULL,
        updated_by  INT NULL
    );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_separate_types_ch' AND object_id = OBJECT_ID(N'core_cnf.separate_types'))
    CREATE INDEX ix_separate_types_ch ON core_cnf.separate_types(channel_id);
GO

IF NOT EXISTS (SELECT 1 FROM core_cnf.separate_types WHERE channel_id = 1 AND name = N'Không xác định')
    INSERT INTO core_cnf.separate_types (channel_id, name, code, created_by) VALUES (1, N'Không xác định', N'', 0);
GO
