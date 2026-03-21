-- Core_Cnf — SQL Server
-- CREATE DATABASE Core_Cnf; rồi chạy script trong database đó.

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'core_cnf')
    EXEC(N'CREATE SCHEMA [core_cnf]');
GO

IF OBJECT_ID(N'core_cnf.channels', N'U') IS NULL
BEGIN
    CREATE TABLE core_cnf.channels (
        id              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        name            NVARCHAR(200) NOT NULL,
        [describe]      NVARCHAR(MAX) NULL,
        url             NVARCHAR(MAX) NULL,
        lang            NVARCHAR(10) NULL,
        logo            NVARCHAR(MAX) NULL,
        weight          INT NOT NULL CONSTRAINT DF_ch_weight DEFAULT (0),
        parent          INT NOT NULL CONSTRAINT DF_ch_parent DEFAULT (0),
        parents         NVARCHAR(MAX) NULL,
        start_date      DATE NULL,
        end_date        DATE NULL,
        account_limit   INT NOT NULL CONSTRAINT DF_ch_acclim DEFAULT (0),
        storage_limit   BIGINT NOT NULL CONSTRAINT DF_ch_stg DEFAULT (0),
        document_limit  BIGINT NOT NULL CONSTRAINT DF_ch_doc DEFAULT (0),
        is_published    BIT NOT NULL CONSTRAINT DF_ch_pub DEFAULT (1),
        search_meta     NVARCHAR(MAX) NULL,
        created         DATETIME2(7) NOT NULL CONSTRAINT DF_ch_created DEFAULT (SYSUTCDATETIME()),
        created_by      INT NOT NULL CONSTRAINT DF_ch_cby DEFAULT (0),
        updated         DATETIME2(7) NULL,
        updated_by      INT NOT NULL CONSTRAINT DF_ch_uby DEFAULT (0)
    );
END
GO

IF OBJECT_ID(N'core_cnf.configs', N'U') IS NULL
BEGIN
    CREATE TABLE core_cnf.configs (
        id          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        [key]       NVARCHAR(200) NOT NULL,
        value       NVARCHAR(MAX) NULL,
        group_name  NVARCHAR(100) NULL,
        [description] NVARCHAR(MAX) NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ux_configs_channel_key' AND object_id = OBJECT_ID(N'core_cnf.configs'))
    CREATE UNIQUE INDEX ux_configs_channel_key ON core_cnf.configs(channel_id, [key]);
GO

IF OBJECT_ID(N'core_cnf.content_types', N'U') IS NULL
BEGIN
    CREATE TABLE core_cnf.content_types (
        id          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        name        NVARCHAR(200) NOT NULL,
        code        NVARCHAR(50) NOT NULL,
        is_active   BIT NOT NULL CONSTRAINT DF_ct_active DEFAULT (1),
        weight      INT NOT NULL CONSTRAINT DF_ct_weight DEFAULT (0),
        created     DATETIME2(7) NOT NULL CONSTRAINT DF_ct_created DEFAULT (SYSUTCDATETIME()),
        created_by  INT NOT NULL CONSTRAINT DF_ct_cby DEFAULT (0),
        updated     DATETIME2(7) NULL,
        updated_by  INT NOT NULL CONSTRAINT DF_ct_uby DEFAULT (0)
    );
END
GO

IF OBJECT_ID(N'core_cnf.record_types', N'U') IS NULL
BEGIN
    CREATE TABLE core_cnf.record_types (
        id              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id      INT NOT NULL,
        content_type_id INT NOT NULL CONSTRAINT DF_rt_ct DEFAULT (0),
        name            NVARCHAR(200) NOT NULL,
        code            NVARCHAR(50) NOT NULL,
        is_active       BIT NOT NULL CONSTRAINT DF_rt_active DEFAULT (1),
        weight          INT NOT NULL CONSTRAINT DF_rt_weight DEFAULT (0),
        search_meta     NVARCHAR(MAX) NULL,
        created         DATETIME2(7) NOT NULL CONSTRAINT DF_rt_created DEFAULT (SYSUTCDATETIME()),
        created_by      INT NOT NULL CONSTRAINT DF_rt_cby DEFAULT (0),
        updated         DATETIME2(7) NULL,
        updated_by      INT NOT NULL CONSTRAINT DF_rt_uby DEFAULT (0)
    );
END
GO

IF OBJECT_ID(N'core_cnf.sync_types', N'U') IS NULL
BEGIN
    CREATE TABLE core_cnf.sync_types (
        id          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        name        NVARCHAR(200) NOT NULL,
        code        NVARCHAR(50) NOT NULL,
        is_active   BIT NOT NULL CONSTRAINT DF_st_active DEFAULT (1),
        weight      INT NOT NULL CONSTRAINT DF_st_weight DEFAULT (0),
        created     DATETIME2(7) NOT NULL CONSTRAINT DF_st_created DEFAULT (SYSUTCDATETIME()),
        created_by  INT NOT NULL CONSTRAINT DF_st_cby DEFAULT (0),
        updated     DATETIME2(7) NULL,
        updated_by  INT NOT NULL CONSTRAINT DF_st_uby DEFAULT (0)
    );
END
GO

IF OBJECT_ID(N'core_cnf.export_types', N'U') IS NULL
BEGIN
    CREATE TABLE core_cnf.export_types (
        id              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id      INT NOT NULL,
        name            NVARCHAR(200) NOT NULL,
        code            NVARCHAR(50) NOT NULL,
        exporter_class  NVARCHAR(MAX) NULL,
        is_active       BIT NOT NULL CONSTRAINT DF_et_active DEFAULT (1),
        weight          INT NOT NULL CONSTRAINT DF_et_weight DEFAULT (0),
        created         DATETIME2(7) NOT NULL CONSTRAINT DF_et_created DEFAULT (SYSUTCDATETIME()),
        created_by      INT NOT NULL CONSTRAINT DF_et_cby DEFAULT (0),
        updated         DATETIME2(7) NULL,
        updated_by      INT NOT NULL CONSTRAINT DF_et_uby DEFAULT (0)
    );
END
GO

IF OBJECT_ID(N'core_cnf.translations', N'U') IS NULL
BEGIN
    CREATE TABLE core_cnf.translations (
        id          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        lang        NVARCHAR(10) NOT NULL CONSTRAINT DF_tr_lang DEFAULT (N'vi'),
        [key]       NVARCHAR(200) NOT NULL,
        value       NVARCHAR(MAX) NULL
    );
END
GO
