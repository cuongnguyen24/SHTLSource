-- Migration: Cập nhật bảng field settings và thêm extended fields
-- Date: 2026-05-07
-- Description: 
--   1. Thêm Field 1-25 (Extended Fields) vào stg_doc_fields
--   2. Cập nhật stg_doc_field_settings: đổi i_type từ NVARCHAR sang INT
--   3. Thêm các cột mới vào doc_type_sync_settings

USE Core_Stg;
GO

PRINT '========================================';
PRINT 'Migration: Update Field Settings';
PRINT 'Date: 2026-05-07';
PRINT '========================================';
GO

-- ============================================================
-- PART 1: Thêm Extended Fields (Field 1-25) vào stg_doc_fields
-- ============================================================
PRINT 'PART 1: Adding Extended Fields (Field 1-25)...';
GO

IF NOT EXISTS (SELECT 1 FROM core_stg.stg_doc_fields WHERE id >= 101 AND id <= 125)
BEGIN
    SET IDENTITY_INSERT core_stg.stg_doc_fields ON;
    
    INSERT INTO core_stg.stg_doc_fields (id, name, title, is_required, is_active, is_record, datatype, c_class) VALUES
    (101, N'field1', N'Field 1', 0, 1, 0, N'text', NULL),
    (102, N'field2', N'Field 2', 0, 1, 0, N'text', NULL),
    (103, N'field3', N'Field 3', 0, 1, 0, N'text', NULL),
    (104, N'field4', N'Field 4', 0, 1, 0, N'text', NULL),
    (105, N'field5', N'Field 5', 0, 1, 0, N'text', NULL),
    (106, N'field6', N'Field 6', 0, 1, 0, N'text', NULL),
    (107, N'field7', N'Field 7', 0, 1, 0, N'text', NULL),
    (108, N'field8', N'Field 8', 0, 1, 0, N'text', NULL),
    (109, N'field9', N'Field 9', 0, 1, 0, N'text', NULL),
    (110, N'field10', N'Field 10', 0, 1, 0, N'text', NULL),
    (111, N'field11', N'Field 11', 0, 1, 0, N'text', NULL),
    (112, N'field12', N'Field 12', 0, 1, 0, N'text', NULL),
    (113, N'field13', N'Field 13', 0, 1, 0, N'text', NULL),
    (114, N'field14', N'Field 14', 0, 1, 0, N'text', NULL),
    (115, N'field15', N'Field 15', 0, 1, 0, N'text', NULL),
    (116, N'field16', N'Field 16', 0, 1, 0, N'number', NULL),
    (117, N'field17', N'Field 17', 0, 1, 0, N'number', NULL),
    (118, N'field18', N'Field 18', 0, 1, 0, N'number', NULL),
    (119, N'field19', N'Field 19', 0, 1, 0, N'number', NULL),
    (120, N'field20', N'Field 20', 0, 1, 0, N'number', NULL),
    (121, N'field21', N'Field 21', 0, 1, 0, N'datetime', NULL),
    (122, N'field22', N'Field 22', 0, 1, 0, N'datetime', NULL),
    (123, N'field23', N'Field 23', 0, 1, 0, N'decimal', NULL),
    (124, N'field24', N'Field 24', 0, 1, 0, N'decimal', NULL),
    (125, N'field25', N'Field 25', 0, 1, 0, N'decimal', NULL);
    
    SET IDENTITY_INSERT core_stg.stg_doc_fields OFF;
    
    PRINT '✓ Added 25 Extended Fields (ID 101-125)';
END
ELSE
BEGIN
    PRINT '✓ Extended Fields already exist, skipping...';
END
GO

-- ============================================================
-- PART 2: Cập nhật stg_doc_field_settings - Đổi i_type từ NVARCHAR sang INT
-- ============================================================
PRINT 'PART 2: Updating stg_doc_field_settings.i_type to INT...';
GO

