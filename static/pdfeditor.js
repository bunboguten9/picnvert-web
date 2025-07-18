// public/pdfeditor.js

let selectedPageIndex = null;
const thumbnailsContainer = document.getElementById("pdf-thumbnails");
const pdfCanvas = document.getElementById("pdf-canvas");
const pdfCtx = pdfCanvas.getContext("2d");
const exportModal = document.getElementById("export-modal");
const exportForm = document.getElementById("export-form");

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
  img.className = "thumbnail-image";

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

// エクスポートモーダル開閉
function openExportModal() {
  exportModal.classList.remove("hidden");
}
function closeExportModal() {
  exportModal.classList.add("hidden");
}

document.getElementById("open-export-modal").addEventListener("click", openExportModal);
document.getElementById("close-export-modal").addEventListener("click", closeExportModal);
document.getElementById("cancel-export").addEventListener("click", closeExportModal);

// エクスポート実行（今はモック）
exportForm.addEventListener("submit", (e) => {
  e.preventDefault();
  alert("エクスポート処理はまだ実装されていません。");
  closeExportModal();
});

window.addEventListener("DOMContentLoaded", loadMockPDFs);
