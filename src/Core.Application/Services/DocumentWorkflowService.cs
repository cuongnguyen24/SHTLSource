using Core.Domain.Contracts;
using Core.Domain.Entities.Log;
using Core.Domain.Entities.Stg;
using Core.Domain.Enums;
using Infrastructure.Data.Repositories.Log;
using Infrastructure.Data.Repositories.Stg;
using Microsoft.Extensions.Logging;
using Shared.Contracts;
using Shared.Contracts.Dtos;

namespace Core.Application.Services;

/// <summary>
/// Service trung tâm điều phối quy trình số hóa (workflow).
/// Mỗi bước workflow gọi một method tương ứng.
/// Business rule: chặn sai trình tự, không cho phép xóa tài liệu đã xử lý.
/// </summary>
public interface IDocumentWorkflowService
{
    Task<ApiResult> CheckScan1Async(CheckScanRequest req, ICurrentUser user);
    Task<ApiResult> CheckScan2Async(CheckScanRequest req, ICurrentUser user);
    Task<ApiResult> ZoneAsync(WorkflowActionRequest req, ICurrentUser user);
    Task<ApiResult> SubmitExtractAsync(ExtractRequest req, ICurrentUser user);
    Task<ApiResult> Check1Async(CheckReviewRequest req, ICurrentUser user);
    Task<ApiResult> Check2Async(CheckReviewRequest req, ICurrentUser user);
    Task<ApiResult> CheckFinalAsync(WorkflowActionRequest req, ICurrentUser user);
    Task<ApiResult> CheckLogicAsync(WorkflowActionRequest req, ICurrentUser user);
    Task<ApiResult> RequestExportAsync(long documentId, string exportType, ICurrentUser user);
    Task<ApiResult> SafeDeleteAsync(long documentId, ICurrentUser user);
}

public class DocumentWorkflowService : IDocumentWorkflowService
{
    private readonly IDocumentRepository _docRepo;
    private readonly IFormCellRepository _cellRepo;
    private readonly IExportJobRepository _exportRepo;
    private readonly IActionLogRepository _logRepo;
    private readonly IStorageService _storage;
    private readonly ILogger<DocumentWorkflowService> _logger;

    public DocumentWorkflowService(
        IDocumentRepository docRepo,
        IFormCellRepository cellRepo,
        IExportJobRepository exportRepo,
        IActionLogRepository logRepo,
        IStorageService storage,
        ILogger<DocumentWorkflowService> logger)
    {
        _docRepo = docRepo;
        _cellRepo = cellRepo;
        _exportRepo = exportRepo;
        _logRepo = logRepo;
        _storage = storage;
        _logger = logger;
    }

    public async Task<ApiResult> CheckScan1Async(CheckScanRequest req, ICurrentUser user)
    {
        var doc = await _docRepo.GetByIdAsync(req.DocumentId);
        if (doc is null) return ApiResult.Fail("Tài liệu không tồn tại");
        if (doc.CurrentStep != WorkflowStep.Scan && doc.CurrentStep != WorkflowStep.CheckScan1)
            return ApiResult.Fail("Tài liệu chưa ở bước kiểm tra scan lần 1");

        doc.IsCheckedScan1 = req.Result == StepResult.Pass;
        doc.CheckedScan1At = DateTime.UtcNow;
        doc.CheckedScan1By = user.Id;
        doc.CheckedScan1Result = req.Result;
        doc.PageCount = req.PageCount > 0 ? req.PageCount : doc.PageCount;
        doc.PageCountA4 = req.PageCountA4;
        doc.PageCountA3 = req.PageCountA3;
        doc.CurrentStep = req.Result == StepResult.Pass ? WorkflowStep.CheckScan2 : WorkflowStep.Scan;
        doc.Updated = DateTime.UtcNow;
        doc.UpdatedBy = user.Id;

        await _docRepo.UpdateAsync(doc);
        await _docRepo.UpdateStepAsync(doc.Id, doc.CurrentStep, user.Id);
        await LogActionAsync(user, "CHECK_SCAN1", "documents", doc.Id.ToString(),
            req.Result.ToString(), req.Note);

        return ApiResult.Ok("Kiểm tra scan lần 1 thành công");
    }

