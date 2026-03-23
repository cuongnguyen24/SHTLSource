using Microsoft.AspNetCore.Http;
using Shared.Contracts.Dtos;

namespace Core.Application.Services.Axe;

/// <summary>Port logic từ AXE DoctypeController.SetDoctypeFields (giữ tên key form F{id}, FN{id}, …).</summary>
public static class DocTypeFieldSettingsBuilder
{
    public static List<StgDocFieldSettingDto> Build(
        IReadOnlyList<StgDocFieldDto> stgFields,
        IReadOnlyList<CategoryTypeDto> categoryTypes,
        int docTypeId,
        IFormCollection form,
        IReadOnlyList<StgDocFieldSettingDto> currentSettings,
        bool isDeleteBefore)
    {
        var current = currentSettings.ToList();
        var weight = 0;
        var list = new List<StgDocFieldSettingDto>();

        foreach (var item in stgFields)
        {
            var keyF = $"F{item.Id}";
            if (!item.IsRequired && (!item.IsActive || !form.ContainsKey(keyF)))
                continue;

            weight++;
            var title = AxeFormHelper.GetString(form, $"FN{item.Id}");
            var type = AxeFormHelper.GetString(form, $"FT{item.Id}");
            var col = AxeFormHelper.GetInt(form, $"FC{item.Id}");
            var row = AxeFormHelper.GetInt(form, $"FR{item.Id}");
            var fixValue = AxeFormHelper.GetString(form, $"FFixV{item.Id}");
            var minValue = AxeFormHelper.GetString(form, $"FMinV{item.Id}");
            var maxValue = AxeFormHelper.GetString(form, $"FMaxV{item.Id}");
            var minLen = AxeFormHelper.GetInt(form, $"FMinL{item.Id}");
            if (minLen < 0) minLen = 0;
            var maxLen = AxeFormHelper.GetInt(form, $"FMaxL{item.Id}");
            if (maxLen < 0) maxLen = 0;
            var patternCustom = AxeFormHelper.GetString(form, $"FPC{item.Id}");
            var idPatternType = AxeFormHelper.GetInt(form, $"FPT{item.Id}");
            var idCategoryType = AxeFormHelper.GetInt(form, $"FCT{item.Id}");
            var idGroup = AxeFormHelper.GetInt(form, $"FG{item.Id}");
            var isReadOnly = AxeFormHelper.GetBool(form, $"FIsRO{item.Id}");
            var isUpperCase = AxeFormHelper.GetBool(form, $"FIsU{item.Id}");
            var isCapitalize = AxeFormHelper.GetBool(form, $"FIsC{item.Id}");
            var format = AxeFormHelper.GetString(form, $"FFormat{item.Id}");

            var prev = current.FirstOrDefault(x => x.IdField == item.Id && !x.IsCatalog);
            list.Add(new StgDocFieldSettingDto
            {
                IdType = docTypeId,
                IdField = item.Id,
                Title = string.IsNullOrEmpty(title) ? item.Title : title,
                IType = string.IsNullOrEmpty(type) ? "text" : type,
                ICol = col,
                IRow = row,
                Weight = prev?.Id > 0 ? prev.Weight : weight,
                IsSearch = true,
                IsCatalog = false,
                IsCatalogMain = false,
                IdFieldGroup = idGroup,
                IdCategoryType = idCategoryType,
                IdPatternType = idPatternType,
                PatternCustom = patternCustom,
                FixValue = fixValue,
                MinValue = minValue,
                MaxValue = maxValue,
                MinLen = minLen,
                MaxLen = maxLen,
                IsRequired = minLen > 0,
                IsReadOnly = isReadOnly,
                IsUpperCase = isUpperCase,
                IsCapitalize = isCapitalize,
                Format = format,
                IsOcrFix = prev?.IsOcrFix ?? false
            });
        }

        var idCatalogMain = AxeFormHelper.GetInt(form, "CTIsCatalogMain");
        foreach (var item in categoryTypes)
        {
            var keyCt = $"CT{item.Id}";
            if (!form.ContainsKey(keyCt))
                continue;

            weight++;
            var title = AxeFormHelper.GetString(form, $"CTN{item.Id}");
            var multi = AxeFormHelper.GetBool(form, $"CTIsMulti{item.Id}");
            var fixValue = AxeFormHelper.GetString(form, $"CTFixV{item.Id}");
            var minValue = AxeFormHelper.GetString(form, $"CTMinV{item.Id}");
            var maxValue = AxeFormHelper.GetString(form, $"CTMaxV{item.Id}");
            var minLen = AxeFormHelper.GetInt(form, $"CTMinL{item.Id}");
            if (minLen < 0) minLen = 0;
            var maxLen = AxeFormHelper.GetInt(form, $"CTMaxL{item.Id}");
            if (maxLen < 0) maxLen = 0;
            var patternCustom = AxeFormHelper.GetString(form, $"CTPC{item.Id}");
            var idPatternType = AxeFormHelper.GetInt(form, $"CTPT{item.Id}");
            var idGroup = AxeFormHelper.GetInt(form, $"CTG{item.Id}");

            var prev = current.FirstOrDefault(x => x.IdField == item.Id && x.IsCatalog);
            list.Add(new StgDocFieldSettingDto
            {
                IdType = docTypeId,
                IdField = item.Id,
                Title = string.IsNullOrEmpty(title) ? item.Name : title,
                IType = "text",
                ICol = 0,
                IRow = 0,
                Weight = prev?.Id > 0 ? prev.Weight : weight,
                IsSearch = true,
                IsCatalog = true,
                IsCatalogMain = idCatalogMain == item.Id,
                IsMulti = multi,
                IdFieldGroup = idGroup,
                IdCategoryType = item.Id,
                IdPatternType = idPatternType,
                PatternCustom = patternCustom,
                FixValue = fixValue,
                MinValue = minValue,
                MaxValue = maxValue,
                MinLen = minLen,
                MaxLen = maxLen,
                IsRequired = minLen > 0,
                IsOcrFix = prev?.IsOcrFix ?? false
            });
        }

        return list;
    }
}
