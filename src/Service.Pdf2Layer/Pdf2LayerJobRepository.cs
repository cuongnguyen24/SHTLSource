using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace SHTL.Service.Pdf2Layer;

internal sealed class Pdf2LayerJobRepository
{
    private readonly string _connectionString;

    public Pdf2LayerJobRepository(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required.");
    }

    public async Task<StgDocumentRow?> GetByIdAsync(long id, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT id, ocr_status, extension, file_name, file_path
            FROM dbo.stg_documents
            WHERE id = @Id
            """;
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken).ConfigureAwait(false);
        return await conn.QueryFirstOrDefaultAsync<StgDocumentRow>(
            new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken)).ConfigureAwait(false);
    }

    public async Task<long?> TryClaimSearchablePdfJobAsync(int maxConcurrentProcessing, CancellationToken cancellationToken = default)
    {
        const string sql = """
            DECLARE @LockResult int;

            BEGIN TRANSACTION;

            EXEC @LockResult = sys.sp_getapplock
                @Resource = N'SHTL_OCR_CLAIM_GATE',
                @LockMode = N'Exclusive',
                @LockOwner = N'Transaction',
                @LockTimeout = 5000;

            IF @LockResult >= 0 AND (
                SELECT COUNT_BIG(1)
                FROM dbo.stg_documents WITH (UPDLOCK, HOLDLOCK)
                WHERE ocr_status = @Processing
                  AND status = @Active
            ) < @MaxConcurrentProcessing
            BEGIN
                ;WITH next_job AS
                (
                    SELECT TOP (1) id
                    FROM dbo.stg_documents WITH (UPDLOCK, READPAST)
                    WHERE ocr_status = @Queued
                      AND status = @Active
                      AND (
                            LOWER(LTRIM(RTRIM(ISNULL(extension, N'')))) IN (N'pdf', N'.pdf')
                            OR LOWER(ISNULL(file_name, N'')) LIKE N'%.pdf'
                            OR LOWER(ISNULL(file_path, N'')) LIKE N'%.pdf'
                          )
                    ORDER BY updated ASC, id ASC
                )
                UPDATE d
                SET ocr_status = @Processing,
                    updated = SYSUTCDATETIME(),
                    updated_by = @SystemUser
                OUTPUT INSERTED.id
                FROM dbo.stg_documents d
                INNER JOIN next_job j ON j.id = d.id;
            END

            COMMIT TRANSACTION;
            """;
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken).ConfigureAwait(false);
        return await conn.QueryFirstOrDefaultAsync<long?>(
            new CommandDefinition(sql, new
            {
                MaxConcurrentProcessing = Math.Max(1, maxConcurrentProcessing),
                Processing = (byte)Pdf2OcrStatus.SearchablePdfProcessing,
                Queued = (byte)Pdf2OcrStatus.SearchablePdfQueued,
                Active = (byte)Pdf2DocumentStatus.Active,
                SystemUser = 0
            }, cancellationToken: cancellationToken)).ConfigureAwait(false);
    }

    public async Task<int> UpdateSearchablePdfStateAsync(
        long id,
        Pdf2OcrStatus ocrStatus,
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

    public async Task<int> ResetStaleSearchablePdfProcessingAsync(TimeSpan olderThan, CancellationToken cancellationToken = default)
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
                Queued = (byte)Pdf2OcrStatus.SearchablePdfQueued,
                Processing = (byte)Pdf2OcrStatus.SearchablePdfProcessing,
                Active = (byte)Pdf2DocumentStatus.Active,
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
}
