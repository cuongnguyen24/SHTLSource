using Shared.Contracts.ViewModels;

namespace Core.Application.Services.Axe;

/// <summary>
/// Service để build ViewModel cho form nhập/sửa tài liệu động
/// </summary>
public interface IDocumentFormViewModelBuilder
{
    /// <summary>
    /// Build ViewModel cho form tạo mới tài liệu
    /// </summary>
    Task<DocumentFormViewModel> BuildForCreateAsync(int channelId, int docTypeId);
    
    /// <summary>
    /// Build ViewModel cho form sửa tài liệu (Extract)
    /// </summary>
    Task<DocumentFormViewModel> BuildForExtractAsync(int channelId, long documentId);
    
    /// <summary>
    /// Build ViewModel cho form Check1
    /// </summary>
    Task<DocumentFormViewModel> BuildForCheck1Async(int channelId, long documentId);
    
    /// <summary>
    /// Build ViewModel cho form Check2
    /// </summary>
    Task<DocumentFormViewModel> BuildForCheck2Async(int channelId, long documentId);
}
