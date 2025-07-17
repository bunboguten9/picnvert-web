from flask import Flask, request, send_file, render_template, abort, jsonify, make_response
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
import io
import zipfile
import os
import tempfile
import uuid
import time
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
    files = request.files.getlist("files")
    output_format = request.form.get("format", "png").lower()
    session_id = str(uuid.uuid4())
    INDIVIDUAL_IMAGES[session_id] = {}

    converted_files = []

    for file in files:
        filename = file.filename
        try:
            img = Image.open(file.stream).convert("RGB")
            name_without_ext = os.path.splitext(os.path.basename(filename))[0]
            new_filename = f"{name_without_ext}.{output_format}"
            output_path = os.path.join(TEMP_DIR, f"{session_id}_{new_filename}")
            img.save(output_path, format=output_format.upper())
            INDIVIDUAL_IMAGES[session_id][new_filename] = output_path
            converted_files.append((new_filename, output_path))
        except Exception as e:
            print(f"変換失敗: {filename} - {e}")

    if not converted_files:
        return abort(400, "ファイル変換に失敗しました")

    if len(converted_files) == 1:
        # 単一ファイルを直接返す
        fname, fpath = converted_files[0]
        response = make_response(send_file(
            fpath,
            as_attachment=True,
            download_name=fname
        ))
        response.headers["X-Session-ID"] = session_id
        return response
    else:
        # ZIPでまとめる
        zip_buffer = io.BytesIO()
        for fname, fpath in converted_files:
            with zipfile.ZipFile(zip_buffer, "a") as zipf:
                with open(fpath, "rb") as f:
                    zipf.writestr(fname, f.read())

        zip_buffer.seek(0)
        response = make_response(send_file(
            zip_buffer,
            mimetype="application/zip",
            as_attachment=True,
            download_name="converted_images.zip"
        ))
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

@app.route("/img2pdf")
def img2pdf():
    return render_template("img2pdf.html")

@app.route("/img2pdf/convert", methods=["POST"])
def img2pdf_convert():
    files = request.files.getlist("files")
    session_id = str(uuid.uuid4())
    output_path = os.path.join(TEMP_DIR, f"{session_id}_merged.pdf")

    try:
        c = canvas.Canvas(output_path, pagesize=A4)
        width, height = A4

        for file in files:
            img = Image.open(file.stream).convert("RGB")
            img.thumbnail((width, height))
            tmp_path = os.path.join(TEMP_DIR, f"{uuid.uuid4()}.jpg")
            img.save(tmp_path, "JPEG")
            c.drawImage(tmp_path, 0, 0, width=width, height=height)
            c.showPage()
            os.remove(tmp_path)

        c.save()

        response = make_response(send_file(
            output_path,
            as_attachment=True,
            download_name="converted.pdf"
        ))
        return response

    except Exception as e:
        print(f"PDF変換エラー: {e}")
        return abort(500, "PDF作成に失敗しました。")

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
