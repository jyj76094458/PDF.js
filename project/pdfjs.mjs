if (!pdfjsLib.getDocument || !pdfjsViewer.PDFPageView) {
  alert("PDF.js 라이브러리를 빌드해주세요");
}

pdfjsLib.GlobalWorkerOptions.workerSrc = './node_modules/pdfjs-dist/build/pdf.worker.mjs';

let pdfDocument1 = null;
let pdfDocument2 = null;
let scale1 = 1;
let scale2 = 1;

const containers = [
  document.getElementById('pageContainer1'),
  document.getElementById('pageContainer2')
];

const zoomSelects = [
  document.getElementById('zoomSelect1'),
  document.getElementById('zoomSelect2')
];

const comparisonResultContainer = document.getElementById('comparisonResult');

async function loadPDF(file, index) {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: file });
    const pdfDocument = await loadingTask.promise;

    if (index === 0) {
      pdfDocument1 = pdfDocument;
    } else if (index === 1) {
      pdfDocument2 = pdfDocument;
    }

    await renderAllPages(index);

    if (pdfDocument1 && pdfDocument2) {
      comparePages();
    }
  } catch (error) {
    console.error('Error loading PDF:', error);
  }
}

async function renderAllPages(containerIndex) {
  const pdfDocument = containerIndex === 0 ? pdfDocument1 : pdfDocument2;
  const container = containers[containerIndex];
  const scale = containerIndex === 0 ? scale1 : scale2;

  container.innerHTML = '';

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
    await renderPage(pdfDocument, pageNumber, container, scale);
  }
}

async function renderPage(pdfDocument, pageNumber, container, scale) {
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale: scale });

  const pageDiv = document.createElement('div');
  pageDiv.className = 'page';
  pageDiv.style.width = `${viewport.width}px`;
  pageDiv.style.height = `${viewport.height}px`;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  const renderContext = {
    canvasContext: context,
    viewport: viewport
  };
  await page.render(renderContext).promise;

  pageDiv.appendChild(canvas);
  container.appendChild(pageDiv);
}

async function extractTextFromPage(pdfDocument, pageNumber, scale) {
  const page = await pdfDocument.getPage(pageNumber);
  const textContent = await page.getTextContent();
  return textContent.items.map(item => ({
    text: item.str,
    x: item.transform[4] * scale,
    y: item.transform[5] * scale,
    width: item.width * scale,
    height: item.height * scale
  }));
}

function compareTexts(items1, items2) {
  const result1 = [];
  const result2 = [];
  const comparisonResult = [];

  let i = 0, j = 0;
  while (i < items1.length && j < items2.length) {
    if (items1[i].text === items2[j].text) {
      result1.push(items1[i]);
      result2.push(items2[j]);
      i++;
      j++;
    } else {
      result1.push({ ...items1[i], highlight: true });
      result2.push({ ...items2[j], highlight: true });
      comparisonResult.push({ type: 'modified', text1: items1[i].text, text2: items2[j].text });
      i++;
      j++;
    }
  }

  while (i < items1.length) {
    result1.push({ ...items1[i], highlight: true });
    comparisonResult.push({ type: 'removed', text: items1[i].text });
    i++;
  }

  while (j < items2.length) {
    result2.push({ ...items2[j], highlight: true });
    comparisonResult.push({ type: 'added', text: items2[j].text });
    j++;
  }

  return [result1, result2, comparisonResult];
}

async function comparePages() {
  if (!pdfDocument1 || !pdfDocument2) return;

  comparisonResultContainer.innerHTML = '';
  const maxPages = Math.max(pdfDocument1.numPages, pdfDocument2.numPages);
  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
    await comparePageTexts(pageNumber);
  }
}

async function comparePageTexts(pageNumber) {
  const items1 = pdfDocument1 && pageNumber <= pdfDocument1.numPages ? await extractTextFromPage(pdfDocument1, pageNumber, scale1) : [];
  const items2 = pdfDocument2 && pageNumber <= pdfDocument2.numPages ? await extractTextFromPage(pdfDocument2, pageNumber, scale2) : [];

  const [highlightedItems1, highlightedItems2, comparisonResult] = compareTexts(items1, items2);

  highlightDifferences(pageNumber, highlightedItems1, 0);
  highlightDifferences(pageNumber, highlightedItems2, 1);
  displayComparisonResult(pageNumber, comparisonResult);
}

function highlightDifferences(pageNumber, highlightedItems, containerIndex) {
  const container = containers[containerIndex];
  const pageDiv = container.children[pageNumber - 1];
  if (!pageDiv) return;

  const canvas = pageDiv.querySelector('canvas');

  pageDiv.querySelectorAll('.highlight-1, .highlight-2').forEach(el => el.remove());

  highlightedItems.forEach(item => {
    if (item.highlight) {
      const highlightDiv = document.createElement('div');
      highlightDiv.style.left = `${item.x}px`;
      highlightDiv.style.top = `${canvas.height - item.y - item.height}px`;
      highlightDiv.style.width = `${item.width}px`;
      highlightDiv.style.height = `${item.height}px`;
      highlightDiv.className = containerIndex === 0 ? 'highlight-1' : 'highlight-2';
      pageDiv.appendChild(highlightDiv);
    }
  });
}

function displayComparisonResult(pageNumber, comparisonResult) {
  const pageResultDiv = document.createElement('div');
  pageResultDiv.className = 'comparison-item';
  pageResultDiv.innerHTML = `<h3>페이지 ${pageNumber}</h3>`;

  if (comparisonResult.length === 0) {
    pageResultDiv.innerHTML += '<p>차이점 없음</p>';
  } else {
    comparisonResult.forEach(result => {
      let resultText = '';
      switch (result.type) {
        case 'added':
          resultText = `<span class="added">${result.text}</span>`;
          break;
        case 'removed':
          resultText = `<span class="removed">${result.text}</span>`;
          break;
        case 'modified':
          resultText = `<span class="modified">${result.text1} -> ${result.text2}</span>`;
          break;
      }
      pageResultDiv.innerHTML += `<p>${resultText}</p>`;
    });
  }

  comparisonResultContainer.appendChild(pageResultDiv);
}

async function changeZoom(index) {
  const newScale = parseFloat(zoomSelects[index].value);
  if (index === 0) {
    scale1 = newScale;
    if (pdfDocument1) await renderAllPages(0);
  } else {
    scale2 = newScale;
    if (pdfDocument2) await renderAllPages(1);
  }
  if (pdfDocument1 && pdfDocument2) {
    comparePages();
  }
}

document.getElementById('fileInput1').addEventListener('change', function(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const buffer = new Uint8Array(e.target.result);
      loadPDF(buffer, 0);
    };
    reader.readAsArrayBuffer(file);
  }
});

document.getElementById('fileInput2').addEventListener('change', function(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const buffer = new Uint8Array(e.target.result);
      loadPDF(buffer, 1);
    };
    reader.readAsArrayBuffer(file);
  }
});

zoomSelects.forEach((select, index) => {
  select.addEventListener('change', () => changeZoom(index));
});