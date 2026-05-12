using System.Net.Http.Headers;
using System.Text.Json;

namespace SHTL.Plugin.Sync;

public sealed class MainForm : Form
{
    private readonly TextBox _txtFolder = new();
    private readonly CheckBox _chkOnlyAdd = new();
    private readonly CheckBox _chkAllowDuplicate = new();
    private readonly CheckBox _chkSelectAllTypes = new();
    private readonly CheckBox _chkReupload = new();
    private readonly CheckBox _chkOnlyPdf = new();
    private readonly Label _lblTotal = new();
    private readonly Label _lblSuccess = new();
    private readonly Label _lblFail = new();
    private readonly Label _lblExist = new();
    private readonly DataGridView _gridTypes = new();
    private readonly TextBox _txtLog = new();
    private readonly Button _btnUpload = new();
    private readonly Button _btnPause = new();
    private readonly FolderBrowserDialog _folderDialog = new();

    private PluginSyncConfig _currentConfig = new();
    private CancellationTokenSource? _uploadCts;
    private bool _isUploading;
    private int _totalCount;
    private int _okCount;
    private int _failCount;
    private int _existCount;

    public MainForm()
    {
        Text = "SHTL Plugin Đồng bộ";
        Width = 900;
        Height = 760;
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(126, 194, 235);

        BuildUi();
        UpdateStats();
    }

    public void ActivateFromRemote()
    {
        if (WindowState == FormWindowState.Minimized)
            WindowState = FormWindowState.Normal;
        Show();
        BringToFront();
        Activate();
    }

    public void ApplyConfiguration(PluginSyncConfig? config)
    {
        _currentConfig = config ?? new PluginSyncConfig();
        _gridTypes.Rows.Clear();

        var items = _currentConfig.Items
            .OrderBy(x => x.Weight)
            .ThenBy(x => x.Name)
            .ToList();

        foreach (var item in items)
        {
            var display = $"{item.Name} : {item.Format ?? string.Empty}";
            var rowIndex = _gridTypes.Rows.Add(item.IsDefault, display, "⬇");
            _gridTypes.Rows[rowIndex].Tag = item;
        }

        AppendLog($"Đã nhận {items.Count} loại đồng bộ từ web.");
    }

