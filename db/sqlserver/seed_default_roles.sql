/* =========================================================================
   Seed 7 vai trò mặc định cho hệ thống SHTL.
   - Idempotent: chạy nhiều lần không phát sinh trùng (dùng MERGE theo code).
   - Chỉ INSERT khi chưa có; nếu đã tồn tại, KHÔNG đụng vào (giữ name/description
     mà admin đã sửa qua /admin/Role/Edit).
   - Không cần biết tenant/channel — bảng acc_roles đã bỏ channel_id.

   Code (mã) cố định, viết HOA, snake-case. Đây là khoá nghiệp vụ — đừng sửa
   sau khi đã release.
   ========================================================================= */

SET NOCOUNT ON;

DECLARE @now DATETIME2 = SYSUTCDATETIME();
DECLARE @sysUser INT   = 0;   -- 0 = hệ thống (script seed)

;WITH src(name, code, description) AS (
    SELECT * FROM (VALUES
        (N'Check phiếu scan lần 1',     N'CHECK_SCAN_1',     N'Kiểm tra lần 1 đối với phiếu sau khi scan.'),
        (N'Check phiếu scan lần 2',     N'CHECK_SCAN_2',     N'Kiểm tra lần 2 đối với phiếu sau khi scan.'),
        (N'Nhập liệu',                  N'EXTRACT',          N'Nhập liệu các trường thông tin từ phiếu đã scan.'),
        (N'Check phiếu nhập lần 1',     N'CHECK_EXTRACT_1',  N'Kiểm tra lần 1 đối với phiếu đã nhập liệu.'),
        (N'Check phiếu nhập lần 2',     N'CHECK_EXTRACT_2',  N'Kiểm tra lần 2 đối với phiếu đã nhập liệu.'),
        (N'Thống kê tài liệu số hóa',   N'STATS_DIGITIZATION', N'Xem báo cáo / thống kê tiến độ số hoá tài liệu.'),
        (N'admin',                      N'ADMIN',            N'Quản trị toàn hệ thống.')
    ) AS v(name, code, description)
)
MERGE dbo.acc_roles AS tgt
USING src
   ON UPPER(tgt.code) = UPPER(src.code)
WHEN NOT MATCHED BY TARGET THEN
    INSERT (name, code, [description], parent, parents, module_code,
            is_active, search_meta, created, created_by, updated, updated_by)
    VALUES (src.name, src.code, src.description, 0, NULL, NULL,
            1, NULL, @now, @sysUser, NULL, @sysUser);

PRINT N'Seed acc_roles xong. Đã có sẵn sẽ giữ nguyên, mới sẽ thêm.';

SELECT id, name, code, is_active, created
FROM   dbo.acc_roles
WHERE  code IN (
    N'CHECK_SCAN_1', N'CHECK_SCAN_2',
    N'EXTRACT', N'CHECK_EXTRACT_1', N'CHECK_EXTRACT_2',
    N'STATS_DIGITIZATION', N'ADMIN'
)
ORDER BY
    CASE code
        WHEN N'CHECK_SCAN_1'       THEN 1
        WHEN N'CHECK_SCAN_2'       THEN 2
        WHEN N'EXTRACT'            THEN 3
        WHEN N'CHECK_EXTRACT_1'    THEN 4
        WHEN N'CHECK_EXTRACT_2'    THEN 5
        WHEN N'STATS_DIGITIZATION' THEN 6
        WHEN N'ADMIN'              THEN 7
    END;
