using Microsoft.EntityFrameworkCore;
using SHTL.Modules.Core.Domain.Entities.Acc;
using SHTL.Modules.Core.Domain.Entities.Cnf;
using SHTL.Modules.Core.Domain.Entities.Log;
using SHTL.Modules.Core.Domain.Entities.Stg;
using StgExportType = SHTL.Modules.Core.Domain.Entities.Stg.ExportType;

namespace SHTL.Modules.Infrastructure.Persistence;

/// <summary>Single EF Core context for the modular monolith (flat dbo, prefixed table names).</summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Dept> Depts => Set<Dept>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<AccRolePermission> AccRolePermissions => Set<AccRolePermission>();

    public DbSet<Document> Documents => Set<Document>();
    public DbSet<DocumentPage> DocumentPages => Set<DocumentPage>();
    public DbSet<FormCell> FormCells => Set<FormCell>();
    public DbSet<OcrJob> OcrJobs => Set<OcrJob>();
    public DbSet<ExportJob> ExportJobs => Set<ExportJob>();

    public DbSet<Channel> Channels => Set<Channel>();
    public DbSet<CnfConfigEntry> CnfConfigEntries => Set<CnfConfigEntry>();
    public DbSet<ContentType> CnfContentTypes => Set<ContentType>();
    public DbSet<RecordType> CnfRecordTypes => Set<RecordType>();
    public DbSet<SyncType> CnfSyncTypes => Set<SyncType>();
    public DbSet<CnfSeparateType> CnfSeparateTypes => Set<CnfSeparateType>();
    public DbSet<StgExportType> ExportTypes => Set<StgExportType>();

    public DbSet<StgDocType> StgDocTypes => Set<StgDocType>();
    public DbSet<StgDocTypeSyncType> StgDocTypeSyncTypes => Set<StgDocTypeSyncType>();
    public DbSet<StgDocTypeSyncSetting> StgDocTypeSyncSettings => Set<StgDocTypeSyncSetting>();
    public DbSet<StgDocField> StgDocFields => Set<StgDocField>();
    public DbSet<StgDocFieldSetting> StgDocFieldSettings => Set<StgDocFieldSetting>();
    public DbSet<StgCategoryType> StgCategoryTypes => Set<StgCategoryType>();
    public DbSet<StgPatternType> StgPatternTypes => Set<StgPatternType>();
    public DbSet<StgDocFieldGroup> StgDocFieldGroups => Set<StgDocFieldGroup>();
    public DbSet<StgDocTypeSeparate> StgDocTypeSeparates => Set<StgDocTypeSeparate>();
    public DbSet<StgDocSoHoaOcrFix> StgDocSoHoaOcrFixes => Set<StgDocSoHoaOcrFix>();
    public DbSet<StgDocSoHoaOcrFixType> StgDocSoHoaOcrFixTypes => Set<StgDocSoHoaOcrFixType>();
    public DbSet<StgDocTypeOcrFix> StgDocTypeOcrFixes => Set<StgDocTypeOcrFix>();

    public DbSet<ActionLog> ActionLogs => Set<ActionLog>();
    public DbSet<ErrorLog> ErrorLogs => Set<ErrorLog>();
    public DbSet<AccessLog> AccessLogs => Set<AccessLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("dbo");

        modelBuilder.Entity<User>().ToTable("acc_users");
        modelBuilder.Entity<Role>().ToTable("acc_roles");
        modelBuilder.Entity<Dept>().ToTable("acc_depts");
        modelBuilder.Entity<UserRole>().ToTable("acc_user_roles");
        modelBuilder.Entity<AccRolePermission>().ToTable("acc_role_permissions");

        modelBuilder.Entity<Document>().ToTable("stg_documents");
        modelBuilder.Entity<Document>().Property(e => e.Describe).HasColumnName("describe");
        modelBuilder.Entity<Document>().Property(e => e.Receiver).HasColumnName("receiver");
        modelBuilder.Entity<Document>().Property(e => e.Subject).HasColumnName("subject");
        modelBuilder.Entity<Document>().Property(e => e.LevelNo).HasColumnName("level_no");
        modelBuilder.Entity<Document>().Property(e => e.BoxNo).HasColumnName("box_no");
        modelBuilder.Entity<Document>().Property(e => e.RecordTitle).HasColumnName("record_title");
        modelBuilder.Entity<Document>().Property(e => e.Poster).HasColumnName("poster");
        modelBuilder.Entity<Document>().Property(e => e.SlotNo).HasColumnName("slot_no");
        modelBuilder.Entity<Document>().Property(e => e.ShelfNo).HasColumnName("shelf_no");
        modelBuilder.Entity<DocumentPage>().ToTable("stg_doc_sohoa_page");

        var formCell = modelBuilder.Entity<FormCell>();
        formCell.ToTable("stg_form_cells");
        // Dapper/SQL dùng checked1_value, … — snake_case mặc định sinh checked1value.
        formCell.Property(e => e.ExtractedValue).HasColumnName("extracted_value");
        formCell.Property(e => e.ExtractedAt).HasColumnName("extracted_at");
        formCell.Property(e => e.ExtractedBy).HasColumnName("extracted_by");
        formCell.Property(e => e.ExtractedResult).HasColumnName("extracted_result");
        formCell.Property(e => e.Checked1Value).HasColumnName("checked1_value");
        formCell.Property(e => e.Checked1At).HasColumnName("checked1_at");
        formCell.Property(e => e.Checked1By).HasColumnName("checked1_by");
        formCell.Property(e => e.Checked1Result).HasColumnName("checked1_result");
        formCell.Property(e => e.IsValueDiff1).HasColumnName("is_value_diff1");
        formCell.Property(e => e.Checked2Value).HasColumnName("checked2_value");
        formCell.Property(e => e.Checked2At).HasColumnName("checked2_at");
        formCell.Property(e => e.Checked2By).HasColumnName("checked2_by");
        formCell.Property(e => e.Checked2Result).HasColumnName("checked2_result");
        formCell.Property(e => e.IsValueDiff2).HasColumnName("is_value_diff2");
        modelBuilder.Entity<OcrJob>().ToTable("stg_ocr_jobs");
        modelBuilder.Entity<ExportJob>().ToTable("stg_export_jobs");

        modelBuilder.Entity<Channel>().ToTable("cnf_channels");
        modelBuilder.Entity<CnfConfigEntry>().ToTable("cnf_configs");
        modelBuilder.Entity<ContentType>().ToTable("cnf_content_types");
        modelBuilder.Entity<RecordType>().ToTable("cnf_record_types");
        modelBuilder.Entity<SyncType>().ToTable("cnf_sync_types");
        modelBuilder.Entity<CnfSeparateType>().ToTable("cnf_separate_types");
        modelBuilder.Entity<StgExportType>().ToTable("cnf_export_types");

        modelBuilder.Entity<StgDocType>().ToTable("stg_doc_types");
        modelBuilder.Entity<StgDocTypeSyncType>().ToTable("stg_doc_type_sync_types");
        modelBuilder.Entity<StgDocTypeSyncSetting>().ToTable("stg_doc_type_sync_settings");
        modelBuilder.Entity<StgDocField>().ToTable("stg_doc_fields");
        modelBuilder.Entity<StgDocFieldSetting>().ToTable("stg_doc_field_settings");
        modelBuilder.Entity<StgCategoryType>().ToTable("stg_category_types");
        modelBuilder.Entity<StgPatternType>().ToTable("stg_pattern_types");
        modelBuilder.Entity<StgDocFieldGroup>().ToTable("stg_doc_field_groups");
        modelBuilder.Entity<StgDocTypeSeparate>().ToTable("stg_doc_type_separates");
        modelBuilder.Entity<StgDocSoHoaOcrFix>().ToTable("stg_doc_sohoa_ocr_fixes");
        modelBuilder.Entity<StgDocSoHoaOcrFixType>().ToTable("stg_doc_sohoa_ocr_fix_types");
        modelBuilder.Entity<StgDocTypeOcrFix>().ToTable("stg_doc_type_ocr_fixes");

        modelBuilder.Entity<ActionLog>().ToTable("log_action_logs");
        modelBuilder.Entity<ErrorLog>().ToTable("log_error_logs");
        modelBuilder.Entity<AccessLog>().ToTable("log_access_logs");
    }
}
