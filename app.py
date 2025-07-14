from flask import Flask, render_template, request, send_file
from PIL import Image
import fitz  # PyMuPDF
import os
import uuid
import tempfile

app = Flask(__name__)

UPLOAD_FOLDER = tempfile.gettempdir()

@app.route("/", methods=["GET", "POST"])
def index():
    result_url = None
    if request.method == "POST":
        file = request.files.get("file")
        if not file:
            return render_template("index.html", error="ファイルが選択されていません")

        filename = str(uuid.uuid4()) + "_" + file.filename
        path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(path)

        ext = os.path.splitext(filename)[1].lower()
        out_path = os.path.join(UPLOAD_FOLDER, "converted_" + filename)

        try:
            if ext == ".pdf":
                doc = fitz.open(path)
                page = doc.load_page(0)
                pix = page.get_pixmap()
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                img.save(out_path.replace(".pdf", ".jpg"))
            elif ext in [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"]:
                img = Image.open(path).convert("RGB")
                img.save(out_path.replace(ext, ".pdf"))
            else:
                return render_template("index.html", error="未対応の形式です")
        except Exception as e:
            return render_template("index.html", error="変換エラー: " + str(e))

        result_url = "/download/" + os.path.basename(out_path.replace(ext, ".pdf" if ext != ".pdf" else ".jpg"))

    return render_template("index.html", result=result_url)

@app.route("/download/<filename>")
def download_file(filename):
    return send_file(os.path.join(UPLOAD_FOLDER, filename), as_attachment=True)

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=10000)
