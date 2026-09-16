// =========================================================
// 狀態
// =========================================================
let uploadedPdfBytes = null;
let uploadedPdfName = '';
let uploadedPdfPageCount = 0;
const FOOTER_HEIGHT_PT = 115; // footer 固定高度（PDF 點數，約 40.6mm），不隨頁面寬度縮放
const PT_PER_CM = 72 / 2.54;

function toggleResizeInputs() {
  const enabled = document.getElementById('f-resize-enabled').checked;
  document.getElementById('resize-size-inputs').style.display = enabled ? 'block' : 'none';
  document.getElementById('resize-hint').style.display = enabled ? 'block' : 'none';
}

// 頁面尺寸快速套用：A4／A3／A5 為未出血的紙張淨尺寸，出血勾選才會加上四邊各 2mm
const PAGE_SIZE_PRESETS_CM = {
  A4: { w: 21, h: 29.7 },
  A3: { w: 29.7, h: 42 },
  A5: { w: 14.8, h: 21 }
};

function applyPageSizePreset(preset) {
  if (preset === 'custom') { updatePreview(); return; }
  const base = PAGE_SIZE_PRESETS_CM[preset];
  const includeBleed = document.getElementById('f-size-include-bleed').checked;
  const bleedCm = includeBleed ? (BLEED_MM * 2) / 10 : 0; // 左右各 2mm／上下各 2mm，換算公分
  document.getElementById('f-target-width-cm').value = (base.w + bleedCm).toFixed(2);
  document.getElementById('f-target-height-cm').value = (base.h + bleedCm).toFixed(2);
  updatePreview();
}

// 出血勾選變更時，若目前選的是預設尺寸就重新套用；自訂尺寸則維持使用者輸入的數字不動
function handleBleedToggleChange() {
  const preset = document.querySelector('input[name="page-size-preset"]:checked').value;
  if (preset === 'custom') { updatePreview(); return; }
  applyPageSizePreset(preset);
}

// 使用者直接手動改寬高數字時，自動切到「自訂」，避免跟預設按鈕的狀態對不上
function markCustomSize() {
  document.getElementById('size-custom').checked = true;
}

function toggleFooterConfig() {
  const enabled = document.getElementById('f-footer-enabled').checked;
  document.getElementById('footer-config-section').style.display = enabled ? 'block' : 'none';
}

function getTargetSizePt() {
  const wCm = parseFloat(document.getElementById('f-target-width-cm').value) || 21.4;
  const hCm = parseFloat(document.getElementById('f-target-height-cm').value) || 30.1;
  return { w: wCm * PT_PER_CM, h: hCm * PT_PER_CM };
}

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

// uniXecure Logo 顏色綁死跟著配色走，深底白字配白 Logo、白底黑字配黑 Logo，不開放手動選色
function unixecureColorModeForTheme() {
  const preset = document.querySelector('input[name="footer-theme"]:checked').value;
  return preset === 'light' ? 'full' : 'white';
}

// 預設帶入 Logo 自助服務站裡的 uniXecure 官方 Logo
function addUnixecureLogo() {
  const html = `<div class="sortable-item footer-logo-item unixecure-logo-item" draggable="true" style="align-items:center; margin-bottom: 8px;">
        <div class="drag-handle">:::</div>
        <img class="thumb-preview fl-preview" src="">
        <input type="hidden" class="fl-url" value="">
        <div style="flex-grow:1; font-size:13px; font-weight:bold;">uniXecure</div>
        <button type="button" class="btn-sm-outline unixecure-toggle-btn" onclick="toggleUnixecureLogoVisibility(this)">隱藏</button>
      </div>`;
  document.getElementById('logo-list').insertAdjacentHTML('beforeend', html);
  const item = document.getElementById('logo-list').lastElementChild;
  setUnixecureLogoColor(item, unixecureColorModeForTheme(), false);
}

// uniXecure Logo 是固定帶入的預設項目，不提供刪除，只能隱藏/顯示
function toggleUnixecureLogoVisibility(btn) {
  const item = btn.closest('.footer-logo-item');
  const hidden = item.getAttribute('data-hidden') === 'true';
  item.setAttribute('data-hidden', hidden ? 'false' : 'true');
  item.style.opacity = hidden ? '1' : '0.45';
  btn.textContent = hidden ? '隱藏' : '顯示';
  updatePreview();
}

// 配色切換時，畫面上所有 uniXecure Logo 一起跟著換色
function syncUnixecureLogoColors() {
  const colorMode = unixecureColorModeForTheme();
  document.querySelectorAll('.unixecure-logo-item').forEach(item => setUnixecureLogoColor(item, colorMode, false));
  updatePreview();
}

