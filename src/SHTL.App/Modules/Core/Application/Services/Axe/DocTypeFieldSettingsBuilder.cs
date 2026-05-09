using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services.Axe;

/// <summary>Port logic từ AXE DoctypeController.SetDoctypeFields (giữ tên key form F{id}, FN{id}, …).
/// Hỗ trợ thêm trường mặc định (DF{id}) và trường mở rộng (EF{id}).</summary>
public static class DocTypeFieldSettingsBuilder
{
    /// <summary>Mapping từ string input type sang INT ID.</summary>
    private static readonly Dictionary<string, int> InputTypeMap = new()
    {
        { "text", 1 },
        { "textarea", 2 },
        { "number", 3 },
        { "date", 4 },
        { "select", 5 },
        { "radio", 6 },
        { "checkbox", 7 }
    };

    /// <summary>Convert string input type sang INT ID.</summary>
    private static int GetInputTypeId(string? inputType)
    {
        if (string.IsNullOrEmpty(inputType))
            return 1; // Default to "text"

        return InputTypeMap.TryGetValue(inputType.ToLower(), out var id) ? id : 1;
    }
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

        // Xử lý trường mặc định (DF{id})
        weight = ProcessDefaultFields(form, docTypeId, current, list, weight);

        // Xử lý trường mở rộng (EF{id})
        weight = ProcessExtendedFields(form, docTypeId, current, list, weight);

        // Xử lý trường STG chuẩn (F{id})
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
                IType = GetInputTypeId(type),
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
                IType = GetInputTypeId("text"),
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

    /// <summary>Xử lý trường mặc định (DF{id}) từ form.</summary>
    private static int ProcessDefaultFields(
        IFormCollection form,
        int docTypeId,
        List<StgDocFieldSettingDto> current,
        List<StgDocFieldSettingDto> list,
        int weight)
    {
        // Danh sách trường mặc định (ID 1-14)
        var defaultFieldIds = Enumerable.Range(1, 14).ToList();

        foreach (var fieldId in defaultFieldIds)
        {
            var keyDf = $"DF{fieldId}";
            var isNameField = fieldId == 1;
            var isEnabled = AxeFormHelper.GetBool(form, $"DF_Enabled_{fieldId}") || form.ContainsKey(keyDf);
            if (!isNameField && !isEnabled)
                continue;

            weight++;
            var fieldWeight = AxeFormHelper.GetInt(form, $"DF_Weight_{fieldId}");
            var title = AxeFormHelper.GetString(form, $"DF_Title_{fieldId}");
            var inputType = AxeFormHelper.GetString(form, $"DF_InputType_{fieldId}") ?? "text";
            var idGroup = AxeFormHelper.GetInt(form, $"DF_GroupDetail_{fieldId}");
            var minValue = AxeFormHelper.GetString(form, $"DF_MinValue_{fieldId}");
            var maxValue = AxeFormHelper.GetString(form, $"DF_MaxValue_{fieldId}");
            var minLen = AxeFormHelper.GetInt(form, $"DF_MinLen_{fieldId}");
            if (minLen < 0) minLen = 0;
            var maxLen = AxeFormHelper.GetInt(form, $"DF_MaxLen_{fieldId}");
            if (maxLen < 0) maxLen = 0;
            var idPatternType = AxeFormHelper.GetInt(form, $"DF_Pattern_{fieldId}");
            var patternCustom = AxeFormHelper.GetString(form, $"DF_Description_{fieldId}");
            var fixValue = AxeFormHelper.GetString(form, $"DF_DefaultValue_{fieldId}");
            var isRequired = AxeFormHelper.GetBool(form, $"DF_Required_{fieldId}");
            var isReadOnly = AxeFormHelper.GetBool(form, $"DF_ReadOnly_{fieldId}");
            var isUpperCase = AxeFormHelper.GetBool(form, $"DF_UpperCase_{fieldId}");
            var isCapitalize = AxeFormHelper.GetBool(form, $"DF_Capitalize_{fieldId}");

            var prev = current.FirstOrDefault(x => x.IdField == fieldId && !x.IsCatalog);
            list.Add(new StgDocFieldSettingDto
            {
                IdType = docTypeId,
                IdField = fieldId,
                Title = isNameField ? (string.IsNullOrWhiteSpace(title) ? "Tên" : title) : (title ?? $"Field {fieldId}"),
                IType = GetInputTypeId(inputType),
                ICol = 0,
                IRow = 0,
                Weight = fieldWeight > 0 ? fieldWeight : weight,
                IsSearch = true,
                IsCatalog = false,
                IsCatalogMain = false,
                IdFieldGroup = idGroup,
                IdCategoryType = 0,
                IdPatternType = idPatternType,
                PatternCustom = patternCustom,
                FixValue = fixValue,
                MinValue = minValue,
                MaxValue = maxValue,
                MinLen = minLen,
                MaxLen = maxLen,
                IsRequired = isNameField || isRequired,
                IsReadOnly = isNameField || isReadOnly,
                IsUpperCase = isUpperCase,
                IsCapitalize = isCapitalize,
                Format = isNameField ? "file_name" : null,
                IsOcrFix = prev?.IsOcrFix ?? false
            });
        }

        return weight;
    }

