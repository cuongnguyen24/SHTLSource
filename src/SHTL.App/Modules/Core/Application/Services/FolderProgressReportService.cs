using Dapper;
using Microsoft.Extensions.Options;
using SHTL.Modules.Core.Application.Options;
using SHTL.Modules.Infrastructure.Persistence;
using SHTL.Modules.Shared.Contracts.ViewModels;

namespace SHTL.Modules.Core.Application.Services;

public interface IFolderProgressReportService
{
    Task<FolderProgressViewModel> GetAsync(string? filter, int takeCurrentProcessing = 20);
}

public sealed class FolderProgressReportService : IFolderProgressReportService
{
    private readonly AppDbContext _db;
    private readonly IOptions<SearchablePdfOptions> _pdfOptions;

    public FolderProgressReportService(AppDbContext db, IOptions<SearchablePdfOptions> pdfOptions)
    {
        _db = db;
        _pdfOptions = pdfOptions;
    }

    public async Task<FolderProgressViewModel> GetAsync(string? filter, int takeCurrentProcessing = 20)
    {
        var conn = await _db.GetOpenConnectionAsync();
        var term = (filter ?? string.Empty).Trim();

        var rows = (await conn.QueryAsync<FolderProgressRowViewModel>(
            """
            WITH base AS (
                SELECT
                    id, file_name, file_path, path_original, extension, ocr_status,
                    is_extracted, is_checked1, is_checked2, updated,
                    REPLACE(COALESCE(NULLIF(path_original, N''), NULLIF(file_path, N''), N'Không rõ'), N'\', N'/') AS rel
                FROM dbo.stg_documents
                WHERE status = 1
            ),
            grouped AS (
                SELECT
                    CASE
                        WHEN rel = N'' THEN N'(trống)'
                        WHEN CHARINDEX(N'/', rel) > 0 THEN LEFT(rel, CHARINDEX(N'/', rel) - 1)
                        ELSE rel
                    END AS folder_name,
                    COUNT(1) AS total_docs,
                    SUM(CASE
                        WHEN LOWER(ISNULL(extension, N'')) IN (N'pdf', N'.pdf')
                          OR LOWER(ISNULL(file_name, N'')) LIKE N'%.pdf'
                          OR LOWER(ISNULL(file_path, N'')) LIKE N'%.pdf'
                        THEN 1 ELSE 0 END) AS total_pdfs,
                    SUM(CASE WHEN ocr_status = 10 THEN 1 ELSE 0 END) AS pdf_queued,
                    SUM(CASE WHEN ocr_status = 11 THEN 1 ELSE 0 END) AS pdf_processing,
                    SUM(CASE WHEN ocr_status = 12 THEN 1 ELSE 0 END) AS pdf_ready,
                    SUM(CASE WHEN ocr_status = 13 THEN 1 ELSE 0 END) AS pdf_failed,
                    SUM(CASE WHEN is_extracted = 1 THEN 1 ELSE 0 END) AS extracted_done,
                    SUM(CASE WHEN is_checked1 = 1 THEN 1 ELSE 0 END) AS check1_done,
                    SUM(CASE WHEN is_checked2 = 1 THEN 1 ELSE 0 END) AS check2_done
                FROM base
                GROUP BY CASE
                    WHEN rel = N'' THEN N'(trống)'
                    WHEN CHARINDEX(N'/', rel) > 0 THEN LEFT(rel, CHARINDEX(N'/', rel) - 1)
                    ELSE rel
                END
            )
            SELECT
                folder_name AS Folder,
                total_docs AS TotalDocs,
                total_pdfs AS TotalPdfs,
                pdf_queued AS PdfQueued,
                pdf_processing AS PdfProcessing,
                pdf_ready AS PdfReady,
                pdf_failed AS PdfFailed,
                extracted_done AS ExtractedDone,
                check1_done AS Check1Done,
                check2_done AS Check2Done
            FROM grouped
            WHERE @Filter = N'' OR folder_name LIKE N'%' + @Filter + N'%'
            ORDER BY total_docs DESC, folder_name ASC;
            """,
            new { Filter = term })).ToList();

        var summary = await conn.QueryFirstAsync<ServiceSummaryRow>(
            """
            SELECT
                SUM(CASE WHEN ocr_status = 10 THEN 1 ELSE 0 END) AS queued,
                SUM(CASE WHEN ocr_status = 11 THEN 1 ELSE 0 END) AS processing,
                SUM(CASE WHEN ocr_status = 12 THEN 1 ELSE 0 END) AS ready,
                SUM(CASE WHEN ocr_status = 13 THEN 1 ELSE 0 END) AS failed,
                MAX(CASE WHEN ocr_status IN (11, 12, 13) THEN updated END) AS last_activity_at_utc,
                MAX(CASE WHEN ocr_status = 11 THEN updated END) AS last_processing_at_utc
            FROM dbo.stg_documents
            WHERE status = 1;
            """);

        var current = (await conn.QueryAsync<SearchablePdfCurrentDocViewModel>(
            """
            SELECT TOP (@Take)
                id AS Id,
                ISNULL(NULLIF(name, N''), CONCAT(N'Tài liệu #', CAST(id AS nvarchar(20)))) AS Name,
                file_name AS FileName,
                file_path AS FilePath,
                updated AS UpdatedAtUtc
            FROM dbo.stg_documents
            WHERE status = 1
              AND ocr_status = 11
            ORDER BY updated DESC;
            """,
            new { Take = Math.Clamp(takeCurrentProcessing, 1, 200) })).ToList();

        return new FolderProgressViewModel
        {
            Filter = term,
            GeneratedAtUtc = DateTime.UtcNow,
            Rows = rows,
            ServiceStatus = new SearchablePdfServiceStatusViewModel
            {
                Queued = summary.Queued,
                Processing = summary.Processing,
                Ready = summary.Ready,
                Failed = summary.Failed,
                LastActivityAtUtc = summary.LastActivityAtUtc,
                LastProcessingAtUtc = summary.LastProcessingAtUtc,
                StatusText = BuildStatus(summary),
                CurrentProcessingDocs = current
            }
        };
    }

    private string BuildStatus(ServiceSummaryRow row)
    {
        var now = DateTime.UtcNow;
        var staleMinutes = Math.Clamp(_pdfOptions.Value.StaleProcessingMinutes, 5, 240);

        if (row.Processing > 0)
        {
            if (row.LastProcessingAtUtc.HasValue && (now - row.LastProcessingAtUtc.Value.ToUniversalTime()) <= TimeSpan.FromMinutes(staleMinutes))
                return "Đang chạy";
            return "Có xử lý dở dang (nghi dừng/kẹt)";
        }

        if (row.Queued > 0)
        {
            if (row.LastActivityAtUtc.HasValue && (now - row.LastActivityAtUtc.Value.ToUniversalTime()) <= TimeSpan.FromMinutes(staleMinutes))
                return "Đang chạy (không có tài liệu đang OCR ngay lúc này)";
            return "Có hàng đợi nhưng chưa thấy xử lý gần đây";
        }

        return "Rảnh (không có hàng đợi)";
    }

    private sealed class ServiceSummaryRow
    {
        public int Queued { get; set; }
        public int Processing { get; set; }
        public int Ready { get; set; }
        public int Failed { get; set; }
        public DateTime? LastActivityAtUtc { get; set; }
        public DateTime? LastProcessingAtUtc { get; set; }
    }
}
