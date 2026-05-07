-- Thêm các trường mở rộng (Field 1-25) vào stg_doc_fields
-- ID 101-125 cho Extended Fields

USE Core_Stg;
GO

-- Thêm Field 1-25 (ID 101-125)
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
END
GO

PRINT 'Đã thêm 25 trường mở rộng (Field 1-25) vào stg_doc_fields';
GO
