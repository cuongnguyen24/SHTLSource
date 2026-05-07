using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SHTL.Modules.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveChannelIdColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "stg_ocr_jobs");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "stg_form_cells");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "stg_export_jobs");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "stg_documents");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "stg_doc_types");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "stg_doc_type_sync_types");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "stg_doc_type_separates");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "stg_doc_type_ocr_fixes");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "stg_doc_sohoa_ocr_fixes");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "stg_doc_field_groups");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "stg_category_types");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "log_error_logs");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "log_action_logs");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "log_access_logs");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "cnf_sync_types");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "cnf_separate_types");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "cnf_record_types");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "cnf_export_types");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "cnf_content_types");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "cnf_configs");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "acc_users");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "acc_user_roles");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "acc_roles");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "acc_role_permissions");

            migrationBuilder.DropColumn(
                name: "channel_id",
                schema: "dbo",
                table: "acc_depts");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "stg_ocr_jobs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "stg_form_cells",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "stg_export_jobs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "stg_documents",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "stg_doc_types",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "stg_doc_type_sync_types",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "stg_doc_type_separates",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "stg_doc_type_ocr_fixes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "stg_doc_sohoa_ocr_fixes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "stg_doc_field_groups",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "stg_category_types",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "log_error_logs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "log_action_logs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "log_access_logs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "cnf_sync_types",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "cnf_separate_types",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "cnf_record_types",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "cnf_export_types",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "cnf_content_types",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "cnf_configs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "acc_users",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "acc_user_roles",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "acc_roles",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "acc_role_permissions",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "channel_id",
                schema: "dbo",
                table: "acc_depts",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }
    }
}
