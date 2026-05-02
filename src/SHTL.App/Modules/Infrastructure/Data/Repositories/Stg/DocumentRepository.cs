using Dapper;
using SHTL.Modules.Core.Domain.Entities.Stg;
using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Persistence;

namespace SHTL.Modules.Infrastructure.Data.Repositories.Stg;

public interface IDocumentRepository
{
    Task<Document?> GetByIdAsync(long id);
    Task<IEnumerable<Document>> GetListAsync(DocumentFilterParams filter, int pageIndex, int pageSize);
    Task<long> CountAsync(DocumentFilterParams filter);
    Task<long> InsertAsync(Document doc);
    Task<int> UpdateAsync(Document doc);
    Task<int> UpdateStepAsync(long id, WorkflowStep step, int updatedBy);
    Task<int> SoftDeleteAsync(long id, int deletedBy);
    Task<IEnumerable<Document>> GetByFolderAsync(long folderId, int pageIndex, int pageSize);
    Task<IEnumerable<Document>> GetPendingForStepAsync(WorkflowStep step, int limit = 50);
}

public class DocumentFilterParams
{
    public string? Search { get; set; }
    public WorkflowStep? Step { get; set; }
    public DocumentStatus? Status { get; set; }
    public int? DocTypeId { get; set; }
    public int? CreatedBy { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public long? FolderId { get; set; }
}

public class DocumentRepository : BaseRepository, IDocumentRepository
{
    public DocumentRepository(AppDbContext db) : base(db) { }

    public async Task<Document?> GetByIdAsync(long id)
    {
        var conn = await OpenConnectionAsync();
        return await QueryFirstOrDefaultAsync<Document>(conn,
            "SELECT * FROM dbo.stg_documents WHERE id = @Id", new { Id = id });
    }

    public async Task<long> InsertAsync(Document doc)
    {
        var conn = await OpenConnectionAsync();
        var sql = @"
            INSERT INTO dbo.stg_documents
                (doc_type_id, record_type_id, content_type_id, sync_type_id,
                 folder_id, dept_id, name, [describe], symbol_no, record_no, issued_by,
                 issued, issued_year, author, signer, noted, summary, search_meta,
                 file_name, file_path, path_original, extension, file_size, page_count,
                 file_hash, is_color_scan, min_dpi, max_dpi, workstation_name,
                 status, current_step, version, weight,
                 field1, field2, field3, field4, field5,
                 field6, field7, field8, field9, field10,
                 field11, field12, field13, field14, field15,
                 field16, field17, field18, field19, field20,
                 created, created_by)
            OUTPUT INSERTED.id
            VALUES
                (@DocTypeId, @RecordTypeId, @ContentTypeId, @SyncTypeId,
                 @FolderId, @DeptId, @Name, @Describe, @SymbolNo, @RecordNo, @IssuedBy,
                 @Issued, ISNULL(@IssuedYear, 0), @Author, @Signer, @Noted, @Summary, @SearchMeta,
                 @FileName, @FilePath, @PathOriginal, @Extension, @FileSize, @PageCount,
                 @FileHash, @IsColorScan, @MinDpi, @MaxDpi, @WorkstationName,
                 @Status, @CurrentStep, @Version, @Weight,
                 @Field1, @Field2, @Field3, @Field4, @Field5,
                 @Field6, @Field7, @Field8, @Field9, @Field10,
                 @Field11, @Field12, @Field13, @Field14, @Field15,
                 @Field16, @Field17, @Field18, @Field19, @Field20,
                 @Created, @CreatedBy)";
        return await ExecuteScalarAsync<long>(conn, sql, doc);
    }

    public async Task<int> UpdateAsync(Document doc)
    {
        var conn = await OpenConnectionAsync();
        var sql = @"
            UPDATE dbo.stg_documents SET
                name = @Name, [describe] = @Describe, symbol_no = @SymbolNo,
                record_no = @RecordNo, issued_by = @IssuedBy, issued = @Issued,
                issued_year = @IssuedYear, author = @Author, signer = @Signer,
                noted = @Noted, summary = @Summary, search_meta = @SearchMeta,
                field1 = @Field1, field2 = @Field2, field3 = @Field3, field4 = @Field4,
                field5 = @Field5, field6 = @Field6, field7 = @Field7, field8 = @Field8,
                field9 = @Field9, field10 = @Field10, field11 = @Field11, field12 = @Field12,
                field13 = @Field13, field14 = @Field14, field15 = @Field15,
                field16 = @Field16, field17 = @Field17, field18 = @Field18,
                field19 = @Field19, field20 = @Field20,
                checked1_return_reason = @Checked1ReturnReason,
                checked2_return_reason = @Checked2ReturnReason,
                updated = @Updated, updated_by = @UpdatedBy
            WHERE id = @Id";
        return await ExecuteAsync(conn, sql, doc);
    }

