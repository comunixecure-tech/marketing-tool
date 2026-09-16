// =========================================================
// 狀態
// =========================================================
let uploadedPdfBytes = null;
let uploadedPdfName = '';
let uploadedPdfPageCount = 0;
const FOOTER_HEIGHT_RATIO = 0.16; // footer 高度佔頁面寬度的比例

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}

// =========================================================
// 拖曳排序（事件綁在容器上，清單重建後仍然有效）
// =========================================================
function initSortable(container) {
  container.addEventListener('dragstart', (e) => {
    if (!e.target.classList.contains('sortable-item')) return;
    e.target.classList.add('dragging');
  });
  container.addEventListener('dragend', (e) => {
    e.target.classList.remove('dragging');
    updatePreview();
  });
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dragging = container.querySelector('.dragging');
    if (!dragging) return;
    const afterElement = getDragAfterElement(container, e.clientY);
    if (afterElement == null) {
      container.appendChild(dragging);
    } else {
      container.insertBefore(dragging, afterElement);
    }
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.sortable-item:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// =========================================================
// 1. PDF 上傳
// =========================================================
async function handlePdfUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  uploadedPdfBytes = await file.arrayBuffer();
  uploadedPdfName = file.name.replace(/\.pdf$/i, '');

  try {
    const doc = await PDFLib.PDFDocument.load(uploadedPdfBytes);
    uploadedPdfPageCount = doc.getPageCount();
  } catch (err) {
    console.error('PDF 讀取失敗', err);
    alert('這個檔案無法讀取，請確認是正常的 PDF 檔案');
    uploadedPdfBytes = null;
    return;
  }

  const nameTag = document.getElementById('pdf-file-name');
  nameTag.textContent = `已選擇：${file.name}（共 ${uploadedPdfPageCount} 頁）`;
  nameTag.style.display = 'block';

  const pageInput = document.getElementById('f-page-number');
  pageInput.max = uploadedPdfPageCount;

  document.getElementById('btn-generate-pdf').disabled = false;
  document.getElementById('generate-status').textContent = '確認 footer 內容無誤後即可下載';

  updatePreview();
}

// =========================================================
// 2. Logo 清單
// =========================================================
function encodeSvg(svgString) {
  if (!svgString) return '';
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
}

let unixecureLogoCounter = 0;

// 預設帶入 Logo 自助服務站裡的 uniXecure 官方 Logo，可用 radio 切換黑色／白色版本
function addUnixecureLogo(colorMode = 'white') {
  const uid = `ul-${++unixecureLogoCounter}`;
  const html = `<div class="sortable-item footer-logo-item" draggable="true" style="align-items:center; margin-bottom: 8px;">
        <div class="drag-handle">:::</div>
        <img class="thumb-preview fl-preview" src="">
        <input type="hidden" class="fl-url" value="">
        <div style="flex-grow:1;">
          <div style="font-size:13px; font-weight:bold; margin-bottom:6px;">uniXecure</div>
          <div class="radio-group" style="margin-top:0; gap:6px;">
            <div class="radio-pill"><input type="radio" name="${uid}" id="${uid}-full" class="ul-color-radio" value="full" ${colorMode === 'full' ? 'checked' : ''} onchange="refreshUnixecureLogo(this)"><label for="${uid}-full">黑色</label></div>
            <div class="radio-pill"><input type="radio" name="${uid}" id="${uid}-white" class="ul-color-radio" value="white" ${colorMode === 'white' ? 'checked' : ''} onchange="refreshUnixecureLogo(this)"><label for="${uid}-white">白色</label></div>
          </div>
        </div>
        <button type="button" class="btn-delete" onclick="this.closest('.footer-logo-item').remove(); updatePreview();">刪除</button>
      </div>`;
  document.getElementById('logo-list').insertAdjacentHTML('beforeend', html);
  const item = document.getElementById('logo-list').lastElementChild;
  setUnixecureLogoColor(item, colorMode);
}

function refreshUnixecureLogo(radio) {
  setUnixecureLogoColor(radio.closest('.footer-logo-item'), radio.value);
}

function setUnixecureLogoColor(item, colorMode) {
  const svg = logoDB.unixecure.layouts.standard.colors[colorMode];
  const dataUri = encodeSvg(svg);
  item.querySelector('.fl-url').value = dataUri;
  item.querySelector('.fl-preview').src = dataUri;
  updatePreview();
}

