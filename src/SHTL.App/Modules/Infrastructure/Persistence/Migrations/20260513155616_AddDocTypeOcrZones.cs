using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SHTL.Modules.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDocTypeOcrZones : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "stg_doc_type_ocr_zones",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    doc_type_id = table.Column<int>(type: "int", nullable: false),
                    field_setting_id = table.Column<int>(type: "int", nullable: false),
                    page_number = table.Column<int>(type: "int", nullable: false),
                    x_ratio = table.Column<decimal>(type: "decimal(18,8)", nullable: false),
                    y_ratio = table.Column<decimal>(type: "decimal(18,8)", nullable: false),
                    width_ratio = table.Column<decimal>(type: "decimal(18,8)", nullable: false),
                    height_ratio = table.Column<decimal>(type: "decimal(18,8)", nullable: false),
                    label = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    sample_text = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    weight = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    created_by = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    updated = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_by = table.Column<int>(type: "int", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_doc_type_ocr_zones", x => x.id);
                    table.CheckConstraint("ck_stg_doc_type_ocr_zones_page", "page_number > 0");
                    table.CheckConstraint("ck_stg_doc_type_ocr_zones_ratio", "x_ratio >= 0 AND x_ratio <= 1 AND y_ratio >= 0 AND y_ratio <= 1 AND width_ratio > 0 AND width_ratio <= 1 AND height_ratio > 0 AND height_ratio <= 1");
                });

            migrationBuilder.CreateIndex(
                name: "ix_stg_doc_type_ocr_zones_doc_type_id_page_number_weight",
                schema: "dbo",
                table: "stg_doc_type_ocr_zones",
                columns: new[] { "doc_type_id", "page_number", "weight" });

            migrationBuilder.CreateIndex(
                name: "ix_stg_doc_type_ocr_zones_field_setting_id",
                schema: "dbo",
                table: "stg_doc_type_ocr_zones",
                column: "field_setting_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "stg_doc_type_ocr_zones",
                schema: "dbo");
        }
    }
}