function setUnixecureLogoColor(item, colorMode, triggerPreview = true) {
  const svg = logoDB.unixecure.layouts.standard.colors[colorMode];
  const dataUri = encodeSvg(svg);
  item.querySelector('.fl-url').value = dataUri;
  item.querySelector('.fl-preview').src = dataUri;
  if (triggerPreview) updatePreview();
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
  syncUnixecureLogoColors();
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
// 8. 繪製 Footer（預覽與實際輸出共用同一套邏輯）
// =========================================================
const BLEED_MM = 2;
const PT_PER_MM = 72 / 25.4;

async function drawFooterToCanvas(canvas, widthPx, pageWidthPt = 595) {
  const ptToPx = widthPx / pageWidthPt; // 每個 PDF 點數對應的畫布像素數，只決定輸出解析度
  const heightPx = Math.round(FOOTER_HEIGHT_PT * ptToPx);
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');

  const { bg, text: textColor } = getFooterTheme();
  const company = document.getElementById('f-company').value;
  const phone = document.getElementById('f-phone').value;
  const email = document.getElementById('f-email').value;
  const address = document.getElementById('f-address').value;

  // 文字、Logo、QR Code 尺寸固定用「PDF 點數」設計，不隨頁面寬度縮放，
  // 頁面變寬只會讓中間留白變多，不會整體跟著放大
  const scale = ptToPx;

  // 出血安全間距：底色本身貼齊頁面邊緣正常出血，只有「內容」（文字／Logo／QR Code）
  // 左右下方固定內縮 2mm 不貼邊，避免裁切誤差切到重要資訊（頂邊不算頁面裁切邊，不用內縮）
  const insetPx = BLEED_MM * PT_PER_MM * ptToPx;

  const safeLeft = insetPx;
  const safeRight = widthPx - insetPx;
  const safeBottom = heightPx - insetPx; // canvas 座標由上往下，safeBottom 是內容安全區在畫布上的下緣

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, widthPx, heightPx);

  const padX = safeLeft + 28 * scale;
  const nameLineH = 18 * scale;
  const rowLineH = 16 * scale;

  // 只有實際有填內容的欄位才會顯示，空白的欄位整行跳過，不佔位置
  const rows = [
    ['服務專線', phone],
    ['電子信箱', email],
    ['台北據點', address]
  ].filter(([, value]) => value.trim());

  const hasCompany = !!company.trim();
  const totalH = (hasCompany ? nameLineH : 0) + rows.length * rowLineH;
  let ty = safeBottom / 2 - totalH / 2;

  ctx.fillStyle = textColor;
  ctx.textBaseline = 'top';

  if (hasCompany) {
    ctx.font = `bold ${13 * scale}px "Microsoft JhengHei", sans-serif`;
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

  // 右側：Logo + QR Code，從右往左排列，整組靠右一點
  let rx = safeRight - 14 * scale;

  const qrItems = [...document.querySelectorAll('.qr-item')].map(item => ({
    url: item.querySelector('.qr-url').value,
    label: item.querySelector('.qr-label').value
  })).filter(q => q.url.trim());

  const qrBoxSize = 52 * scale;
  const qrDataUrls = await Promise.all(qrItems.map(q => getQrDataUrl(q.url)));

  for (let i = qrItems.length - 1; i >= 0; i--) {
    const dataUrl = qrDataUrls[i];
    if (!dataUrl) continue;
    const img = await loadImage(dataUrl);
    rx -= qrBoxSize;
    const qy = safeBottom / 2 - qrBoxSize / 2 - 8 * scale;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rx, qy, qrBoxSize, qrBoxSize);
    if (img) ctx.drawImage(img, rx, qy, qrBoxSize, qrBoxSize);

    ctx.fillStyle = textColor;
    ctx.font = `${9 * scale}px "Microsoft JhengHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(qrItems[i].label || '', rx + qrBoxSize / 2, qy + qrBoxSize + 6 * scale);
    ctx.textAlign = 'left';

    rx -= 10 * scale;
  }

  const logoUrls = [...document.querySelectorAll('.footer-logo-item:not([data-hidden="true"]) .fl-url')].map(el => el.value).filter(v => v.trim());
  const logoImgs = await Promise.all(logoUrls.map(loadImage));
  const logoH = 50 * scale;

  for (let i = logoImgs.length - 1; i >= 0; i--) {
    const img = logoImgs[i];
    if (!img) continue;
    const ratio = img.naturalWidth / img.naturalHeight || 1;
    const logoW = logoH * ratio;
    rx -= logoW;
    ctx.drawImage(img, rx, safeBottom / 2 - logoH / 2, logoW, logoH);
    rx -= 20 * scale;
  }
}

// =========================================================
// 9. 更新預覽
// =========================================================
let previewToken = 0;
async function updatePreview() {
  const token = ++previewToken;
  const displayCanvas = document.getElementById('footer-canvas');
  const loadingTag = document.getElementById('preview-loading');
  loadingTag.style.display = 'flex';

  // 全部畫在畫面外的暫存 canvas，確認仍是最新一次請求後才一次性換到畫面上
  // 避免使用者連續操作時，前後兩次非同步繪製結果互相疊加造成重影／錯位
  const commit = (buffer) => {
    if (token !== previewToken) return;
    displayCanvas.width = buffer.width;
    displayCanvas.height = buffer.height;
    displayCanvas.getContext('2d').drawImage(buffer, 0, 0);
    loadingTag.style.display = 'none';
  };

  if (!uploadedPdfBytes) {
    const buffer = document.createElement('canvas');
    await drawFooterToCanvas(buffer, 1400);
    commit(buffer);
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
    const PREVIEW_SCALE = 2; // 每 PDF 點對應的預覽像素數
    const nativeViewport = page.getViewport({ scale: 1 }); // scale:1 時單位即為 PDF 點數
    const origW = nativeViewport.width;
    const origH = nativeViewport.height;

    const resizeEnabled = document.getElementById('f-resize-enabled').checked;
    let pageWidthPt, pageHeightPt, drawOffsetXPx, drawOffsetYPx, renderScale;

    if (resizeEnabled) {
      const targetSize = getTargetSizePt();
      pageWidthPt = targetSize.w;
      pageHeightPt = targetSize.h;
      const fitScale = Math.min(pageWidthPt / origW, pageHeightPt / origH);
      renderScale = PREVIEW_SCALE * fitScale;
      drawOffsetXPx = (pageWidthPt - origW * fitScale) / 2 * PREVIEW_SCALE;
      drawOffsetYPx = (pageHeightPt - origH * fitScale) / 2 * PREVIEW_SCALE;
    } else {
      pageWidthPt = origW;
      pageHeightPt = origH;
      renderScale = PREVIEW_SCALE;
      drawOffsetXPx = 0;
      drawOffsetYPx = 0;
    }

    const buffer = document.createElement('canvas');
    buffer.width = Math.round(pageWidthPt * PREVIEW_SCALE);
    buffer.height = Math.round(pageHeightPt * PREVIEW_SCALE);
    const bufferCtx = buffer.getContext('2d');
    bufferCtx.fillStyle = '#ffffff';
    bufferCtx.fillRect(0, 0, buffer.width, buffer.height);

    const pageViewport = page.getViewport({ scale: renderScale });
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = pageViewport.width;
    pageCanvas.height = pageViewport.height;
    await page.render({ canvasContext: pageCanvas.getContext('2d'), viewport: pageViewport }).promise;
    bufferCtx.drawImage(pageCanvas, drawOffsetXPx, drawOffsetYPx);

    const footerEnabled = document.getElementById('f-footer-enabled').checked;
    if (footerEnabled) {
      const footerCanvas = document.createElement('canvas');
      await drawFooterToCanvas(footerCanvas, buffer.width, pageWidthPt);
      const footerY = buffer.height - footerCanvas.height;
      // 像素捨入偶爾會在 footer 正上方留一條原頁面內容的細縫，這裡先墊一層純色蓋掉，
      // 避免彩色 PDF 在接縫處透出一條顏色不一的線
      bufferCtx.fillStyle = getFooterTheme().bg;
      bufferCtx.fillRect(0, footerY - 2, buffer.width, footerCanvas.height + 2);
      bufferCtx.drawImage(footerCanvas, 0, footerY);
    }

    // 純視覺參考：畫面上用虛線標示 2mm 出血裁切線位置，不會畫進實際下載的 PDF 裡
    // 獨立於「加上 Footer」之外，調整頁面尺寸時同樣可能需要看這條參考線
    const showBleedGuide = document.getElementById('f-show-bleed-guide').checked;
    if (showBleedGuide) {
      const trimInsetPx = BLEED_MM * PT_PER_MM * PREVIEW_SCALE;
      bufferCtx.save();
      bufferCtx.strokeStyle = '#ff3b30';
      bufferCtx.lineWidth = 1.5;
      bufferCtx.setLineDash([6, 5]);
      bufferCtx.strokeRect(trimInsetPx, trimInsetPx, buffer.width - trimInsetPx * 2, buffer.height - trimInsetPx * 2);
      bufferCtx.restore();
    }

    commit(buffer);
  } catch (err) {
    console.error('PDF 預覽產生失敗', err);
    const buffer = document.createElement('canvas');
    await drawFooterToCanvas(buffer, 1400);
    commit(buffer);
  }
}

// =========================================================
// 10. 產生處理後的 PDF
// =========================================================
async function generateStampedPdf() {
  if (!uploadedPdfBytes) {
    alert('請先上傳 PDF 檔案');
    return;
  }

  const statusTag = document.getElementById('generate-status');
  statusTag.textContent = '處理中，請稍候...';

  try {
    const srcDoc = await PDFLib.PDFDocument.load(uploadedPdfBytes);
    const srcPages = srcDoc.getPages();

    const rangeType = document.querySelector('input[name="page-range"]:checked').value;
    let targetIndexes = [];
    if (rangeType === 'all') {
      targetIndexes = srcPages.map((_, i) => i);
    } else if (rangeType === 'custom') {
      const pageNum = parseInt(document.getElementById('f-page-number').value, 10);
      if (!pageNum || pageNum < 1 || pageNum > srcPages.length) {
        alert(`請輸入 1 到 ${srcPages.length} 之間的頁碼`);
        statusTag.textContent = '確認 footer 內容無誤後即可下載';
        return;
      }
      targetIndexes = [pageNum - 1];
    } else {
      targetIndexes = [srcPages.length - 1];
    }

    const footerEnabled = document.getElementById('f-footer-enabled').checked;
    const resizeEnabled = document.getElementById('f-resize-enabled').checked;
    if (!footerEnabled && !resizeEnabled) {
      alert('請至少選擇「加上 Footer」或「調整頁面尺寸」其中一項');
      statusTag.textContent = '確認設定後即可下載';
      return;
    }

    // 頁面尺寸調整：只調整需要套用的目標頁，其餘頁面維持原樣不動
    // 內容用等比例縮放＋置中放進新尺寸，不會變形，多出的空間補白邊
    let pdfDoc, pages;

    if (resizeEnabled) {
      const targetSize = getTargetSizePt();
      const outDoc = await PDFLib.PDFDocument.create();
      for (let i = 0; i < srcPages.length; i++) {
        if (targetIndexes.includes(i)) {
          const origW = srcPages[i].getWidth();
          const origH = srcPages[i].getHeight();
          const embedded = await outDoc.embedPage(srcPages[i]);
          const fitScale = Math.min(targetSize.w / origW, targetSize.h / origH);
          const drawW = origW * fitScale;
          const drawH = origH * fitScale;
          const offsetX = (targetSize.w - drawW) / 2;
          const offsetY = (targetSize.h - drawH) / 2;
          const newPage = outDoc.addPage([targetSize.w, targetSize.h]);
          newPage.drawPage(embedded, { x: offsetX, y: offsetY, width: drawW, height: drawH });
        } else {
          const [copiedPage] = await outDoc.copyPages(srcDoc, [i]);
          outDoc.addPage(copiedPage);
        }
      }
      pdfDoc = outDoc;
      pages = outDoc.getPages();
    } else {
      pdfDoc = srcDoc;
      pages = srcPages;
    }

    // 依每個目標頁面「各自實際的寬度」分別繪製高解析度 footer 圖片
    // 頁面寬度不同時（例如混合尺寸的 PDF）不能只做一張圖去套用到所有頁，會被拉伸變形
    if (footerEnabled) {
      const RENDER_SCALE = 4; // 提高解析度避免輸出後模糊
      const pngImageCache = new Map(); // 同寬度的頁面共用同一張圖，不用重繪

      for (const idx of targetIndexes) {
        const page = pages[idx];
        const w = page.getWidth();
        const h = FOOTER_HEIGHT_PT; // 固定高度，不隨頁面寬度縮放

        let pngImage = pngImageCache.get(w);
        if (!pngImage) {
          const canvas = document.createElement('canvas');
          await drawFooterToCanvas(canvas, Math.round(w * RENDER_SCALE), w);
          const pngDataUrl = canvas.toDataURL('image/png');
          const pngBytes = await fetch(pngDataUrl).then(r => r.arrayBuffer());
          pngImage = await pdfDoc.embedPng(pngBytes);
          pngImageCache.set(w, pngImage);
        }

        page.drawImage(pngImage, { x: 0, y: 0, width: w, height: h });
      }
    }

    const outBytes = await pdfDoc.save();
    const blob = new Blob([outBytes], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${uploadedPdfName}_footer.pdf`;
    a.click();

    statusTag.textContent = '已下載完成，可以打開確認結果';
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
  addUnixecureLogo();
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
  document.getElementById('f-show-bleed-guide').checked = true;
  document.getElementById('f-footer-enabled').checked = true;
  toggleFooterConfig();

  document.getElementById('f-resize-enabled').checked = true;
  document.getElementById('size-a4').checked = true;
  document.getElementById('f-size-include-bleed').checked = true;
  applyPageSizePreset('A4');
  toggleResizeInputs();

  setFooterColorPreset('dark');
  loadDefaults();
}

window.onload = () => {
  initSortable(document.getElementById('logo-list'));
  initSortable(document.getElementById('qr-list'));
  loadDefaults();
};
