# Modular monolith — DB inventory and dbo naming

## Table inventory (from `db/sqlserver/*.sql`)

| Legacy schema | Table | Suggested `dbo` name |
|---------------|-------|----------------------|
| core_acc | users | acc_users |
| core_acc | roles | acc_roles |
| core_acc | role_permissions | acc_role_permissions |
| core_acc | user_roles | acc_user_roles |
| core_acc | depts | acc_depts |
| core_acc | positions | acc_positions |
| core_acc | teams | acc_teams |
| core_acc | user_sessions | acc_user_sessions |
| core_cnf | channels | cnf_channels |
| core_cnf | configs | cnf_configs |
| core_cnf | content_types | cnf_content_types |
| core_cnf | record_types | cnf_record_types |
| core_cnf | sync_types | cnf_sync_types |
| core_cnf | export_types | cnf_export_types |
| core_cnf | translations | cnf_translations |
| core_cnf | separate_types | cnf_separate_types |
| core_stg | document_folders | stg_document_folders |
| core_stg | documents | stg_documents |
| core_stg | form_cells | stg_form_cells |
| core_stg | ocr_jobs | stg_ocr_jobs |
| core_stg | export_jobs | stg_export_jobs |
| core_stg | doc_types | stg_doc_types |
| core_stg | doc_type_sync_types | stg_doc_type_sync_types |
| core_stg | stg_doc_fields | stg_doc_fields |
| core_stg | stg_doc_field_settings | stg_doc_field_settings |
| core_stg | stg_doc_field_groups | stg_doc_field_groups |
| core_stg | pattern_types | stg_pattern_types |
| core_stg | category_types | stg_category_types |
| core_stg | stg_doc_type_separates | stg_doc_type_separates |
| core_stg | stg_doc_sohoa_ocr_fix_types | stg_doc_sohoa_ocr_fix_types |
| core_stg | stg_doc_sohoa_ocr_fixes | stg_doc_sohoa_ocr_fixes |
| core_stg | stg_doc_type_ocr_fixes | stg_doc_type_ocr_fixes |
| core_stg | doc_type_sync_settings | stg_doc_type_sync_settings |
| core_log | access_logs | log_access_logs |
| core_log | action_logs | log_action_logs |
| core_log | error_logs | log_error_logs |
| core_msg | notifications | msg_notifications |
| core_catalog | provinces | cat_provinces |
| core_catalog | districts | cat_districts |
| core_catalog | wards | cat_wards |

No duplicate short names across schemas; prefixed names avoid future collisions in a single `dbo`.

## Raw SQL audit

Repositories and `ReportService` contain hand-written SQL — each must be ported to EF LINQ, `SqlQuery`, or `ExecuteSql` against `AppDbContext` during the rewrite phase.

## View / route overlap

Each former host (`Web.Account`, `Web.Admin`, …) becomes an **MVC Area** with distinct controller namespaces. Resolve duplicate `HomeController` / shared view paths via `Areas/{Name}/Views/...` and `_ViewStart.cshtml` per area.
