// =========================================================
// 狀態管理與 UI 控制 (依賴 ../js/common.js 中的 logoDB)
// =========================================================
let currentImage = new Image();
let isImageLoaded = false;
let selectedBrand = '';
let selectedLayout = '';
let selectedColor = '';
let customFilename = 'logo_export';
let currentObjectUrl = null; 
let currentAssetData = null; // 新增：用於記錄當前選取的 SVG 原始路徑或字串

function initAgents() {
  try {
    const agentContainer = document.getElementById('agent-brands-container');
    if (!agentContainer || typeof agentList === 'undefined') return;

    agentList.forEach(agent => {
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
      
      const radioHTML = `
        <div class="radio-pill">
          <input type="radio" name="brand" id="b-${agent}" value="${agent}">
          <label for="b-${agent}">${agent.toUpperCase()}</label>
        </div>`;
      agentContainer.insertAdjacentHTML('beforeend', radioHTML);
    });
  } catch (err) {
    console.error("初始化代理產品失敗:", err);
  }
}

function bindEvents() {
  document.querySelectorAll('input[name="brand"]').forEach(radio => {
    radio.addEventListener('change', handleBrandChange);
  });
}

function handleBrandChange() {
  try {
    const checkedRadio = document.querySelector('input[name="brand"]:checked');
    if (!checkedRadio) return;
    
    const brandVal = checkedRadio.value;
    const uploadArea = document.getElementById('upload-area');
    const layoutSec = document.getElementById('layout-section');
    const colorSec = document.getElementById('color-section');
    
    if (brandVal === 'upload') {
      if (uploadArea) uploadArea.style.display = 'block';
      if (layoutSec) layoutSec.classList.remove('active');
      if (colorSec) colorSec.classList.remove('active');
      isImageLoaded = false;
      currentAssetData = null;
      customFilename = 'uploaded_logo';
      drawCanvas();
      return;
    }

    if (uploadArea) uploadArea.style.display = 'none';
    selectedBrand = brandVal;
    customFilename = brandVal;
    
    if (typeof logoDB !== 'undefined' && logoDB[brandVal]) {
      const layouts = logoDB[brandVal].layouts;
      const layoutGroup = document.getElementById('layout-group');
      if (!layoutGroup) return;
      
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
      if (layoutSec) layoutSec.classList.add('active');
      handleLayoutChange();
    } else {
      if (layoutSec) layoutSec.classList.remove('active');
      if (colorSec) colorSec.classList.remove('active');
      const infoTag = document.getElementById('output-info');
      if (infoTag) {
        infoTag.textContent = `⚠️ 尚未建立 ${brandVal} 的 Logo 資料`;
        infoTag.style.color = "var(--danger)";
      }
      isImageLoaded = false;
      currentAssetData = null;
      drawCanvas();
    }
  } catch (err) {
    console.error("切換品牌失敗:", err);
  }
}

function handleLayoutChange() {
  try {
    const checkedLayout = document.querySelector('input[name="layout"]:checked');
    if (!checkedLayout) return;
    
    selectedLayout = checkedLayout.value;
    const colors = logoDB[selectedBrand].layouts[selectedLayout].colors;
    const colorGroup = document.getElementById('color-group');
    const colorSec = document.getElementById('color-section');
    if (!colorGroup) return;
    
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
    if (colorSec) colorSec.classList.add('active');
    loadFileBySelection();
  } catch (err) {
    console.error("切換排版失敗:", err);
  }
}

function loadFileBySelection() {
  try {
    const checkedColor = document.querySelector('input[name="color"]:checked');
    if (!checkedColor) return;
    
    selectedColor = checkedColor.value;
    const svgData = logoDB[selectedBrand].layouts[selectedLayout].colors[selectedColor];
    
    if (!svgData) return;
    currentAssetData = svgData; // 紀錄原始資產，供 SVG 匯出使用

    if (svgData.trim().startsWith('<svg')) {
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      currentObjectUrl = URL.createObjectURL(blob);
      loadImage(currentObjectUrl);
    } else {
      loadImage(svgData);
    }
  } catch (err) {
    console.error("讀取選取檔案失敗:", err);
    isImageLoaded = false;
    currentAssetData = null;
    drawCanvas();
  }
}

