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

    public async Task<long?> TryClaimSearchablePdfJobAsync(CancellationToken cancellationToken = default)
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
}
