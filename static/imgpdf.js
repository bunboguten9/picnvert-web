document.addEventListener("DOMContentLoaded", () => {
  const dropArea = document.getElementById("drop-area");
  const fileInput = document.getElementById("fileElem");
  const convertBtn = document.getElementById("convert-btn");
  const fileList = document.getElementById("file-list");
  const downloadArea = document.getElementById("download-area");

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

    fetch("/imgpdf/convert", {
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
});
