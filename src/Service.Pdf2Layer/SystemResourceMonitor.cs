namespace SHTL.Service.Pdf2Layer;

/// <summary>
/// Theo dõi tài nguyên máy (RAM, CPU core) để tính số worker song song tối ưu.
/// Cross-platform: dùng GC.GetGCMemoryInfo() (hoạt động trên Windows và Linux/container).
/// </summary>
internal static class SystemResourceMonitor
{
    /// <summary>
    /// RAM khả dụng (MB) toàn hệ thống.
    /// Trên Linux container bị giới hạn cgroup, trả về giá trị trong giới hạn đó.
    /// </summary>
    public static long GetAvailableMemoryMb()
    {
        try
        {
            var info = GC.GetGCMemoryInfo();
            // TotalAvailableMemoryBytes = tổng RAM vật lý (hoặc container cgroup limit)
            // MemoryLoadBytes           = lượng RAM đang sử dụng toàn hệ thống
            var availableBytes = (long)info.TotalAvailableMemoryBytes - (long)info.MemoryLoadBytes;
            return Math.Max(0, availableBytes / 1024 / 1024);
        }
        catch
        {
            return -1;
        }
    }

    /// <summary>Số logical CPU cores của máy.</summary>
    public static int ProcessorCount => Environment.ProcessorCount;

    /// <summary>
    /// Tính số worker song song mục tiêu dựa trên cấu hình và tài nguyên thực tế.
    /// <para>
    /// Logic scale:
    /// <list type="bullet">
    ///   <item>Nếu <see cref="SearchablePdfWorkerOptions.MaxConcurrentWorkers"/> &gt; 0 → dùng cố định, bỏ qua auto-scale.</item>
    ///   <item>Giới hạn trên = số CPU logical core (tránh context-switch quá nhiều Python process).</item>
    ///   <item>Giới hạn bởi RAM: <c>floor((freeRam - overhead) / MinFreeMemoryPerJobMb)</c>.</item>
    ///   <item>Kết quả tối thiểu = 1 (luôn xử lý ít nhất 1 job).</item>
    /// </list>
    /// </para>
    /// </summary>
    public static int ComputeTargetWorkers(SearchablePdfWorkerOptions opts)
    {
        // Manual override: cấu hình cứng, bỏ qua auto-scale
        if (opts.MaxConcurrentWorkers > 0)
            return opts.MaxConcurrentWorkers;

        // Giới hạn trên theo số CPU core
        var maxByCpu = Math.Max(1, ProcessorCount);

        // Giới hạn theo RAM khả dụng
        var freeMemMb = GetAvailableMemoryMb();
        int maxByMemory;

        if (freeMemMb < 0 || opts.MinFreeMemoryPerJobMb <= 0)
        {
            // Không đọc được RAM hoặc không cấu hình → chỉ dựa vào CPU
            maxByMemory = maxByCpu;
        }
        else
        {
            // Dành 300 MB cho OS + .NET runtime, phần còn lại chia đều cho Python workers
            const int overheadMb = 300;
            var usableMb = Math.Max(0, freeMemMb - overheadMb);
            maxByMemory = (int)(usableMb / opts.MinFreeMemoryPerJobMb);
        }

        return Math.Max(1, Math.Min(maxByCpu, maxByMemory));
    }
}