    public async Task<ApiResult> CheckScan2Async(CheckScanRequest req, ICurrentUser user)
    {
        var doc = await _docRepo.GetByIdAsync(req.DocumentId);
        if (doc is null) return ApiResult.Fail("Tài liệu không tồn tại");
        if (!doc.IsCheckedScan1)
            return ApiResult.Fail("Chưa thực hiện kiểm tra scan lần 1");

        doc.IsCheckedScan2 = req.Result == StepResult.Pass;
        doc.CheckedScan2At = DateTime.UtcNow;
        doc.CheckedScan2By = user.Id;
        doc.CheckedScan2Result = req.Result;
        doc.CurrentStep = req.Result == StepResult.Pass ? WorkflowStep.Zone : WorkflowStep.CheckScan1;
        doc.Updated = DateTime.UtcNow;
        doc.UpdatedBy = user.Id;

        await _docRepo.UpdateAsync(doc);
        await _docRepo.UpdateStepAsync(doc.Id, doc.CurrentStep, user.Id);
        await LogActionAsync(user, "CHECK_SCAN2", "documents", doc.Id.ToString(),
            req.Result.ToString(), req.Note);

        return ApiResult.Ok("Kiểm tra scan lần 2 thành công");
    }

    public async Task<ApiResult> ZoneAsync(WorkflowActionRequest req, ICurrentUser user)
    {
        var doc = await _docRepo.GetByIdAsync(req.DocumentId);
        if (doc is null) return ApiResult.Fail("Tài liệu không tồn tại");
        if (!doc.IsCheckedScan2)
            return ApiResult.Fail("Chưa hoàn thành kiểm tra scan lần 2");

        doc.IsZoned = req.Result == StepResult.Pass;
        doc.ZonedAt = DateTime.UtcNow;
        doc.ZonedBy = user.Id;
        doc.ZonedResult = req.Result;
        // Nếu OCR enabled thì chuyển sang bước OCR, không thì sang Extract luôn
        doc.CurrentStep = req.Result == StepResult.Pass
            ? (doc.IsOcrEnabled ? WorkflowStep.Ocr : WorkflowStep.Extract)
            : WorkflowStep.CheckScan2;
        doc.Updated = DateTime.UtcNow;
        doc.UpdatedBy = user.Id;

        await _docRepo.UpdateAsync(doc);
        await _docRepo.UpdateStepAsync(doc.Id, doc.CurrentStep, user.Id);
        await LogActionAsync(user, "ZONE", "documents", doc.Id.ToString(), req.Result.ToString(), req.Note);

        return ApiResult.Ok("Khoanh vùng thành công");
    }

    public async Task<ApiResult> SubmitExtractAsync(ExtractRequest req, ICurrentUser user)
    {
        var doc = await _docRepo.GetByIdAsync(req.DocumentId);
        if (doc is null) return ApiResult.Fail("Tài liệu không tồn tại");

        // Cập nhật fields
        MapExtractFields(doc, req);
        doc.IsExtracted = true;
        doc.ExtractedAt = DateTime.UtcNow;
        doc.ExtractedBy = user.Id;
        doc.ExtractedResult = StepResult.Pass;
        doc.Checked1ReturnReason = null;
        doc.Checked2ReturnReason = null;
        doc.CurrentStep = WorkflowStep.Check1;
        doc.Updated = DateTime.UtcNow;
        doc.UpdatedBy = user.Id;

        await _docRepo.UpdateAsync(doc);
        // Guard rail: luôn chốt bước workflow về Check1 sau khi lưu nhập liệu.
        await _docRepo.UpdateStepAsync(doc.Id, WorkflowStep.Check1, user.Id);

        // Cập nhật form cells nếu có
        foreach (var cell in req.Cells)
        {
            await _cellRepo.UpdateValueAsync(cell.Id, cell.Value, user.Id, WorkflowStep.Extract);
        }

        await LogActionAsync(user, "EXTRACT", "documents", doc.Id.ToString(), "Done", null);
        return ApiResult.Ok("Nhập liệu thành công");
    }

