# Service.Export

Worker xử lý hàng đợi export (CSV tối thiểu) — chạy độc lập (`dotnet Service.Export.dll` hoặc Windows Service).

Tham khảo thêm logic export Excel / cấu hình kênh tại dự án mẫu legacy:

`E:\SourceCodeAXE\AXE-ServiceExport` (Windows Service .NET Framework — `ServiceSTG`, factory exporter…).

Có thể mở rộng `ExportWorker` hoặc tách exporter theo `export_type` trong DB khi cần parity với AXE.
