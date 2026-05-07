// FileManager OCR Request functionality

let ocrDocumentTypes = [];

// Load document types when page loads
$(document).ready(function () {
    loadOcrDocumentTypes();
    initOcrModalEvents();
});

// Load OCR document types
function loadOcrDocumentTypes() {
    $.ajax({
        url: '/FileManager/GetOcrDocumentTypes',
        method: 'GET',
        success: function (response) {
            if (response.success && response.data) {
                ocrDocumentTypes = response.data;
                populateDocumentTypeDropdown(response.data);
            } else {
                console.error('Failed to load OCR document types:', response.message);
            }
        },
        error: function (xhr, status, error) {
            console.error('Error loading OCR document types:', error);
        }
    });
}

// Populate document type dropdown
function populateDocumentTypeDropdown(documentTypes) {
    const dropdown = $('#ocrDocumentType');
    dropdown.empty();
    dropdown.append('<option value="">-- Select Document Type --</option>');
    
    documentTypes.forEach(function (docType) {
        dropdown.append(`<option value="${docType.code}">${docType.documentTypeName}</option>`);
    });
}

// Open OCR modal
function openOcrModal(fileId, fileName) {
    $('#ocrFileId').val(fileId);
    $('#ocrFileName').text(fileName);
    $('#ocrDocumentType').val('').removeClass('is-invalid');
    $('#ocrForm')[0].reset();
    $('#ocrModal').modal('show');
}

// Initialize OCR modal events
function initOcrModalEvents() {
    // Submit OCR form
    $('#btnSubmitOcr').off('click').on('click', function () {
        const form = $('#ocrForm')[0];
        const documentType = $('#ocrDocumentType').val();
        
        // Validate form
        if (!documentType) {
            $('#ocrDocumentType').addClass('is-invalid');
            return;
        }
        
        $('#ocrDocumentType').removeClass('is-invalid');
        
        const fileId = $('#ocrFileId').val();
        const fileName = $('#ocrFileName').text();
        
        processOcr(fileId, documentType, fileName);
    });

    // Clear validation on change
    $('#ocrDocumentType').on('change', function () {
        if ($(this).val()) {
            $(this).removeClass('is-invalid');
        }
    });
}

// Process OCR request
function processOcr(fileId, documentTypeCode, fileName) {
    const $submitBtn = $('#btnSubmitOcr');
    const originalBtnText = $submitBtn.html();
    
    // Show loading state
    $submitBtn.prop('disabled', true)
              .html('<i class="fas fa-spinner fa-spin me-2"></i>Processing...');

    $.ajax({
        url: '/FileManager/ProcessOcr',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            fileId: fileId,
            documentTypeCode: documentTypeCode
        }),
        headers: {
            'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
        },
        success: function (response) {
            if (response.success) {
                // Close OCR modal
                $('#ocrModal').modal('hide');
                
                // Show success message
                toastr.success(response.message || 'OCR request submitted successfully');
                
                // Show result in modal
                if (response.data) {
                    showOcrResult(response.data);
                }
            } else {
                toastr.error(response.message || 'OCR processing failed');
            }
        },
        error: function (xhr, status, error) {
            let errorMessage = 'An error occurred while processing OCR';
            if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = xhr.responseJSON.message;
            } else if (xhr.responseText) {
                try {
                    const errorResponse = JSON.parse(xhr.responseText);
                    errorMessage = errorResponse.message || errorMessage;
                } catch (e) {
                    // Keep default error message
                }
            }
            toastr.error(errorMessage);
        },
        complete: function () {
            // Restore button state
            $submitBtn.prop('disabled', false).html(originalBtnText);
        }
    });
}

