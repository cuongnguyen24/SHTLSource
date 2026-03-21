-- Core_Msg — stub — SQL Server
-- CREATE DATABASE Core_Msg; rồi chạy script trong database đó.

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'core_msg')
    EXEC(N'CREATE SCHEMA [core_msg]');
GO

IF OBJECT_ID(N'core_msg.notifications', N'U') IS NULL
BEGIN
    CREATE TABLE core_msg.notifications (
        id          BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        user_id     INT NOT NULL CONSTRAINT DF_nt_uid DEFAULT (0),
        title       NVARCHAR(MAX) NOT NULL,
        content     NVARCHAR(MAX) NULL,
        is_read     BIT NOT NULL CONSTRAINT DF_nt_read DEFAULT (0),
        created_at  DATETIME2(7) NOT NULL CONSTRAINT DF_nt_cat DEFAULT (SYSUTCDATETIME())
    );
END
GO
