using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SHTL.Modules.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddConstructionOpsAndKpiPayroll : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "stg_construction_attendances",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    user_id = table.Column<int>(type: "int", nullable: false),
                    work_date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    check_in_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    check_out_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    work_hours = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<int>(type: "int", nullable: false),
                    updated = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_by = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_construction_attendances", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_construction_batch_assignments",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    batch_id = table.Column<long>(type: "bigint", nullable: false),
                    user_id = table.Column<int>(type: "int", nullable: false),
                    step = table.Column<byte>(type: "tinyint", nullable: false),
                    status = table.Column<byte>(type: "tinyint", nullable: false),
                    assigned_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    assigned_by = table.Column<int>(type: "int", nullable: false),
                    completed_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<int>(type: "int", nullable: false),
                    updated = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_by = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_construction_batch_assignments", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_construction_batch_documents",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    batch_id = table.Column<long>(type: "bigint", nullable: false),
                    document_id = table.Column<long>(type: "bigint", nullable: false),
                    assignment_id = table.Column<long>(type: "bigint", nullable: true),
                    current_step = table.Column<byte>(type: "tinyint", nullable: false),
                    status = table.Column<byte>(type: "tinyint", nullable: false),
                    is_owned_by_uploader = table.Column<bool>(type: "bit", nullable: false),
                    started_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    completed_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<int>(type: "int", nullable: false),
                    updated = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_by = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_construction_batch_documents", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_construction_batches",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    folder_id = table.Column<long>(type: "bigint", nullable: true),
                    assigned_to_user_id = table.Column<int>(type: "int", nullable: true),
                    assigned_to_dept_id = table.Column<int>(type: "int", nullable: true),
                    status = table.Column<byte>(type: "tinyint", nullable: false),
                    total_documents = table.Column<int>(type: "int", nullable: false),
                    started_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    due_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    completed_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<int>(type: "int", nullable: false),
                    updated = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_by = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_construction_batches", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_construction_payroll_entries",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    user_id = table.Column<int>(type: "int", nullable: false),
                    year = table.Column<int>(type: "int", nullable: false),
                    month = table.Column<int>(type: "int", nullable: false),
                    base_salary = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    quantity_amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    quality_bonus = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    attendance_deduction = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    total_salary = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    status = table.Column<byte>(type: "tinyint", nullable: false),
                    approved_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    approved_by = table.Column<int>(type: "int", nullable: false),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<int>(type: "int", nullable: false),
                    updated = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_by = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_construction_payroll_entries", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_construction_user_daily_kpis",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    user_id = table.Column<int>(type: "int", nullable: false),
                    work_date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    step = table.Column<byte>(type: "tinyint", nullable: false),
                    batch_id = table.Column<long>(type: "bigint", nullable: true),
                    documents_processed = table.Column<int>(type: "int", nullable: false),
                    documents_passed = table.Column<int>(type: "int", nullable: false),
                    documents_failed = table.Column<int>(type: "int", nullable: false),
                    documents_returned = table.Column<int>(type: "int", nullable: false),
                    quality_score = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    avg_minutes_per_document = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    work_hours = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<int>(type: "int", nullable: false),
                    updated = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_by = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_construction_user_daily_kpis", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "stg_construction_attendances",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_construction_batch_assignments",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_construction_batch_documents",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_construction_batches",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_construction_payroll_entries",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_construction_user_daily_kpis",
                schema: "dbo");
        }
    }
}