    public async Task<ApiResult> Check1Async(CheckReviewRequest req, ICurrentUser user)
        => await DoCheckAsync(req, user, WorkflowStep.Check1, WorkflowStep.Check2, WorkflowStep.Extract, "CHECK1");

    public async Task<ApiResult> Check2Async(CheckReviewRequest req, ICurrentUser user)
        => await DoCheckAsync(req, user, WorkflowStep.Check2, WorkflowStep.CheckFinal, WorkflowStep.Check1, "CHECK2");

    public async Task<ApiResult> CheckFinalAsync(WorkflowActionRequest req, ICurrentUser user)
    {
        var doc = await _docRepo.GetByIdAsync(req.DocumentId);
        if (doc is null) return ApiResult.Fail("Tài liệu không tồn tại");
        if (doc.CurrentStep != WorkflowStep.CheckFinal)
            return ApiResult.Fail($"Tài liệu chưa ở bước kiểm tra cuối (đang ở bước {doc.CurrentStep})");

        doc.IsCheckedFinal = req.Result == StepResult.Pass;
        doc.CheckedFinalAt = DateTime.UtcNow;
        doc.CheckedFinalBy = user.Id;
        doc.CheckedFinalResult = req.Result;
        doc.CheckedFinalChangeInfo = req.Note;
        doc.CurrentStep = req.Result == StepResult.Pass ? WorkflowStep.CheckLogic : WorkflowStep.Check2;
        doc.Updated = DateTime.UtcNow;
        doc.UpdatedBy = user.Id;

        await _docRepo.UpdateAsync(doc);
        await _docRepo.UpdateStepAsync(doc.Id, doc.CurrentStep, user.Id);
        await LogActionAsync(user, "CHECK_FINAL", "documents", doc.Id.ToString(), req.Result.ToString(), req.Note);

        return ApiResult.Ok("Kiểm tra cuối thành công");
    }

    public async Task<ApiResult> CheckLogicAsync(WorkflowActionRequest req, ICurrentUser user)
    {
        var doc = await _docRepo.GetByIdAsync(req.DocumentId);
        if (doc is null) return ApiResult.Fail("Tài liệu không tồn tại");
        if (doc.CurrentStep != WorkflowStep.CheckLogic)
            return ApiResult.Fail("Tài liệu chưa ở bước kiểm tra logic");

        doc.IsCheckedLogic = req.Result == StepResult.Pass;
        doc.CheckedLogicAt = DateTime.UtcNow;
        doc.CheckedLogicBy = user.Id;
        doc.CheckedLogicResult = req.Result;
        doc.CurrentStep = req.Result == StepResult.Pass ? WorkflowStep.Export : WorkflowStep.CheckFinal;
        doc.Updated = DateTime.UtcNow;
        doc.UpdatedBy = user.Id;

        await _docRepo.UpdateAsync(doc);
        await _docRepo.UpdateStepAsync(doc.Id, doc.CurrentStep, user.Id);
        await LogActionAsync(user, "CHECK_LOGIC", "documents", doc.Id.ToString(), req.Result.ToString(), req.Note);

        return ApiResult.Ok("Kiểm tra logic thành công");
    }

