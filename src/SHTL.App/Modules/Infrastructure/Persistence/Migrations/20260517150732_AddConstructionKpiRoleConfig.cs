using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SHTL.Modules.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddConstructionKpiRoleConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
MERGE dbo.cnf_configs WITH (HOLDLOCK) AS t
USING (VALUES
    ('ConstructionKpi_CheckScan_DailyTarget', '80', 'Construction', N'Chỉ tiêu KPI ngày — CheckScan'),
    ('ConstructionKpi_CheckScan_MinQuality', '95', 'Construction', N'Chất lượng tối thiểu (%) — CheckScan'),
    ('ConstructionKpi_CheckScan_Bonus1_MinProcessed', '100', 'Construction', N'Mốc thưởng 1: số tài liệu — CheckScan'),
    ('ConstructionKpi_CheckScan_Bonus1_MinQuality', '98', 'Construction', N'Mốc thưởng 1: chất lượng (%) — CheckScan'),
    ('ConstructionKpi_CheckScan_Bonus1_Amount', '100000', 'Construction', N'Mốc thưởng 1: tiền — CheckScan'),
    ('ConstructionKpi_CheckScan_Bonus2_MinProcessed', '120', 'Construction', N'Mốc thưởng 2: số tài liệu — CheckScan'),
    ('ConstructionKpi_CheckScan_Bonus2_MinQuality', '99', 'Construction', N'Mốc thưởng 2: chất lượng (%) — CheckScan'),
    ('ConstructionKpi_CheckScan_Bonus2_Amount', '200000', 'Construction', N'Mốc thưởng 2: tiền — CheckScan'),
    ('ConstructionKpi_Extract_DailyTarget', '60', 'Construction', N'Chỉ tiêu KPI ngày — Extract'),
    ('ConstructionKpi_Extract_MinQuality', '95', 'Construction', N'Chất lượng tối thiểu (%) — Extract'),
    ('ConstructionKpi_Extract_Bonus1_MinProcessed', '80', 'Construction', N'Mốc thưởng 1: số tài liệu — Extract'),
    ('ConstructionKpi_Extract_Bonus1_MinQuality', '98', 'Construction', N'Mốc thưởng 1: chất lượng (%) — Extract'),
    ('ConstructionKpi_Extract_Bonus1_Amount', '100000', 'Construction', N'Mốc thưởng 1: tiền — Extract'),
    ('ConstructionKpi_PostExtractCheck_DailyTarget', '60', 'Construction', N'Chỉ tiêu KPI ngày — Check sau Extract'),
    ('ConstructionKpi_PostExtractCheck_MinQuality', '96', 'Construction', N'Chất lượng tối thiểu (%) — Check sau Extract'),
    ('ConstructionKpi_PostExtractCheck_Bonus1_MinProcessed', '80', 'Construction', N'Mốc thưởng 1: số tài liệu — Check sau Extract'),
    ('ConstructionKpi_PostExtractCheck_Bonus1_MinQuality', '98', 'Construction', N'Mốc thưởng 1: chất lượng (%) — Check sau Extract'),
    ('ConstructionKpi_PostExtractCheck_Bonus1_Amount', '100000', 'Construction', N'Mốc thưởng 1: tiền — Check sau Extract'),
    ('ConstructionPayrollAttendanceDeductionPerDay', '200000', 'Construction', N'Trừ lương mỗi ngày công thiếu (theo KPI)')
) AS s([key], value, group_name, [description])
ON t.[key] = s.[key]
WHEN MATCHED THEN UPDATE SET
    t.group_name = COALESCE(t.group_name, s.group_name),
    t.[description] = COALESCE(t.[description], s.[description])
WHEN NOT MATCHED THEN
    INSERT([key], value, group_name, [description])
    VALUES (s.[key], s.value, s.group_name, s.[description]);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM dbo.cnf_configs
WHERE [key] LIKE 'ConstructionKpi_%'
   OR [key] = 'ConstructionPayrollAttendanceDeductionPerDay';");
        }
    }
}
