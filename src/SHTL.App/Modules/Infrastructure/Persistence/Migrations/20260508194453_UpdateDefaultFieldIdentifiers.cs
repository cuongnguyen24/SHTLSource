using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SHTL.Modules.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UpdateDefaultFieldIdentifiers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE f
SET 
    f.name = m.name,
    f.title = m.title
FROM dbo.stg_doc_fields f
INNER JOIN (VALUES
    (1, N'title',       N'Tên'),
    (2, N'symbolno',    N'Số ký hiệu'),
    (3, N'issuer',      N'Cơ quan ban hành'),
    (4, N'receiver',    N'Nơi nhận'),
    (5, N'subject',     N'Về việc'),
    (6, N'levelno',     N'Tầng số'),
    (7, N'boxno',       N'Hộp số'),
    (8, N'recordno',    N'Hồ sơ số'),
    (9, N'recordtitle', N'Tiêu đề hồ sơ'),
    (10, N'poster',     N'Người lập'),
    (11, N'signer',     N'Người ký'),
    (12, N'slotno',     N'Khoang số'),
    (13, N'shelfno',    N'Giá / kệ số'),
    (14, N'noted',      N'Ghi chú')
) m(id, name, title) ON m.id = f.id;

UPDATE s
SET s.title = m.title
FROM dbo.stg_doc_field_settings s
INNER JOIN (VALUES
    (1, N'Tên'),
    (2, N'Số ký hiệu'),
    (3, N'Cơ quan ban hành'),
    (4, N'Nơi nhận'),
    (5, N'Về việc'),
    (6, N'Tầng số'),
    (7, N'Hộp số'),
    (8, N'Hồ sơ số'),
    (9, N'Tiêu đề hồ sơ'),
    (10, N'Người lập'),
    (11, N'Người ký'),
    (12, N'Khoang số'),
    (13, N'Giá / kệ số'),
    (14, N'Ghi chú')
) m(id, title) ON m.id = s.id_field
WHERE ISNULL(s.is_catalog, 0) = 0;

UPDATE s
SET s.title = m.title
FROM dbo.stg_doc_type_sync_settings s
INNER JOIN (VALUES
    (1, N'Tên'),
    (2, N'Số ký hiệu'),
    (3, N'Cơ quan ban hành'),
    (4, N'Nơi nhận'),
    (5, N'Về việc'),
    (6, N'Tầng số'),
    (7, N'Hộp số'),
    (8, N'Hồ sơ số'),
    (9, N'Tiêu đề hồ sơ'),
    (10, N'Người lập'),
    (11, N'Người ký'),
    (12, N'Khoang số'),
    (13, N'Giá / kệ số'),
    (14, N'Ghi chú')
) m(id, title) ON m.id = s.id_field
WHERE ISNULL(s.is_catalog, 0) = 0;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE f
SET 
    f.name = m.name,
    f.title = m.title
FROM dbo.stg_doc_fields f
INNER JOIN (VALUES
    (1, N'dc_title',    N'Tên'),
    (2, N'dc_symbol',   N'Số ký hiệu'),
    (3, N'dc_receiver', N'Nơi nhận'),
    (4, N'dc_box',      N'Hộp'),
    (5, N'dc_num1',     N'Số nguyên mẫu'),
    (6, N'dc_date1',    N'Ngày tháng mẫu'),
    (7, N'dc_custom1',  N'Tùy chỉnh'),
    (8, N'dc_select1',  N'Chọn'),
    (9, N'fc_title',    N'Tiêu đề hồ sơ'),
    (10, N'fc_end',     N'Thời gian kết thúc'),
    (11, N'fc_lang',    N'Ngôn ngữ'),
    (12, N'fc_start',   N'Thời gian bắt đầu'),
    (13, N'fc_pages',   N'Số lượng tờ'),
    (14, N'fc_store',   N'Thời hạn lưu trữ')
) m(id, name, title) ON m.id = f.id;
");
        }
    }
}