    public async Task<ApiResult> RequestExportAsync(long documentId, string exportType, ICurrentUser user)
    {
        var doc = await _docRepo.GetByIdAsync(documentId);
        if (doc is null) return ApiResult.Fail("Tài liệu không tồn tại");
        if (doc.CurrentStep != WorkflowStep.Export)
            return ApiResult.Fail("Tài liệu chưa sẵn sàng để export");

        var job = new ExportJob
        {
            ChannelId = user.ChannelId,
            ExportTypeId = 0, // TODO: Map exportType string to ExportTypeId
            Name = $"Export document {documentId}",
            FilterJson = $"{{\"documentId\":{documentId}}}",
            Status = QueueStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            RequestedBy = user.Id
        };
        await _exportRepo.EnqueueAsync(job);

        await LogActionAsync(user, "REQUEST_EXPORT", "documents", documentId.ToString(), exportType, null);
        return ApiResult.Ok("Đã thêm vào hàng đợi export");
    }

    public async Task<ApiResult> SafeDeleteAsync(long documentId, ICurrentUser user)
    {
        var doc = await _docRepo.GetByIdAsync(documentId);
        if (doc is null) return ApiResult.Fail("Tài liệu không tồn tại");

        // Chặn xóa nếu đã qua bước nhập liệu (đã sang Check1 trở đi).
        if ((int)doc.CurrentStep > (int)WorkflowStep.Extract || doc.IsExtracted)
            return ApiResult.Fail("Không thể xóa tài liệu đã nhập liệu hoặc đang ở bước kiểm tra. Hãy liên hệ quản trị viên.");

        var filePath = doc.FilePath;
        var thumbPath = doc.ThumbPath;

        await _docRepo.SoftDeleteAsync(documentId, user.Id);
        await LogActionAsync(user, "DELETE", "documents", documentId.ToString(), "Deleted", null);

        await TryDeleteStoredFilesAsync(filePath, thumbPath);

        return ApiResult.Ok("Đã xóa tài liệu và file trên storage");
    }

    private async Task TryDeleteStoredFilesAsync(string? filePath, string? thumbPath)
    {
        if (!string.IsNullOrWhiteSpace(filePath))
        {
            try
            {
                await _storage.DeleteFileAsync(filePath);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không xóa được file chính: {Path}", filePath);
            }
        }

        if (!string.IsNullOrWhiteSpace(thumbPath))
        {
            try
            {
                await _storage.DeleteFileAsync(thumbPath);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không xóa được thumbnail: {Path}", thumbPath);
            }
        }
    }

    // ----- Helpers -----

    private async Task<ApiResult> DoCheckAsync(
        CheckReviewRequest req, ICurrentUser user,
        WorkflowStep expectedStep, WorkflowStep nextStep, WorkflowStep returnStep, string actionName)
    {
        var doc = await _docRepo.GetByIdAsync(req.DocumentId);
        if (doc is null) return ApiResult.Fail("Tài liệu không tồn tại");
        if (doc.CurrentStep != expectedStep)
            return ApiResult.Fail($"Tài liệu đang ở bước {doc.CurrentStep}, không phải {expectedStep}");

        ApplyCheckEdits(doc, req);

        if (req.Result == StepResult.Pass)
        {
            doc.CurrentStep = nextStep;
        }
        else if (req.Result == StepResult.Return)
        {
            doc.CurrentStep = returnStep;
        }
        else
        {
            doc.CurrentStep = returnStep;
        }

        // Set timestamps dựa vào step
        switch (expectedStep)
        {
            case WorkflowStep.Check1:
                doc.IsChecked1 = req.Result == StepResult.Pass;
                doc.Checked1At = DateTime.UtcNow;
                doc.Checked1By = user.Id;
                doc.Checked1Result = req.Result;
                if (req.Result != StepResult.Pass)
                {
                    doc.Checked1ReturnCount++;
                    doc.Checked1ReturnReason = req.ReturnReason;
                }
                else
                {
                    doc.Checked1ReturnReason = null;
                }
                break;
            case WorkflowStep.Check2:
                doc.IsChecked2 = req.Result == StepResult.Pass;
                doc.Checked2At = DateTime.UtcNow;
                doc.Checked2By = user.Id;
                doc.Checked2Result = req.Result;
                if (req.Result != StepResult.Pass)
                    doc.Checked2ReturnReason = req.ReturnReason;
                else
                    doc.Checked2ReturnReason = null;
                break;
        }

        doc.Updated = DateTime.UtcNow;
        doc.UpdatedBy = user.Id;
        await _docRepo.UpdateAsync(doc);
        await _docRepo.UpdateStepAsync(doc.Id, doc.CurrentStep, user.Id);
        if (req.Cells.Count > 0)
        {
            foreach (var cell in req.Cells)
                await _cellRepo.UpdateValueAsync(cell.Id, cell.Value, user.Id, expectedStep);
        }
        await LogActionAsync(user, actionName, "documents", doc.Id.ToString(), req.Result.ToString(), req.Note);

        return ApiResult.Ok($"Bước {actionName} thành công");
    }

