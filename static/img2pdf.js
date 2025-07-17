document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileElem");
  const convertBtn = document.getElementById("convert-btn");
  const downloadArea = document.getElementById("download-area");

  convertBtn.addEventListener("click", () => {
    const files = Array.from(fileInput.files);
    if (files.length === 0) {
      alert("変換する画像を選んでください。");
      return;
    }

    const formData = new FormData();
    files.forEach(file => {
      formData.append("files", file);
    });

    convertBtn.disabled = true;
    convertBtn.textContent = "変換中...";

    fetch("/img2pdf/convert", {
      method: "POST",
      body: formData
    })
    .then(async res => {
      if (!res.ok) throw new Error("変換に失敗しました");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "converted.pdf";
      link.textContent = "✅ PDFをダウンロード";
      downloadArea.innerHTML = "";
      downloadArea.appendChild(link);
    })
    .catch(err => {
      alert("変換エラー：" + err.message);
    })
    .finally(() => {
      convertBtn.disabled = false;
      convertBtn.textContent = "PDFに変換";
    });
  });
});
