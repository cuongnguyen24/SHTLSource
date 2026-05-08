using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SHTL.Modules.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentDefaultFieldColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "box_no",
                schema: "dbo",
                table: "stg_documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "level_no",
                schema: "dbo",
                table: "stg_documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "poster",
                schema: "dbo",
                table: "stg_documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "receiver",
                schema: "dbo",
                table: "stg_documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "record_title",
                schema: "dbo",
                table: "stg_documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "shelf_no",
                schema: "dbo",
                table: "stg_documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "slot_no",
                schema: "dbo",
                table: "stg_documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "subject",
                schema: "dbo",
                table: "stg_documents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.Sql(@"
UPDATE dbo.stg_documents
SET
    receiver = COALESCE(receiver, field9),
    subject = COALESCE(subject, [describe]),
    level_no = COALESCE(level_no, field10),
    box_no = COALESCE(box_no, field11),
    record_title = COALESCE(record_title, field12),
    poster = COALESCE(poster, author),
    slot_no = COALESCE(slot_no, field13),
    shelf_no = COALESCE(shelf_no, field14);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "box_no",
                schema: "dbo",
                table: "stg_documents");

            migrationBuilder.DropColumn(
                name: "level_no",
                schema: "dbo",
                table: "stg_documents");

            migrationBuilder.DropColumn(
                name: "poster",
                schema: "dbo",
                table: "stg_documents");

            migrationBuilder.DropColumn(
                name: "receiver",
                schema: "dbo",
                table: "stg_documents");

            migrationBuilder.DropColumn(
                name: "record_title",
                schema: "dbo",
                table: "stg_documents");

            migrationBuilder.DropColumn(
                name: "shelf_no",
                schema: "dbo",
                table: "stg_documents");

            migrationBuilder.DropColumn(
                name: "slot_no",
                schema: "dbo",
                table: "stg_documents");

            migrationBuilder.DropColumn(
                name: "subject",
                schema: "dbo",
                table: "stg_documents");
        }
    }
}