    /// <summary>Xử lý trường mở rộng (EF{id}) từ form (Field 1-25, ID 101-125).</summary>
    private static int ProcessExtendedFields(
        IFormCollection form,
        int docTypeId,
        List<StgDocFieldSettingDto> current,
        List<StgDocFieldSettingDto> list,
        int weight)
    {
        for (int i = 1; i <= 25; i++)
        {
            var fieldId = 100 + i; // ID 101-125
            var keyEf = $"EF{fieldId}";
            var isEnabled = AxeFormHelper.GetBool(form, $"EF_Enabled_{fieldId}") || form.ContainsKey(keyEf);
            if (!isEnabled)
                continue;

            weight++;
            var fieldWeight = AxeFormHelper.GetInt(form, $"EF_Weight_{fieldId}");
            var title = AxeFormHelper.GetString(form, $"EF_Title_{fieldId}");
            var inputType = AxeFormHelper.GetString(form, $"EF_InputType_{fieldId}") ?? "text";
            var idGroup = AxeFormHelper.GetInt(form, $"EF_GroupDetail_{fieldId}");
            var minValue = AxeFormHelper.GetString(form, $"EF_MinValue_{fieldId}");
            var maxValue = AxeFormHelper.GetString(form, $"EF_MaxValue_{fieldId}");
            var minLen = AxeFormHelper.GetInt(form, $"EF_MinLen_{fieldId}");
            if (minLen < 0) minLen = 0;
            var maxLen = AxeFormHelper.GetInt(form, $"EF_MaxLen_{fieldId}");
            if (maxLen < 0) maxLen = 0;
            var idPatternType = AxeFormHelper.GetInt(form, $"EF_Pattern_{fieldId}");
            var patternCustom = AxeFormHelper.GetString(form, $"EF_Description_{fieldId}");
            var fixValue = AxeFormHelper.GetString(form, $"EF_DefaultValue_{fieldId}");
            var isRequired = AxeFormHelper.GetBool(form, $"EF_Required_{fieldId}");
            var isReadOnly = AxeFormHelper.GetBool(form, $"EF_ReadOnly_{fieldId}");
            var isUpperCase = AxeFormHelper.GetBool(form, $"EF_UpperCase_{fieldId}");
            var isCapitalize = AxeFormHelper.GetBool(form, $"EF_Capitalize_{fieldId}");

            var prev = current.FirstOrDefault(x => x.IdField == fieldId && !x.IsCatalog);
            list.Add(new StgDocFieldSettingDto
            {
                IdType = docTypeId,
                IdField = fieldId,
                Title = title ?? $"Field {i}",
                IType = GetInputTypeId(inputType),
                ICol = 0,
                IRow = 0,
                Weight = fieldWeight > 0 ? fieldWeight : weight,
                IsSearch = true,
                IsCatalog = false,
                IsCatalogMain = false,
                IdFieldGroup = idGroup,
                IdCategoryType = 0,
                IdPatternType = idPatternType,
                PatternCustom = patternCustom,
                FixValue = fixValue,
                MinValue = minValue,
                MaxValue = maxValue,
                MinLen = minLen,
                MaxLen = maxLen,
                IsRequired = isRequired,
                IsReadOnly = isReadOnly,
                IsUpperCase = isUpperCase,
                IsCapitalize = isCapitalize,
                Format = null,
                IsOcrFix = prev?.IsOcrFix ?? false
            });
        }

        return weight;
    }
}