function handleFileUpload(event) {
  try {
    const file = event.target.files[0];
    if (!file) return;
    customFilename = file.name.split('.')[0];
    currentAssetData = null; // 自訂上傳不支援 SVG 原生導出
    const reader = new FileReader();
    reader.onload = (e) => loadImage(e.target.result);
    reader.readAsDataURL(file);
  } catch (err) {
    console.error("檔案上傳失敗:", err);
  }
}

function loadImage(src) {
  isImageLoaded = false;
  drawCanvas();

  currentImage = new Image();
  currentImage.crossOrigin = "anonymous"; 
  
  currentImage.onload = () => {
    isImageLoaded = true;
    drawCanvas();
  };
  currentImage.onerror = () => {
    isImageLoaded = false;
    drawCanvas();
  };
  currentImage.src = src;
}

// 根據選擇的格式動態調整 UI 狀態
function handleFormatChange() {
  try {
    const checkedFormat = document.querySelector('input[name="format"]:checked');
    if (!checkedFormat) return;
    const format = checkedFormat.value;
    
    const transRadio = document.getElementById('bg-trans');
    const whiteRadio = document.getElementById('bg-white');
    const customRadio = document.getElementById('bg-custom');
    const wInput = document.getElementById('f-width');
    const hInput = document.getElementById('f-height');
    const pInput = document.getElementById('f-padding');
    const hint = document.getElementById('format-hint');
    const btnSpan = document.querySelector('#main-download-btn span');

    // 恢復所有輸入框預設為可用
    [transRadio, whiteRadio, customRadio, wInput, hInput, pInput].forEach(el => { if(el) el.disabled = false; });
    if (hint) hint.style.display = 'none';

    if (format === 'jpg') {
      if (transRadio) transRadio.disabled = true;
      if (transRadio && transRadio.checked && whiteRadio) whiteRadio.checked = true;
      if (btnSpan) btnSpan.textContent = "下載 JPG 圖檔";
    } else if (format === 'png') {
      if (btnSpan) btnSpan.textContent = "下載 PNG 圖檔";
    } else if (format === 'svg') {
      // SVG 為下載原始檔，故禁用畫布操作
      [wInput, hInput, pInput, transRadio, whiteRadio, customRadio].forEach(el => { if(el) el.disabled = true; });
      if (hint) {
        hint.textContent = "💡 選擇 SVG 時，將直接匯出無損原始向量檔，忽略畫布尺寸與背景設定。";
        hint.style.display = 'block';
      }
      if (btnSpan) btnSpan.textContent = "下載 SVG 向量檔";
    } else if (format === 'ai') {
      // AI 檔純提供雲端連結
      [wInput, hInput, pInput, transRadio, whiteRadio, customRadio].forEach(el => { if(el) el.disabled = true; });
      if (hint) {
        hint.textContent = "💡 將直接引導您前往精誠企業雲端資料夾下載原始 AI 檔。";
        hint.style.display = 'block';
      }
      if (btnSpan) btnSpan.textContent = "前往雲端下載 AI 原檔";
    }
    
    drawCanvas();
  } catch (err) {
    console.error("格式切換失敗:", err);
  }
}

function resetPadding() {
  const paddingInput = document.getElementById('f-padding');
  if (paddingInput) paddingInput.value = 40;
  drawCanvas();
}

