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
