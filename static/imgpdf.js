// static/imgpdf.js

// 初期化処理
document.addEventListener("DOMContentLoaded", () => {
  const directionBtn = document.getElementById("direction-toggle");
  const modeTextBtn = document.getElementById("mode-text-toggle");
  const modeTitle = document.getElementById("mode-title");
  const formContainer = document.getElementById("form-container");
  const downloadArea = document.getElementById("download-area");

  let mode = "img2pdf"; // デフォルトは画像 → PDF

  function renderForm() {
    downloadArea.innerHTML = "";
    if (mode === "img2pdf") {
      modeTitle.innerHTML = "🖼 → 📄";
      modeTextBtn.textContent = "PDF → 画像に切り替え";
      directionBtn.textContent = "→";
      formContainer.innerHTML = `
        <div id="drop-area" class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-red-400 transition mb-4">
          <p>画像をドロップ・クリックして選択</p>
          <input type="file" id="fileElem" accept="image/*" multiple style="display: none;">
        </div>
        <div id="file-list" class="text-sm text-gray-700 mb-4"></div>
        <div class="flex justify-center">
          <button id="convert-btn" class="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-2 rounded shadow-md transition">
            PDFを作成
          </button>
        </div>
      `;
      setupImg2PdfLogic();
    } else {
      modeTitle.innerHTML = "📄 → 🖼";
      modeTextBtn.textContent = "画像 → PDFに切り替え";
      directionBtn.textContent = "←";
      formContainer.innerHTML = `
        <div id="drop-area" class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition mb-4">
          <p>PDFをドロップ・クリックして選択</p>
          <input type="file" id="fileElem" accept="application/pdf" style="display: none;">
        </div>
        <div id="file-list" class="text-sm text-gray-700 mb-4"></div>
        <div class="flex justify-center">
          <button id="convert-btn" class="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-2 rounded shadow-md transition">
            画像を抽出
          </button>
        </div>
      `;
      setupPdf2ImgLogic();
    }
  }

  directionBtn.addEventListener("click", () => {
    mode = mode === "img2pdf" ? "pdf2img" : "img2pdf";
    renderForm();
  });

  modeTextBtn.addEventListener("click", () => {
    mode = mode === "img2pdf" ? "pdf2img" : "img2pdf";
    renderForm();
  });

  renderForm();

  function setupImg2PdfLogic() {
    const dropArea = document.getElementById("drop-area");
    const fileInput = document.getElementById("fileElem");
    const convertBtn = document.getElementById("convert-btn");
    const fileList = document.getElementById("file-list");

    let selectedFiles = [];

    dropArea.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      selectedFiles = Array.from(e.target.files);
      showFileList();
    });
    dropArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropArea.classList.add("border-red-400");
    });
    dropArea.addEventListener("dragleave", () => {
      dropArea.classList.remove("border-red-400");
    });
    dropArea.addEventListener("drop", (e) => {
      e.preventDefault();
      dropArea.classList.remove("border-red-400");
      selectedFiles = Array.from(e.dataTransfer.files);
      showFileList();
    });

    function showFileList() {
      fileList.innerHTML = "";
      selectedFiles.forEach(file => {
        const p = document.createElement("p");
        p.textContent = file.name;
        fileList.appendChild(p);
      });
    }

    convertBtn.addEventListener("click", () => {
      if (selectedFiles.length === 0) {
        alert("画像を選択してください。");
        return;
      }
      const formData = new FormData();
      selectedFiles.forEach(file => formData.append("files", file));
      convertBtn.disabled = true;
      convertBtn.textContent = "作成中...";
      fetch("/img2pdf/convert", {
        method: "POST",
        body: formData
      })
        .then(res => {
          if (!res.ok) throw new Error("PDF作成失敗");
          return res.blob();
        })
        .then(blob => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "converted.pdf";
          link.textContent = "📄 PDFをダウンロード";
          link.className = "text-red-600 underline";
          downloadArea.innerHTML = "";
          downloadArea.appendChild(link);
        })
        .catch(err => {
          alert("エラー：" + err.message);
        })
        .finally(() => {
          convertBtn.disabled = false;
          convertBtn.textContent = "PDFを作成";
        });
    });
  }

  function setupPdf2ImgLogic() {
    const dropArea = document.getElementById("drop-area");
    const fileInput = document.getElementById("fileElem");
    const convertBtn = document.getElementById("convert-btn");
    const fileList = document.getElementById("file-list");
    let selectedFile = null;

    dropArea.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      selectedFile = e.target.files[0];
      showFileList();
    });
    dropArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropArea.classList.add("border-blue-400");
    });
    dropArea.addEventListener("dragleave", () => {
      dropArea.classList.remove("border-blue-400");
    });
    dropArea.addEventListener("drop", (e) => {
      e.preventDefault();
      dropArea.classList.remove("border-blue-400");
      selectedFile = e.dataTransfer.files[0];
      showFileList();
    });

    function showFileList() {
      fileList.innerHTML = "";
      if (selectedFile) {
        const p = document.createElement("p");
        p.textContent = selectedFile.name;
        fileList.appendChild(p);
      }
    }

    convertBtn.addEventListener("click", () => {
      if (!selectedFile) {
        alert("PDFファイルを選択してください。");
        return;
      }
      const formData = new FormData();
      formData.append("pdf", selectedFile);
      convertBtn.disabled = true;
      convertBtn.textContent = "抽出中...";
      fetch("/pdf2img/convert", {
        method: "POST",
        body: formData
      })
        .then(res => {
          if (!res.ok) throw new Error("画像抽出失敗");
          return res.blob();
        })
        .then(blob => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "extracted_images.zip";
          link.textContent = "🖼 画像ZIPをダウンロード";
          link.className = "text-blue-600 underline";
          downloadArea.innerHTML = "";
          downloadArea.appendChild(link);
        })
        .catch(err => {
          alert("エラー：" + err.message);
        })
        .finally(() => {
          convertBtn.disabled = false;
          convertBtn.textContent = "画像を抽出";
        });
    });
  }
});
