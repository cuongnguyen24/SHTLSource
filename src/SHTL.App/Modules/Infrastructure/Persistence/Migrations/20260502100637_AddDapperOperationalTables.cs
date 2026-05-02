using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SHTL.Modules.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDapperOperationalTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "exporter_class",
                schema: "dbo",
                table: "cnf_export_types",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "weight",
                schema: "dbo",
                table: "cnf_export_types",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "acc_role_permissions",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    role_id = table.Column<int>(type: "int", nullable: false),
                    channel_id = table.Column<int>(type: "int", nullable: false),
                    permission_code = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_acc_role_permissions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "cnf_configs",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    channel_id = table.Column<int>(type: "int", nullable: false),
                    key = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    value = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    group_name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cnf_configs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "cnf_content_types",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    code = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    describe = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    weight = table.Column<int>(type: "int", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    is_doc_type = table.Column<bool>(type: "bit", nullable: false),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<int>(type: "int", nullable: false),
                    updated = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_by = table.Column<int>(type: "int", nullable: false),
                    channel_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cnf_content_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "cnf_record_types",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    code = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    describe = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    weight = table.Column<int>(type: "int", nullable: false),
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
                    table.PrimaryKey("pk_cnf_record_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "cnf_separate_types",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    channel_id = table.Column<int>(type: "int", nullable: false),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cnf_separate_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "cnf_sync_types",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    describe = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    weight = table.Column<int>(type: "int", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<int>(type: "int", nullable: false),
                    updated = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_by = table.Column<int>(type: "int", nullable: false),
                    channel_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cnf_sync_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "log_access_logs",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    channel_id = table.Column<int>(type: "int", nullable: false),
                    user_id = table.Column<int>(type: "int", nullable: false),
                    user_name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    path = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    method = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ip_address = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    user_agent = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    status_code = table.Column<int>(type: "int", nullable: false),
                    duration_ms = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_log_access_logs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "log_action_logs",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    channel_id = table.Column<int>(type: "int", nullable: false),
                    user_id = table.Column<int>(type: "int", nullable: false),
                    user_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    action = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    table_name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    record_id = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    old_value = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    new_value = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ip_address = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_log_action_logs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "log_error_logs",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    channel_id = table.Column<int>(type: "int", nullable: false),
                    user_id = table.Column<int>(type: "int", nullable: true),
                    message = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    stack_trace = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    source = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    url = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    level = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_log_error_logs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_category_types",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    channel_id = table.Column<int>(type: "int", nullable: false),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    weight = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_category_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_doc_field_groups",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    channel_id = table.Column<int>(type: "int", nullable: false),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    group_name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    weight = table.Column<int>(type: "int", nullable: false),
                    id_parent = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_doc_field_groups", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_doc_field_settings",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    id_type = table.Column<int>(type: "int", nullable: false),
                    id_field = table.Column<int>(type: "int", nullable: false),
                    id_pattern_type = table.Column<int>(type: "int", nullable: false),
                    id_category_type = table.Column<int>(type: "int", nullable: false),
                    id_field_group = table.Column<int>(type: "int", nullable: false),
                    ocr_type = table.Column<int>(type: "int", nullable: false),
                    i_type = table.Column<int>(type: "int", nullable: false),
                    i_row = table.Column<int>(type: "int", nullable: false),
                    i_col = table.Column<int>(type: "int", nullable: false),
                    title = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    weight = table.Column<int>(type: "int", nullable: false),
                    is_multi = table.Column<bool>(type: "bit", nullable: false),
                    is_search = table.Column<bool>(type: "bit", nullable: false),
                    is_catalog = table.Column<bool>(type: "bit", nullable: false),
                    is_catalog_main = table.Column<bool>(type: "bit", nullable: false),
                    pattern_custom = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    fix_value = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    min_value = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    max_value = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    min_len = table.Column<int>(type: "int", nullable: false),
                    max_len = table.Column<int>(type: "int", nullable: false),
                    is_required = table.Column<bool>(type: "bit", nullable: false),
                    is_read_only = table.Column<bool>(type: "bit", nullable: false),
                    is_upper_case = table.Column<bool>(type: "bit", nullable: false),
                    is_capitalize = table.Column<bool>(type: "bit", nullable: false),
                    format = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    is_ocr_fix = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_doc_field_settings", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_doc_fields",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    title = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    is_required = table.Column<bool>(type: "bit", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    is_record = table.Column<bool>(type: "bit", nullable: false),
                    datatype = table.Column<int>(type: "int", nullable: false),
                    c_class = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_doc_fields", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_doc_sohoa_ocr_fix_types",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    code = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_doc_sohoa_ocr_fix_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_doc_sohoa_ocr_fixes",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    channel_id = table.Column<int>(type: "int", nullable: false),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    type = table.Column<int>(type: "int", nullable: false),
                    from_str = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    to_str = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    from_position = table.Column<int>(type: "int", nullable: false),
                    to_position = table.Column<int>(type: "int", nullable: false),
                    excepts = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_doc_sohoa_ocr_fixes", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_doc_type_ocr_fixes",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    channel_id = table.Column<int>(type: "int", nullable: false),
                    id_doctype = table.Column<int>(type: "int", nullable: false),
                    id_field = table.Column<int>(type: "int", nullable: false),
                    id_ocr_fix = table.Column<int>(type: "int", nullable: false),
                    weight = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_doc_type_ocr_fixes", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_doc_type_separates",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    channel_id = table.Column<int>(type: "int", nullable: false),
                    id_doctype = table.Column<int>(type: "int", nullable: false),
                    x = table.Column<int>(type: "int", nullable: false),
                    y = table.Column<int>(type: "int", nullable: false),
                    width = table.Column<int>(type: "int", nullable: false),
                    height = table.Column<int>(type: "int", nullable: false),
                    weight = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_doc_type_separates", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_doc_type_sync_settings",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    id_type = table.Column<int>(type: "int", nullable: false),
                    id_field = table.Column<int>(type: "int", nullable: false),
                    id_pattern_type = table.Column<int>(type: "int", nullable: false),
                    title = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    weight = table.Column<int>(type: "int", nullable: false),
                    is_catalog = table.Column<bool>(type: "bit", nullable: false),
                    pattern_custom = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    fix_value = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    min_value = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    max_value = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    min_len = table.Column<int>(type: "int", nullable: false),
                    max_len = table.Column<int>(type: "int", nullable: false),
                    is_required = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_doc_type_sync_settings", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_doc_type_sync_types",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    channel_id = table.Column<int>(type: "int", nullable: false),
                    doc_type_id = table.Column<int>(type: "int", nullable: false),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    describe = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    format = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    scan_path_root = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    weight = table.Column<int>(type: "int", nullable: false),
                    is_default = table.Column<bool>(type: "bit", nullable: false),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<int>(type: "int", nullable: false),
                    updated = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_by = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_doc_type_sync_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_doc_types",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    channel_id = table.Column<int>(type: "int", nullable: false),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    describe = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    parent_id = table.Column<int>(type: "int", nullable: true),
                    parents = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    is_default = table.Column<bool>(type: "bit", nullable: false),
                    is_ocr_manual_zoned = table.Column<bool>(type: "bit", nullable: false),
                    field_quantity = table.Column<int>(type: "int", nullable: false),
                    separate_type_id = table.Column<int>(type: "int", nullable: false),
                    extractor_type_id = table.Column<int>(type: "int", nullable: false),
                    weight = table.Column<int>(type: "int", nullable: false),
                    review_status = table.Column<int>(type: "int", nullable: false),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<int>(type: "int", nullable: false),
                    updated = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_by = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_doc_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_export_jobs",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    channel_id = table.Column<int>(type: "int", nullable: false),
                    export_type_id = table.Column<int>(type: "int", nullable: false),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    filter_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    export_input_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    field_folder_export = table.Column<int>(type: "int", nullable: false),
                    doc_status = table.Column<int>(type: "int", nullable: false),
                    is_export_file = table.Column<bool>(type: "bit", nullable: false),
                    status = table.Column<byte>(type: "tinyint", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    processed_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    completed_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    total = table.Column<int>(type: "int", nullable: false),
                    processed = table.Column<int>(type: "int", nullable: false),
                    success = table.Column<int>(type: "int", nullable: false),
                    error = table.Column<int>(type: "int", nullable: false),
                    download_path = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    download_log_path = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    message = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    compressed_percent = table.Column<int>(type: "int", nullable: false),
                    requested_by = table.Column<int>(type: "int", nullable: false),
                    dept_id = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_export_jobs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_form_cells",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    channel_id = table.Column<int>(type: "int", nullable: false),
                    document_id = table.Column<long>(type: "bigint", nullable: false),
                    cell = table.Column<int>(type: "int", nullable: false),
                    cell_type = table.Column<int>(type: "int", nullable: false),
                    group_cell = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    field = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    title = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    x = table.Column<int>(type: "int", nullable: false),
                    y = table.Column<int>(type: "int", nullable: false),
                    width = table.Column<int>(type: "int", nullable: false),
                    height = table.Column<int>(type: "int", nullable: false),
                    page = table.Column<int>(type: "int", nullable: false),
                    page_width = table.Column<int>(type: "int", nullable: false),
                    page_height = table.Column<int>(type: "int", nullable: false),
                    cropped_path = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    value = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    extracted_value = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    extracted_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    extracted_by = table.Column<int>(type: "int", nullable: false),
                    extracted_result = table.Column<byte>(type: "tinyint", nullable: false),
                    checked1_value = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    checked1_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    checked1_by = table.Column<int>(type: "int", nullable: false),
                    checked1_result = table.Column<byte>(type: "tinyint", nullable: false),
                    is_value_diff1 = table.Column<bool>(type: "bit", nullable: false),
                    checked2_value = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    checked2_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    checked2_by = table.Column<int>(type: "int", nullable: false),
                    checked2_result = table.Column<byte>(type: "tinyint", nullable: false),
                    is_value_diff2 = table.Column<bool>(type: "bit", nullable: false),
                    province = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    district = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ward = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<int>(type: "int", nullable: false),
                    updated = table.Column<DateTime>(type: "datetime2", nullable: true),
                    updated_by = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_form_cells", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_ocr_jobs",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    channel_id = table.Column<int>(type: "int", nullable: false),
                    document_id = table.Column<long>(type: "bigint", nullable: false),
                    type = table.Column<byte>(type: "tinyint", nullable: false),
                    status = table.Column<byte>(type: "tinyint", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    processed_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    completed_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    message = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    retry_count = table.Column<int>(type: "int", nullable: false),
                    priority = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_ocr_jobs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stg_pattern_types",
                schema: "dbo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stg_pattern_types", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "acc_role_permissions",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "cnf_configs",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "cnf_content_types",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "cnf_record_types",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "cnf_separate_types",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "cnf_sync_types",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "log_access_logs",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "log_action_logs",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "log_error_logs",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_category_types",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_doc_field_groups",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_doc_field_settings",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_doc_fields",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_doc_sohoa_ocr_fix_types",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_doc_sohoa_ocr_fixes",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_doc_type_ocr_fixes",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_doc_type_separates",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_doc_type_sync_settings",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_doc_type_sync_types",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_doc_types",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_export_jobs",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_form_cells",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_ocr_jobs",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "stg_pattern_types",
                schema: "dbo");

            migrationBuilder.DropColumn(
                name: "exporter_class",
                schema: "dbo",
                table: "cnf_export_types");

            migrationBuilder.DropColumn(
                name: "weight",
                schema: "dbo",
                table: "cnf_export_types");
        }
    }
}
