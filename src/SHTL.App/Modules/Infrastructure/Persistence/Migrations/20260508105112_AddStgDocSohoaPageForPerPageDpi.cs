using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SHTL.Modules.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStgDocSohoaPageForPerPageDpi : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "stg_doc_sohoa_page",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    document_id = table.Column<long>(type: "bigint", nullable: false),
                    page_number = table.Column<int>(type: "int", nullable: false),
                    dpi_x = table.Column<int>(type: "int", nullable: false),
                    dpi_y = table.Column<int>(type: "int", nullable: false),
                    page_size = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_doc_sohoa_page", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "stg_doc_sohoa_page",
                schema: "dbo");
        }
    }
}
