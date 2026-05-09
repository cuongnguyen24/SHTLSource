using Dapper;
using SHTL.Modules.Core.Domain.Entities.Stg;
using SHTL.Modules.Core.Domain.Enums;

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

    /// <summary>Lấy 1 tài liệu chờ PDF 2 lớp và chuyển sang trạng thái đang xử lý. Trả về null nếu không có.</summary>
    Task<long?> TryClaimSearchablePdfJobAsync();

    Task<int> UpdateSearchablePdfStateAsync(long id, OcrStatus ocrStatus, string? pathPdfSearchable, int updatedBy);

    /// <summary>Phục hồi job bị kẹt (app restart giữa chừng).</summary>
    Task<int> ResetStaleSearchablePdfProcessingAsync(TimeSpan olderThan);

    /// <summary>Tìm các tài liệu cùng bộ theo danh sách key cấu hình (SetRecordInfo).</summary>
    Task<IEnumerable<Document>> GetSameRecordDocumentsAsync(long documentId, IReadOnlyList<string> recordKeys, int limit = 200);
}

public class DocumentFilterParams
{
    public string? Search { get; set; }
    public WorkflowStep? Step { get; set; }
    public CheckQueueListScope CheckQueueListScope { get; set; }
    public bool IncludeExtractedInCheck1 { get; set; }
    public DocumentStatus? Status { get; set; }
    public int? DocTypeId { get; set; }
    public int? CreatedBy { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public long? FolderId { get; set; }
}

public class DocumentRepository : BaseRepository, IDocumentRepository
{
    private static readonly Dictionary<string, string> RecordKeyColumnMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Id"] = "id",
        ["DocTypeId"] = "doc_type_id",
        ["RecordTypeId"] = "record_type_id",
        ["ContentTypeId"] = "content_type_id",
        ["SyncTypeId"] = "sync_type_id",
        ["FolderId"] = "folder_id",
        ["DeptId"] = "dept_id",
        ["Name"] = "name",
        ["SymbolNo"] = "symbol_no",
        ["RecordNo"] = "record_no",
        ["IssuedBy"] = "issued_by",
        ["Receiver"] = "receiver",
        ["Subject"] = "subject",
        ["LevelNo"] = "level_no",
        ["BoxNo"] = "box_no",
        ["RecordTitle"] = "record_title",
        ["Poster"] = "poster",
        ["SlotNo"] = "slot_no",
        ["ShelfNo"] = "shelf_no",
        ["IssuedYear"] = "issued_year",
        ["Author"] = "author",
        ["Field1"] = "field1",
        ["Field2"] = "field2",
        ["Field3"] = "field3",
        ["Field4"] = "field4",
        ["Field5"] = "field5",
        ["Field6"] = "field6",
        ["Field7"] = "field7",
        ["Field8"] = "field8",
        ["Field9"] = "field9",
        ["Field10"] = "field10",
        ["Field11"] = "field11",
        ["Field12"] = "field12",
        ["Field13"] = "field13",
        ["Field14"] = "field14",
        ["Field15"] = "field15"
    };

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
                 receiver, subject, level_no, box_no, record_title, poster, slot_no, shelf_no,
                 issued, issued_year, author, signer, noted, summary, search_meta,
                 file_name, file_path, path_original, path_converted, path_pdf_searchable, thumb_path, extension, file_size, page_count,
                 file_hash, is_color_scan, min_dpi, max_dpi, version_pdf, workstation_name,
                 status, current_step, locked_by_step, locked_at, locked_by_user_id,
                 is_checked_scan1, checked_scan1at, checked_scan1by, checked_scan1result,
                 is_checked_scan2, checked_scan2at, checked_scan2by, checked_scan2result,
                 is_zoned, zoned_at, zoned_by, zoned_result,
                 ocr_status, is_ocr_enabled, ocr_at, ocr_by, ocr_result,
                 is_extracted, extracted_at, extracted_by, extracted_result, extracted_return_count, extracted_return_reason,
                 is_checked1, checked1at, checked1by, checked1result, checked1return_count, checked1return_reason,
                 is_checked2, checked2at, checked2by, checked2result, checked2return_reason,
                 is_checked_final, checked_final_at, checked_final_by, checked_final_result, checked_final_change_info,
                 is_checked_logic, checked_logic_at, checked_logic_by, checked_logic_result,
                 export_status, exported_at, exported_by, excel_metadata_id,
                 page_count_a4, page_count_a3, page_count_a2, page_count_a1, page_count_a0, page_count_other,
                 field1, field2, field3, field4, field5,
                 field6, field7, field8, field9, field10,
                 field11, field12, field13, field14, field15,
                 field16, field17, field18, field19, field20,
                 field21, field22, field23, field24, field25,
                 sort_meta, version, weight, created, created_by, updated, updated_by)
            OUTPUT INSERTED.id
            VALUES
                (@DocTypeId, @RecordTypeId, @ContentTypeId, @SyncTypeId,
                 @FolderId, @DeptId, @Name, @Describe, @SymbolNo, @RecordNo, @IssuedBy,
                 @Receiver, @Subject, @LevelNo, @BoxNo, @RecordTitle, @Poster, @SlotNo, @ShelfNo,
                 @Issued, ISNULL(@IssuedYear, 0), @Author, @Signer, @Noted, @Summary, @SearchMeta,
                 @FileName, @FilePath, @PathOriginal, @PathConverted, @PathPdfSearchable, @ThumbPath, @Extension, @FileSize, @PageCount,
                 @FileHash, @IsColorScan, @MinDpi, @MaxDpi, @VersionPdf, @WorkstationName,
                 @Status, @CurrentStep, @LockedByStep, @LockedAt, @LockedByUserId,
                 @IsCheckedScan1, @CheckedScan1At, @CheckedScan1By, @CheckedScan1Result,
                 @IsCheckedScan2, @CheckedScan2At, @CheckedScan2By, @CheckedScan2Result,
                 @IsZoned, @ZonedAt, @ZonedBy, @ZonedResult,
                 @OcrStatus, @IsOcrEnabled, @OcrAt, @OcrBy, @OcrResult,
                 @IsExtracted, @ExtractedAt, @ExtractedBy, @ExtractedResult, @ExtractedReturnCount, @ExtractedReturnReason,
                 @IsChecked1, @Checked1At, @Checked1By, @Checked1Result, @Checked1ReturnCount, @Checked1ReturnReason,
                 @IsChecked2, @Checked2At, @Checked2By, @Checked2Result, @Checked2ReturnReason,
                 @IsCheckedFinal, @CheckedFinalAt, @CheckedFinalBy, @CheckedFinalResult, @CheckedFinalChangeInfo,
                 @IsCheckedLogic, @CheckedLogicAt, @CheckedLogicBy, @CheckedLogicResult,
                 @ExportStatus, @ExportedAt, @ExportedBy, @ExcelMetadataId,
                 @PageCountA4, @PageCountA3, @PageCountA2, @PageCountA1, @PageCountA0, @PageCountOther,
                 @Field1, @Field2, @Field3, @Field4, @Field5,
                 @Field6, @Field7, @Field8, @Field9, @Field10,
                 @Field11, @Field12, @Field13, @Field14, @Field15,
                 @Field16, @Field17, @Field18, @Field19, @Field20,
                 @Field21, @Field22, @Field23, @Field24, @Field25,
                 @SortMeta, @Version, @Weight, @Created, @CreatedBy, @Updated, @UpdatedBy)";
        return await ExecuteScalarAsync<long>(conn, sql, doc);
    }

    public async Task<int> UpdateAsync(Document doc)
    {
        var conn = await OpenConnectionAsync();
        var sql = @"
            UPDATE dbo.stg_documents SET
                name = @Name, [describe] = @Describe, symbol_no = @SymbolNo,
                record_no = @RecordNo, issued_by = @IssuedBy,
                receiver = @Receiver, subject = @Subject, level_no = @LevelNo, box_no = @BoxNo,
                record_title = @RecordTitle, poster = @Poster, slot_no = @SlotNo, shelf_no = @ShelfNo,
                issued = @Issued,
                issued_year = @IssuedYear, author = @Author, signer = @Signer,
                noted = @Noted, summary = @Summary, search_meta = @SearchMeta,
                field1 = @Field1, field2 = @Field2, field3 = @Field3, field4 = @Field4,
                field5 = @Field5, field6 = @Field6, field7 = @Field7, field8 = @Field8,
                field9 = @Field9, field10 = @Field10, field11 = @Field11, field12 = @Field12,
                field13 = @Field13, field14 = @Field14, field15 = @Field15,
                field16 = @Field16, field17 = @Field17, field18 = @Field18,
                field19 = @Field19, field20 = @Field20,
                field21 = @Field21, field22 = @Field22, field23 = @Field23,
                field24 = @Field24, field25 = @Field25,
                current_step = @CurrentStep,
                is_checked_scan1 = @IsCheckedScan1,
                checked_scan1at = @CheckedScan1At,
                checked_scan1by = @CheckedScan1By,
                checked_scan1result = @CheckedScan1Result,
                is_checked_scan2 = @IsCheckedScan2,
                checked_scan2at = @CheckedScan2At,
                checked_scan2by = @CheckedScan2By,
                checked_scan2result = @CheckedScan2Result,
                is_zoned = @IsZoned,
                zoned_at = @ZonedAt,
                zoned_by = @ZonedBy,
                zoned_result = @ZonedResult,
                ocr_status = @OcrStatus,
                is_ocr_enabled = @IsOcrEnabled,
                ocr_at = @OcrAt,
                ocr_by = @OcrBy,
                ocr_result = @OcrResult,
                is_extracted = @IsExtracted,
                extracted_at = @ExtractedAt,
                extracted_by = @ExtractedBy,
                extracted_result = @ExtractedResult,
                extracted_return_count = @ExtractedReturnCount,
                extracted_return_reason = @ExtractedReturnReason,
                is_checked1 = @IsChecked1,
                checked1at = @Checked1At,
                checked1by = @Checked1By,
                checked1result = @Checked1Result,
                checked1return_count = @Checked1ReturnCount,
                checked1return_reason = @Checked1ReturnReason,
                is_checked2 = @IsChecked2,
                checked2at = @Checked2At,
                checked2by = @Checked2By,
                checked2result = @Checked2Result,
                checked2return_reason = @Checked2ReturnReason,
                is_checked_final = @IsCheckedFinal,
                checked_final_at = @CheckedFinalAt,
                checked_final_by = @CheckedFinalBy,
                checked_final_result = @CheckedFinalResult,
                checked_final_change_info = @CheckedFinalChangeInfo,
                is_checked_logic = @IsCheckedLogic,
                checked_logic_at = @CheckedLogicAt,
                checked_logic_by = @CheckedLogicBy,
                checked_logic_result = @CheckedLogicResult,
                export_status = @ExportStatus,
                exported_at = @ExportedAt,
                exported_by = @ExportedBy,
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
        var orderBy = filter.CheckQueueListScope != CheckQueueListScope.None
            ? "updated DESC, id DESC"
            : "id DESC";
        var sql = WithPaging(
            $"SELECT * FROM dbo.stg_documents {where} ORDER BY {orderBy}",
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

    public async Task<long?> TryClaimSearchablePdfJobAsync()
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
UPDATE TOP (1) dbo.stg_documents
SET ocr_status = @Processing,
    updated = SYSUTCDATETIME(),
    updated_by = @SystemUser
OUTPUT INSERTED.id
WHERE ocr_status = @Queued
  AND status = @Active
  AND (
        LOWER(LTRIM(RTRIM(ISNULL(extension, N'')))) IN (N'pdf', N'.pdf')
        OR LOWER(ISNULL(file_name, N'')) LIKE N'%.pdf'
        OR LOWER(ISNULL(file_path, N'')) LIKE N'%.pdf'
      );";
        return await QueryFirstOrDefaultAsync<long?>(conn, sql, new
        {
            Processing = (byte)OcrStatus.SearchablePdfProcessing,
            Queued = (byte)OcrStatus.SearchablePdfQueued,
            Active = (byte)DocumentStatus.Active,
            SystemUser = 0
        });
    }

    public async Task<int> UpdateSearchablePdfStateAsync(long id, OcrStatus ocrStatus, string? pathPdfSearchable, int updatedBy)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn, @"
UPDATE dbo.stg_documents SET
    ocr_status = @OcrStatus,
    path_pdf_searchable = @PathPdfSearchable,
    ocr_at = CASE WHEN @OcrStatus IN (12, 13) THEN SYSUTCDATETIME() ELSE ocr_at END,
    updated = SYSUTCDATETIME(),
    updated_by = @UpdatedBy
WHERE id = @Id",
            new
            {
                Id = id,
                OcrStatus = (byte)ocrStatus,
                PathPdfSearchable = pathPdfSearchable,
                UpdatedBy = updatedBy
            });
    }

    public async Task<int> ResetStaleSearchablePdfProcessingAsync(TimeSpan olderThan)
    {
        var conn = await OpenConnectionAsync();
        return await ExecuteAsync(conn, @"
UPDATE dbo.stg_documents
SET ocr_status = @Queued,
    updated = SYSUTCDATETIME(),
    updated_by = @SystemUser
WHERE ocr_status = @Processing
  AND status = @Active
  AND updated < DATEADD(SECOND, @NegSeconds, SYSUTCDATETIME());",
            new
            {
                Queued = (byte)OcrStatus.SearchablePdfQueued,
                Processing = (byte)OcrStatus.SearchablePdfProcessing,
                Active = (byte)DocumentStatus.Active,
                SystemUser = 0,
                NegSeconds = -(int)olderThan.TotalSeconds
            });
    }

    public async Task<IEnumerable<Document>> GetSameRecordDocumentsAsync(long documentId, IReadOnlyList<string> recordKeys, int limit = 200)
    {
        var normalizedKeys = (recordKeys ?? Array.Empty<string>())
            .Select(x => x?.Trim())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(x => x!)
            .ToList();
        if (normalizedKeys.Count == 0)
            return Enumerable.Empty<Document>();

        var source = await GetByIdAsync(documentId);
        if (source is null)
            return Enumerable.Empty<Document>();

        var conditions = new List<string> { "status != 2" };
        var p = new DynamicParameters();
        p.Add("Limit", limit <= 0 ? 200 : limit);
        p.Add("Id", documentId);

        var matchedKeyCount = 0;
        foreach (var key in normalizedKeys)
        {
            if (!RecordKeyColumnMap.TryGetValue(key, out var col))
                continue;

            var prop = typeof(Document).GetProperty(key);
            if (prop is null)
                continue;

            var value = prop.GetValue(source);
            matchedKeyCount++;
            if (value is null)
            {
                conditions.Add($"{col} IS NULL");
            }
            else
            {
                var paramName = $"k_{matchedKeyCount}";
                conditions.Add($"{col} = @{paramName}");
                p.Add(paramName, value);
            }
        }

        if (matchedKeyCount == 0)
            return Enumerable.Empty<Document>();

        var sql = $@"
            SELECT TOP (@Limit) *
            FROM dbo.stg_documents
            WHERE {string.Join(" AND ", conditions)}
            ORDER BY CASE WHEN id = @Id THEN 0 ELSE 1 END, id DESC";
        var conn = await OpenConnectionAsync();
        return await QueryAsync<Document>(conn, sql, p);
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
        if (f.CheckQueueListScope == CheckQueueListScope.Check1Board)
        {
            conditions.Add(@"(
                current_step = @Q1_Chk1
                OR (current_step = @Q1_Ext AND NULLIF(LTRIM(RTRIM(ISNULL(checked1return_reason, N''))), N'') IS NOT NULL)
                OR (is_checked1 = 1 AND current_step = @Q1_Chk2)
            )");
            p.Add("Q1_Chk1", (byte)WorkflowStep.Check1);
            p.Add("Q1_Ext", (byte)WorkflowStep.Extract);
            p.Add("Q1_Chk2", (byte)WorkflowStep.Check2);
        }
        else if (f.CheckQueueListScope == CheckQueueListScope.Check2Board)
        {
            conditions.Add(@"(
                current_step = @Q2_Chk2
                OR (current_step = @Q2_Chk1 AND NULLIF(LTRIM(RTRIM(ISNULL(checked2return_reason, N''))), N'') IS NOT NULL)
                OR (is_checked2 = 1 AND current_step = @Q2_ChkF)
            )");
            p.Add("Q2_Chk2", (byte)WorkflowStep.Check2);
            p.Add("Q2_Chk1", (byte)WorkflowStep.Check1);
            p.Add("Q2_ChkF", (byte)WorkflowStep.CheckFinal);
        }
        else if (f.Step.HasValue)
        {
            if (f.IncludeExtractedInCheck1 && f.Step.Value == WorkflowStep.Extract)
            {
                conditions.Add("(current_step = @Step OR is_extracted = 1)");
                p.Add("Step", (byte)WorkflowStep.Extract);
            }
            else
            {
                conditions.Add("current_step = @Step");
                p.Add("Step", (byte)f.Step.Value);
            }
        }
        if (f.Status.HasValue) { conditions.Add("status = @Status"); p.Add("Status", (byte)f.Status.Value); }
        if (f.DocTypeId.HasValue) { conditions.Add("doc_type_id = @DocTypeId"); p.Add("DocTypeId", f.DocTypeId.Value); }
        if (f.CreatedBy.HasValue) { conditions.Add("created_by = @CreatedBy"); p.Add("CreatedBy", f.CreatedBy.Value); }
        if (f.FolderId.HasValue) { conditions.Add("folder_id = @FolderId"); p.Add("FolderId", f.FolderId.Value); }
        if (f.StartDate.HasValue) { conditions.Add("created >= @StartDate"); p.Add("StartDate", f.StartDate.Value); }
        if (f.EndDate.HasValue) { conditions.Add("created < @EndDate"); p.Add("EndDate", f.EndDate.Value.AddDays(1)); }

        return ($"WHERE {string.Join(" AND ", conditions)}", p);
    }
}
