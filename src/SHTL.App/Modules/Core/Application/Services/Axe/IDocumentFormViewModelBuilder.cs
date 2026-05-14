using SHTL.Modules.Shared.Contracts.ViewModels;

namespace SHTL.Modules.Core.Application.Services.Axe;

/// <summary>
/// Service để build ViewModel cho form nhập/sửa tài liệu động
/// </summary>
public interface IDocumentFormViewModelBuilder
{
    Task<DocumentFormViewModel> BuildForCreateAsync(int docTypeId);

    Task<DocumentFormViewModel> BuildForExtractAsync(long documentId, int currentUserId, bool isAdminUser);

    Task<DocumentFormViewModel> BuildForCheck1Async(long documentId, int currentUserId, bool isAdminUser);

    Task<DocumentFormViewModel> BuildForCheck2Async(long documentId, int currentUserId, bool isAdminUser);
}
