let selectedPageIndex = null;
const thumbnailsContainer = document.getElementById("thumbnailArea");
const editorArea = document.getElementById("editorArea");
const exportModal = document.getElementById("exportModal");
const exportButton = document.getElementById("exportButton");
const cancelExport = document.getElementById("cancelExport");

// メイン表示キャンバス（仮に作成）
let pdfCanvas = document.createElement("canvas");
pdfCanvas.className = "border shadow";
editorArea.innerHTML = "";  // 初期表示削除
editorArea.appendChild(pdfCanvas);
const pdfCtx = pdfCanvas.getContext("2d");

let loadedPages = []; // { name: string, url: string, image: Image }

// モックPDF（画像）を読み込む（今は画像で代用）
function loadMockPDFs() {
  const mockPDFs = [
    { name: "sample1.pdf", url: "/mock/sample1.jpg" },
    { name: "sample2.pdf", url: "/mock/sample2.jpg" },
    { name: "sample3.pdf", url: "/mock/sample3.jpg" }
  ];

  mockPDFs.forEach((pdf, index) => {
    const img = new Image();
    img.src = pdf.url;
    img.onload = () => {
      loadedPages.push({ ...pdf, image: img });
      renderThumbnail(index);
      if (index === 0) {
        selectPage(index);
      }
    };
  });
}

function renderThumbnail(index) {
  const page = loadedPages[index];
  const div = document.createElement("div");
  div.className = "thumbnail-item";
  div.draggable = true;
  div.dataset.index = index;

  const img = document.createElement("img");
  img.src = page.url;
  img.alt = page.name;
  img.className = "thumbnail-image h-24 shadow rounded";

  const label = document.createElement("div");
  label.textContent = page.name;
  label.className = "text-xs text-gray-500 mt-1 text-center";

  div.appendChild(img);
  div.appendChild(label);
  thumbnailsContainer.appendChild(div);

  // クリックで選択
  div.addEventListener("click", () => selectPage(index));

  // DnDイベント
  div.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", index);
  });

  div.addEventListener("dragover", (e) => e.preventDefault());

  div.addEventListener("drop", (e) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    const toIndex = parseInt(div.dataset.index, 10);
    if (fromIndex !== toIndex) {
      const moved = loadedPages.splice(fromIndex, 1)[0];
      loadedPages.splice(toIndex, 0, moved);
      rerenderThumbnails();
      if (selectedPageIndex === fromIndex) {
        selectPage(toIndex);
      }
    }
  });
}

function rerenderThumbnails() {
  thumbnailsContainer.innerHTML = "";
  loadedPages.forEach((_, i) => renderThumbnail(i));
}

function selectPage(index) {
  selectedPageIndex = index;
  const page = loadedPages[index];
  if (!page || !page.image) return;

  const img = page.image;
  pdfCanvas.width = img.width;
  pdfCanvas.height = img.height;
  pdfCtx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
  pdfCtx.drawImage(img, 0, 0);

  // 編集用ラベル
  pdfCtx.fillStyle = "rgba(255,255,255,0.7)";
  pdfCtx.fillRect(0, 0, 200, 50);
  pdfCtx.fillStyle = "black";
  pdfCtx.font = "bold 18px sans-serif";
  pdfCtx.fillText("ここで編集", 20, 30);
}

// モーダル操作
function openExportModal() {
  exportModal.classList.remove("hidden");
}
function closeExportModal() {
  exportModal.classList.add("hidden");
}

exportButton.addEventListener("click", openExportModal);
cancelExport.addEventListener("click", closeExportModal);

exportModal.querySelector("button.bg-blue-600").addEventListener("click", async () => {
  const filenameInput = document.getElementById("exportFilename");
  const filename = filenameInput.value.trim() || "output.pdf";

  const imageData = loadedPages.map((page) => page.url);  // base64の画像URL一覧

  const res = await fetch("/pdfeditor/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images: imageData, filename })
  });

  if (res.ok) {
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    closeExportModal();
  } else {
    alert("PDF生成に失敗しました");
  }
});

// PDFアップロードと読み込み処理
document.getElementById("pdfUpload").addEventListener("change", async function (e) {
  const file = e.target.files[0];
  if (!file || file.type !== "application/pdf") {
    alert("PDFファイルを選んでください");
    return;
  }

  const fileReader = new FileReader();
  fileReader.onload = async function () {
    const typedArray = new Uint8Array(this.result);
    const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

    loadedPages = []; // クリア
    thumbnailsContainer.innerHTML = "";

    for (let i = 0; i < pdf.numPages; i++) {
      const page = await pdf.getPage(i + 1);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

      const img = new Image();
      img.src = canvas.toDataURL();
      await new Promise((resolve) => (img.onload = resolve));

      loadedPages.push({ name: `page${i + 1}`, url: img.src, image: img });
      renderThumbnail(i);
      if (i === 0) selectPage(0);
    }
  };
  fileReader.readAsArrayBuffer(file);
});
