-- Migration: Create export_jobs table
-- Date: 2026-04-09
-- Description: Tạo bảng queue xử lý export dữ liệu (không dùng FK)
-- Database: SQL Server
-- Schema: core_stg (không phải dbo)

USE Core_Stg;
GO

-- Tạo bảng export_jobs nếu chưa tồn tại
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[core_stg].[export_jobs]') AND type in (N'U'))
BEGIN
    CREATE TABLE [core_stg].[export_jobs] (
        [id] BIGINT IDENTITY(1,1) PRIMARY KEY,
        [channel_id] INT NOT NULL,
        [export_type_id] INT NOT NULL DEFAULT 0,
        [name] NVARCHAR(255),
        [filter_json] NVARCHAR(MAX),
        [export_input_json] NVARCHAR(MAX),
        [field_folder_export] INT DEFAULT 0,
        [doc_status] INT DEFAULT 0,
        [is_export_file] BIT DEFAULT 1,
        [status] TINYINT DEFAULT 0,
        [created_at] DATETIME NOT NULL DEFAULT GETUTCDATE(),
        [processed_at] DATETIME,
        [completed_at] DATETIME,
        [total] INT DEFAULT 0,
        [processed] INT DEFAULT 0,
        [success] INT DEFAULT 0,
        [error] INT DEFAULT 0,
        [download_path] NVARCHAR(500),
        [download_log_path] NVARCHAR(500),
        [message] NVARCHAR(MAX),
        [compressed_percent] INT DEFAULT 0,
        [requested_by] INT NOT NULL,
        [dept_id] INT,
        
        INDEX [idx_channel_id] ([channel_id]),
        INDEX [idx_export_type_id] ([export_type_id]),
        INDEX [idx_status] ([status]),
        INDEX [idx_created_at] ([created_at])
    );
    
    PRINT 'Table core_stg.export_jobs created successfully';
END
ELSE
BEGIN
    PRINT 'Table core_stg.export_jobs already exists';
END
GO

PRINT 'Migration completed successfully';
