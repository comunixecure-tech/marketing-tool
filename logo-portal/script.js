// =========================================================
// 狀態管理與 UI 控制 (依賴 ../js/common.js 中的 logoDB)
// =========================================================
let currentImage = new Image();
let isImageLoaded = false;
let selectedBrand = '';
let selectedLayout = '';
let selectedColor = '';
let customFilename = 'logo_export';

function initAgents() {
  const agentContainer = document.getElementById('agent-brands-container');
  if (!agentContainer) return;

  agentList.forEach(agent => {
    // 更新全域的 logoDB (加入代理產品)
    logoDB[agent] = {
      name: agent.toUpperCase(),
      layouts: {
        'standard': {
          name: '標準 Logo',
          colors: {
            'full': `../assets/logos/agents/${agent}/full.svg`,
            'white': `../assets/logos/agents/${agent}/white.svg`
          }
        }
      }
    };
    
    // 渲染 UI 按鈕
    const radioHTML = `
      <div class="radio-pill">
        <input type="radio" name="brand" id="b-${agent}" value="${agent}">
        <label for="b-${agent}">${agent.toUpperCase()}</label>
      </div>`;
    agentContainer.insertAdjacentHTML('beforeend', radioHTML);
  });
}

function bindEvents() {
  document.querySelectorAll('input[name="brand"]').forEach(radio => {
    radio.addEventListener('change', handleBrandChange);
  });
}

function handleBrandChange() {
  const brandVal = document.querySelector('input[name="brand"]:checked').value;
  const uploadArea = document.getElementById('upload-area');
  const layoutSec = document.getElementById('layout-section');
  const colorSec = document.getElementById('color-section');
  
  if (brandVal === 'upload') {
    uploadArea.style.display = 'block';
    layoutSec.classList.remove('active');
    colorSec.classList.remove('active');
    isImageLoaded = false;
    customFilename = 'uploaded_logo';
    drawCanvas();
    return;
  }

  uploadArea.style.display = 'none';
  selectedBrand = brandVal;
  customFilename = brandVal;
  
  // 檢查共用資料庫 logoDB 是否有該品牌的設定
  if (typeof logoDB !== 'undefined' && logoDB[brandVal]) {
    const layouts = logoDB[brandVal].layouts;
    const layoutGroup = document.getElementById('layout-group');
    layoutGroup.innerHTML = '';
    
    let firstLayout = true;
    for (const key in layouts) {
      const id = `l-${key}`;
      const isChecked = firstLayout ? 'checked' : '';
      layoutGroup.innerHTML += `
        <div class="radio-pill">
          <input type="radio" name="layout" id="${id}" value="${key}" ${isChecked}>
          <label for="${id}">${layouts[key].name}</label>
        </div>`;
      firstLayout = false;
    }
    
    document.querySelectorAll('input[name="layout"]').forEach(r => r.addEventListener('change', handleLayoutChange));
    layoutSec.classList.add('active');
    handleLayoutChange();
  } else {
    layoutSec.classList.remove('active');
    colorSec.classList.remove('active');
    const infoTag = document.getElementById('output-info');
    infoTag.textContent = `⚠️ 尚未建立 ${brandVal} 的 Logo 資料`;
    infoTag.style.color = "var(--danger)";
    isImageLoaded = false;
    drawCanvas();
  }
}

function handleLayoutChange() {
  selectedLayout = document.querySelector('input[name="layout"]:checked').value;
  const colors = logoDB[selectedBrand].layouts[selectedLayout].colors;
  const colorGroup = document.getElementById('color-group');
  const colorSec = document.getElementById('color-section');
  
  colorGroup.innerHTML = '';
  
  const colorNames = { 
    'full': '標準色 Full Color', 
    'black': '單色黑 Black Mono', 
    'white': '反白色 White Reverse',
    'dark': '深色版 Dark',
    'allwhite': '全白版 All White'
  };
  
  let firstColor = true;
  for (const key in colors) {
    const id = `c-${key}`;
    const isChecked = firstColor ? 'checked' : '';
    colorGroup.innerHTML += `
      <div class="radio-pill">
        <input type="radio" name="color" id="${id}" value="${key}" ${isChecked}>
        <label for="${id}">${colorNames[key] || key}</label>
      </div>`;
    firstColor = false;
  }
  
  document.querySelectorAll('input[name="color"]').forEach(r => r.addEventListener('change', loadFileBySelection));
  colorSec.classList.add('active');
  loadFileBySelection();
}

