-- Core_Acc — SQL Server
-- Tạo database: CREATE DATABASE Core_Acc; rồi chạy script trong ngữ cảnh database đó.
-- Không FK; multi-tenant qua channel_id.

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'core_acc')
    EXEC(N'CREATE SCHEMA [core_acc]');
GO

IF OBJECT_ID(N'core_acc.users', N'U') IS NULL
BEGIN
    CREATE TABLE core_acc.users (
        id              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id      INT NOT NULL,
        user_name       NVARCHAR(100) NOT NULL,
        email           NVARCHAR(200) NOT NULL,
        full_name       NVARCHAR(200) NOT NULL,
        password_hash   NVARCHAR(MAX) NOT NULL,
        password_salt   NVARCHAR(MAX) NULL,
        dept_id         INT NOT NULL CONSTRAINT DF_users_dept DEFAULT (0),
        position_id     INT NOT NULL CONSTRAINT DF_users_pos DEFAULT (0),
        is_active       BIT NOT NULL CONSTRAINT DF_users_active DEFAULT (1),
        is_admin        BIT NOT NULL CONSTRAINT DF_users_admin DEFAULT (0),
        avatar          NVARCHAR(MAX) NULL,
        phone           NVARCHAR(50) NULL,
        weight          INT NOT NULL CONSTRAINT DF_users_weight DEFAULT (0),
        search_meta     NVARCHAR(MAX) NULL,
        last_login      DATETIME2(7) NULL,
        created         DATETIME2(7) NOT NULL CONSTRAINT DF_users_created DEFAULT (SYSUTCDATETIME()),
        created_by      INT NOT NULL CONSTRAINT DF_users_cby DEFAULT (0),
        updated         DATETIME2(7) NULL,
        updated_by      INT NOT NULL CONSTRAINT DF_users_uby DEFAULT (0)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_users_channel' AND object_id = OBJECT_ID(N'core_acc.users'))
    CREATE INDEX ix_users_channel ON core_acc.users(channel_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ux_users_channel_username' AND object_id = OBJECT_ID(N'core_acc.users'))
    CREATE UNIQUE INDEX ux_users_channel_username ON core_acc.users(channel_id, user_name);
GO

IF OBJECT_ID(N'core_acc.roles', N'U') IS NULL
BEGIN
    CREATE TABLE core_acc.roles (
        id              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id      INT NOT NULL,
        name            NVARCHAR(200) NOT NULL,
        code            NVARCHAR(50) NOT NULL,
        [description]   NVARCHAR(MAX) NULL,
        is_active       BIT NOT NULL CONSTRAINT DF_roles_active DEFAULT (1),
        created         DATETIME2(7) NOT NULL CONSTRAINT DF_roles_created DEFAULT (SYSUTCDATETIME()),
        created_by      INT NOT NULL CONSTRAINT DF_roles_cby DEFAULT (0),
        updated         DATETIME2(7) NULL,
        updated_by      INT NOT NULL CONSTRAINT DF_roles_uby DEFAULT (0)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_roles_channel' AND object_id = OBJECT_ID(N'core_acc.roles'))
    CREATE INDEX ix_roles_channel ON core_acc.roles(channel_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ux_roles_channel_code' AND object_id = OBJECT_ID(N'core_acc.roles'))
    CREATE UNIQUE INDEX ux_roles_channel_code ON core_acc.roles(channel_id, code);
GO

IF OBJECT_ID(N'core_acc.role_permissions', N'U') IS NULL
BEGIN
    CREATE TABLE core_acc.role_permissions (
        id              BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id      INT NOT NULL,
        role_id         INT NOT NULL,
        permission_code NVARCHAR(100) NOT NULL,
        created         DATETIME2(7) NOT NULL CONSTRAINT DF_rp_created DEFAULT (SYSUTCDATETIME())
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_role_permissions_role' AND object_id = OBJECT_ID(N'core_acc.role_permissions'))
    CREATE INDEX ix_role_permissions_role ON core_acc.role_permissions(channel_id, role_id);
GO

IF OBJECT_ID(N'core_acc.user_roles', N'U') IS NULL
BEGIN
    CREATE TABLE core_acc.user_roles (
        id          BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        user_id     INT NOT NULL,
        role_id     INT NOT NULL,
        created     DATETIME2(7) NOT NULL CONSTRAINT DF_ur_created DEFAULT (SYSUTCDATETIME())
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_user_roles_user' AND object_id = OBJECT_ID(N'core_acc.user_roles'))
    CREATE INDEX ix_user_roles_user ON core_acc.user_roles(channel_id, user_id);
GO

IF OBJECT_ID(N'core_acc.depts', N'U') IS NULL
BEGIN
    CREATE TABLE core_acc.depts (
        id          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        name        NVARCHAR(200) NOT NULL,
        code        NVARCHAR(50) NOT NULL CONSTRAINT DF_depts_code DEFAULT (N''),
        [describe]  NVARCHAR(MAX) NULL,
        parent      INT NOT NULL CONSTRAINT DF_depts_parent DEFAULT (0),
        parents     NVARCHAR(MAX) NULL,
        weight      INT NOT NULL CONSTRAINT DF_depts_weight DEFAULT (0),
        search_meta NVARCHAR(MAX) NULL,
        created     DATETIME2(7) NOT NULL CONSTRAINT DF_depts_created DEFAULT (SYSUTCDATETIME()),
        created_by  INT NOT NULL CONSTRAINT DF_depts_cby DEFAULT (0),
        updated     DATETIME2(7) NULL,
        updated_by  INT NOT NULL CONSTRAINT DF_depts_uby DEFAULT (0)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_depts_channel' AND object_id = OBJECT_ID(N'core_acc.depts'))
    CREATE INDEX ix_depts_channel ON core_acc.depts(channel_id);
GO

IF OBJECT_ID(N'core_acc.positions', N'U') IS NULL
BEGIN
    CREATE TABLE core_acc.positions (
        id          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        name        NVARCHAR(200) NOT NULL,
        [describe]  NVARCHAR(MAX) NULL,
        weight      INT NOT NULL CONSTRAINT DF_pos_weight DEFAULT (0),
        created     DATETIME2(7) NOT NULL CONSTRAINT DF_pos_created DEFAULT (SYSUTCDATETIME()),
        created_by  INT NOT NULL CONSTRAINT DF_pos_cby DEFAULT (0),
        updated     DATETIME2(7) NULL,
        updated_by  INT NOT NULL CONSTRAINT DF_pos_uby DEFAULT (0)
    );
END
GO

IF OBJECT_ID(N'core_acc.teams', N'U') IS NULL
BEGIN
    CREATE TABLE core_acc.teams (
        id          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        name        NVARCHAR(200) NOT NULL,
        [describe]  NVARCHAR(MAX) NULL,
        weight      INT NOT NULL CONSTRAINT DF_teams_weight DEFAULT (0),
        created     DATETIME2(7) NOT NULL CONSTRAINT DF_teams_created DEFAULT (SYSUTCDATETIME()),
        created_by  INT NOT NULL CONSTRAINT DF_teams_cby DEFAULT (0),
        updated     DATETIME2(7) NULL,
        updated_by  INT NOT NULL CONSTRAINT DF_teams_uby DEFAULT (0)
    );
END
GO

IF OBJECT_ID(N'core_acc.user_sessions', N'U') IS NULL
BEGIN
    CREATE TABLE core_acc.user_sessions (
        id          BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        channel_id  INT NOT NULL,
        user_id     INT NOT NULL,
        token       NVARCHAR(MAX) NOT NULL,
        ip_address  NVARCHAR(64) NULL,
        user_agent  NVARCHAR(MAX) NULL,
        created_at  DATETIME2(7) NOT NULL CONSTRAINT DF_usess_cat DEFAULT (SYSUTCDATETIME()),
        expires_at  DATETIME2(7) NULL,
        is_revoked  BIT NOT NULL CONSTRAINT DF_usess_rev DEFAULT (0)
    );
END
GO
