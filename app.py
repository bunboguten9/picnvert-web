from flask import Flask, request, send_file, render_template, abort, jsonify
from PIL import Image
import io
import zipfile
import os
import tempfile
import uuid

app = Flask(__name__)

TEMP_DIR = tempfile.mkdtemp()
INDIVIDUAL_IMAGES = {}  # session_id -> {filename: full_path}

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

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zipf:
        for file in files:
            filename = file.filename
            try:
                img = Image.open(file.stream).convert("RGB")
                name_without_ext = os.path.splitext(os.path.basename(filename))[0]
                new_filename = f"{name_without_ext}.{output_format}"

                # Zip保存
                img_io = io.BytesIO()
                img.save(img_io, format=output_format.upper())
                img_io.seek(0)
                zipf.writestr(new_filename, img_io.read())

                # 個別保存
                output_path = os.path.join(TEMP_DIR, f"{session_id}_{new_filename}")
                img.save(output_path, format=output_format.upper())
                INDIVIDUAL_IMAGES[session_id][new_filename] = output_path

            except Exception as e:
                print(f"変換失敗: {filename} - {e}")

    zip_buffer.seek(0)
    return send_file(
        zip_buffer,
        mimetype="application/zip",
        as_attachment=True,
        download_name="converted_images.zip",
        headers={"X-Session-ID": session_id}
    )

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
    app.run(debug=True)
