## Database scripts (PostgreSQL)

Mục tiêu: tạo database theo bounded context giống hệ thống cũ, **không FK**, dễ quản lý/backup.

### Files
- `core_acc.sql`: user/role/dept/team/permission/session
- `core_cnf.sql`: channel, config, content/record/sync/export types
- `core_stg.sql`: document, folder, form_cell, queues (ocr/export/...)
- `core_log.sql`: access/action/error log
- `core_msg.sql`: notifications (stub)
- `core_catalog.sql`: danh mục địa giới hành chính (stub)

### Usage
Chạy lần lượt các file để tạo schema + table:

- Tạo database trước (ví dụ `Core_Acc`, `Core_Cnf`, ...), sau đó chạy script tương ứng.

