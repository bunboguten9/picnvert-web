from flask import Flask, request, send_file, render_template, abort, jsonify, make_response, Response
from PIL import Image, UnidentifiedImageError
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
import io
import fitz
import zipfile
import os
import tempfile
import uuid
import time
import traceback
import pillow_heif
pillow_heif.register_heif_opener()


TEMP_DIR = tempfile.mkdtemp()
INDIVIDUAL_IMAGES = {}  # session_id -> {filename: full_path}

EXPIRE_SECONDS = 600  # 10分

def cleanup_old_sessions():
    now = time.time()
    for sid, filemap in list(INDIVIDUAL_IMAGES.items()):
        for fpath in filemap.values():
            try:
                if os.path.exists(fpath) and now - os.path.getmtime(fpath) > EXPIRE_SECONDS:
                    os.remove(fpath)
            except Exception:
                pass
        INDIVIDUAL_IMAGES.pop(sid, None)

cleanup_old_sessions()

app = Flask(__name__)

@app.route("/googlef081ea3d57b18b33.html")
def google_verification():
    return "google-site-verification: googlef081ea3d57b18b33.html"

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/img2img")
def img2img():
    return render_template("img2img.html")

@app.route("/img2img/convert", methods=["POST"])
def img2img_convert():
    uploaded_files = request.files.getlist("files")
    format = request.form.get("format")
    quality_option = request.form.get("quality", "original")
    session_id = str(uuid.uuid4())
    session_dir = os.path.join("converted", session_id)
    os.makedirs(session_dir, exist_ok=True)

    converted_filenames = []

    # 画質オプションに応じたサイズ・圧縮設定
    def get_resize_and_quality(option):
        if option == "high":
            return {"max_size": 1920, "quality": 95, "optimize": True}
        elif option == "medium":
            return {"max_size": 1280, "quality": 85, "optimize": True}
        elif option == "low":
            return {"max_size": 960, "quality": 70, "optimize": True}
        else:  # original
            return {"max_size": None, "quality": None, "optimize": False}

    settings = get_resize_and_quality(quality_option)

    for file in uploaded_files:
        try:
            img = Image.open(file.stream).convert("RGBA" if format.lower() == "png" else "RGB")
        except UnidentifiedImageError:
            continue  # スキップ

        original_name = os.path.splitext(file.filename)[0]
        ext = f".{format.lower()}"
        save_path = os.path.join(session_dir, original_name + ext)

        # サイズ調整
        if settings["max_size"]:
            width, height = img.size
            max_dim = max(width, height)
            if max_dim > settings["max_size"]:
                scale = settings["max_size"] / max_dim
                img = img.resize((int(width * scale), int(height * scale)), Image.LANCZOS)

        # 保存時のパラメータ
        save_kwargs = {}
        if format.lower() in ["jpeg", "jpg", "webp", "heic", "tiff", "bmp"]:
            if settings["quality"]:
                save_kwargs["quality"] = settings["quality"]
            if settings["optimize"]:
                save_kwargs["optimize"] = True

        img.save(save_path, format=format.upper(), **save_kwargs)
        converted_filenames.append(os.path.basename(save_path))

    # 単一ファイルの場合は直接返す
    if len(converted_filenames) == 1:
        path = os.path.join(session_dir, converted_filenames[0])
        response = make_response(send_file(path, as_attachment=True))
        response.headers["X-Session-ID"] = session_id
        return response

    # 複数ファイル → ZIPで返す
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zipf:
        for fname in converted_filenames:
            path = os.path.join(session_dir, fname)
            zipf.write(path, arcname=fname)
    zip_buffer.seek(0)

    response = make_response(send_file(zip_buffer, as_attachment=True, download_name="converted_images.zip"))
    response.headers["Content-Type"] = "application/zip"
    response.headers["X-Session-ID"] = session_id
    return response

@app.route("/img2img/list/<session_id>")
def img2img_list(session_id):
    files = INDIVIDUAL_IMAGES.get(session_id)
    if not files:
        return abort(404)
    return jsonify(list(files.keys()))

