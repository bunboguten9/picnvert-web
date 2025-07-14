from flask import Flask, request, send_file, render_template
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

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zipf:
        for file in files:
            filename = file.filename
            try:
                img = Image.open(file.stream).convert("RGB")
                name_without_ext = os.path.splitext(os.path.basename(filename))[0]
                img_io = io.BytesIO()
                img.save(img_io, format=output_format.upper())
                img_io.seek(0)
                zipf.writestr(f"{name_without_ext}.{output_format}", img_io.read())
            except Exception as e:
                print(f"変換失敗: {filename} - {e}")

    zip_buffer.seek(0)
    return send_file(zip_buffer, mimetype="application/zip", as_attachment=True, download_name="converted_images.zip")

if __name__ == "__main__":
    app.run(debug=True)
