document.addEventListener("DOMContentLoaded", function () {
  const dropArea = document.getElementById("drop-area");
  const fileInput = document.getElementById("fileElem");
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

dropArea.addEventListener("drop", async (e) => {
  e.preventDefault();
  dropArea.classList.remove("hover");

  const includeSubdirs = document.getElementById("includeSubdirs").checked;
  let newFiles = [];

  if (includeSubdirs) {
    newFiles = await getAllFilesFromDataTransferItemList(e.dataTransfer.items);
  } else {
    newFiles = Array.from(e.dataTransfer.files);
  }

  selectedFiles.push(...newFiles);
  showFileList();
});


  function showFileList() {
    const list = document.getElementById("file-list");
    list.innerHTML = "";
  
    // スクロールコンテナの作成
    const scrollContainer = document.createElement("div");
    scrollContainer.style.display = "flex";
    scrollContainer.style.overflowX = "auto";
    scrollContainer.style.gap = "16px";
    scrollContainer.style.padding = "10px 0";
  
    selectedFiles.forEach(file => {
      const container = document.createElement("div");
      container.style.minWidth = "100px";
      container.style.textAlign = "center";
  
      const label = document.createElement("div");
      label.textContent = file.name;
      label.style.fontSize = "0.8rem";
      label.style.marginBottom = "4px";
  
      const img = document.createElement("img");
      img.style.width = "100px";
      img.style.height = "100px";
      img.style.objectFit = "cover";
      img.style.border = "1px solid #ccc";
      img.style.borderRadius = "8px";
      img.alt = file.name;
  
      // FileReaderで画像を読み込み
      const reader = new FileReader();
      reader.onload = function (e) {
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
  
      container.appendChild(label);
      container.appendChild(img);
      scrollContainer.appendChild(container);
    });
  
    list.appendChild(scrollContainer);
  }

  convertBtn.addEventListener("click", () => {
    if (selectedFiles.length === 0) {
      alert("変換するファイルを選択してください。");
      return;
    }

    const format = formatSelect.value;
    const quality = document.getElementById("quality-select").value;

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append("files", file);
    });
    formData.append("format", format);
    formData.append("quality", quality);

    convertBtn.disabled = true;
    convertBtn.textContent = "変換中...";

    const progressContainer = document.getElementById("progress-container");
    const progressBar = document.getElementById("progress-bar");
    const progressMessage = document.getElementById("progress-message");

    progressContainer.style.display = "block";
    progressBar.value = 10;
    progressMessage.textContent = "モバイル環境では変換に時間がかかる場合があります…";

    // 擬似プログレス進行
    let fakeProgress = 10;
    const fakeInterval = setInterval(() => {
      if (fakeProgress < 90) {
        fakeProgress += Math.random() * 5;
        progressBar.value = Math.min(fakeProgress, 90);
      }
    }, 300);

    fetch("/img2img/convert", {
      method: "POST",
      body: formData
    })
      .then(async res => {
        if (!res.ok) throw new Error("変換に失敗しました。");

        const sessionId = res.headers.get("X-Session-ID");
        const blob = await res.blob();
        const contentType = res.headers.get("Content-Type");
        const url = URL.createObjectURL(blob);

        downloadArea.innerHTML = "";

        if (contentType === "application/zip") {
          // ZIPファイル
          const zipLink = document.createElement("a");
          zipLink.href = url;
          zipLink.download = "converted_images.zip";
          zipLink.textContent = "✅ 一括ダウンロード（ZIP）";
          zipLink.style.display = "block";
          zipLink.style.marginTop = "10px";
          downloadArea.appendChild(zipLink);

          // 個別リンク
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
        } else {
          // 単一画像ファイル
          const imgLink = document.createElement("a");
          imgLink.href = url;
          imgLink.download = "converted_image";
          imgLink.textContent = "✅ 画像をダウンロード";
          imgLink.style.display = "block";
          imgLink.style.marginTop = "10px";
          downloadArea.appendChild(imgLink);
        }
      })
      .catch(err => {
        alert("変換エラー：" + err.message);
      })
      .finally(() => {
        convertBtn.disabled = false;
        convertBtn.textContent = "変換実行";
        progressContainer.style.display = "none";
        progressBar.value = 0;
        clearInterval(fakeInterval);
      });
  });

async function getAllFilesFromDataTransferItemList(dataTransferItemList) {
  const files = [];

  for (const item of dataTransferItemList) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) {
      const newFiles = await traverseEntry(entry);
      files.push(...newFiles);
    }
  }

  return files;
}

function traverseEntry(entry) {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((file) => resolve([file]));
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      let entries = [];

      const readEntries = () => {
        dirReader.readEntries(async (batch) => {
          if (batch.length === 0) {
            const all = await Promise.all(entries.map(traverseEntry));
            resolve(all.flat());
          } else {
            entries.push(...batch);
            readEntries();
          }
        });
      };
      readEntries();
    } else {
      resolve([]);
    }
  });
}
