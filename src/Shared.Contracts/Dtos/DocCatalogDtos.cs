using System.ComponentModel.DataAnnotations;

namespace Shared.Contracts.Dtos;

public class DocTypeListItemDto
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Describe { get; set; }
    public int SeparateTypeId { get; set; }
    /// <summary>Dự phòng: gán loại trích xuất (chưa dùng UI).</summary>
    public int? ExtractorTypeId { get; set; }
    /// <summary>1 = đã kiểm duyệt, 0 = chờ.</summary>
    public byte ReviewStatus { get; set; }
    public int Weight { get; set; }
}

public class DocTypeEditRequest
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Tên là bắt buộc")]
    [StringLength(255)]
    public string Name { get; set; } = string.Empty;

    [StringLength(100)]
    public string? Code { get; set; }

    public string? Describe { get; set; }
    public int SeparateTypeId { get; set; }
    /// <summary>Chỉnh sau khi bật tính năng loại trích xuất.</summary>
    public int? ExtractorTypeId { get; set; }
    public byte ReviewStatus { get; set; } = 1;
    public int Weight { get; set; }
}

public class DocTypeSyncListItemDto
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public int DocTypeId { get; set; }
    public string DocTypeName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Describe { get; set; }
    public string? Format { get; set; }
    public int Weight { get; set; }
    public bool IsDefault { get; set; }
}

public class DocTypeSyncEditRequest
{
    public int Id { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Chọn loại tài liệu")]
    public int DocTypeId { get; set; }

    [Required(ErrorMessage = "Tên là bắt buộc")]
    [StringLength(255)]
    public string Name { get; set; } = string.Empty;

    public string? Describe { get; set; }
    public string? Format { get; set; }
    public int Weight { get; set; }
    public bool IsDefault { get; set; }
}