function addFooterLogo(url = '') {
  const html = `<div class="sortable-item footer-logo-item" draggable="true" style="align-items:center; margin-bottom: 8px;">
        <div class="drag-handle">:::</div>
        <div style="display:flex; gap:8px; align-items:center; flex-grow:1;">
          <img class="thumb-preview fl-preview" src="${url}"><input type="text" class="input-field fl-url" value="${url}" style="margin-bottom:0" placeholder="Logo 圖片網址" oninput="updateListThumbs(); updatePreview();">
          <label class="btn-sm-outline" style="cursor:pointer; margin:0; white-space:nowrap;" title="上傳本地圖片">
            📁
            <input type="file" accept="image/png, image/jpeg, image/svg+xml" style="display:none;" onchange="handleLocalImageUpload(this, '.fl-url')">
          </label>
          <button type="button" class="btn-delete" onclick="this.closest('.footer-logo-item').remove(); updatePreview();">刪除</button>
        </div></div>`;
  document.getElementById('logo-list').insertAdjacentHTML('beforeend', html);
  updatePreview();
}

// =========================================================
// 3. QR Code 清單
// =========================================================
function addQrItem(url = '', label = '') {
  const html = `<div class="sortable-item qr-item" draggable="true" style="align-items:center; margin-bottom: 8px;">
        <div class="drag-handle">:::</div>
        <div style="display:flex; gap:8px; align-items:center; flex-grow:1;">
          <input type="text" class="input-field qr-url" value="${url}" style="margin-bottom:0" placeholder="連結網址" oninput="updatePreview()">
          <input type="text" class="input-field qr-label" value="${label}" style="margin-bottom:0; max-width:110px;" placeholder="標籤文字" oninput="updatePreview()">
          <button type="button" class="btn-delete" onclick="this.closest('.qr-item').remove(); updatePreview();">刪除</button>
        </div></div>`;
  document.getElementById('qr-list').insertAdjacentHTML('beforeend', html);
  updatePreview();
}

// =========================================================
// 4. 本地圖片上傳（沿用 EDM 工具邏輯）
// =========================================================
function handleLocalImageUpload(fileInput, targetSelector) {
  const file = fileInput.files[0];
  if (!file) return;
  const container = fileInput.closest('.sortable-item');
  const textInput = container ? container.querySelector(targetSelector) : document.querySelector(targetSelector);
  if (!textInput) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    textInput.value = e.target.result;
    updateListThumbs();
    updatePreview();
  };
  reader.readAsDataURL(file);
  fileInput.value = '';
}

function updateListThumbs() {
  document.querySelectorAll('.footer-logo-item').forEach(item => {
    const url = item.querySelector('.fl-url').value;
    item.querySelector('.fl-preview').src = url || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  });
}

// =========================================================
// 5. 配色（印刷色彩考量，固定兩組配色，不開放自訂顏色）
// =========================================================
function setFooterColorPreset(preset) {
  const radio = document.getElementById(preset === 'light' ? 'theme-light' : 'theme-dark');
  radio.checked = true;
  updatePreview();
}

function getFooterTheme() {
  const preset = document.querySelector('input[name="footer-theme"]:checked').value;
  return preset === 'light'
    ? { bg: '#ffffff', text: '#333333' }
    : { bg: '#333333', text: '#ffffff' };
}

// =========================================================
// 6. 頁碼範圍 UI
// =========================================================
document.addEventListener('change', (e) => {
  if (e.target.name === 'page-range') {
    document.getElementById('f-page-number').style.display = e.target.value === 'custom' ? 'block' : 'none';
  }
});

// =========================================================
// 7. 載入圖片工具函式
// =========================================================
function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function getQrDataUrl(text) {
  if (!text || !text.trim()) return null;
  try {
    return await QRCode.toDataURL(text.trim(), { margin: 1, width: 240, color: { dark: '#000000', light: '#ffffff' } });
  } catch (err) {
    console.error('QR Code 產生失敗', err);
    return null;
  }
}

