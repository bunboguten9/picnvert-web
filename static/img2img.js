document.addEventListener("DOMContentLoaded", function () {
  const dropArea = document.getElementById("drop-area");
  const fileInput = document.getElementById("file-input");
  const formatSelect = document.getElementById("format-select");
  const convertBtn = document.getElementById("convert-btn");
  const downloadArea = document.getElementById("download-area");

  let selectedFiles = [];

  dropArea.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", (e) => {
    selectedFiles = Array.from(e.target.files);
    showFileList();
  });

  dropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropArea.classList.add("hover");
  });

  dropArea.addEventListener("dragleave", () => {
    dropArea.classList.remove("hover");
  });

  dropArea.addEventListener("drop", (e) => {
    e.preventDefault();
    dropArea.classList.remove("hover");

    const dt = e.dataTransfer;
    const files = Array.from(dt.files);
    selectedFiles = files;
    showFileList();
  });

  function showFileList() {
    const list = document.getElementById("file-list");
    list.innerHTML = "";
    selectedFiles.forEach(file => {
      const li = document.createElement("li");
      li.textContent = file.name;
      list.appendChild(li);
    });
  }

  convertBtn.addEventListener("click", () => {
    if (selectedFiles.length === 0) {
      alert("変換するファイルを選択してください。");
      return;
    }

    const format = formatSelect.value;
    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append("files", file);
    });
    formData.append("format", format);

    convertBtn.disabled = true;
    convertBtn.textContent = "変換中...";

    fetch("/img2img/convert", {
      method: "POST",
      body: formData
    })
    .then(async res => {
      if (!res.ok) throw new Error("変換に失敗しました。");

      const sessionId = res.headers.get("X-Session-ID");
      const blob = await res.blob();
      const zipUrl = URL.createObjectURL(blob);

      // ダウンロードリンク表示
      downloadArea.innerHTML = "";

      const zipLink = document.createElement("a");
      zipLink.href = zipUrl;
      zipLink.download = "converted_images.zip";
      zipLink.textContent = "✅ 一括ダウンロード（ZIP）";
      zipLink.style.display = "block";
      zipLink.style.marginTop = "10px";
      downloadArea.appendChild(zipLink);

      // 個別リンクも取得して表示
      fetch(`/img2img/list/${sessionId}`)
        .then(r => r.json())
        .then(files => {
          const ul = document.createElement("ul");
          ul.style.marginTop = "10px";
          files.forEach(f => {
            const li = document.createElement("li");
            const link = document.createElement("a");
            link.href = `/img2img/download/${sessionId}/${encodeURIComponent(f)}`;
            link.download = f;
            link.textContent = `📄 ${f}`;
            li.appendChild(link);
            ul.appendChild(li);
          });
          downloadArea.appendChild(document.createElement("hr"));
          downloadArea.appendChild(document.createTextNode("個別ダウンロード："));
          downloadArea.appendChild(ul);
        });

    })
    .catch(err => {
      alert("変換エラー：" + err.message);
    })
    .finally(() => {
      convertBtn.disabled = false;
      convertBtn.textContent = "変換実行";
    });
  });
});
