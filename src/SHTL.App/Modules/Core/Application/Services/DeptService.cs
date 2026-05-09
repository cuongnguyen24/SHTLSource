using SHTL.Modules.Core.Domain.Contracts;
using SHTL.Modules.Core.Domain.Entities.Acc;
using SHTL.Modules.Infrastructure.Data.Repositories.Acc;
using SHTL.Modules.Shared.Contracts;
using SHTL.Modules.Shared.Contracts.Dtos;

namespace SHTL.Modules.Core.Application.Services;

public interface IDeptService
{
    Task<IReadOnlyList<DeptDto>> GetListAsync(string? search = null);
    Task<IReadOnlyList<DeptSelectOption>> GetParentOptionsAsync(int? excludeSubtreeRootId = null);
    Task<DeptDto?> GetByIdAsync(int id);
    Task<ApiResult<int>> CreateAsync(CreateDeptRequest req, ICurrentUser currentUser);
    Task<ApiResult> UpdateAsync(UpdateDeptRequest req, ICurrentUser currentUser);
    Task<ApiResult> DeleteAsync(int id, ICurrentUser currentUser);
}

public class DeptService : IDeptService
{
    private readonly IDeptRepository _deptRepo;

    public DeptService(IDeptRepository deptRepo)
    {
        _deptRepo = deptRepo;
    }

    public async Task<IReadOnlyList<DeptDto>> GetListAsync(string? search = null)
    {
        var all = (await _deptRepo.GetAllAsync()).ToList();
        var byId = all.ToDictionary(d => d.Id);
        var term = (search ?? string.Empty).Trim();
        IEnumerable<Dept> query = all;
        if (!string.IsNullOrEmpty(term))
        {
            query = all.Where(d =>
                (!string.IsNullOrEmpty(d.Name) && d.Name.Contains(term, StringComparison.OrdinalIgnoreCase))
                || (!string.IsNullOrEmpty(d.Code) && d.Code.Contains(term, StringComparison.OrdinalIgnoreCase))
                || (!string.IsNullOrEmpty(d.Describe) && d.Describe.Contains(term, StringComparison.OrdinalIgnoreCase)));
        }

        var ordered = query
            .OrderBy(d => d.Weight)
            .ThenBy(d => d.Name ?? "", StringComparer.OrdinalIgnoreCase)
            .ToList();

        return ordered
            .Select(d => MapToDto(d, byId))
            .ToList();
    }

    public async Task<IReadOnlyList<DeptSelectOption>> GetParentOptionsAsync(int? excludeSubtreeRootId = null)
    {
        var all = (await _deptRepo.GetAllAsync()).ToList();
        var byId = all.ToDictionary(d => d.Id);
        var exclude = new HashSet<int>();
        if (excludeSubtreeRootId is { } rootId && rootId > 0)
        {
            exclude.Add(rootId);
            foreach (var id in CollectDescendantIds(all, rootId))
                exclude.Add(id);
        }

        int Depth(int id)
        {
            var depth = 0;
            var cur = id;
            var guard = 0;
            while (cur > 0 && byId.TryGetValue(cur, out var node))
            {
                depth++;
                cur = EffectiveParent(node);
                if (++guard > 100) break;
            }

            return Math.Max(0, depth - 1);
        }

        return all
            .Where(d => !exclude.Contains(d.Id))
            .OrderBy(d => Depth(d.Id))
            .ThenBy(d => d.Weight)
            .ThenBy(d => d.Name ?? "", StringComparer.OrdinalIgnoreCase)
            .Select(d =>
            {
                var depth = Depth(d.Id);
                var prefix = depth > 0 ? new string('—', depth) + " " : string.Empty;
                var codePart = string.IsNullOrWhiteSpace(d.Code) ? "" : $" ({d.Code})";
                return new DeptSelectOption(d.Id, prefix + (d.Name ?? "") + codePart);
            })
            .ToList();
    }

    public async Task<DeptDto?> GetByIdAsync(int id)
    {
        var all = (await _deptRepo.GetAllAsync()).ToList();
        var d = all.FirstOrDefault(x => x.Id == id);
        if (d is null) return null;
        var byId = all.ToDictionary(x => x.Id);
        return MapToDto(d, byId);
    }

    public async Task<ApiResult<int>> CreateAsync(CreateDeptRequest req, ICurrentUser currentUser)
    {
        var name = req.Name.Trim();
        var parent = req.ParentId ?? 0;
        if (parent < 0) parent = 0;

        var all = (await _deptRepo.GetAllAsync()).ToList();
        if (parent > 0 && all.All(x => x.Id != parent))
            return ApiResult<int>.Fail("Phòng ban cha không tồn tại.");

        if (NameExistsUnderParent(all, name, parent, null))
            return ApiResult<int>.Fail($"Đã có phòng ban tên «{name}» cùng cấp (cùng phòng ban cha).");

        var byId = all.ToDictionary(x => x.Id);
        var parentsPath = BuildParentsChain(byId, parent);

        var dept = new Dept
        {
            Name = name,
            Code = req.Code?.Trim().ToUpperInvariant() ?? string.Empty,
            Describe = string.IsNullOrWhiteSpace(req.Describe) ? null : req.Describe.Trim(),
            Parent = parent,
            ParentId = parent > 0 ? parent : null,
            Parents = string.IsNullOrEmpty(parentsPath) ? null : parentsPath,
            Weight = 0,
            Created = DateTime.UtcNow,
            CreatedBy = currentUser.Id
        };

        var id = (int)await _deptRepo.InsertAsync(dept);
        return ApiResult<int>.Ok(id, "Tạo phòng ban thành công");
    }

