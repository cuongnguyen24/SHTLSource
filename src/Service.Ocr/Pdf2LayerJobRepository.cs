using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace SHTL.Service.Ocr;

internal sealed class OcrServiceJobRepository
{
    private readonly string _connectionString;

    public OcrServiceJobRepository(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required.");
    }

    public async Task<StgDocumentRow?> GetByIdAsync(long id, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT id, doc_type_id, ocr_status, extension, file_name, file_path
            FROM dbo.stg_documents
            WHERE id = @Id
            """;
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken).ConfigureAwait(false);
        return await conn.QueryFirstOrDefaultAsync<StgDocumentRow>(
            new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken)).ConfigureAwait(false);
    }

    public async Task<long?> TryClaimOcrSearchablePdfJobAsync(CancellationToken cancellationToken = default)
    {
        const string sql = """
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
                  );
            """;
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken).ConfigureAwait(false);
        return await conn.QueryFirstOrDefaultAsync<long?>(
            new CommandDefinition(sql, new
            {
                Processing = (byte)OcrOcrStatus.OcrSearchablePdfProcessing,
                Queued = (byte)OcrOcrStatus.OcrSearchablePdfQueued,
                Active = (byte)OcrDocumentStatus.Active,
                SystemUser = 0
            }, cancellationToken: cancellationToken)).ConfigureAwait(false);
    }

    public async Task<int> UpdateOcrSearchablePdfStateAsync(
        long id,
        OcrOcrStatus ocrStatus,
        string? pathPdfSearchable,
        int updatedBy,
        CancellationToken cancellationToken = default)
    {
        const string sql = """
            UPDATE dbo.stg_documents SET
                ocr_status = @OcrStatus,
                path_pdf_searchable = @PathPdfSearchable,
                ocr_at = CASE WHEN @OcrStatus IN (12, 13) THEN SYSUTCDATETIME() ELSE ocr_at END,
                updated = SYSUTCDATETIME(),
                updated_by = @UpdatedBy
            WHERE id = @Id
            """;
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken).ConfigureAwait(false);
        return await conn.ExecuteAsync(
            new CommandDefinition(sql, new
            {
                Id = id,
                OcrStatus = (byte)ocrStatus,
                PathPdfSearchable = pathPdfSearchable,
                UpdatedBy = updatedBy
            }, cancellationToken: cancellationToken)).ConfigureAwait(false);
    }

    public async Task<int> ResetStaleOcrSearchablePdfProcessingAsync(TimeSpan olderThan, CancellationToken cancellationToken = default)
    {
        const string sql = """
            UPDATE dbo.stg_documents
            SET ocr_status = @Queued,
                updated = SYSUTCDATETIME(),
                updated_by = @SystemUser
            WHERE ocr_status = @Processing
              AND status = @Active
              AND updated < DATEADD(SECOND, @NegSeconds, SYSUTCDATETIME());
            """;
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken).ConfigureAwait(false);
        return await conn.ExecuteAsync(
            new CommandDefinition(sql, new
            {
                Queued = (byte)OcrOcrStatus.OcrSearchablePdfQueued,
                Processing = (byte)OcrOcrStatus.OcrSearchablePdfProcessing,
                Active = (byte)OcrDocumentStatus.Active,
                SystemUser = 0,
                NegSeconds = -(int)olderThan.TotalSeconds
            }, cancellationToken: cancellationToken)).ConfigureAwait(false);
    }

    public async Task<string?> GetConfigValueAsync(string key, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT TOP (1) value
            FROM dbo.cnf_configs
            WHERE [key] = @Key;
            """;
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken).ConfigureAwait(false);
        return await conn.ExecuteScalarAsync<string?>(
            new CommandDefinition(sql, new { Key = key }, cancellationToken: cancellationToken)).ConfigureAwait(false);
    }

    public async Task<int?> GetPreferredDpiAsync(long documentId, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT TOP (1) dpi_x
            FROM dbo.stg_doc_sohoa_page
            WHERE document_id = @DocumentId
              AND dpi_x > 0
            ORDER BY page_number ASC;
            """;
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken).ConfigureAwait(false);
        return await conn.ExecuteScalarAsync<int?>(
            new CommandDefinition(sql, new { DocumentId = documentId }, cancellationToken: cancellationToken)).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<int>> GetConfiguredOcrPagesAsync(int docTypeId, CancellationToken cancellationToken = default)
    {
        if (docTypeId <= 0)
            return Array.Empty<int>();

        const string sql = """
            SELECT DISTINCT page_number
            FROM dbo.stg_doc_type_ocr_zones
            WHERE doc_type_id = @DocTypeId
              AND page_number > 0
            ORDER BY page_number;
            """;
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken).ConfigureAwait(false);
        var rows = await conn.QueryAsync<int>(
            new CommandDefinition(sql, new { DocTypeId = docTypeId }, cancellationToken: cancellationToken))
            .ConfigureAwait(false);
        return rows.ToList();
    }

    public async Task<IReadOnlyList<OcrZoneRow>> GetOcrZonesAsync(int docTypeId, CancellationToken cancellationToken = default)
    {
        if (docTypeId <= 0)
            return Array.Empty<OcrZoneRow>();

        const string sql = """
            SELECT
                z.id AS Id,
                COALESCE(fs.id_field, 0) AS FieldId,
                z.page_number AS PageNumber,
                z.x_ratio AS XRatio,
                z.y_ratio AS YRatio,
                z.width_ratio AS WidthRatio,
                z.height_ratio AS HeightRatio,
                COALESCE(f.name, N'') AS FieldName,
                COALESCE(f.datatype, N'') AS DataType
            FROM dbo.stg_doc_type_ocr_zones z
            LEFT JOIN dbo.stg_doc_field_settings fs ON fs.id = z.field_setting_id
            LEFT JOIN dbo.stg_doc_fields f ON f.id = fs.id_field
            WHERE z.doc_type_id = @DocTypeId
            ORDER BY z.page_number, z.weight, z.id;
            """;
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken).ConfigureAwait(false);
        var rows = await conn.QueryAsync<OcrZoneRow>(
            new CommandDefinition(sql, new { DocTypeId = docTypeId }, cancellationToken: cancellationToken))
            .ConfigureAwait(false);
        return rows.ToList();
    }

    public async Task<int> UpdateDocumentFieldsAsync(
        long documentId,
        IReadOnlyDictionary<string, object?> values,
        CancellationToken cancellationToken = default)
    {
        if (values.Count == 0)
            return 0;

        var allowedColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "name","symbol_no","record_no","issued_by","receiver","subject","level_no","box_no",
            "record_title","poster","signer","slot_no","shelf_no","author","noted","summary","describe",
            "field1","field2","field3","field4","field5","field6","field7","field8","field9","field10",
            "field11","field12","field13","field14","field15","field16","field17","field18","field19","field20",
            "field21","field22","field23","field24","field25"
        };

        var columns = values.Keys.Where(k => allowedColumns.Contains(k)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (columns.Count == 0)
            return 0;

        var sets = columns.Select(c => $"{c} = @{c}").ToList();
        sets.Add("updated = SYSUTCDATETIME()");
        sets.Add("updated_by = 0");

        var sql = $"""
            UPDATE dbo.stg_documents
            SET {string.Join(", ", sets)}
            WHERE id = @Id;
            """;

        var args = new DynamicParameters();
        args.Add("Id", documentId);
        foreach (var c in columns)
            args.Add(c, values[c]);

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken).ConfigureAwait(false);
        return await conn.ExecuteAsync(new CommandDefinition(sql, args, cancellationToken: cancellationToken)).ConfigureAwait(false);
    }

    public async Task<IReadOnlyDictionary<string, object?>> GetDocumentExistingFieldValuesAsync(
        long documentId,
        CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                name, symbol_no, record_no, issued_by, receiver, subject, level_no, box_no, record_title,
                poster, signer, slot_no, shelf_no, author, noted, summary, describe,
                field1, field2, field3, field4, field5, field6, field7, field8, field9, field10,
                field11, field12, field13, field14, field15, field16, field17, field18, field19, field20,
                field21, field22, field23, field24, field25
            FROM dbo.stg_documents
            WHERE id = @Id;
            """;
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken).ConfigureAwait(false);
        var row = await conn.QueryFirstOrDefaultAsync(
            new CommandDefinition(sql, new { Id = documentId }, cancellationToken: cancellationToken)).ConfigureAwait(false);
        if (row is null)
            return new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);

        var dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var kv in (IDictionary<string, object?>)row)
            dict[kv.Key] = kv.Value is DBNull ? null : kv.Value;
        return dict;
    }
}

internal sealed class OcrZoneRow
{
    public long Id { get; set; }
    public int FieldId { get; set; }
    public int PageNumber { get; set; }
    public decimal XRatio { get; set; }
    public decimal YRatio { get; set; }
    public decimal WidthRatio { get; set; }
    public decimal HeightRatio { get; set; }
    public string FieldName { get; set; } = string.Empty;
    public string DataType { get; set; } = string.Empty;
}