// =========================================================
// 3. 核心完美置中與安全渲染演算
// =========================================================
function drawCanvas() {
  try {
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const infoTag = document.getElementById('output-info');

    const widthInput = document.getElementById('f-width');
    const heightInput = document.getElementById('f-height');
    const paddingInput = document.getElementById('f-padding');
    const bgColorInput = document.getElementById('f-bg-color');

    const canvasW = widthInput ? (parseInt(widthInput.value) || 500) : 500;
    const canvasH = heightInput ? (parseInt(heightInput.value) || 500) : 500;
    const padding = paddingInput ? (parseInt(paddingInput.value) || 0) : 0;
    
    const checkedBg = document.querySelector('input[name="bg"]:checked');
    const bgSetting = checkedBg ? checkedBg.value : 'transparent';
    
    const customPicker = document.getElementById('custom-bg-picker');
    if (customPicker) {
      customPicker.classList.toggle('active', bgSetting === 'custom');
    }

    canvas.width = canvasW;
    canvas.height = canvasH;
    ctx.clearRect(0, 0, canvasW, canvasH);

    if (bgSetting !== 'transparent') {
      ctx.fillStyle = bgSetting === 'custom' ? (bgColorInput ? bgColorInput.value : '#f8fafc') : bgSetting;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    if (!isImageLoaded) {
      if (infoTag && !infoTag.textContent.includes("❌") && !infoTag.textContent.includes("⚠️")) {
        infoTag.textContent = `畫布已就緒: ${canvasW} x ${canvasH} px`;
        infoTag.style.color = "var(--text-muted)";
      }
      return;
    }

    const availableW = Math.max(0, canvasW - padding * 2);
    const availableH = Math.max(0, canvasH - padding * 2);
    
    let imgW = currentImage.naturalWidth || currentImage.width || 300;
    let imgH = currentImage.naturalHeight || currentImage.height || 100;
    if (imgW === 0 || imgH === 0) { imgW = 300; imgH = 100; }
    
    const imgRatio = imgW / imgH;
    const boxRatio = availableW / (availableH || 1);

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
    
    if (infoTag) {
      infoTag.textContent = `預覽規格: ${canvasW} x ${canvasH} px`;
      infoTag.style.color = "var(--text-main)";
    }
  } catch (err) {
    console.error("渲染畫布過程中發生錯誤:", err);
  }
}

// =========================================================
// 4. 導出下載 (整合 AI 與 SVG 原檔抓取)
// =========================================================
async function downloadImage() {
  try {
    const checkedFormat = document.querySelector('input[name="format"]:checked');
    const format = checkedFormat ? checkedFormat.value : 'png';

    // [1] AI 檔處理：跳轉至雲端資料夾
    if (format === 'ai') {
      window.open('https://systexgroup-my.sharepoint.com/:f:/g/personal/2200615_systex_com_tw/IgCqcp6hsQvbTZ6d3OI9n9RkATM2c9Q43c7C5SGHhwNVcXI?e=7FTNlS', '_blank');
      return;
    }

    // [2] SVG 檔處理：擷取原始文字後轉換 Blob 下載
    if (format === 'svg') {
      if (selectedBrand === 'upload') {
        alert("自訂上傳模式不支援 SVG 匯出，請切換至 PNG 或 JPG。");
        return;
      }
      if (!currentAssetData) {
        alert("找不到可用的 SVG 來源檔");
        return;
      }

      let svgContent = '';
      if (currentAssetData.trim().startsWith('<svg')) {
        svgContent = currentAssetData;
      } else {
        // 利用 Fetch API 讀取本地 SVG 內容 (GitHub Pages 完全支援)
        const response = await fetch(currentAssetData);
        svgContent = await response.text();
      }
      
      const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${customFilename}_vector.svg`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // [3] PNG & JPG 處理：依賴畫布匯出
    if (!isImageLoaded) { alert("請確認當前已成功顯示 Logo 圖檔再行下載"); return; }
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;
    
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const filename = `${customFilename}_${canvas.width}x${canvas.height}.${format}`;

    canvas.toBlob(function(blob) {
      if (!blob) { alert("圖檔生成失敗"); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }, mimeType, 1.0);

  } catch (err) {
    alert("匯出下載失敗。");
    console.error("下載失敗:", err);
  }
}

// =========================================================
// 5. 初始化啟動
// =========================================================
window.onload = () => {
  initAgents();
  bindEvents();
  const defaultRadio = document.getElementById('b-uni');
  if (defaultRadio) {
    defaultRadio.checked = true;
    handleBrandChange();
  }
};