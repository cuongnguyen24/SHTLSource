# SQL Server — tạo schema

1. Kết nối SQL Server (SSMS), chạy `00_create_databases.sql` khi đang trỏ vào `master` (hoặc tự `CREATE DATABASE` từng DB).
2. Lần lượt, **USE** từng database rồi **Execute** file:
   - `Core_Acc` ← `core_acc.sql`
   - `Core_Cnf` ← `core_cnf.sql`
   - `Core_Stg` ← `core_stg.sql`
   - `Core_Log` ← `core_log.sql`
   - `Core_Msg` ← `core_msg.sql`
   - `Core_Catalog` ← `core_catalog.sql`

Script dùng `IF NOT EXISTS` / `IF OBJECT_ID` để hạn chế lỗi khi chạy lại; nếu cần tạo lại sạch, `DROP DATABASE` từng DB rồi chạy từ đầu.

Cột dạng thời gian mặc định: `SYSUTCDATETIME()` (UTC). Có thể đổi sang `GETDATE()` nếu bạn muốn giờ local server.