    private void BuildUi()
    {
        var pnlTop = new Panel { Left = 16, Top = 12, Width = 850, Height = 86 };
        Controls.Add(pnlTop);

        var lblFolder = new Label { Left = 0, Top = 4, Text = "Chọn thư mục:" };
        pnlTop.Controls.Add(lblFolder);

        _chkOnlyAdd.Left = 120;
        _chkOnlyAdd.Top = 2;
        _chkOnlyAdd.AutoSize = true;
        _chkOnlyAdd.Text = "Chỉ thêm bản ghi. Không tải file lên";
        pnlTop.Controls.Add(_chkOnlyAdd);

        _chkAllowDuplicate.Left = 410;
        _chkAllowDuplicate.Top = 2;
        _chkAllowDuplicate.AutoSize = true;
        _chkAllowDuplicate.Text = "Cho phép file trùng nội dung";
        pnlTop.Controls.Add(_chkAllowDuplicate);

        _txtFolder.Left = 0;
        _txtFolder.Top = 26;
        _txtFolder.Width = 700;
        pnlTop.Controls.Add(_txtFolder);

        var btnPick = new Button { Left = 708, Top = 24, Width = 82, Height = 26, Text = "Chọn" };
        btnPick.Click += (_, _) =>
        {
            if (_folderDialog.ShowDialog() == DialogResult.OK)
                _txtFolder.Text = _folderDialog.SelectedPath;
        };
        pnlTop.Controls.Add(btnPick);

        var lblStruct = new Label { Left = 0, Top = 62, Text = "Cấu trúc thư" };
        pnlTop.Controls.Add(lblStruct);

        _chkSelectAllTypes.Left = 120;
        _chkSelectAllTypes.Top = 60;
        _chkSelectAllTypes.AutoSize = true;
        _chkSelectAllTypes.Text = "Chọn tất cả";
        _chkSelectAllTypes.CheckedChanged += (_, _) =>
        {
            foreach (DataGridViewRow row in _gridTypes.Rows)
                row.Cells[0].Value = _chkSelectAllTypes.Checked;
        };
        pnlTop.Controls.Add(_chkSelectAllTypes);

        _gridTypes.Left = 16;
        _gridTypes.Top = 104;
        _gridTypes.Width = 850;
        _gridTypes.Height = 220;
        _gridTypes.AllowUserToAddRows = false;
        _gridTypes.RowHeadersVisible = false;
        _gridTypes.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
        _gridTypes.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
        _gridTypes.Columns.Add(new DataGridViewCheckBoxColumn { Width = 60, HeaderText = "Chọn", FillWeight = 10 });
        _gridTypes.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Loại tài liệu", FillWeight = 85 });
        _gridTypes.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "", FillWeight = 5 });
        Controls.Add(_gridTypes);

        var pnlStats = new Panel { Left = 16, Top = 334, Width = 850, Height = 36 };
        Controls.Add(pnlStats);
        var lblPdf = new Label { Left = 0, Top = 8, Text = "PDF" };
        pnlStats.Controls.Add(lblPdf);
        _chkReupload.Left = 96; _chkReupload.Top = 8; _chkReupload.Text = "in bộ"; _chkReupload.AutoSize = true;
        pnlStats.Controls.Add(_chkReupload);
        _chkOnlyPdf.Left = 154; _chkOnlyPdf.Top = 8; _chkOnlyPdf.Text = "Chỉ PDF"; _chkOnlyPdf.AutoSize = true; _chkOnlyPdf.Checked = true;
        pnlStats.Controls.Add(_chkOnlyPdf);
        _lblTotal.Left = 320; _lblTotal.Top = 9; _lblTotal.AutoSize = true; _lblTotal.Font = new Font(_lblTotal.Font, FontStyle.Bold);
        pnlStats.Controls.Add(_lblTotal);
        _lblSuccess.Left = 430; _lblSuccess.Top = 9; _lblSuccess.AutoSize = true; _lblSuccess.ForeColor = Color.Green; _lblSuccess.Font = new Font(_lblSuccess.Font, FontStyle.Bold);
        pnlStats.Controls.Add(_lblSuccess);
        _lblFail.Left = 560; _lblFail.Top = 9; _lblFail.AutoSize = true; _lblFail.ForeColor = Color.Red; _lblFail.Font = new Font(_lblFail.Font, FontStyle.Bold);
        pnlStats.Controls.Add(_lblFail);
        _lblExist.Left = 640; _lblExist.Top = 9; _lblExist.AutoSize = true; _lblExist.ForeColor = Color.Red; _lblExist.Font = new Font(_lblExist.Font, FontStyle.Bold);
        pnlStats.Controls.Add(_lblExist);

        var pnlActions = new Panel { Left = 16, Top = 372, Width = 850, Height = 40 };
        Controls.Add(pnlActions);
        _btnUpload.Left = 0; _btnUpload.Top = 4; _btnUpload.Width = 70; _btnUpload.Text = "Tải lên";
        _btnUpload.Click += async (_, _) => await StartUploadAsync();
        pnlActions.Controls.Add(_btnUpload);
        _btnPause.Left = 76; _btnPause.Top = 4; _btnPause.Width = 76; _btnPause.Text = "Tạm dừng";
        _btnPause.Click += (_, _) => PauseUpload();
        pnlActions.Controls.Add(_btnPause);
        var btnHide = new Button { Left = 158, Top = 4, Width = 56, Text = "Ẩn" };
        btnHide.Click += (_, _) => WindowState = FormWindowState.Minimized;
        pnlActions.Controls.Add(btnHide);
        var btnExportLog = new Button { Left = 220, Top = 4, Width = 100, Text = "Xuất file logs" };
        btnExportLog.Click += (_, _) => ExportLog();
        pnlActions.Controls.Add(btnExportLog);

        _txtLog.Left = 16;
        _txtLog.Top = 418;
        _txtLog.Width = 850;
        _txtLog.Height = 280;
        _txtLog.Multiline = true;
        _txtLog.ScrollBars = ScrollBars.Vertical;
        _txtLog.ReadOnly = true;
        Controls.Add(_txtLog);
    }

    private async Task StartUploadAsync()
    {
        if (_isUploading)
            return;

        var folder = (_txtFolder.Text ?? string.Empty).Trim();
        if (!Directory.Exists(folder))
        {
            AppendLog("Thư mục không tồn tại.");
            return;
        }

        if (_chkOnlyAdd.Checked)
        {
            AppendLog("Tùy chọn 'Chỉ thêm bản ghi' chưa hỗ trợ ở backend hiện tại.");
            return;
        }

        var uploadUrl = !string.IsNullOrWhiteSpace(_currentConfig.UploadChunkUrl)
            ? _currentConfig.UploadChunkUrl
            : _currentConfig.UploadUrl;
        if (string.IsNullOrWhiteSpace(uploadUrl))
        {
            AppendLog("Thiếu Upload URL từ web. Bấm lại nút Đồng bộ ở trang Scan.");
            return;
        }

        var selectedSyncTypeIds = GetSelectedSyncTypeIds();
        if (selectedSyncTypeIds.Count == 0)
        {
            AppendLog("Chưa chọn loại đồng bộ.");
            return;
        }

        var allFiles = Directory.EnumerateFiles(folder, "*", SearchOption.AllDirectories).ToList();
        if (_chkOnlyPdf.Checked)
            allFiles = allFiles.Where(x => string.Equals(Path.GetExtension(x), ".pdf", StringComparison.OrdinalIgnoreCase)).ToList();

        if (allFiles.Count == 0)
        {
            AppendLog("Không có file phù hợp để tải lên.");
            return;
        }

        _uploadCts = new CancellationTokenSource();
        _isUploading = true;
        _btnUpload.Enabled = false;
        _btnPause.Enabled = true;
        _totalCount = allFiles.Count;
        _okCount = 0;
        _failCount = 0;
        _existCount = 0;
        UpdateStats();

        try
        {
            using var client = new HttpClient { Timeout = Timeout.InfiniteTimeSpan };
            if (!string.IsNullOrWhiteSpace(_currentConfig.ApiKey))
                client.DefaultRequestHeaders.Add("X-Api-Key", _currentConfig.ApiKey);

            foreach (var filePath in allFiles)
            {
                _uploadCts.Token.ThrowIfCancellationRequested();
                await UploadSingleFileChunkedAsync(
                    client,
                    uploadUrl,
                    filePath,
                    folder,
                    selectedSyncTypeIds,
                    _chkOnlyPdf.Checked,
                    _uploadCts.Token);
            }

            AppendLog("Hoàn tất tải lên.");
        }
        catch (OperationCanceledException)
        {
            AppendLog("Đã tạm dừng.");
        }
        catch (Exception ex)
        {
            AppendLog("Lỗi tải lên: " + ex.Message);
        }
        finally
        {
            _isUploading = false;
            _btnUpload.Enabled = true;
            _btnPause.Enabled = false;
            _uploadCts?.Dispose();
            _uploadCts = null;
        }
    }

    private async Task UploadSingleFileChunkedAsync(
        HttpClient client,
        string uploadUrl,
        string filePath,
        string rootFolder,
        List<int> selectedSyncTypeIds,
        bool onlyPdf,
        CancellationToken cancellationToken)
    {
        var relativePath = Path.GetRelativePath(rootFolder, filePath).Replace('\\', '/');
        var fileName = Path.GetFileName(filePath);
        var uploadId = Guid.NewGuid().ToString("N");
        const int chunkSize = 4 * 1024 * 1024;

        await using var source = File.OpenRead(filePath);
        var totalChunks = (int)Math.Ceiling(source.Length / (double)chunkSize);
        if (totalChunks <= 0) totalChunks = 1;

        for (var chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var remaining = source.Length - source.Position;
            var bytesToRead = (int)Math.Min(chunkSize, remaining);
            var buffer = new byte[bytesToRead];
            var read = await source.ReadAsync(buffer.AsMemory(0, bytesToRead), cancellationToken);
            if (read <= 0)
                break;

            using var form = new MultipartFormDataContent();
            form.Add(new StringContent(uploadId), "uploadId");
            form.Add(new StringContent(fileName), "fileName");
            form.Add(new StringContent(relativePath), "relativePath");
            form.Add(new StringContent(chunkIndex.ToString()), "chunkIndex");
            form.Add(new StringContent(totalChunks.ToString()), "totalChunks");
            foreach (var id in selectedSyncTypeIds)
                form.Add(new StringContent(id.ToString()), "syncTypeIds");
            form.Add(new StringContent(onlyPdf ? "true" : "false"), "onlyPdf");
            form.Add(new StringContent(_currentConfig.CreatedBy.ToString()), "createdBy");

            var payload = read == buffer.Length ? buffer : buffer[..read];
            var chunkContent = new ByteArrayContent(payload);
            chunkContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            form.Add(chunkContent, "chunk", fileName + ".part");

            using var resp = await client.PostAsync(uploadUrl, form, cancellationToken);
            var body = await resp.Content.ReadAsStringAsync(cancellationToken);
            if (!resp.IsSuccessStatusCode)
            {
                _failCount++;
                if ((int)resp.StatusCode == 413)
                {
                    var mb = new FileInfo(filePath).Length / (1024d * 1024d);
                    AppendLog($"ERR | {relativePath} | HTTP 413 - chunk vẫn vượt ngưỡng IIS ({mb:0.##} MB file).");
                }
                else
                {
                    var brief = string.IsNullOrWhiteSpace(body) ? "" : (" | " + body[..Math.Min(240, body.Length)].Replace('\r', ' ').Replace('\n', ' '));
                    AppendLog($"ERR | {relativePath} | HTTP {(int)resp.StatusCode}{brief}");
                }

                UpdateStats();
                return;
            }

            var chunkResp = JsonSerializer.Deserialize<ChunkUploadResponseDto>(body, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            if (chunkResp?.Completed != true)
                continue;

            var result = chunkResp.Result ?? new WebSyncUploadBatchResultDto();
            foreach (var item in result.Items)
            {
                if (item.Success) _okCount++;
                else
                {
                    _failCount++;
                    if (!string.IsNullOrWhiteSpace(item.Message) &&
                        item.Message.Contains("tồn tại", StringComparison.OrdinalIgnoreCase))
                        _existCount++;
                }
                AppendLog($"{(item.Success ? "OK" : "ERR")} | {item.RelativePath} | {item.Message}");
            }

            UpdateStats();
            return;
        }

        _failCount++;
        AppendLog($"ERR | {relativePath} | Không nhận được phản hồi hoàn tất upload.");
        UpdateStats();
    }

    private void PauseUpload()
    {
        if (!_isUploading)
            return;
        _uploadCts?.Cancel();
    }

    private List<int> GetSelectedSyncTypeIds()
    {
        var ids = new List<int>();
        foreach (DataGridViewRow row in _gridTypes.Rows)
        {
            var selected = row.Cells[0].Value is bool b && b;
            if (!selected)
                continue;
            if (row.Tag is PluginSyncTypeItem item && item.SyncTypeId > 0)
                ids.Add(item.SyncTypeId);
        }
        return ids.Distinct().ToList();
    }

    private void UpdateStats()
    {
        _lblTotal.Text = $"Tổng: {_totalCount}";
        _lblSuccess.Text = $"Thành công: {_okCount}";
        _lblFail.Text = $"Lỗi: {_failCount}";
        _lblExist.Text = $"Đã tồn tại: {_existCount}";
    }

    private void ExportLog()
    {
        using var dialog = new SaveFileDialog
        {
            Filter = "Text file (*.txt)|*.txt",
            FileName = $"shtl-sync-log-{DateTime.Now:yyyyMMdd-HHmmss}.txt"
        };
        if (dialog.ShowDialog() != DialogResult.OK)
            return;
        File.WriteAllText(dialog.FileName, _txtLog.Text);
    }

    private void AppendLog(string message)
    {
        _txtLog.AppendText($"[{DateTime.Now:HH:mm:ss}] {message}{Environment.NewLine}");
    }
}

public sealed class WebSyncUploadBatchResultDto
{
    public List<WebSyncUploadItemResultDto> Items { get; set; } = new();
}

public sealed class WebSyncUploadItemResultDto
{
    public string FileName { get; set; } = string.Empty;
    public string RelativePath { get; set; } = string.Empty;
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public long? DocumentId { get; set; }
}

public sealed class ChunkUploadResponseDto
{
    public bool Completed { get; set; }
    public WebSyncUploadBatchResultDto? Result { get; set; }
}