-- Kiểm tra kiểu dữ liệu hiện tại của i_type
IF EXISTS (
    SELECT 1 
    FROM sys.columns c
    JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID(N'core_stg.stg_doc_field_settings') 
    AND c.name = N'i_type'
    AND t.name = N'nvarchar'
)
BEGIN
    PRINT 'Converting i_type from NVARCHAR to INT...';
    
    -- Tạo cột tạm để chuyển đổi
    ALTER TABLE core_stg.stg_doc_field_settings ADD i_type_temp INT NULL;
    GO
    
    -- Chuyển đổi dữ liệu: text=1, textarea=2, number=3, date=4, select=5, radio=6, checkbox=7
    UPDATE core_stg.stg_doc_field_settings
    SET i_type_temp = CASE 
        WHEN LOWER(i_type) = 'text' THEN 1
        WHEN LOWER(i_type) = 'textarea' THEN 2
        WHEN LOWER(i_type) = 'number' THEN 3
        WHEN LOWER(i_type) = 'date' THEN 4
        WHEN LOWER(i_type) = 'select' THEN 5
        WHEN LOWER(i_type) = 'radio' THEN 6
        WHEN LOWER(i_type) = 'checkbox' THEN 7
        ELSE 1 -- Default to text
    END;
    GO
    
    -- Xóa cột cũ
    ALTER TABLE core_stg.stg_doc_field_settings DROP COLUMN i_type;
    GO
    
    -- Đổi tên cột mới
    EXEC sp_rename 'core_stg.stg_doc_field_settings.i_type_temp', 'i_type', 'COLUMN';
    GO
    
    -- Thêm constraint NOT NULL và default
    ALTER TABLE core_stg.stg_doc_field_settings ALTER COLUMN i_type INT NOT NULL;
    GO
    
    ALTER TABLE core_stg.stg_doc_field_settings ADD CONSTRAINT DF_sdfs_itype DEFAULT (1) FOR i_type;
    GO
    
    PRINT '✓ Converted i_type to INT successfully';
END
ELSE
BEGIN
    PRINT '✓ i_type is already INT, skipping...';
END
GO

-- ============================================================
-- PART 3: Thêm các cột mới vào doc_type_sync_settings
-- ============================================================
PRINT 'PART 3: Adding new columns to doc_type_sync_settings...';
GO

-- Thêm id_field_group
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'core_stg.doc_type_sync_settings') AND name = N'id_field_group')
BEGIN
    ALTER TABLE core_stg.doc_type_sync_settings ADD id_field_group INT NOT NULL CONSTRAINT DF_dss_fg DEFAULT (0);
    PRINT '✓ Added column: id_field_group';
END
ELSE
BEGIN
    PRINT '✓ Column id_field_group already exists';
END
GO

-- Thêm i_type
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'core_stg.doc_type_sync_settings') AND name = N'i_type')
BEGIN
    ALTER TABLE core_stg.doc_type_sync_settings ADD i_type INT NOT NULL CONSTRAINT DF_dss_itype DEFAULT (1);
    PRINT '✓ Added column: i_type';
END
ELSE
BEGIN
    PRINT '✓ Column i_type already exists';
END
GO

-- Thêm is_read_only
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'core_stg.doc_type_sync_settings') AND name = N'is_read_only')
BEGIN
    ALTER TABLE core_stg.doc_type_sync_settings ADD is_read_only BIT NOT NULL CONSTRAINT DF_dss_ro DEFAULT (0);
    PRINT '✓ Added column: is_read_only';
END
ELSE
BEGIN
    PRINT '✓ Column is_read_only already exists';
END
GO

-- Thêm is_upper_case
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'core_stg.doc_type_sync_settings') AND name = N'is_upper_case')
BEGIN
    ALTER TABLE core_stg.doc_type_sync_settings ADD is_upper_case BIT NOT NULL CONSTRAINT DF_dss_u DEFAULT (0);
    PRINT '✓ Added column: is_upper_case';
END
ELSE
BEGIN
    PRINT '✓ Column is_upper_case already exists';
END
GO

-- Thêm is_capitalize
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'core_stg.doc_type_sync_settings') AND name = N'is_capitalize')
BEGIN
    ALTER TABLE core_stg.doc_type_sync_settings ADD is_capitalize BIT NOT NULL CONSTRAINT DF_dss_cap DEFAULT (0);
    PRINT '✓ Added column: is_capitalize';
END
ELSE
BEGIN
    PRINT '✓ Column is_capitalize already exists';
END
GO

-- ============================================================
-- SUMMARY
-- ============================================================
PRINT '';
PRINT '========================================';
PRINT 'Migration completed successfully!';
PRINT '========================================';
PRINT 'Summary:';
PRINT '  ✓ Extended Fields (Field 1-25) added to stg_doc_fields';
PRINT '  ✓ stg_doc_field_settings.i_type converted to INT';
PRINT '  ✓ doc_type_sync_settings updated with 5 new columns';
PRINT '';
PRINT 'You can now use the updated schema.';
PRINT '========================================';
GO
