-- Core_Acc — user admin / mật khẩu: 123
-- Ứng dụng lưu mật khẩu plain trong cột password_hash (không hash).

USE Core_Acc;
GO

DECLARE @pwd NVARCHAR(MAX) = N'123';

IF NOT EXISTS (SELECT 1 FROM core_acc.users WHERE LOWER(user_name) = N'admin')
BEGIN
    INSERT INTO core_acc.users (
        channel_id,
        user_name,
        email,
        full_name,
        password_hash,
        password_salt,
        dept_id,
        position_id,
        is_active,
        is_admin,
        weight,
        search_meta,
        created,
        created_by
    )
    VALUES (
        1,
        N'admin',
        N'admin@local',
        N'Administrator',
        @pwd,
        N'',
        0,
        0,
        1,
        1,
        0,
        N'admin administrator admin@local',
        SYSUTCDATETIME(),
        0
    );
END
ELSE
BEGIN
    UPDATE core_acc.users
    SET password_hash = @pwd,
        password_salt = N''
    WHERE LOWER(user_name) = N'admin';
END
GO