// Show OCR result in modal
function showOcrResult(ocrData) {
    let resultHtml = `
        <div class="row mb-3">
            <div class="col-md-6">
                <h6 class="fw-bold text-muted">File Name:</h6>
                <p class="mb-0">${ocrData.fileName || 'N/A'}</p>
            </div>
            <div class="col-md-6">
                <h6 class="fw-bold text-muted">Job ID:</h6>
                <p class="mb-0"><code>${ocrData.jobId || 'N/A'}</code></p>
            </div>
        </div>
        <div class="row mb-3">
            <div class="col-md-12">
                <h6 class="fw-bold text-muted">Status:</h6>
                <p class="mb-0">${ocrData.success ? '<span class="badge bg-success">Success</span>' : '<span class="badge bg-danger">Failed</span>'}</p>
            </div>
        </div>
    `;

    // Add OCR result data if available
    if (ocrData.informationFields) {
        try {
            const resultData = ocrData.informationFields;
            
            // Check if it's a Dictionary<string, InformationFieldDto> (AX Provider format)
            if (resultData && typeof resultData === 'object' && !Array.isArray(resultData)) {
                const fields = Object.entries(resultData);
                
                if (fields.length > 0) {
                    resultHtml += `
                        <div class="mb-3">
                            <h6 class="fw-bold text-muted">OCR Result (${fields.length} fields extracted):</h6>
                            <div class="card">
                                <div class="card-body p-0">
                                    <div class="table-responsive">
                                        <table class="table table-sm table-hover table-bordered mb-0">
                                            <thead class="table-light">
                                                <tr>
                                                    <th style="width: 25%;">Field Name</th>
                                                    <th style="width: 40%;">Value</th>
                                                    <th style="width: 15%;" class="text-center">Confidence</th>
                                                    <th style="width: 20%;" class="text-center">Details</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                    `;
                    
                    fields.forEach(([fieldName, field]) => {
                        const confidence = field.confidence != null ? (field.confidence * 100).toFixed(2) : 'N/A';
                        const confidenceClass = field.confidence >= 0.9 ? 'success' : field.confidence >= 0.7 ? 'warning' : 'danger';
                        const confidenceBadge = field.confidence != null 
                            ? `<span class="badge bg-${confidenceClass}">${confidence}%</span>`
                            : '<span class="badge bg-secondary">N/A</span>';
                        
                        const details = [];
                        if (field.area) details.push(`Area: ${field.area}`);
                        if (field.page != null) details.push(`Page: ${field.page}`);
                        if (field.pageSize) details.push(`Size: ${field.pageSize}`);
                        const detailsText = details.length > 0 ? details.join('<br>') : '-';
                        
                        resultHtml += `
                            <tr>
                                <td><strong class="text-primary">${fieldName}</strong></td>
                                <td>${field.value || '<em class="text-muted">Empty</em>'}</td>
                                <td class="text-center">${confidenceBadge}</td>
                                <td class="text-center" style="font-size: 11px; color: #666;">${detailsText}</td>
                            </tr>
                        `;
                    });
                    
                    resultHtml += `
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    resultHtml += `
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            No fields extracted from OCR result
                        </div>
                    `;
                }
            } else {
                // Show raw JSON if not in expected format
                resultHtml += `
                    <div class="mb-3">
                        <h6 class="fw-bold text-muted">OCR Result:</h6>
                        <div class="card">
                            <div class="card-body">
                                <pre class="mb-0" style="max-height: 400px; overflow-y: auto; white-space: pre-wrap; font-size: 12px;">${JSON.stringify(resultData, null, 2)}</pre>
                            </div>
                        </div>
                    </div>
                `;
            }
        } catch (e) {
            // If parsing fails, show as text
            resultHtml += `
                <div class="mb-3">
                    <h6 class="fw-bold text-muted">Result:</h6>
                    <div class="card">
                        <div class="card-body">
                            <pre class="mb-0" style="max-height: 400px; overflow-y: auto; white-space: pre-wrap;">${ocrData.result}</pre>
                        </div>
                    </div>
                </div>
            `;
        }
    } else if (ocrData.status === 'Pending' || ocrData.status === 'Processing') {
        resultHtml += `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Info:</strong> OCR processing is in progress. Please check the job history for updates.
            </div>
        `;
    }

    // Add error message if failed
    if (ocrData.errorMessage) {
        resultHtml += `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Error:</strong> ${ocrData.errorMessage}
            </div>
        `;
    }

    // Add link to job history
    resultHtml += `
        <div class="mt-3 text-end">
            <a href="/ocr/jobs/${ocrData.jobId}" class="btn btn-sm btn-outline-primary" target="_blank">
                <i class="fas fa-external-link-alt me-1"></i> View in Job History
            </a>
        </div>
    `;

    $('#ocrResultContent').html(resultHtml);
    $('#ocrResultModal').modal('show');
}

// Format datetime for display
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

// Get document type name by code
function getDocumentTypeName(code) {
    const docType = ocrDocumentTypes.find(dt => dt.code === code);
    return docType ? docType.documentTypeName : code;
}

// Get status badge HTML
function getStatusBadge(status) {
    const statusConfig = {
        'Pending': { class: 'warning', icon: 'clock' },
        'Processing': { class: 'info', icon: 'spinner fa-spin' },
        'Completed': { class: 'success', icon: 'check-circle' },
        'Failed': { class: 'danger', icon: 'times-circle' }
    };

    const config = statusConfig[status] || { class: 'secondary', icon: 'question-circle' };
    return `<span class="badge bg-${config.class}"><i class="fas fa-${config.icon} me-1"></i>${status}</span>`;
}
