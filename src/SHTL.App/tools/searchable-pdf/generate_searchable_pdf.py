#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tạo PDF 2 lớp: ảnh raster từng trang + lớp chữ ẩn (OCR VNCV + PyMuPDF)."""
from __future__ import annotations

import os
import sys
import tempfile


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


def quad_to_rect(box, fitz_mod):
    xs = [float(pt[0]) for pt in box]
    ys = [float(pt[1]) for pt in box]
    return fitz_mod.Rect(min(xs), min(ys), max(xs), max(ys))


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: generate_searchable_pdf.py <input.pdf> <output.pdf> [dpi]", file=sys.stderr)
        return 2

    inp = sys.argv[1]
    outp = sys.argv[2]
    dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 150
    dpi = max(72, min(300, dpi))

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
        mat = fitz.Matrix(dpi / 72.0, dpi / 72.0)
        for i in range(len(src)):
            page = src[i]
            pix = page.get_pixmap(matrix=mat, alpha=False)
            w, h = pix.width, pix.height
            new_page = out.new_page(width=w, height=h)
            img_bytes = pix.tobytes("png")
            new_page.insert_image(new_page.rect, stream=img_bytes)

            tmp_path = None
            try:
                with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                    tmp.write(img_bytes)
                    tmp_path = tmp.name

                try:
                    items = extract_text(tmp_path, lang="vi", return_dict=True)
                except Exception as ocr_ex:
                    print(f"OCR page {i + 1}: {ocr_ex}", file=sys.stderr)
                    items = []

                use_font = "helv"
                if font_path:
                    try:
                        new_page.insert_font(fontname="vi", fontfile=font_path)
                        use_font = "vi"
                    except Exception:
                        pass

                for item in items or []:
                    text = (item.get("text") or "").strip()
                    if not text:
                        continue
                    box = item.get("box")
                    if not box or len(box) < 4:
                        continue
                    r = quad_to_rect(box, fitz)
                    fontsize = max(6, min(28, r.height * 0.72))
                    placed = False
                    try:
                        new_page.insert_textbox(
                            r,
                            text,
                            fontname=use_font,
                            fontsize=fontsize,
                            align=fitz.TEXT_ALIGN_LEFT,
                            render_mode=3,
                        )
                        placed = True
                    except Exception:
                        pass
                    if not placed:
                        try:
                            pt = fitz.Point(r.x0, min(r.y1, float(h)) - 2)
                            new_page.insert_text(
                                pt, text, fontname=use_font, fontsize=fontsize, render_mode=3
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
