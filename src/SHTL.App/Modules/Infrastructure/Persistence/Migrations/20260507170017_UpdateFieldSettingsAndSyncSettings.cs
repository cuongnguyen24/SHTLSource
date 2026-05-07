using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SHTL.Modules.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UpdateFieldSettingsAndSyncSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "i_type",
                schema: "dbo",
                table: "stg_doc_type_sync_settings",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "id_field_group",
                schema: "dbo",
                table: "stg_doc_type_sync_settings",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "is_capitalize",
                schema: "dbo",
                table: "stg_doc_type_sync_settings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_read_only",
                schema: "dbo",
                table: "stg_doc_type_sync_settings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_upper_case",
                schema: "dbo",
                table: "stg_doc_type_sync_settings",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "i_type",
                schema: "dbo",
                table: "stg_doc_type_sync_settings");

            migrationBuilder.DropColumn(
                name: "id_field_group",
                schema: "dbo",
                table: "stg_doc_type_sync_settings");

            migrationBuilder.DropColumn(
                name: "is_capitalize",
                schema: "dbo",
                table: "stg_doc_type_sync_settings");

            migrationBuilder.DropColumn(
                name: "is_read_only",
                schema: "dbo",
                table: "stg_doc_type_sync_settings");

            migrationBuilder.DropColumn(
                name: "is_upper_case",
                schema: "dbo",
                table: "stg_doc_type_sync_settings");
        }
    }
}
