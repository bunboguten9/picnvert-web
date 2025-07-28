// pdfeditor.js（高解像度サーバー変換対応 + 拡大縮小制限・背景対応）

let selectedPageIndex = null;
const thumbnailsContainer = document.getElementById("thumbnailArea");
const editorArea = document.getElementById("editorArea");
editorArea.style.backgroundColor = "#e5e7eb"; // tailwindのgray-200相当
const exportModal = document.getElementById("exportModal");
const exportButton = document.getElementById("exportButton");
const cancelExport = document.getElementById("cancelExport");

// メイン表示キャンバス
let pdfCanvas = document.createElement("canvas");
pdfCanvas.className = "border shadow";
editorArea.innerHTML = "";
editorArea.appendChild(pdfCanvas);
const pdfCtx = pdfCanvas.getContext("2d");

let loadedPages = []; // { name: string, url: string, image: Image }
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let imgNaturalWidth = 0;
let imgNaturalHeight = 0;

function drawPage() {
  const img = loadedPages[selectedPageIndex]?.image;
  if (!img) return;
  imgNaturalWidth = img.width;
  imgNaturalHeight = img.height;

  pdfCanvas.width = editorArea.clientWidth;
  pdfCanvas.height = editorArea.clientHeight;

  pdfCtx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);

  const drawWidth = imgNaturalWidth * scale;
  const drawHeight = imgNaturalHeight * scale;

  const dx = (pdfCanvas.width - drawWidth) / 2 + offsetX;
  const dy = (pdfCanvas.height - drawHeight) / 2 + offsetY;

  pdfCtx.drawImage(img, dx, dy, drawWidth, drawHeight);

  pdfCtx.fillStyle = "rgba(255,255,255,0.7)";
  pdfCtx.fillRect(dx, dy, 200 * scale, 50 * scale);
  pdfCtx.fillStyle = "black";
  pdfCtx.font = `${18 * scale}px sans-serif`;
  pdfCtx.fillText("ここで編集", dx + 20 * scale, dy + 30 * scale);
}

function selectPage(index) {
  selectedPageIndex = index;
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  drawPage();
}

pdfCanvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const prevScale = scale;
  const zoomFactor = 0.98; // 感度調整（0.98倍）
  scale *= e.deltaY > 0 ? zoomFactor : 1 / zoomFactor;

  const img = loadedPages[selectedPageIndex]?.image;
  if (!img) return;

  const minScaleW = editorArea.clientWidth / img.width;
  const minScaleH = editorArea.clientHeight / img.height;
  const minScale = Math.min(minScaleW, minScaleH);
  if (scale < minScale) scale = minScale;

  drawPage();
});

pdfCanvas.addEventListener("mousedown", (e) => {
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
});

document.addEventListener("mouseup", () => (isDragging = false));

document.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  offsetX += e.clientX - dragStartX;
  offsetY += e.clientY - dragStartY;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  drawPage();
});

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

  div.addEventListener("click", () => selectPage(index));

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
      if (selectedPageIndex === fromIndex) selectPage(toIndex);
    }
  });
}

function rerenderThumbnails() {
  thumbnailsContainer.innerHTML = "";
  loadedPages.forEach((_, i) => renderThumbnail(i));
}

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
  const imageData = loadedPages.map((page) => page.url);

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

document.getElementById("pdfUpload").addEventListener("change", async function (e) {
  const file = e.target.files[0];
  if (!file || file.type !== "application/pdf") {
    alert("PDFファイルを選んでください");
    return;
  }

  const formData = new FormData();
  formData.append("pdf", file);

  const res = await fetch("/pdfeditor/preview", {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    alert("PDF変換に失敗しました");
    return;
  }

  const imageUrls = await res.json();

  loadedPages = [];
  thumbnailsContainer.innerHTML = "";

  for (let i = 0; i < imageUrls.length; i++) {
    const img = new Image();
    img.src = imageUrls[i];
    await new Promise((resolve) => (img.onload = resolve));
    loadedPages.push({ name: `page${i + 1}`, url: imageUrls[i], image: img });
    renderThumbnail(i);
    if (i === 0) selectPage(0);
  }
});
