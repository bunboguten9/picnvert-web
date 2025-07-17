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
import tempfile
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

# 🔸 HEIC/HEIF対応を有効にする
register_heif_opener()

@app.route("/img2img/convert", methods=["POST"])
def img2img_convert():
    files = request.files.getlist("files")
    output_format = request.form.get("format", "png").lower()
    
    session_id = next(tempfile._get_candidate_names())
    session_dir = os.path.join("temp", session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    output_paths = []

    for i, file in enumerate(files):
        try:
            print(f"[INFO] ファイル {i+1}: {file.filename}")

            # 画像を開く
            image = Image.open(file.stream)
            print(f"[INFO] 読み込み成功: {file.filename} - {image.format} - サイズ: {image.size}")

            # 必要に応じて RGB に変換（HEICなども含む）
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGB")

            # 幅が大きすぎる画像はリサイズ（例：1280px以下に制限）
            max_width = 1280
            if image.width > max_width:
                ratio = max_width / image.width
                new_size = (int(image.width * ratio), int(image.height * ratio))
                image = image.resize(new_size)
                print(f"[INFO] 縮小: {file.filename} → {new_size}")

            # 保存先パス作成
            base_name = os.path.splitext(file.filename)[0]
            output_filename = f"{base_name}_converted.{output_format}"
            output_path = os.path.join(session_dir, output_filename)

            # 保存（出力形式に応じて）
            image.save(output_path, format=output_format.upper())
            output_paths.append(output_path)

        except Exception as e:
            print(f"[ERROR] {file.filename} の変換に失敗: {e}")
            traceback.print_exc()

    # 単体画像ならそのまま返す
    if len(output_paths) == 1:
        response = make_response(send_file(output_paths[0], as_attachment=True))
        response.headers["X-Session-ID"] = session_id
        return response

    # 複数画像なら ZIP にして返す
    elif len(output_paths) > 1:
        zip_path = os.path.join(session_dir, "converted_images.zip")
        with zipfile.ZipFile(zip_path, "w") as zipf:
            for path in output_paths:
                zipf.write(path, os.path.basename(path))
        response = make_response(send_file(zip_path, as_attachment=True))
        response.headers["X-Session-ID"] = session_id
        return response

    # 変換に失敗した場合
    return jsonify({"error": "変換に失敗しました"}), 500

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
