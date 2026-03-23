using Microsoft.AspNetCore.Http;
using Shared.Contracts.Dtos;

namespace Core.Application.Services.Axe;

/// <summary>Port từ AXE SyncController.SetSyncTypeSettings.</summary>
public static class SyncTypeFieldSettingsBuilder
{
    public static List<DocTypeSyncSettingDto> Build(
        IReadOnlyList<StgDocFieldDto> stgFields,
        IReadOnlyList<CategoryTypeDto> categoryTypes,
        int syncTypeId,
        IFormCollection form,
        IReadOnlyList<DocTypeSyncSettingDto> currentSettings,
        bool isDeleteBefore)
    {
        var current = currentSettings.ToList();
        var weight = 0;
        var list = new List<DocTypeSyncSettingDto>();

        foreach (var item in stgFields)
        {
            if (!item.IsActive || !form.ContainsKey($"F{item.Id}"))
                continue;
            weight++;
            var title = AxeFormHelper.GetString(form, $"FN{item.Id}");
            var idPatternType = AxeFormHelper.GetInt(form, $"FPT{item.Id}");
            var fixValue = AxeFormHelper.GetString(form, $"FFixV{item.Id}");
            var minValue = AxeFormHelper.GetString(form, $"FMinV{item.Id}");
            var maxValue = AxeFormHelper.GetString(form, $"FMaxV{item.Id}");
            var minLen = AxeFormHelper.GetInt(form, $"FMinL{item.Id}");
            if (minLen < 0) minLen = 0;
            var maxLen = AxeFormHelper.GetInt(form, $"FMaxL{item.Id}");
            if (maxLen < 0) maxLen = 0;
            var patternCustom = AxeFormHelper.GetString(form, $"FPC{item.Id}");

            var prev = current.FirstOrDefault(x => x.IdField == item.Id && !x.IsCatalog);
            list.Add(new DocTypeSyncSettingDto
            {
                IdType = syncTypeId,
                IdField = item.Id,
                IdPatternType = idPatternType,
                Title = string.IsNullOrEmpty(title) ? item.Title : title,
                Weight = prev?.Id > 0 ? prev.Weight : weight,
                IsCatalog = false,
                PatternCustom = patternCustom,
                FixValue = fixValue,
                MinValue = minValue,
                MaxValue = maxValue,
                MinLen = minLen,
                MaxLen = maxLen,
                IsRequired = true
            });
        }

        foreach (var item in categoryTypes)
        {
            if (!form.ContainsKey($"CT{item.Id}"))
                continue;
            weight++;
            var title = AxeFormHelper.GetString(form, $"CTN{item.Id}");
            var idPatternType = AxeFormHelper.GetInt(form, $"CTPT{item.Id}");
            var fixValue = AxeFormHelper.GetString(form, $"CTFixV{item.Id}");
            var minValue = AxeFormHelper.GetString(form, $"CTMinV{item.Id}");
            var maxValue = AxeFormHelper.GetString(form, $"CTMaxV{item.Id}");
            var minLen = AxeFormHelper.GetInt(form, $"CTMinL{item.Id}");
            if (minLen < 0) minLen = 0;
            var maxLen = AxeFormHelper.GetInt(form, $"CTMaxL{item.Id}");
            if (maxLen < 0) maxLen = 0;
            var patternCustom = AxeFormHelper.GetString(form, $"CTPC{item.Id}");

            var prev = current.FirstOrDefault(x => x.IdField == item.Id && x.IsCatalog);
            list.Add(new DocTypeSyncSettingDto
            {
                IdType = syncTypeId,
                IdField = item.Id,
                IdPatternType = idPatternType,
                Title = string.IsNullOrEmpty(title) ? item.Name : title,
                Weight = prev?.Id > 0 ? prev.Weight : weight,
                IsCatalog = true,
                PatternCustom = patternCustom,
                FixValue = fixValue,
                MinValue = minValue,
                MaxValue = maxValue,
                MinLen = minLen,
                MaxLen = maxLen,
                IsRequired = true
            });
        }

        return list;
    }
}
