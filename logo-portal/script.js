// =========================================================
// 狀態管理與 UI 控制 (依賴 ../js/common.js 中的 logoDB)
// =========================================================
let currentImage = new Image();
let isImageLoaded = false;
let selectedBrand = '';
let selectedLayout = '';
let selectedColor = '';
let customFilename = 'logo_export';
let currentObjectUrl = null; // 用於追蹤與釋放記憶體

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

    // 🔬 核心改進：判斷如果是純 <svg> 原始碼，直接用 Blob 封裝
    if (svgData.trim().startsWith('<svg')) {
      // 釋放上一次的記憶體路徑，避免瀏覽器記憶體洩漏
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
      
      // 使用 Blob，這能完美包容 SVG 內部的任何中文、雙引號或特殊字元，絕不報錯
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      currentObjectUrl = URL.createObjectURL(blob);
      loadImage(currentObjectUrl);
    } else {
      // 相容傳統圖片路徑
      loadImage(svgData);
    }
  } catch (err) {
    console.error("讀取選取檔案失敗:", err);
    isImageLoaded = false;
    const infoTag = document.getElementById('output-info');
    if (infoTag) {
      infoTag.textContent = "❌ 圖檔加載失敗";
      infoTag.style.color = "var(--danger)";
    }
    drawCanvas();
  }
}

function handleFileUpload(event) {
  try {
    const file = event.target.files[0];
    if (!file) return;
    customFilename = file.name.split('.')[0];
    const reader = new FileReader();
    reader.onload = (e) => loadImage(e.target.result);
    reader.readAsDataURL(file);
  } catch (err) {
    console.error("檔案上傳失敗:", err);
  }
}

function loadImage(src) {
  isImageLoaded = false;
  const infoTag = document.getElementById('output-info');
  if (infoTag) {
    infoTag.textContent = "正在讀取圖檔資產...";
    infoTag.style.color = "var(--text-muted)";
  }
  drawCanvas();

  currentImage = new Image();
  // 設置匿名跨域，防止 Canvas 導出時因為安全策略被污染 (Tainted Canvas)
  currentImage.crossOrigin = "anonymous"; 
  
  currentImage.onload = () => {
    isImageLoaded = true;
    if (infoTag) infoTag.style.color = "var(--primary)";
    drawCanvas();
  };
  currentImage.onerror = () => {
    isImageLoaded = false;
    if (infoTag) {
      infoTag.textContent = `❌ 圖檔解析失敗，請確認 SVG 格式`;
      infoTag.style.color = "var(--danger)";
    }
    drawCanvas();
  };
  currentImage.src = src;
}

function handleFormatChange() {
  try {
    const checkedFormat = document.querySelector('input[name="format"]:checked');
    if (!checkedFormat) return;
    
    const format = checkedFormat.value;
    const transRadio = document.getElementById('bg-trans');
    
    if (format === 'jpg') {
      if (transRadio) transRadio.disabled = true;
      const whiteRadio = document.getElementById('bg-white');
      if (transRadio && transRadio.checked && whiteRadio) whiteRadio.checked = true;
    } else {
      if (transRadio) transRadio.disabled = false;
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
// 3. 核心完美置中與安全渲染演算 (Try-Catch 全面保護)
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

    // 🟢 重新設定畫布尺寸並清空
    canvas.width = canvasW;
    canvas.height = canvasH;
    ctx.clearRect(0, 0, canvasW, canvasH);

    // 🟢 繪製背景色 (不論圖片有沒有載入成功，這段都必須且一定能正常執行！)
    if (bgSetting !== 'transparent') {
      ctx.fillStyle = bgSetting === 'custom' ? (bgColorInput ? bgColorInput.value : '#f8fafc') : bgSetting;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // 🟢 如果圖片還沒準備好，就停在這裡，確保背景色能單獨顯示
    if (!isImageLoaded) {
      if (infoTag && !infoTag.textContent.includes("❌") && !infoTag.textContent.includes("⚠️")) {
        infoTag.textContent = `畫布已就緒: ${canvasW} x ${canvasH} px (未選取圖檔)`;
        infoTag.style.color = "var(--text-muted)";
      }
      return;
    }

    const availableW = Math.max(0, canvasW - padding * 2);
    const availableH = Math.max(0, canvasH - padding * 2);
    
    // 安全防禦：如果 SVG 檔案缺乏實體尺寸，給予安全預設值，避免除以 0 造成瀏覽器崩潰
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

    // 🟢 繪製 Logo 圖片
    ctx.drawImage(currentImage, drawX, drawY, drawW, drawH);
    
    if (infoTag) {
      infoTag.textContent = `最終輸出規格: ${canvasW} x ${canvasH} px`;
      infoTag.style.color = "var(--text-main)";
    }
  } catch (err) {
    console.error("渲染畫布過程中發生錯誤:", err);
  }
}

// =========================================================
// 4. 導出下載
// =========================================================
function downloadImage() {
  try {
    if (!isImageLoaded) { alert("請確認當前已成功顯示 Logo 圖檔再行下載"); return; }
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;
    
    const checkedFormat = document.querySelector('input[name="format"]:checked');
    const format = checkedFormat ? checkedFormat.value : 'png';
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
    alert("匯出下載失敗，可能是瀏覽器安全策略阻擋。建議點擊「恢復預設背景」後重試。");
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