    private static void MapExtractFields(Document doc, ExtractRequest req)
    {
        doc.Field1 = req.Field1 ?? doc.Field1;
        doc.Field2 = req.Field2 ?? doc.Field2;
        doc.Field3 = req.Field3 ?? doc.Field3;
        doc.Field4 = req.Field4 ?? doc.Field4;
        doc.Field5 = req.Field5 ?? doc.Field5;
        doc.Field6 = req.Field6 ?? doc.Field6;
        doc.Field7 = req.Field7 ?? doc.Field7;
        doc.Field8 = req.Field8 ?? doc.Field8;
        doc.Field9 = req.Field9 ?? doc.Field9;
        doc.Field10 = req.Field10 ?? doc.Field10;
        doc.Field11 = req.Field11 ?? doc.Field11;
        doc.Field12 = req.Field12 ?? doc.Field12;
        doc.Field13 = req.Field13 ?? doc.Field13;
        doc.Field14 = req.Field14 ?? doc.Field14;
        doc.Field15 = req.Field15 ?? doc.Field15;
        if (req.Field16.HasValue) doc.Field16 = req.Field16;
        if (req.Field17.HasValue) doc.Field17 = req.Field17;
        if (req.Field21.HasValue) doc.Field21 = req.Field21;
        if (req.Field22.HasValue) doc.Field22 = req.Field22;
        if (req.Field23.HasValue) doc.Field23 = req.Field23;
    }

    private static void ApplyCheckEdits(Document doc, CheckReviewRequest req)
    {
        doc.Name = req.Name ?? doc.Name;
        doc.SymbolNo = req.SymbolNo ?? doc.SymbolNo;
        doc.RecordNo = req.RecordNo ?? doc.RecordNo;
        doc.IssuedBy = req.IssuedBy ?? doc.IssuedBy;
        doc.Author = req.Author ?? doc.Author;
        doc.Noted = req.Noted ?? doc.Noted;
        doc.Field1 = req.Field1 ?? doc.Field1;
        doc.Field2 = req.Field2 ?? doc.Field2;
        doc.Field3 = req.Field3 ?? doc.Field3;
        doc.Field4 = req.Field4 ?? doc.Field4;
        doc.Field5 = req.Field5 ?? doc.Field5;
        doc.Field6 = req.Field6 ?? doc.Field6;
        doc.Field7 = req.Field7 ?? doc.Field7;
        doc.Field8 = req.Field8 ?? doc.Field8;
    }

    private async Task LogActionAsync(ICurrentUser user, string action, string table, string recordId, string newValue, string? description)
    {
        await _logRepo.LogAsync(new ActionLog
        {
            ChannelId = user.ChannelId,
            UserId = user.Id,
            UserName = user.UserName,
            Action = action,
            TableName = table,
            RecordId = recordId,
            NewValue = newValue,
            Description = description,
            CreatedAt = DateTime.UtcNow
        });
    }
}
