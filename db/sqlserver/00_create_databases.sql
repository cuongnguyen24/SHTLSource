-- Chạy một lần trên instance SQL Server (ví dụ trong SSMS, kết nối master).
-- Điều chỉnh tên database nếu cần; sau đó chạy lần lượt core_*.sql trong từng database tương ứng.

IF DB_ID(N'Core_Acc') IS NULL CREATE DATABASE Core_Acc;
IF DB_ID(N'Core_Cnf') IS NULL CREATE DATABASE Core_Cnf;
IF DB_ID(N'Core_Stg') IS NULL CREATE DATABASE Core_Stg;
IF DB_ID(N'Core_Log') IS NULL CREATE DATABASE Core_Log;
IF DB_ID(N'Core_Msg') IS NULL CREATE DATABASE Core_Msg;
IF DB_ID(N'Core_Catalog') IS NULL CREATE DATABASE Core_Catalog;
GO
