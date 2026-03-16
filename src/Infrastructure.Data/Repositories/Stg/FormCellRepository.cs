using Core.Domain.Entities.Stg;
using Core.Domain.Enums;
using Dapper;

namespace Infrastructure.Data.Repositories.Stg;

public interface IFormCellRepository
{
    Task<IEnumerable<FormCell>> GetByDocumentAsync(long documentId);
    Task<FormCell?> GetByIdAsync(long id);
    Task<long> InsertAsync(FormCell cell);
    Task<int> UpdateValueAsync(long id, string? value, int updatedBy, WorkflowStep step);
    Task<int> DeleteByDocumentAsync(long documentId);
    Task BulkInsertAsync(IEnumerable<FormCell> cells);
}

public class FormCellRepository : BaseRepository, IFormCellRepository
{
    public FormCellRepository(IDbConnectionFactory factory) : base(factory) { }

    public async Task<IEnumerable<FormCell>> GetByDocumentAsync(long documentId)
    {
        using var conn = _factory.CreateStgConnection();
        return await QueryAsync<FormCell>(conn,
            "SELECT * FROM core_stg.form_cells WHERE document_id = @DocId ORDER BY page, cell",
            new { DocId = documentId });
    }

    public async Task<FormCell?> GetByIdAsync(long id)
    {
        using var conn = _factory.CreateStgConnection();
        return await QueryFirstOrDefaultAsync<FormCell>(conn,
            "SELECT * FROM core_stg.form_cells WHERE id = @Id", new { Id = id });
    }

    public async Task<long> InsertAsync(FormCell cell)
    {
        using var conn = _factory.CreateStgConnection();
        var sql = @"
            INSERT INTO core_stg.form_cells
                (channel_id, document_id, cell, cell_type, group_cell, field, title,
                 x, y, width, height, page, page_width, page_height, cropped_path,
                 value, created, created_by)
            VALUES
                (@ChannelId, @DocumentId, @Cell, @CellType, @GroupCell, @Field, @Title,
                 @X, @Y, @Width, @Height, @Page, @PageWidth, @PageHeight, @CroppedPath,
                 @Value, @Created, @CreatedBy)
            RETURNING id";
        return await ExecuteScalarAsync<long>(conn, sql, cell);
    }

    public async Task<int> UpdateValueAsync(long id, string? value, int updatedBy, WorkflowStep step)
    {
        using var conn = _factory.CreateStgConnection();
        return step switch
        {
            WorkflowStep.Extract => await ExecuteAsync(conn,
                "UPDATE core_stg.form_cells SET extracted_value = @Value, extracted_by = @By, extracted_at = now() WHERE id = @Id",
                new { Id = id, Value = value, By = updatedBy }),
            WorkflowStep.Check1 => await ExecuteAsync(conn,
                "UPDATE core_stg.form_cells SET checked1_value = @Value, checked1_by = @By, checked1_at = now() WHERE id = @Id",
                new { Id = id, Value = value, By = updatedBy }),
            WorkflowStep.Check2 => await ExecuteAsync(conn,
                "UPDATE core_stg.form_cells SET checked2_value = @Value, checked2_by = @By, checked2_at = now() WHERE id = @Id",
                new { Id = id, Value = value, By = updatedBy }),
            _ => 0
        };
    }

    public async Task<int> DeleteByDocumentAsync(long documentId)
    {
        using var conn = _factory.CreateStgConnection();
        return await ExecuteAsync(conn,
            "DELETE FROM core_stg.form_cells WHERE document_id = @DocId",
            new { DocId = documentId });
    }

    public async Task BulkInsertAsync(IEnumerable<FormCell> cells)
    {
        using var conn = _factory.CreateStgConnection();
        conn.Open();
        using var transaction = conn.BeginTransaction();
        try
        {
            var sql = @"
                INSERT INTO core_stg.form_cells
                    (channel_id, document_id, cell, cell_type, group_cell, field, title,
                     x, y, width, height, page, page_width, page_height, cropped_path,
                     value, created, created_by)
                VALUES
                    (@ChannelId, @DocumentId, @Cell, @CellType, @GroupCell, @Field, @Title,
                     @X, @Y, @Width, @Height, @Page, @PageWidth, @PageHeight, @CroppedPath,
                     @Value, @Created, @CreatedBy)";
            await conn.ExecuteAsync(sql, cells, transaction);
            transaction.Commit();
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }
}
