$root = Join-Path $PSScriptRoot "..\src\SHTL.App\Modules" | Resolve-Path
$repl = [ordered]@{
    "core_acc.users" = "dbo.acc_users"
    "core_acc.roles" = "dbo.acc_roles"
    "core_acc.depts" = "dbo.acc_depts"
    "core_acc.role_permissions" = "dbo.acc_role_permissions"
    "core_acc.user_roles" = "dbo.acc_user_roles"
    "MERGE core_cnf.configs" = "MERGE dbo.cnf_configs"
    "FROM core_cnf.configs" = "FROM dbo.cnf_configs"
    "INTO core_cnf.configs" = "INTO dbo.cnf_configs"
    "core_cnf.content_types" = "dbo.cnf_content_types"
    "core_cnf.record_types" = "dbo.cnf_record_types"
    "core_cnf.sync_types" = "dbo.cnf_sync_types"
    "core_cnf.export_types" = "dbo.cnf_export_types"
    "core_cnf.separate_types" = "dbo.cnf_separate_types"
    "core_stg.documents" = "dbo.stg_documents"
    "core_stg.form_cells" = "dbo.stg_form_cells"
    "core_stg.ocr_jobs" = "dbo.stg_ocr_jobs"
    "core_stg.export_jobs" = "dbo.stg_export_jobs"
    "core_stg.doc_types" = "dbo.stg_doc_types"
    "core_stg.doc_type_sync_types" = "dbo.stg_doc_type_sync_types"
    "core_stg.doc_type_sync_settings" = "dbo.stg_doc_type_sync_settings"
    "core_stg.stg_doc_fields" = "dbo.stg_doc_fields"
    "core_stg.stg_doc_field_settings" = "dbo.stg_doc_field_settings"
    "core_stg.stg_doc_field_groups" = "dbo.stg_doc_field_groups"
    "core_stg.stg_doc_type_separates" = "dbo.stg_doc_type_separates"
    "core_stg.stg_doc_sohoa_ocr_fixes" = "dbo.stg_doc_sohoa_ocr_fixes"
    "core_stg.stg_doc_sohoa_ocr_fix_types" = "dbo.stg_doc_sohoa_ocr_fix_types"
    "core_stg.stg_doc_type_ocr_fixes" = "dbo.stg_doc_type_ocr_fixes"
    "core_stg.pattern_types" = "dbo.stg_pattern_types"
    "core_stg.category_types" = "dbo.stg_category_types"
    "core_log.action_logs" = "dbo.log_action_logs"
    "core_log.access_logs" = "dbo.log_access_logs"
    "core_log.error_logs" = "dbo.log_error_logs"
    "core_catalog.provinces" = "dbo.cat_provinces"
    "core_catalog.districts" = "dbo.cat_districts"
    "core_catalog.wards" = "dbo.cat_wards"
    "core_msg.notifications" = "dbo.msg_notifications"
}
Get-ChildItem -Path $root -Recurse -Include *.cs,*.cshtml | ForEach-Object {
    if ($_.FullName -match "\\(bin|obj)\\") { return }
    $t = [IO.File]::ReadAllText($_.FullName)
    $o = $t
    foreach ($k in $repl.Keys) { $t = $t.Replace($k, $repl[$k]) }
    if ($t -ne $o) { [IO.File]::WriteAllText($_.FullName, $t) }
}
Write-Host "SQL table prefix replace done"
