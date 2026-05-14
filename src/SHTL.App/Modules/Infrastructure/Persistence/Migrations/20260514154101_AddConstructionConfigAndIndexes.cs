using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SHTL.Modules.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddConstructionConfigAndIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_stg_construction_batch_assignments_batch_user_step'
      AND object_id = OBJECT_ID('dbo.stg_construction_batch_assignments')
)
CREATE UNIQUE INDEX UX_stg_construction_batch_assignments_batch_user_step
ON dbo.stg_construction_batch_assignments(batch_id, user_id, step);");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_stg_construction_batch_assignments_user_status'
      AND object_id = OBJECT_ID('dbo.stg_construction_batch_assignments')
)
CREATE INDEX IX_stg_construction_batch_assignments_user_status
ON dbo.stg_construction_batch_assignments(user_id, [status]);");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_stg_construction_batch_documents_document'
      AND object_id = OBJECT_ID('dbo.stg_construction_batch_documents')
)
CREATE INDEX IX_stg_construction_batch_documents_document
ON dbo.stg_construction_batch_documents(document_id);");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_stg_construction_batch_documents_assignment'
      AND object_id = OBJECT_ID('dbo.stg_construction_batch_documents')
)
CREATE INDEX IX_stg_construction_batch_documents_assignment
ON dbo.stg_construction_batch_documents(assignment_id);");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_stg_construction_attendances_user_workdate'
      AND object_id = OBJECT_ID('dbo.stg_construction_attendances')
)
CREATE UNIQUE INDEX UX_stg_construction_attendances_user_workdate
ON dbo.stg_construction_attendances(user_id, work_date);");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_stg_construction_user_daily_kpis_user_date_step'
      AND object_id = OBJECT_ID('dbo.stg_construction_user_daily_kpis')
)
CREATE UNIQUE INDEX UX_stg_construction_user_daily_kpis_user_date_step
ON dbo.stg_construction_user_daily_kpis(user_id, work_date, step);");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_stg_construction_payroll_entries_user_month'
      AND object_id = OBJECT_ID('dbo.stg_construction_payroll_entries')
)
CREATE UNIQUE INDEX UX_stg_construction_payroll_entries_user_month
ON dbo.stg_construction_payroll_entries(user_id, [year], [month]);");

            migrationBuilder.Sql(@"
MERGE dbo.cnf_configs WITH (HOLDLOCK) AS t
USING (VALUES
    ('ConstructionPayrollBaseSalary', '5000000', 'Construction', N'Lương cơ bản tháng cho KPI/Payroll thi công'),
    ('ConstructionPayrollRatePerDocument', '1000', 'Construction', N'Đơn giá theo số lượng tài liệu xử lý'),
    ('ConstructionPayrollQualityThresholdHigh', '98', 'Construction', N'Ngưỡng chất lượng cao để nhận thưởng mức cao'),
    ('ConstructionPayrollQualityBonusHigh', '1500000', 'Construction', N'Thưởng chất lượng mức cao'),
    ('ConstructionPayrollQualityThresholdMedium', '95', 'Construction', N'Ngưỡng chất lượng trung bình để nhận thưởng mức vừa'),
    ('ConstructionPayrollQualityBonusMedium', '750000', 'Construction', N'Thưởng chất lượng mức vừa'),
    ('ConstructionPayrollStandardWorkHours', '176', 'Construction', N'Chuẩn giờ công theo tháng'),
    ('ConstructionPayrollAttendanceDeductionPerHour', '20000', 'Construction', N'Mức trừ lương cho mỗi giờ công thiếu')
) AS s([key], value, group_name, [description])
ON t.[key] = s.[key]
WHEN MATCHED THEN UPDATE SET
    t.value = COALESCE(t.value, s.value),
    t.group_name = COALESCE(t.group_name, s.group_name),
    t.[description] = COALESCE(t.[description], s.[description])
WHEN NOT MATCHED THEN
    INSERT([key], value, group_name, [description])
    VALUES (s.[key], s.value, s.group_name, s.[description]);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS UX_stg_construction_batch_assignments_batch_user_step ON dbo.stg_construction_batch_assignments;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS IX_stg_construction_batch_assignments_user_status ON dbo.stg_construction_batch_assignments;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS IX_stg_construction_batch_documents_document ON dbo.stg_construction_batch_documents;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS IX_stg_construction_batch_documents_assignment ON dbo.stg_construction_batch_documents;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS UX_stg_construction_attendances_user_workdate ON dbo.stg_construction_attendances;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS UX_stg_construction_user_daily_kpis_user_date_step ON dbo.stg_construction_user_daily_kpis;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS UX_stg_construction_payroll_entries_user_month ON dbo.stg_construction_payroll_entries;");
        }
    }
}
