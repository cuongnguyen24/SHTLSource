using SHTL.Modules.Core.Domain.Entities.Stg;

namespace SHTL.Modules.Infrastructure.Data.Repositories.Stg;

public interface IDocumentPageRepository
{
    Task InsertManyAsync(IEnumerable<DocumentPage> pages);
    Task<double?> GetPreferredDpiAsync(long documentId);
}

public sealed class DocumentPageRepository : BaseRepository, IDocumentPageRepository
{
    public DocumentPageRepository(AppDbContext db) : base(db)
    {
    }

    public async Task InsertManyAsync(IEnumerable<DocumentPage> pages)
    {
        var list = pages?.ToList() ?? new List<DocumentPage>();
        if (list.Count == 0)
            return;

        var conn = await OpenConnectionAsync();
        const string sql = @"
INSERT INTO dbo.stg_doc_sohoa_page
    (document_id, page_number, dpi_x, dpi_y, page_size, created)
VALUES
    (@DocumentId, @PageNumber, @DpiX, @DpiY, @PageSize, @Created);";
        await ExecuteAsync(conn, sql, list);
    }

    public async Task<double?> GetPreferredDpiAsync(long documentId)
    {
        var conn = await OpenConnectionAsync();
        const string sql = @"
SELECT TOP (1) CAST(dpi_x AS float)
FROM dbo.stg_doc_sohoa_page
WHERE document_id = @DocumentId AND dpi_x > 0
ORDER BY page_number ASC;";
        return await ExecuteScalarAsync<double?>(conn, sql, new { DocumentId = documentId });
    }
}