    public async Task<int> UpdateStepAsync(long id, WorkflowStep step, int updatedBy)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn,
            "UPDATE dbo.stg_documents SET current_step = @Step, updated = SYSUTCDATETIME(), updated_by = @UpdatedBy WHERE id = @Id",
            new { Id = id, Step = (byte)step, UpdatedBy = updatedBy });
    }

    public async Task<int> SoftDeleteAsync(long id, int deletedBy)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn,
            "UPDATE dbo.stg_documents SET status = @Status, updated = SYSUTCDATETIME(), updated_by = @DeletedBy WHERE id = @Id",
            new { Id = id, Status = (byte)DocumentStatus.Deleted, DeletedBy = deletedBy });
    }

    public async Task<IEnumerable<Document>> GetListAsync(DocumentFilterParams filter, int pageIndex, int pageSize)
    {
        var conn = await OpenConnectionAsync();
        var (where, param) = BuildWhere(filter);
        var sql = WithPaging(
            $"SELECT * FROM dbo.stg_documents {where} ORDER BY id DESC",
            pageIndex, pageSize);
        return await QueryAsync<Document>(conn, sql, param);
    }

    public async Task<long> CountAsync(DocumentFilterParams filter)
    {
        var conn = await OpenConnectionAsync();
        var (where, param) = BuildWhere(filter);
        return await ExecuteScalarAsync<long>(conn,
            $"SELECT COUNT(1) FROM dbo.stg_documents {where}", param);
    }

    public async Task<IEnumerable<Document>> GetByFolderAsync(long folderId, int pageIndex, int pageSize)
    {
        var conn = await OpenConnectionAsync();
        var sql = WithPaging(
            "SELECT * FROM dbo.stg_documents WHERE folder_id = @FolderId AND status != 2 ORDER BY id DESC",
            pageIndex, pageSize);
        return await QueryAsync<Document>(conn, sql, new { FolderId = folderId });
    }

    public async Task<IEnumerable<Document>> GetPendingForStepAsync(WorkflowStep step, int limit = 50)
    {
        var conn = await OpenConnectionAsync();
        return await QueryAsync<Document>(conn,
            @"SELECT * FROM dbo.stg_documents WHERE current_step = @Step AND status = 1
              ORDER BY id DESC OFFSET 0 ROWS FETCH NEXT @Limit ROWS ONLY",
            new { Step = (byte)step, Limit = limit });
    }

    private static (string where, object param) BuildWhere(DocumentFilterParams f)
    {
        var conditions = new List<string>();
        var p = new DynamicParameters();
        conditions.Add("status != 2");

        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            conditions.Add("(search_meta LIKE @Search OR name LIKE @Search)");
            p.Add("Search", $"%{f.Search}%");
        }
        if (f.Step.HasValue) { conditions.Add("current_step = @Step"); p.Add("Step", (byte)f.Step.Value); }
        if (f.Status.HasValue) { conditions.Add("status = @Status"); p.Add("Status", (byte)f.Status.Value); }
        if (f.DocTypeId.HasValue) { conditions.Add("doc_type_id = @DocTypeId"); p.Add("DocTypeId", f.DocTypeId.Value); }
        if (f.CreatedBy.HasValue) { conditions.Add("created_by = @CreatedBy"); p.Add("CreatedBy", f.CreatedBy.Value); }
        if (f.FolderId.HasValue) { conditions.Add("folder_id = @FolderId"); p.Add("FolderId", f.FolderId.Value); }
        if (f.StartDate.HasValue) { conditions.Add("created >= @StartDate"); p.Add("StartDate", f.StartDate.Value); }
        if (f.EndDate.HasValue) { conditions.Add("created < @EndDate"); p.Add("EndDate", f.EndDate.Value.AddDays(1)); }

        return ($"WHERE {string.Join(" AND ", conditions)}", p);
    }
}
