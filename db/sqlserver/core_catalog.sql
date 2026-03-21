-- Core_Catalog — stub — SQL Server
-- CREATE DATABASE Core_Catalog; rồi chạy script trong database đó.

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'core_catalog')
    EXEC(N'CREATE SCHEMA [core_catalog]');
GO

IF OBJECT_ID(N'core_catalog.provinces', N'U') IS NULL
BEGIN
    CREATE TABLE core_catalog.provinces (
        id   INT NOT NULL PRIMARY KEY,
        name NVARCHAR(200) NOT NULL
    );
END
GO

IF OBJECT_ID(N'core_catalog.districts', N'U') IS NULL
BEGIN
    CREATE TABLE core_catalog.districts (
        id          INT NOT NULL PRIMARY KEY,
        province_id INT NOT NULL,
        name        NVARCHAR(200) NOT NULL
    );
END
GO

IF OBJECT_ID(N'core_catalog.wards', N'U') IS NULL
BEGIN
    CREATE TABLE core_catalog.wards (
        id          INT NOT NULL PRIMARY KEY,
        district_id INT NOT NULL,
        name        NVARCHAR(200) NOT NULL
    );
END
GO