// =========================================================
// 8. 繪製 Footer（預覽與實際蓋章共用同一套邏輯）
// =========================================================
async function drawFooterToCanvas(canvas, widthPx) {
  const heightPx = Math.round(widthPx * FOOTER_HEIGHT_RATIO);
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');

  const { bg, text: textColor } = getFooterTheme();
  const company = document.getElementById('f-company').value;
  const phone = document.getElementById('f-phone').value;
  const email = document.getElementById('f-email').value;
  const address = document.getElementById('f-address').value;

  const scale = widthPx / 700; // 以 700px 為基準設計尺寸，再依實際寬度等比縮放

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, widthPx, heightPx);

  const padX = 28 * scale;
  const nameLineH = 20 * scale;
  const rowLineH = 16 * scale;

  // 只有實際有填內容的欄位才會顯示，空白的欄位整行跳過，不佔位置
  const rows = [
    ['服務專線', phone],
    ['電子信箱', email],
    ['台北據點', address]
  ].filter(([, value]) => value.trim());

  const hasCompany = !!company.trim();
  const totalH = (hasCompany ? nameLineH : 0) + rows.length * rowLineH;
  let ty = heightPx / 2 - totalH / 2;

  ctx.fillStyle = textColor;
  ctx.textBaseline = 'top';

  if (hasCompany) {
    ctx.font = `bold ${15 * scale}px "Microsoft JhengHei", sans-serif`;
    ctx.fillText(company, padX, ty);
    ty += nameLineH;
  }

  ctx.font = `${11 * scale}px "Microsoft JhengHei", sans-serif`;
  rows.forEach(([label, value]) => {
    ctx.globalAlpha = 0.85;
    ctx.fillText(label, padX, ty);
    ctx.globalAlpha = 1;
    ctx.fillText(value, padX + 62 * scale, ty);
    ty += rowLineH;
  });

  // 右側：Logo + QR Code，從右往左排列
  let rx = widthPx - 20 * scale;

  const qrItems = [...document.querySelectorAll('.qr-item')].map(item => ({
    url: item.querySelector('.qr-url').value,
    label: item.querySelector('.qr-label').value
  })).filter(q => q.url.trim());

  const qrBoxSize = 62 * scale;
  const qrDataUrls = await Promise.all(qrItems.map(q => getQrDataUrl(q.url)));

  for (let i = qrItems.length - 1; i >= 0; i--) {
    const dataUrl = qrDataUrls[i];
    if (!dataUrl) continue;
    const img = await loadImage(dataUrl);
    rx -= qrBoxSize;
    const qy = heightPx / 2 - qrBoxSize / 2 - 8 * scale;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rx, qy, qrBoxSize, qrBoxSize);
    if (img) ctx.drawImage(img, rx, qy, qrBoxSize, qrBoxSize);

    ctx.fillStyle = textColor;
    ctx.font = `${9 * scale}px "Microsoft JhengHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(qrItems[i].label || '', rx + qrBoxSize / 2, qy + qrBoxSize + 6 * scale);
    ctx.textAlign = 'left';

    rx -= 16 * scale;
  }

  const logoUrls = [...document.querySelectorAll('.fl-url')].map(el => el.value).filter(v => v.trim());
  const logoImgs = await Promise.all(logoUrls.map(loadImage));
  const logoH = 50 * scale;

  for (let i = logoImgs.length - 1; i >= 0; i--) {
    const img = logoImgs[i];
    if (!img) continue;
    const ratio = img.naturalWidth / img.naturalHeight || 1;
    const logoW = logoH * ratio;
    rx -= logoW;
    ctx.drawImage(img, rx, heightPx / 2 - logoH / 2, logoW, logoH);
    rx -= 20 * scale;
  }
}

// =========================================================
// 9. 更新預覽
// =========================================================
let previewToken = 0;
async function updatePreview() {
  const token = ++previewToken;
  const canvas = document.getElementById('footer-canvas');

  if (!uploadedPdfBytes) {
    await drawFooterToCanvas(canvas, 1400);
    return;
  }

  try {
    const rangeType = document.querySelector('input[name="page-range"]:checked').value;
    let previewPageNum = uploadedPdfPageCount;
    if (rangeType === 'custom') {
      const n = parseInt(document.getElementById('f-page-number').value, 10);
      if (n >= 1 && n <= uploadedPdfPageCount) previewPageNum = n;
    }

    const pdf = await pdfjsLib.getDocument({ data: uploadedPdfBytes.slice(0) }).promise;
    const page = await pdf.getPage(previewPageNum);
    const viewport = page.getViewport({ scale: 2 });

    if (token !== previewToken) return; // 避免非同步結果互相覆蓋

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    if (token !== previewToken) return;

    const footerCanvas = document.createElement('canvas');
    await drawFooterToCanvas(footerCanvas, viewport.width);
    if (token !== previewToken) return;
    ctx.drawImage(footerCanvas, 0, canvas.height - footerCanvas.height);
  } catch (err) {
    console.error('PDF 預覽產生失敗', err);
    await drawFooterToCanvas(canvas, 1400);
  }
}

// =========================================================
// 10. 產生蓋章後的 PDF
// =========================================================
async function generateStampedPdf() {
  if (!uploadedPdfBytes) {
    alert('請先上傳 PDF 檔案');
    return;
  }

  const statusTag = document.getElementById('generate-status');
  statusTag.textContent = '處理中，請稍候...';

  try {
    const pdfDoc = await PDFLib.PDFDocument.load(uploadedPdfBytes);
    const pages = pdfDoc.getPages();

    const rangeType = document.querySelector('input[name="page-range"]:checked').value;
    let targetIndexes = [];
    if (rangeType === 'all') {
      targetIndexes = pages.map((_, i) => i);
    } else if (rangeType === 'custom') {
      const pageNum = parseInt(document.getElementById('f-page-number').value, 10);
      if (!pageNum || pageNum < 1 || pageNum > pages.length) {
        alert(`請輸入 1 到 ${pages.length} 之間的頁碼`);
        statusTag.textContent = '確認 footer 內容無誤後即可下載';
        return;
      }
      targetIndexes = [pageNum - 1];
    } else {
      targetIndexes = [pages.length - 1];
    }

    // 依實際頁面寬度（PDF 點數，1pt = 1/72 吋）繪製高解析度 footer 圖片
    const firstPage = pages[targetIndexes[0]];
    const pageWidthPt = firstPage.getWidth();
    const RENDER_SCALE = 4; // 提高解析度避免蓋章後模糊
    const canvas = document.createElement('canvas');
    await drawFooterToCanvas(canvas, Math.round(pageWidthPt * RENDER_SCALE));

    const pngDataUrl = canvas.toDataURL('image/png');
    const pngBytes = await fetch(pngDataUrl).then(r => r.arrayBuffer());
    const pngImage = await pdfDoc.embedPng(pngBytes);

    targetIndexes.forEach(idx => {
      const page = pages[idx];
      const w = page.getWidth();
      const h = w * FOOTER_HEIGHT_RATIO;
      page.drawImage(pngImage, { x: 0, y: 0, width: w, height: h });
    });

    const outBytes = await pdfDoc.save();
    const blob = new Blob([outBytes], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${uploadedPdfName}_footer.pdf`;
    a.click();

    statusTag.textContent = '已下載完成，可以打開確認蓋章結果';
  } catch (err) {
    console.error('產生 PDF 失敗', err);
    alert('產生 PDF 時發生錯誤，請確認檔案是否正常');
    statusTag.textContent = '確認 footer 內容無誤後即可下載';
  }
}

// =========================================================
// 11. 初始化
// =========================================================
function loadDefaults() {
  document.getElementById('logo-list').innerHTML = '';
  document.getElementById('qr-list').innerHTML = '';
  addUnixecureLogo('white');
  addQrItem('https://www.unixecure.com/tw/index', '官方網站');
  addQrItem('https://www.facebook.com/uniXecure/', 'Facebook');
  updatePreview();
}

function resetToDefaults() {
  if (!confirm('確定要恢復預設資料嗎？目前填寫的內容會被清除。')) return;

  document.getElementById('f-company').value = '智慧資安科技股份有限公司';
  document.getElementById('f-phone').value = '04-24523928 分機 300、301、302';
  document.getElementById('f-email').value = 'servicedesk@unixecure.com.tw';
  document.getElementById('f-address').value = '114 台北市內湖區瑞光路 318 號 7 樓';

  document.getElementById('range-last').checked = true;
  document.getElementById('f-page-number').style.display = 'none';

  setFooterColorPreset('dark');
  loadDefaults();
}

window.onload = () => {
  initSortable(document.getElementById('logo-list'));
  initSortable(document.getElementById('qr-list'));
  loadDefaults();
};
