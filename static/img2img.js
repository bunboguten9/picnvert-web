document.addEventListener("DOMContentLoaded", function () {
  const dropArea = document.getElementById("drop-area");
  const fileElem = document.getElementById("fileElem");
  const fileList = document.getElementById("file-list");

  dropArea.addEventListener("click", () => fileElem.click());

  dropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropArea.style.borderColor = "#4CAF50";
  });

  dropArea.addEventListener("dragleave", () => {
    dropArea.style.borderColor = "#ccc";
  });

  dropArea.addEventListener("drop", (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
    dropArea.style.borderColor = "#ccc";
  });

  fileElem.addEventListener("change", () => {
    handleFiles(fileElem.files);
  });

  function handleFiles(files) {
    fileList.innerHTML = "";
    [...files].forEach(file => {
      const div = document.createElement("div");
      div.textContent = file.webkitRelativePath || file.name;
      fileList.appendChild(div);
    });
  }
});

document.getElementById("convertBtn").addEventListener("click", () => {
  const format = document.getElementById("format").value;
  const includeSubdirs = document.getElementById("includeSubdirs").checked;

  const formData = new FormData();
  formData.append("format", format);
  formData.append("include_subdirs", includeSubdirs);

  const files = fileElem.files;
  for (let i = 0; i < files.length; i++) {
    formData.append("files", files[i]);
  }

  fetch("/img2img/convert", {
    method: "POST",
    body: formData
  })
    .then(res => {
      if (!res.ok) throw new Error("変換失敗");
      return res.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "converted_images.zip";
      a.textContent = "✅ 変換済みファイルをダウンロード";
      const area = document.getElementById("download-area");
      area.innerHTML = "";
      area.appendChild(a);
    })
    .catch(err => {
      alert("変換に失敗しました：" + err.message);
    });
});
