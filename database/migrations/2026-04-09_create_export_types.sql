-- Migration: Create export_types table
-- Date: 2026-04-09
-- Description: Tạo bảng lưu cấu hình loại xuất dữ liệu (port từ AXE StgDocSoHoaExportType)
-- Database: SQL Server
-- Schema: core_stg (không phải dbo)
-- Note: Không dùng Foreign Key, các bảng độc lập

USE Core_Stg;
GO

-- Tạo bảng export_types
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[core_stg].[export_types]') AND type in (N'U'))
BEGIN
    CREATE TABLE [core_stg].[export_types] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [channel_id] INT NOT NULL,
        [name] NVARCHAR(255) NOT NULL,
        [code] NVARCHAR(100) NOT NULL,
        [description] NVARCHAR(MAX),
        [excel_file_path] NVARCHAR(500),
        [excel_file_name] NVARCHAR(255),
        [json_config] NVARCHAR(MAX),
        [search_meta] NVARCHAR(MAX),
        [is_active] BIT DEFAULT 1,
        [created] DATETIME NOT NULL DEFAULT GETUTCDATE(),
        [created_by] INT NOT NULL,
        [updated] DATETIME,
        [updated_by] INT,
        
        CONSTRAINT [uk_channel_code] UNIQUE ([channel_id], [code])
    );
    
    -- Tạo indexes
    CREATE NONCLUSTERED INDEX [idx_channel_id] ON [core_stg].[export_types] ([channel_id]);
    CREATE NONCLUSTERED INDEX [idx_code] ON [core_stg].[export_types] ([channel_id], [code]);
    CREATE NONCLUSTERED INDEX [idx_is_active] ON [core_stg].[export_types] ([is_active]);
    
    PRINT 'Table core_stg.export_types created successfully';
END
ELSE
BEGIN
    PRINT 'Table core_stg.export_types already exists';
END
GO

PRINT 'Migration completed successfully';
