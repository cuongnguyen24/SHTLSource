using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SHTL.Modules.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "dbo");

            migrationBuilder.CreateTable(
                name: "acc_depts",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    describe = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    parent_id = table.Column<int>(type: "int", nullable: true),
                    parent = table.Column<int>(type: "int", nullable: false),
                    parents = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    weight = table.Column<int>(type: "int", nullable: false),
                    search_meta = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<int>(type: "int", nullable: false),
                    updated = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_by = table.Column<int>(type: "int", nullable: false),
                    channel_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_acc_depts", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "acc_roles",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    parent = table.Column<int>(type: "int", nullable: false),
                    parents = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    module_code = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    search_meta = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<int>(type: "int", nullable: false),
                    updated = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_by = table.Column<int>(type: "int", nullable: false),
                    channel_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_acc_roles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "acc_user_roles",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    user_id = table.Column<int>(type: "int", nullable: false),
                    role_id = table.Column<int>(type: "int", nullable: false),
                    channel_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_acc_user_roles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "acc_users",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    channel_id = table.Column<int>(type: "int", nullable: false),
                    user_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    email = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    full_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    password_hash = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    password_salt = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    dept_id = table.Column<int>(type: "int", nullable: false),
                    position_id = table.Column<int>(type: "int", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    is_admin = table.Column<bool>(type: "bit", nullable: false),
                    avatar = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    phone = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    last_login = table.Column<DateTime>(type: "datetime2", nullable: true),
                    search_meta = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    weight = table.Column<int>(type: "int", nullable: false),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<int>(type: "int", nullable: false),
                    updated = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_by = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_acc_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "cnf_channels",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    describe = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    url = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    lang = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    logo = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    weight = table.Column<int>(type: "int", nullable: false),
                    parent = table.Column<int>(type: "int", nullable: false),
                    parents = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    start_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    end_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    account_limit = table.Column<int>(type: "int", nullable: false),
                    storage_limit = table.Column<long>(type: "bigint", nullable: false),
                    document_limit = table.Column<long>(type: "bigint", nullable: false),
                    is_published = table.Column<bool>(type: "bit", nullable: false),
                    search_meta = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<int>(type: "int", nullable: false),
                    updated = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_by = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cnf_channels", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "cnf_export_types",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    excel_file_path = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    excel_file_name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    json_config = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    search_meta = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<int>(type: "int", nullable: false),
                    updated = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_by = table.Column<int>(type: "int", nullable: false),
                    channel_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cnf_export_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_documents",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    doc_type_id = table.Column<int>(type: "int", nullable: false),
                    record_type_id = table.Column<int>(type: "int", nullable: false),
                    content_type_id = table.Column<int>(type: "int", nullable: false),
                    sync_type_id = table.Column<int>(type: "int", nullable: false),
                    folder_id = table.Column<long>(type: "bigint", nullable: false),
                    dept_id = table.Column<int>(type: "int", nullable: false),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    describe = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    symbol_no = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    record_no = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    issued_by = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    issued = table.Column<DateTime>(type: "datetime2", nullable: true),
                    issued_year = table.Column<int>(type: "int", nullable: true),
                    author = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    signer = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    noted = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    summary = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    search_meta = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    file_name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    file_path = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    path_original = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    path_converted = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    path_pdf_searchable = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    thumb_path = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    extension = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    file_size = table.Column<long>(type: "bigint", nullable: false),
                    page_count = table.Column<int>(type: "int", nullable: false),
                    file_hash = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    is_color_scan = table.Column<bool>(type: "bit", nullable: false),
                    min_dpi = table.Column<double>(type: "float", nullable: false),
                    max_dpi = table.Column<double>(type: "float", nullable: false),
                    version_pdf = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    workstation_name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    status = table.Column<byte>(type: "tinyint", nullable: false),
                    current_step = table.Column<byte>(type: "tinyint", nullable: false),
                    locked_by_step = table.Column<byte>(type: "tinyint", nullable: false),
                    locked_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    locked_by_user_id = table.Column<int>(type: "int", nullable: false),
                    is_checked_scan1 = table.Column<bool>(type: "bit", nullable: false),
                    checked_scan1at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    checked_scan1by = table.Column<int>(type: "int", nullable: false),
                    checked_scan1result = table.Column<byte>(type: "tinyint", nullable: false),
                    is_checked_scan2 = table.Column<bool>(type: "bit", nullable: false),
                    checked_scan2at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    checked_scan2by = table.Column<int>(type: "int", nullable: false),
                    checked_scan2result = table.Column<byte>(type: "tinyint", nullable: false),
                    is_zoned = table.Column<bool>(type: "bit", nullable: false),
                    zoned_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    zoned_by = table.Column<int>(type: "int", nullable: false),
                    zoned_result = table.Column<byte>(type: "tinyint", nullable: false),
                    ocr_status = table.Column<byte>(type: "tinyint", nullable: false),
                    is_ocr_enabled = table.Column<bool>(type: "bit", nullable: false),
                    ocr_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ocr_by = table.Column<int>(type: "int", nullable: false),
                    ocr_result = table.Column<byte>(type: "tinyint", nullable: false),
                    is_extracted = table.Column<bool>(type: "bit", nullable: false),
                    extracted_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    extracted_by = table.Column<int>(type: "int", nullable: false),
                    extracted_result = table.Column<byte>(type: "tinyint", nullable: false),
                    extracted_return_count = table.Column<int>(type: "int", nullable: false),
                    extracted_return_reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    is_checked1 = table.Column<bool>(type: "bit", nullable: false),
                    checked1at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    checked1by = table.Column<int>(type: "int", nullable: false),
                    checked1result = table.Column<byte>(type: "tinyint", nullable: false),
                    checked1return_count = table.Column<int>(type: "int", nullable: false),
                    checked1return_reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    is_checked2 = table.Column<bool>(type: "bit", nullable: false),
                    checked2at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    checked2by = table.Column<int>(type: "int", nullable: false),
                    checked2result = table.Column<byte>(type: "tinyint", nullable: false),
                    checked2return_reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    is_checked_final = table.Column<bool>(type: "bit", nullable: false),
                    checked_final_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    checked_final_by = table.Column<int>(type: "int", nullable: false),
                    checked_final_result = table.Column<byte>(type: "tinyint", nullable: false),
                    checked_final_change_info = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    is_checked_logic = table.Column<bool>(type: "bit", nullable: false),
                    checked_logic_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    checked_logic_by = table.Column<int>(type: "int", nullable: false),
                    checked_logic_result = table.Column<byte>(type: "tinyint", nullable: false),
                    export_status = table.Column<byte>(type: "tinyint", nullable: false),
                    exported_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    exported_by = table.Column<int>(type: "int", nullable: false),
                    excel_metadata_id = table.Column<long>(type: "bigint", nullable: false),
                    page_count_a4 = table.Column<int>(type: "int", nullable: false),
                    page_count_a3 = table.Column<int>(type: "int", nullable: false),
                    page_count_a2 = table.Column<int>(type: "int", nullable: false),
                    page_count_a1 = table.Column<int>(type: "int", nullable: false),
                    page_count_a0 = table.Column<int>(type: "int", nullable: false),
                    page_count_other = table.Column<int>(type: "int", nullable: false),
                    field1 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    field2 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    field3 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    field4 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    field5 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    field6 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    field7 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    field8 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    field9 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    field10 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    field11 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    field12 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    field13 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    field14 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    field15 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    field16 = table.Column<long>(type: "bigint", nullable: true),
                    field17 = table.Column<long>(type: "bigint", nullable: true),
                    field18 = table.Column<long>(type: "bigint", nullable: true),
                    field19 = table.Column<long>(type: "bigint", nullable: true),
                    field20 = table.Column<long>(type: "bigint", nullable: true),
                    field21 = table.Column<DateTime>(type: "datetime2", nullable: true),
                    field22 = table.Column<DateTime>(type: "datetime2", nullable: true),
                    field23 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    field24 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    field25 = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    sort_meta = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    version = table.Column<int>(type: "int", nullable: false),
                    weight = table.Column<int>(type: "int", nullable: false),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<int>(type: "int", nullable: false),
                    updated = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_by = table.Column<int>(type: "int", nullable: false),
                    channel_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_documents", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "acc_depts",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "acc_roles",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "acc_user_roles",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "acc_users",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "cnf_channels",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "cnf_export_types",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_documents",
                schema: "dbo");
        }
    }
}
