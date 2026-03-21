-- Core_Log — SQL Server
-- CREATE DATABASE Core_Log; rồi chạy script trong database đó.

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'core_log')
    EXEC(N'CREATE SCHEMA [core_log]');
GO

IF OBJECT_ID(N'core_log.access_logs', N'U') IS NULL
BEGIN
    CREATE TABLE core_log.access_logs (
        id          BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        user_id     INT NOT NULL CONSTRAINT DF_al_uid DEFAULT (0),
        user_name   NVARCHAR(100) NULL,
        path        NVARCHAR(MAX) NOT NULL,
        method      NVARCHAR(10) NULL,
        status_code INT NOT NULL CONSTRAINT DF_al_sc DEFAULT (0),
        duration_ms BIGINT NOT NULL CONSTRAINT DF_al_dur DEFAULT (0),
        ip_address  NVARCHAR(64) NULL,
        user_agent  NVARCHAR(MAX) NULL,
        created_at  DATETIME2(7) NOT NULL CONSTRAINT DF_al_cat DEFAULT (SYSUTCDATETIME())
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_access_logs_channel' AND object_id = OBJECT_ID(N'core_log.access_logs'))
    CREATE INDEX ix_access_logs_channel ON core_log.access_logs(channel_id, created_at);
GO

IF OBJECT_ID(N'core_log.action_logs', N'U') IS NULL
BEGIN
    CREATE TABLE core_log.action_logs (
        id          BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        user_id     INT NOT NULL CONSTRAINT DF_acl_uid DEFAULT (0),
        user_name   NVARCHAR(100) NULL,
        action      NVARCHAR(100) NOT NULL,
        table_name  NVARCHAR(100) NULL,
        record_id   NVARCHAR(50) NULL,
        old_value   NVARCHAR(MAX) NULL,
        new_value   NVARCHAR(MAX) NULL,
        [description] NVARCHAR(MAX) NULL,
        ip_address  NVARCHAR(64) NULL,
        created_at  DATETIME2(7) NOT NULL CONSTRAINT DF_acl_cat DEFAULT (SYSUTCDATETIME())
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_action_logs_channel' AND object_id = OBJECT_ID(N'core_log.action_logs'))
    CREATE INDEX ix_action_logs_channel ON core_log.action_logs(channel_id, created_at);
GO

IF OBJECT_ID(N'core_log.error_logs', N'U') IS NULL
BEGIN
    CREATE TABLE core_log.error_logs (
        id          BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        user_id     INT NOT NULL CONSTRAINT DF_el_uid DEFAULT (0),
        message     NVARCHAR(MAX) NOT NULL,
        stack_trace NVARCHAR(MAX) NULL,
        source      NVARCHAR(MAX) NULL,
        url         NVARCHAR(MAX) NULL,
        level       NVARCHAR(20) NULL,
        created_at  DATETIME2(7) NOT NULL CONSTRAINT DF_el_cat DEFAULT (SYSUTCDATETIME())
    );
END
GO
