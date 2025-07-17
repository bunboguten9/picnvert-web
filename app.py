from flask import Flask, request, send_file, render_template, abort, jsonify
from PIL import Image
import io
import zipfile
import os
import tempfile
import uuid
import time

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

    # 複数 or 単一の判断用
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
        from flask import make_response
        
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
        with zipfile.ZipFile(zip_buffer, "w") as zipf:
            for fname, fpath in converted_files:
                with open(fpath, "rb") as f:
                    zipf.writestr(fname, f.read())

        zip_buffer.seek(0)
        from flask import make_response
        
        response = make_response(send_file(
            fpath,
            as_attachment=True,
            download_name=fname
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

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))

