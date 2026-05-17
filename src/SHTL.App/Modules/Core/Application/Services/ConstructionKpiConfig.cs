using SHTL.Modules.Core.Domain.Enums;
using SHTL.Modules.Infrastructure.Data.Repositories.Cnf;

namespace SHTL.Modules.Core.Application.Services;

public sealed class ConstructionKpiRoleSettings
{
    public ConstructionKpiRole Role { get; init; }
    public string DisplayName { get; init; } = string.Empty;
    public int DailyTarget { get; init; }
    public decimal MinQualityPercent { get; init; }
    public IReadOnlyList<ConstructionKpiBonusTier> BonusTiers { get; init; } = Array.Empty<ConstructionKpiBonusTier>();
}

public sealed class ConstructionKpiBonusTier
{
    public int MinProcessed { get; init; }
    public decimal MinQualityPercent { get; init; }
    public decimal BonusAmount { get; init; }
}

public sealed class ConstructionKpiSettings
{
    public IReadOnlyList<ConstructionKpiRoleSettings> Roles { get; init; } = Array.Empty<ConstructionKpiRoleSettings>();

    public ConstructionKpiRoleSettings GetRole(ConstructionKpiRole role)
        => Roles.First(r => r.Role == role);
}

public static class ConstructionKpiConfig
{
    public static string RolePrefix(ConstructionKpiRole role) => role switch
    {
        ConstructionKpiRole.CheckScan => "CheckScan",
        ConstructionKpiRole.Extract => "Extract",
        ConstructionKpiRole.PostExtractCheck => "PostExtractCheck",
        _ => role.ToString()
    };

    public static string DisplayName(ConstructionKpiRole role) => role switch
    {
        ConstructionKpiRole.CheckScan => "CheckScan",
        ConstructionKpiRole.Extract => "Extract",
        ConstructionKpiRole.PostExtractCheck => "Check sau Extract",
        _ => role.ToString()
    };

    public static ConstructionKpiRole? MapWorkflowStep(WorkflowStep step) => step switch
    {
        WorkflowStep.CheckScan1 or WorkflowStep.CheckScan2 => ConstructionKpiRole.CheckScan,
        WorkflowStep.Extract => ConstructionKpiRole.Extract,
        WorkflowStep.Check1 => ConstructionKpiRole.PostExtractCheck,
        _ => null
    };

    public static async Task<ConstructionKpiSettings> LoadAsync(ICnfRepository cnfRepo)
    {
        var configs = await cnfRepo.GetConfigsAsync();
        var map = configs.ToDictionary(x => x.Key ?? string.Empty, x => x.Value, StringComparer.OrdinalIgnoreCase);
        var roles = new[]
        {
            ConstructionKpiRole.CheckScan,
            ConstructionKpiRole.Extract,
            ConstructionKpiRole.PostExtractCheck
        };
        return new ConstructionKpiSettings
        {
            Roles = roles.Select(r => LoadRole(map, r)).ToList()
        };
    }

    public static async Task SaveRoleAsync(
        ICnfRepository cnfRepo,
        ConstructionKpiRole role,
        int dailyTarget,
        decimal minQualityPercent,
        IReadOnlyList<ConstructionKpiBonusTier> tiers,
        int updatedBy)
    {
        var prefix = $"ConstructionKpi_{RolePrefix(role)}";
        const string group = "Construction";
        await cnfRepo.UpsertConfigAsync($"{prefix}_DailyTarget", dailyTarget.ToString(), updatedBy, group,
            $"Chỉ tiêu KPI ngày — {DisplayName(role)}");
        await cnfRepo.UpsertConfigAsync($"{prefix}_MinQuality", minQualityPercent.ToString("0.##"), updatedBy, group,
            $"Chất lượng tối thiểu (%) — {DisplayName(role)}");

        for (var i = 0; i < 3; i++)
        {
            var tier = i < tiers.Count ? tiers[i] : new ConstructionKpiBonusTier();
            var n = i + 1;
            await cnfRepo.UpsertConfigAsync($"{prefix}_Bonus{n}_MinProcessed", tier.MinProcessed.ToString(), updatedBy, group,
                $"Mốc thưởng {n}: số tài liệu tối thiểu — {DisplayName(role)}");
            await cnfRepo.UpsertConfigAsync($"{prefix}_Bonus{n}_MinQuality", tier.MinQualityPercent.ToString("0.##"), updatedBy, group,
                $"Mốc thưởng {n}: chất lượng tối thiểu (%) — {DisplayName(role)}");
            await cnfRepo.UpsertConfigAsync($"{prefix}_Bonus{n}_Amount", tier.BonusAmount.ToString("0"), updatedBy, group,
                $"Mốc thưởng {n}: số tiền — {DisplayName(role)}");
        }
    }

    public static decimal CalculateBonus(ConstructionKpiRoleSettings role, int processed, decimal quality)
    {
        decimal bonus = 0;
        foreach (var tier in role.BonusTiers)
        {
            if (processed >= tier.MinProcessed && quality >= tier.MinQualityPercent)
                bonus += tier.BonusAmount;
        }
        return bonus;
    }

    public static bool MeetsDailyKpi(ConstructionKpiRoleSettings role, int processed, decimal quality)
        => processed >= role.DailyTarget && quality >= role.MinQualityPercent;

    private static ConstructionKpiRoleSettings LoadRole(IReadOnlyDictionary<string, string?> map, ConstructionKpiRole role)
    {
        var prefix = $"ConstructionKpi_{RolePrefix(role)}";
        var tiers = new List<ConstructionKpiBonusTier>();
        for (var i = 1; i <= 3; i++)
        {
            var minProc = ReadInt(map, $"{prefix}_Bonus{i}_MinProcessed", 0);
            var minQual = ReadDecimal(map, $"{prefix}_Bonus{i}_MinQuality", 0);
            var amount = ReadDecimal(map, $"{prefix}_Bonus{i}_Amount", 0);
            if (minProc > 0 || amount > 0)
                tiers.Add(new ConstructionKpiBonusTier { MinProcessed = minProc, MinQualityPercent = minQual, BonusAmount = amount });
        }

        return new ConstructionKpiRoleSettings
        {
            Role = role,
            DisplayName = DisplayName(role),
            DailyTarget = ReadInt(map, $"{prefix}_DailyTarget", role switch
            {
                ConstructionKpiRole.CheckScan => 80,
                ConstructionKpiRole.Extract => 60,
                ConstructionKpiRole.PostExtractCheck => 60,
                _ => 50
            }),
            MinQualityPercent = ReadDecimal(map, $"{prefix}_MinQuality", 95m),
            BonusTiers = tiers
        };
    }

    private static int ReadInt(IReadOnlyDictionary<string, string?> map, string key, int fallback)
    {
        if (!map.TryGetValue(key, out var raw) || string.IsNullOrWhiteSpace(raw))
            return fallback;
        return int.TryParse(raw, out var value) ? value : fallback;
    }

    private static decimal ReadDecimal(IReadOnlyDictionary<string, string?> map, string key, decimal fallback)
    {
        if (!map.TryGetValue(key, out var raw) || string.IsNullOrWhiteSpace(raw))
            return fallback;
        return decimal.TryParse(raw, out var value) ? value : fallback;
    }
}
