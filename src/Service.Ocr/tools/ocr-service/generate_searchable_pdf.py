#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tạo PDF 2 lớp: ảnh raster từng trang + lớp chữ ẩn (OCR VNCV + PyMuPDF)."""
from __future__ import annotations

import os
import sys
import tempfile
from typing import Set


def find_font() -> str | None:
    candidates = [
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\seguiui.ttf",
        r"C:\Windows\Fonts\times.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for p in candidates:
        if os.path.isfile(p):
            return p
    return None


def quad_to_rect(box, fitz_mod, scale_x: float = 1.0, scale_y: float = 1.0):
    xs = [float(pt[0]) * scale_x for pt in box]
    ys = [float(pt[1]) * scale_y for pt in box]
    return fitz_mod.Rect(min(xs), min(ys), max(xs), max(ys))


def detect_scale(items, target_w: float, target_h: float,
                 pix_w: int, pix_h: int) -> tuple[float, float]:
    """Suy luận scale OCR-box → POINT.

    VNCV (cũng như PaddleOCR/EasyOCR) thường resize ảnh đầu vào về một kích
    thước nội bộ giới hạn (ví dụ max edge 960/1280px) trước khi inference, rồi
    trả `box` trong không gian đã resize. Vì vậy dùng `pix_w/pix_h` (kích thước
    ảnh ta render) làm mẫu số là SAI — sẽ cho scale nhỏ hơn thực tế, dẫn đến
    highlight chỉ phủ ~một phần dòng chữ.

    Cách bền vững: ước lượng kích thước thực của không gian toạ độ OCR bằng
    `min_coord + max_coord` (giả định lề trang đối xứng — đúng với ~99% tài
    liệu in). Khi lề trái ≈ lề phải, `min + max` ≈ chiều rộng toàn bộ không
    gian toạ độ, không phụ thuộc OCR resize đến đâu.

    Các nhánh xử lý:
      A. OCR trả toạ độ trong POINT (≤ target*1.2): scale = 1.0.
      B. OCR trả toạ độ trong không gian khác: scale = target / (min + max).
         Fallback nếu `min + max` quá khác `pix_w/pix_h` (ví dụ tài liệu có
         lề rất lệch): dùng `max(max_coord, pix_dim_resized_estimate)`.
    """
    if not items or target_w <= 0 or target_h <= 0 or pix_w <= 0 or pix_h <= 0:
        return 1.0, 1.0

    max_x = 0.0
    max_y = 0.0
    min_x = float("inf")
    min_y = float("inf")
    for item in items:
        box = item.get("box")
        if not box:
            continue
        for pt in box:
            try:
                x = float(pt[0])
                y = float(pt[1])
            except (TypeError, ValueError, IndexError):
                continue
            if x > max_x:
                max_x = x
            if y > max_y:
                max_y = y
            if x < min_x:
                min_x = x
            if y < min_y:
                min_y = y

    if max_x <= 0 or max_y <= 0 or not (min_x < float("inf")):
        return 1.0, 1.0

    # Nhánh A — OCR đã ở POINT space.
    if max_x <= target_w * 1.2 and max_y <= target_h * 1.2:
        return 1.0, 1.0

    # Nhánh B — ước lượng kích thước không gian OCR.
    #
    # Giả định: lề trang ĐỐI XỨNG (left margin ≈ right margin). Khi đó:
    #     coord_space_width ≈ min_x + max_x
    # Heuristic này đúng cho ~99% tài liệu in (báo cáo, văn bản hành chính,
    # sách, công văn…). Khi `min/max` quá lớn (> 0.5) → content lệch (header
    # logo, chỉ có chữ một bên), heuristic không tin cậy → dùng `max * 1.05`
    # làm fallback an toàn (chấp nhận highlight có thể tràn 5% mép phải).
    if max_x > 0 and (min_x / max_x) < 0.5:
        span_x = min_x + max_x
    else:
        span_x = max_x * 1.05
    if max_y > 0 and (min_y / max_y) < 0.5:
        span_y = min_y + max_y
    else:
        span_y = max_y * 1.05

    # Chặn trên: OCR coord space không thể vượt kích thước ảnh ta đã render
    # (trừ khi VNCV upscale, điều rất hiếm). Cap để tránh scale quá nhỏ.
    span_x = min(span_x, float(pix_w))
    span_y = min(span_y, float(pix_h))

    return target_w / span_x, target_h / span_y


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: generate_searchable_pdf.py <input.pdf> <output.pdf> [dpi] [max_pages] [selected_pages_csv]", file=sys.stderr)
        return 2

    inp = sys.argv[1]
    outp = sys.argv[2]
    dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 150
    dpi = max(72, min(300, dpi))
    max_pages = int(sys.argv[4]) if len(sys.argv) > 4 else 0
    if max_pages < 0:
        max_pages = 0
    selected_pages_raw = sys.argv[5] if len(sys.argv) > 5 else ""
    selected_pages: Set[int] = set()
    if selected_pages_raw.strip():
        for token in selected_pages_raw.split(","):
            token = token.strip()
            if not token:
                continue
            try:
                page_no = int(token)
            except ValueError:
                continue
            if page_no > 0:
                selected_pages.add(page_no)

    if not os.path.isfile(inp):
        print(f"Input not found: {inp}", file=sys.stderr)
        return 1

    try:
        import fitz  # PyMuPDF
        from vncv.ocr import extract_text
    except ImportError as e:
        print(f"Missing dependency (pip install vncv pymupdf): {e}", file=sys.stderr)
        return 1

    font_path = find_font()
    src = fitz.open(inp)
    out = fitz.open()
    try:
        # Matrix chỉ để render ảnh nét; KHÔNG dùng để định cỡ trang mới.
        render_mat = fitz.Matrix(dpi / 72.0, dpi / 72.0)
        total_pages = len(src)
        limit = total_pages if max_pages <= 0 else min(total_pages, max_pages)

        for i in range(limit):
            page = src[i]

            # ── 1) Render ảnh DPI cao để giữ chất lượng visual ──────────────────
            pix = page.get_pixmap(matrix=render_mat, alpha=False)
            pix_w, pix_h = pix.width, pix.height
            img_bytes = pix.tobytes("png")

            # ── 2) Tạo trang mới đúng kích thước GỐC (POINT) — KHÔNG dùng pixel ─
            src_rect = page.rect
            page_w_pt = float(src_rect.width)
            page_h_pt = float(src_rect.height)
            new_page = out.new_page(width=page_w_pt, height=page_h_pt)
            # Ảnh được nhúng nguyên gốc (DPI cao), PDF reader scale xuống POINT-space.
            new_page.insert_image(new_page.rect, stream=img_bytes)

            # ── 3) Chạy OCR trên ảnh PNG đã render (chỉ các trang được chọn) ───
            tmp_path = None
            try:
                if selected_pages and (i + 1) not in selected_pages:
                    continue

                with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                    tmp.write(img_bytes)
                    tmp_path = tmp.name

                try:
                    items = extract_text(tmp_path, lang="vi", return_dict=True) or []
                except Exception as ocr_ex:
                    print(f"OCR page {i + 1}: {ocr_ex}", file=sys.stderr)
                    items = []

                # ── 4) Đoán không gian toạ độ của OCR & tính scale → POINT ────
                scale_x, scale_y = detect_scale(items, page_w_pt, page_h_pt, pix_w, pix_h)

                # ── 5) Đăng ký font Unicode (Việt) cho lớp chữ ẩn ─────────────
                use_font = "helv"
                if font_path:
                    try:
                        new_page.insert_font(fontname="vi", fontfile=font_path)
                        use_font = "vi"
                    except Exception:
                        pass

                # ── 6) Chèn lớp chữ ẩn (render_mode=3 = invisible) ────────────
                for item in items:
                    text = (item.get("text") or "").strip()
                    if not text:
                        continue
                    box = item.get("box")
                    if not box or len(box) < 4:
                        continue
                    r = quad_to_rect(box, fitz, scale_x=scale_x, scale_y=scale_y)
                    if r.is_empty or r.is_infinite:
                        continue
                    # Font size dựa trên chiều cao box theo POINT (1 pt ≈ 1/72 in).
                    fontsize = max(4, min(36, r.height * 0.9))
                    placed = False
                    try:
                        rc = new_page.insert_textbox(
                            r,
                            text,
                            fontname=use_font,
                            fontsize=fontsize,
                            align=fitz.TEXT_ALIGN_LEFT,
                            render_mode=3,  # invisible (text dùng để select/search)
                        )
                        placed = rc is None or rc >= 0
                    except Exception:
                        pass
                    if not placed:
                        try:
                            pt = fitz.Point(r.x0, min(r.y1, page_h_pt) - 1)
                            new_page.insert_text(
                                pt, text,
                                fontname=use_font,
                                fontsize=fontsize,
                                render_mode=3,
                            )
                        except Exception:
                            pass
            finally:
                if tmp_path:
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass

        out.save(outp, garbage=4, deflate=True)
    finally:
        src.close()
        out.close()

    if not os.path.isfile(outp) or os.path.getsize(outp) == 0:
        print("Output PDF missing or empty", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
