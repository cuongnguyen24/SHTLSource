namespace Core.Domain.Enums;

/// <summary>Bước trong quy trình số hóa tài liệu</summary>
public enum WorkflowStep : byte
{
    /// <summary>0 - Chưa bắt đầu</summary>
    None = 0,
    /// <summary>1 - Scan / Upload file</summary>
    Scan = 1,
    /// <summary>2 - Kiểm tra scan lần 1</summary>
    CheckScan1 = 2,
    /// <summary>3 - Kiểm tra scan lần 2</summary>
    CheckScan2 = 3,
    /// <summary>4 - Khoanh vùng OCR</summary>
    Zone = 4,
    /// <summary>5 - OCR (optional)</summary>
    Ocr = 5,
    /// <summary>6 - Nhập liệu / Extract</summary>
    Extract = 6,
    /// <summary>7 - Kiểm tra lần 1</summary>
    Check1 = 7,
    /// <summary>8 - Kiểm tra lần 2</summary>
    Check2 = 8,
    /// <summary>9 - Kiểm tra cuối</summary>
    CheckFinal = 9,
    /// <summary>10 - Kiểm tra logic</summary>
    CheckLogic = 10,
    /// <summary>11 - Export</summary>
    Export = 11,
    /// <summary>99 - Đã hoàn thành</summary>
    Completed = 99
}

public enum StepResult : byte
{
    Pending = 0,
    Pass = 1,
    Fail = 2,
    Return = 3
}

public enum QueueStatus : byte
{
    Pending = 0,
    Processing = 1,
    Done = 2,
    Error = 3,
    Cancelled = 4
}

public enum QueueType : byte
{
    Ocr = 1,
    Export = 2,
    Delete = 3,
    Import = 4,
    Thumbnail = 5,
    PdfConvert = 6
}

public enum OcrStatus : byte
{
    NotRequested = 0,
    Queued = 1,
    Processing = 2,
    Done = 3,
    Error = 4,
    Skipped = 9
}

public enum SyncType : int
{
    Manual = 0,
    Auto = 1,
    ScanUpload = 2,
    ExcelImport = 3,
    FolderWatch = 4,
    ApiPush = 5,
    ScanExcel = 6
}

public enum ExportStatus : byte
{
    Pending = 0,
    Processing = 1,
    Done = 2,
    Error = 3
}

public enum DocumentStatus : byte
{
    Active = 1,
    Deleted = 2,
    Archived = 3,
    Locked = 4
}

public enum FormCellType : int
{
    Digit = 1,
    Alphabet = 2,
    Character = 3,
    Tick = 4,
    Signature = 5
}

public enum ModuleCode
{
    // Admin
    UserManagement = 100,
    RoleManagement = 101,
    DeptManagement = 102,
    TeamManagement = 103,
    SystemConfig = 110,
    ChannelManagement = 111,

    // SoHoa - Upload / Scan
    ScanUpload = 200,
    ManageFolder = 201,

    // SoHoa - Check Scan
    CheckScanFirst = 210,
    CheckScanSecond = 211,

    // SoHoa - Zone & OCR
    Zone = 220,
    Ocr = 221,

    // SoHoa - Extract
    ExtractDigit = 230,
    ExtractAlphabet = 231,
    ExtractCharacter = 232,
    ExtractTick = 233,
    ExtractForm = 234,

    // SoHoa - Check
    CheckFirst = 240,
    CheckSecond = 241,
    CheckFinal = 242,
    CheckLogic = 243,

    // SoHoa - Export
    ExportData = 250,
    ExportConfig = 251,

    // SoHoa - Config
    DocTypeConfig = 260,
    RecordTypeConfig = 261,
    SyncTypeConfig = 262,
    ContentTypeConfig = 263,

    // Report
    Report = 300,
    ReportProductivity = 301,
    ReportQuality = 302,
    ReportLog = 303,
}
