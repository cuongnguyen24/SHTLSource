using Microsoft.AspNetCore.Http;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services.Axe;

/// <summary>Builder cho field settings của Loại đồng bộ (DocTypeSyncSettingDto).</summary>
public static class SyncTypeFieldSettingsBuilder
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

    public static List<DocTypeSyncSettingDto> Build(
        int syncTypeId,
        IFormCollection form,
        IReadOnlyList<DocTypeSyncSettingDto> currentSettings)
    {
        var current = currentSettings.ToList();
        var weight = 0;
        var list = new List<DocTypeSyncSettingDto>();

        // Xử lý trường mặc định (DF{id})
        weight = ProcessDefaultFields(form, syncTypeId, current, list, weight);

        // Xử lý trường mở rộng (EF{id})
        weight = ProcessExtendedFields(form, syncTypeId, current, list, weight);

        return list;
    }

    /// <summary>Xử lý trường mặc định (DF{id}) từ form.</summary>
    private static int ProcessDefaultFields(
        IFormCollection form,
        int syncTypeId,
        List<DocTypeSyncSettingDto> current,
        List<DocTypeSyncSettingDto> list,
        int weight)
    {
        // Danh sách trường mặc định (ID 1-20)
        var defaultFieldIds = Enumerable.Range(1, 20).ToList();

        foreach (var fieldId in defaultFieldIds)
        {
            var keyDf = $"DF{fieldId}";
            if (!form.ContainsKey(keyDf))
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
            var isRequired = AxeFormHelper.GetBool(form, $"DF_Required_{fieldId}");
            var isReadOnly = AxeFormHelper.GetBool(form, $"DF_ReadOnly_{fieldId}");
            var isUpperCase = AxeFormHelper.GetBool(form, $"DF_UpperCase_{fieldId}");
            var isCapitalize = AxeFormHelper.GetBool(form, $"DF_Capitalize_{fieldId}");

            var prev = current.FirstOrDefault(x => x.IdField == fieldId && !x.IsCatalog);
            list.Add(new DocTypeSyncSettingDto
            {
                IdType = syncTypeId,
                IdField = fieldId,
                Title = title ?? $"Field {fieldId}",
                IType = GetInputTypeId(inputType),
                Weight = fieldWeight > 0 ? fieldWeight : weight,
                IsCatalog = false,
                IdFieldGroup = idGroup,
                IdPatternType = idPatternType,
                PatternCustom = null,
                FixValue = null,
                MinValue = minValue,
                MaxValue = maxValue,
                MinLen = minLen,
                MaxLen = maxLen,
                IsRequired = isRequired,
                IsReadOnly = isReadOnly,
                IsUpperCase = isUpperCase,
                IsCapitalize = isCapitalize
            });
        }

        return weight;
    }

    /// <summary>Xử lý trường mở rộng (EF{id}) từ form (Field 1-25, ID 101-125).</summary>
    private static int ProcessExtendedFields(
        IFormCollection form,
        int syncTypeId,
        List<DocTypeSyncSettingDto> current,
        List<DocTypeSyncSettingDto> list,
        int weight)
    {
        for (int i = 1; i <= 25; i++)
        {
            var fieldId = 100 + i; // ID 101-125
            var keyEf = $"EF{fieldId}";
            if (!form.ContainsKey(keyEf))
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
            var isRequired = AxeFormHelper.GetBool(form, $"EF_Required_{fieldId}");
            var isReadOnly = AxeFormHelper.GetBool(form, $"EF_ReadOnly_{fieldId}");
            var isUpperCase = AxeFormHelper.GetBool(form, $"EF_UpperCase_{fieldId}");
            var isCapitalize = AxeFormHelper.GetBool(form, $"EF_Capitalize_{fieldId}");

            var prev = current.FirstOrDefault(x => x.IdField == fieldId && !x.IsCatalog);
            list.Add(new DocTypeSyncSettingDto
            {
                IdType = syncTypeId,
                IdField = fieldId,
                Title = title ?? $"Field {i}",
                IType = GetInputTypeId(inputType),
                Weight = fieldWeight > 0 ? fieldWeight : weight,
                IsCatalog = false,
                IdFieldGroup = idGroup,
                IdPatternType = idPatternType,
                PatternCustom = null,
                FixValue = null,
                MinValue = minValue,
                MaxValue = maxValue,
                MinLen = minLen,
                MaxLen = maxLen,
                IsRequired = isRequired,
                IsReadOnly = isReadOnly,
                IsUpperCase = isUpperCase,
                IsCapitalize = isCapitalize
            });
        }

        return weight;
    }
}