function loadFileBySelection() {
  selectedColor = document.querySelector('input[name="color"]:checked').value;
  
  // 從資料庫取得資料 (可能是 <svg> 原始碼，也可能是路徑)
  const svgData = logoDB[selectedBrand].layouts[selectedLayout].colors[selectedColor];
  
  // 判斷：這是一段純 SVG 原始碼，還是外部路徑？
  if (svgData.trim().startsWith('<svg')) {
    try {
      // 這是最穩定的 Canvas SVG 轉碼法：先處理中文 (圖層_1)，再轉成 Base64
      const base64Svg = btoa(unescape(encodeURIComponent(svgData)));
      const dataUri = `data:image/svg+xml;base64,${base64Svg}`;
      loadImage(dataUri);
    } catch (e) {
      console.error("SVG 轉碼失敗:", e);
      document.getElementById('output-info').textContent = "❌ SVG 轉碼失敗";
    }
  } else {
    // 如果未來 RAVEN 等產品放的是 '../assets/...' 路徑，依然完美相容
    loadImage(svgData);
  }
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  customFilename = file.name.split('.')[0];
  const reader = new FileReader();
  reader.onload = (e) => loadImage(e.target.result);
  reader.readAsDataURL(file);
}

function loadImage(src) {
  isImageLoaded = false;
  const infoTag = document.getElementById('output-info');
  infoTag.textContent = "正在讀取圖檔資產...";
  infoTag.style.color = "var(--text-muted)";
  drawCanvas();

  currentImage = new Image();
  currentImage.onload = () => {
    isImageLoaded = true;
    infoTag.style.color = "var(--primary)";
    drawCanvas();
  };
  currentImage.onerror = () => {
    isImageLoaded = false;
    infoTag.textContent = `❌ 讀取失敗，找不到此檔案： ${src}`;
    infoTag.style.color = "var(--danger)";
    drawCanvas();
  };
  currentImage.src = src;
}

function handleFormatChange() {
  const format = document.querySelector('input[name="format"]:checked').value;
  const transRadio = document.getElementById('bg-trans');
  
  if (format === 'jpg') {
    transRadio.disabled = true;
    if (transRadio.checked) document.getElementById('bg-white').checked = true;
  } else {
    transRadio.disabled = false;
  }
  drawCanvas();
}

function resetPadding() {
  document.getElementById('f-padding').value = 40;
  drawCanvas();
}

function drawCanvas() {
  const canvas = document.getElementById('preview-canvas');
  const ctx = canvas.getContext('2d');
  const infoTag = document.getElementById('output-info');

  const canvasW = parseInt(document.getElementById('f-width').value) || 500;
  const canvasH = parseInt(document.getElementById('f-height').value) || 500;
  const padding = parseInt(document.getElementById('f-padding').value) || 0;
  const bgSetting = document.querySelector('input[name="bg"]:checked').value;
  
  const customPicker = document.getElementById('custom-bg-picker');
  customPicker.classList.toggle('active', bgSetting === 'custom');

  canvas.width = canvasW;
  canvas.height = canvasH;
  ctx.clearRect(0, 0, canvasW, canvasH);

  if (bgSetting !== 'transparent') {
    ctx.fillStyle = bgSetting === 'custom' ? document.getElementById('f-bg-color').value : bgSetting;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  if (!isImageLoaded) {
    if (!infoTag.textContent.includes("❌") && !infoTag.textContent.includes("⚠️")) {
      infoTag.textContent = `畫布已就緒: ${canvasW} x ${canvasH} px (未選取圖檔)`;
    }
    return;
  }

  const availableW = Math.max(0, canvasW - padding * 2);
  const availableH = Math.max(0, canvasH - padding * 2);
  
  const imgW = currentImage.naturalWidth || currentImage.width;
  const imgH = currentImage.naturalHeight || currentImage.height;
  
  const imgRatio = imgW / imgH;
  const boxRatio = availableW / availableH;

  let drawW, drawH;

  if (imgRatio > boxRatio) {
    drawW = availableW;
    drawH = availableW / imgRatio;
  } else {
    drawH = availableH;
    drawW = availableH * imgRatio;
  }

  const drawX = padding + (availableW - drawW) / 2;
  const drawY = padding + (availableH - drawH) / 2;

  ctx.drawImage(currentImage, drawX, drawY, drawW, drawH);
  infoTag.textContent = `最終輸出規格: ${canvasW} x ${canvasH} px`;
}

function downloadImage() {
  if (!isImageLoaded) { alert("請確認當前已成功顯示 Logo 圖檔再行下載"); return; }
  const canvas = document.getElementById('preview-canvas');
  const format = document.querySelector('input[name="format"]:checked').value;
  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const filename = `${customFilename}_${canvas.width}x${canvas.height}.${format}`;

  canvas.toBlob(function(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, mimeType, 1.0);
}

window.onload = () => {
  initAgents();
  bindEvents();
  const defaultRadio = document.getElementById('b-uni');
  if (defaultRadio) {
    defaultRadio.checked = true;
    handleBrandChange();
  }
};