    public async Task<ApiResult> UpdateAsync(UpdateDeptRequest req, ICurrentUser currentUser)
    {
        var dept = await _deptRepo.GetByIdAsync(req.Id);
        if (dept is null) return ApiResult.Fail("Phòng ban không tồn tại");

        var name = req.Name.Trim();
        var parent = req.ParentId ?? 0;
        if (parent < 0) parent = 0;

        if (parent == req.Id)
            return ApiResult.Fail("Không thể chọn chính phòng ban này làm phòng ban cha.");

        var all = (await _deptRepo.GetAllAsync()).ToList();
        if (parent > 0)
        {
            if (all.All(x => x.Id != parent))
                return ApiResult.Fail("Phòng ban cha không tồn tại.");
            var descendants = CollectDescendantIds(all, req.Id).ToHashSet();
            if (descendants.Contains(parent))
                return ApiResult.Fail("Không thể đặt phòng ban cha là một đơn vị trực thuộc bên dưới.");
        }

        if (NameExistsUnderParent(all, name, parent, req.Id))
            return ApiResult.Fail($"Đã có phòng ban tên «{name}» cùng cấp (cùng phòng ban cha).");

        var byId = all.ToDictionary(x => x.Id);
        dept.Name = name;
        dept.Code = req.Code?.Trim().ToUpperInvariant() ?? dept.Code;
        dept.Describe = string.IsNullOrWhiteSpace(req.Describe) ? null : req.Describe.Trim();
        dept.Parent = parent;
        dept.ParentId = parent > 0 ? parent : null;
        dept.Parents = BuildParentsChain(byId, parent);
        if (string.IsNullOrEmpty(dept.Parents)) dept.Parents = null;
        dept.Updated = DateTime.UtcNow;
        dept.UpdatedBy = currentUser.Id;

        await _deptRepo.UpdateAsync(dept);
        return ApiResult.Ok("Cập nhật phòng ban thành công");
    }

    public async Task<ApiResult> DeleteAsync(int id, ICurrentUser currentUser)
    {
        var dept = await _deptRepo.GetByIdAsync(id);
        if (dept is null)
            return ApiResult.Fail("Phòng ban không tồn tại");

        var all = (await _deptRepo.GetAllAsync()).ToList();
        if (all.Any(d => EffectiveParent(d) == id))
            return ApiResult.Fail("Không xóa được: còn phòng ban con. Hãy xóa hoặc chuyển các đơn vị con trước.");

        await _deptRepo.DeleteAsync(id);
        return ApiResult.Ok("Đã xóa phòng ban");
    }

    private static bool NameExistsUnderParent(List<Dept> all, string name, int parent, int? excludeId)
    {
        return all.Any(d =>
            string.Equals(d.Name, name, StringComparison.OrdinalIgnoreCase)
            && EffectiveParent(d) == parent
            && (excludeId == null || d.Id != excludeId));
    }

    /// <summary>Hậu duệ theo cạnh cha→con; BFS + tập đã gặp để tránh lặp vô hạn khi dữ liệu vòng.</summary>
    private static IEnumerable<int> CollectDescendantIds(List<Dept> all, int rootId)
    {
        var result = new HashSet<int>();
        var queue = new Queue<int>();
        foreach (var c in all.Where(d => EffectiveParent(d) == rootId))
            queue.Enqueue(c.Id);
        while (queue.Count > 0)
        {
            var id = queue.Dequeue();
            if (!result.Add(id))
                continue;
            foreach (var c in all.Where(d => EffectiveParent(d) == id))
            {
                if (!result.Contains(c.Id))
                    queue.Enqueue(c.Id);
            }
        }

        return result;
    }

    /// <summary>Ưu tiên cột <c>parent</c>; nếu = 0 thì dùng <c>parent_id</c> (dữ liệu AXE/cũ).</summary>
    private static int EffectiveParent(Dept d)
        => d.Parent != 0 ? d.Parent : (d.ParentId ?? 0);

    /// <summary>Chuỗi id tổ tiên từ gốc tới cha trực tiếp, ví dụ <c>1/5/12</c> (giống hướng AXE lưu <c>parents</c>).</summary>
    private static string BuildParentsChain(IReadOnlyDictionary<int, Dept> byId, int parentId)
    {
        if (parentId <= 0) return string.Empty;
        var parts = new List<int>();
        var cur = parentId;
        var guard = 0;
        while (cur > 0 && guard++ < 100)
        {
            parts.Add(cur);
            if (!byId.TryGetValue(cur, out var node)) break;
            cur = EffectiveParent(node);
        }

        parts.Reverse();
        return string.Join("/", parts);
    }

    private static DeptDto MapToDto(Dept d, IReadOnlyDictionary<int, Dept> byId)
    {
        var pid = EffectiveParent(d);
        string? parentName = null;
        if (pid > 0 && byId.TryGetValue(pid, out var p))
            parentName = p.Name;

        return new DeptDto
        {
            Id = d.Id,
            Name = d.Name ?? string.Empty,
            Code = d.Code ?? string.Empty,
            Describe = d.Describe,
            ParentId = pid > 0 ? pid : null,
            ParentName = parentName
        };
    }
}