@app.route("/img2img/download/<session_id>/<filename>")
def img2img_download(session_id, filename):
    files = INDIVIDUAL_IMAGES.get(session_id)
    if not files or filename not in files:
        return abort(404)
    return send_file(files[filename], as_attachment=True)

@app.route("/pdf2img/convert", methods=["POST"])
def pdf_to_images():
    if "pdf" not in request.files:
        return "No PDF file uploaded", 400

    pdf_file = request.files["pdf"]
    if pdf_file.filename == "":
        return "Empty filename", 400

    try:
        # PDF を読み込む
        pdf_data = pdf_file.read()
        doc = fitz.open(stream=pdf_data, filetype="pdf")

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w") as zipf:
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                pix = page.get_pixmap(dpi=150)
                img_data = pix.tobytes("png")
                zipf.writestr(f"page_{page_num + 1}.png", img_data)

        zip_buffer.seek(0)
        return send_file(
            zip_buffer,
            mimetype="application/zip",
            as_attachment=True,
            download_name="extracted_images.zip"
        )

    except Exception as e:
        return f"Error processing PDF: {str(e)}", 500

@app.route("/imgpdf")
def imgpdf():
    return render_template("imgpdf.html")

@app.route("/imgpdf/convert", methods=["POST"])
def imgpdf_convert():
    files = request.files.getlist("files")
    session_id = str(uuid.uuid4())
    output_path = os.path.join(TEMP_DIR, f"{session_id}_merged.pdf")

    try:
        pdf_buffer = io.BytesIO()
        c = canvas.Canvas(pdf_buffer)

        max_size = 2048  # 長辺最大2048pxにリサイズ（縦横比維持）

        for file in files:
            img = Image.open(file.stream).convert("RGB")

            # リサイズ（長辺2048pxまで）
            width, height = img.size
            if max(width, height) > max_size:
                scale = max_size / max(width, height)
                width = int(width * scale)
                height = int(height * scale)
                img = img.resize((width, height), Image.LANCZOS)

            img_io = io.BytesIO()
            img.save(img_io, format="JPEG")
            img_io.seek(0)

            # ページサイズを画像サイズに合わせて変更
            c.setPageSize((width, height))
            c.drawImage(ImageReader(img_io), 0, 0, width=width, height=height)
            c.showPage()

        c.save()

        # PDF書き出し
        pdf_buffer.seek(0)
        with open(output_path, "wb") as f:
            f.write(pdf_buffer.read())

        response = make_response(send_file(
            output_path,
            as_attachment=True,
            download_name="converted.pdf"
        ))
        return response

    except Exception as e:
        print(f"PDF変換エラー: {e}")
        return abort(500, "PDF作成に失敗しました。")

# ✅ PDFエディタ用ルートの追加
@app.route('/pdfeditor')
def pdfeditor():
    return render_template('pdfeditor.html')

@app.route("/robots.txt")
def robots_txt():
    return Response(
        "User-agent: *\nAllow: /\nSitemap: https://picnvert-web.onrender.com/sitemap.xml",
        mimetype="text/plain"
    )

@app.route("/sitemap.xml", methods=["GET"])
def sitemap():
    pages = [
        "https://picnvert-web.onrender.com/",
        "https://picnvert-web.onrender.com/img2img",
        "https://picnvert-web.onrender.com/imgpdf",
        "https://picnvert-web.onrender.com/pdfeditor",  # ← 今後追加したいなら
    ]
    xml = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']

    for url in pages:
        xml.append("  <url>")
        xml.append(f"    <loc>{url}</loc>")
        xml.append(f"    <lastmod>{time.strftime('%Y-%m-%d')}</lastmod>")
        xml.append("    <priority>0.8</priority>")
        xml.append("  </url>")

    xml.append("</urlset>")
    response = Response("\n".join(xml), mimetype='application/xml')
    return response


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
