const canvas = document.getElementById('bannerCanvas');
const ctx = canvas.getContext('2d');

let images = {
  speaker: null
};

let currentPrimaryHex = '#3c49ba';
let currentLogoColorMode = 'full'; // 🟢 新增：全域控制 Logo 色彩模式 (full 或 white)
let isDrawing = false;
let drawQueue = false;

// 將純 SVG 原始碼轉為安全的 Data URI (加上 Base64 防護)
function encodeSvg(svgString) {
  if (!svgString) return '';
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
}

// ---------------------------------------------------------
// 1. 多選 Logo 與 UI 邏輯
// ---------------------------------------------------------
function addBannerLogo(brand = 'unixecure', customSrc = '') {
  // 🟢 修正：移除了個別的色彩下拉選單，並優化了破圖預覽顯示邏輯
  const html = `
    <div class="sortable-item banner-logo-item" draggable="true" ondragend="drawCanvas()" style="align-items: center; margin-bottom: 4px;">
      <div class="drag-handle">:::</div>
      <div style="flex-grow:1;">
        <div style="display:flex; gap:8px;" class="bl-controls">
          <select class="input-field bl-brand" onchange="updateBannerLogoUI(this); drawCanvas();" style="margin:0; flex:1; background: #fff;">
            <option value="unixecure" ${brand==='unixecure'?'selected':''}>uniXecure</option>
            <option value="raven" ${brand==='raven'?'selected':''}>RAVEN</option>
            <option value="heis" ${brand==='heis'?'selected':''}>HEIS</option>
            <option value="lucas" ${brand==='lucas'?'selected':''}>LUCAS</option>
            <option value="srmas" ${brand==='srmas'?'selected':''}>SRMAS</option>
            <option value="custom" ${brand==='custom'?'selected':''}>📁 自訂...</option>
          </select>
          <button type="button" class="btn-delete" onclick="this.closest('.banner-logo-item').remove(); drawCanvas();">刪除</button>
        </div>
        
        <div class="bl-custom-upload" style="display:${brand==='custom'?'flex':'none'}; gap:8px; align-items:center; margin-top: 8px;">
          <img class="thumb-preview bl-preview" src="${customSrc}" style="display:${customSrc ? 'block' : 'none'}; object-fit:contain; width:40px; height:20px;">
          <label class="btn-sm-outline" style="cursor:pointer; margin:0; flex-grow:1; text-align:center;">
            選擇圖片
            <input type="file" style="display:none;" accept="image/png, image/jpeg, image/svg+xml" onchange="handleCustomLogoUpload(this)">
          </label>
        </div>
      </div>
    </div>
  `;
  document.getElementById('banner-logo-list').insertAdjacentHTML('beforeend', html);
  drawCanvas();
}

function toggleAllLogoColors(colorType) {
  // 🟢 修正：一鍵切換時，改變全域變數並重新繪圖
  currentLogoColorMode = colorType;
  drawCanvas();
}

function updateBannerLogoUI(select) {
  const item = select.closest('.banner-logo-item');
  const customDiv = item.querySelector('.bl-custom-upload');
  
  if (select.value === 'custom') {
    customDiv.style.display = 'flex';
  } else {
    customDiv.style.display = 'none';
  }
}

function handleCustomLogoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const item = input.closest('.banner-logo-item');
    const previewImg = item.querySelector('.bl-preview');
    previewImg.src = e.target.result;
    previewImg.style.display = 'block'; // 上傳後才把圖片顯示出來，避免破圖
    drawCanvas();
  };
  reader.readAsDataURL(file);
}

function initSortable(container) {
  if (!container) return;
  container.addEventListener('dragstart', (e) => {
    if(!e.target.classList.contains('sortable-item')) return;
    e.target.classList.add('dragging');
  });
  container.addEventListener('dragend', (e) => {
    e.target.classList.remove('dragging');
    drawCanvas(); 
  });
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dragging = container.querySelector('.dragging');
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

// ---------------------------------------------------------
// 2. 顏色與表單工具邏輯
// ---------------------------------------------------------
function hexToRgb(hex) {
  let r = parseInt(hex.slice(1, 3), 16) || 0;
  let g = parseInt(hex.slice(3, 5), 16) || 0;
  let b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgba(hex, alpha) {
  let r = parseInt(hex.slice(1, 3), 16) || 0;
  let g = parseInt(hex.slice(3, 5), 16) || 0;
  let b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resetPrimaryColor() {
  document.getElementById('f-color').value = '#3c49ba';
  updatePrimaryColor();
}

function updatePrimaryColor() {
  const newHex = document.getElementById('f-color').value;
  const oldRgb = hexToRgb(currentPrimaryHex);
  const newRgb = hexToRgb(newHex);
  
  const titleEl = document.getElementById('f-title');
  titleEl.innerHTML = titleEl.innerHTML.replace(new RegExp(currentPrimaryHex, 'gi'), newHex);
  titleEl.innerHTML = titleEl.innerHTML.replace(new RegExp(oldRgb.replace('(', '\\(').replace(')', '\\)'), 'gi'), newRgb);
  
  currentPrimaryHex = newHex;
  document.documentElement.style.setProperty('--primary', newHex);
  drawCanvas();
}

function setTextColor(hexCode) {
  const color = hexCode === 'primary' ? currentPrimaryHex : hexCode;
  document.execCommand('styleWithCSS', false, true);
  document.execCommand('foreColor', false, color);
  drawCanvas();
}

function toggleSection(id, show) {
  document.getElementById(id).style.display = show ? 'block' : 'none';
}

function handleImageUpload(event, type) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() { images[type] = img; drawCanvas(); }
    img.src = e.target.result;
  }
  reader.readAsDataURL(file);
}

// ---------------------------------------------------------
// 3. 繪圖輔助函數
// ---------------------------------------------------------
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function getTokensFromNode(node, defaultColor) {
  let tokens = [];
  function traverse(n, color) {
    if (n.nodeType === 3) {
      let text = n.textContent;
      let parts = text.match(/([a-zA-Z0-9]+|\s|.)/g) || [];
      parts.forEach(p => tokens.push({ text: p, color: color }));
    } else if (n.nodeType === 1) {
      if (n.tagName === 'BR' || n.tagName === 'DIV' || n.tagName === 'P') {
        if (tokens.length > 0 && tokens[tokens.length-1].text !== '\n') {
          tokens.push({ text: '\n', color: color });
        }
      }
      let c = color;
      if (n.style && n.style.color) c = n.style.color;
      else if (n.tagName === 'FONT' && n.color) c = n.color;
      n.childNodes.forEach(child => traverse(child, c));
    }
  }
  traverse(node, defaultColor);
  return tokens;
}

function measureColoredText(ctx, tokens, maxWidth, lineHeight) {
  let cx = 0;
  let lines = 1;
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];
    if (token.text === '\n') { cx = 0; lines++; continue; }
    let w = ctx.measureText(token.text).width;
    if (cx + w > maxWidth && cx !== 0 && token.text.trim() !== '') {
      cx = 0; lines++;
    }
    cx += w;
  }
  return lines * lineHeight;
}

function drawColoredText(ctx, tokens, x, y, maxWidth, lineHeight) {
  ctx.textBaseline = 'top';
  let cx = x;
  let cy = y;
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];
    if (token.text === '\n') { cx = x; cy += lineHeight; continue; }
    
    ctx.fillStyle = token.color;
    let w = ctx.measureText(token.text).width;
    
    if (cx + w > x + maxWidth && cx !== x && token.text.trim() !== '') {
      cx = x; cy += lineHeight;
    }
    ctx.fillText(token.text, cx, cy);
    cx += w;
  }
  ctx.textBaseline = 'alphabetic';
}

function drawWrappedTextCentered(ctx, text, x, y, maxWidth, lineHeight) {
  let paragraphs = (text || "").split('\n');
  let cy = y;
  
  paragraphs.forEach(paragraph => {
    let chars = paragraph.split('');
    let line = '';
    for (let n = 0; n < chars.length; n++) {
      let testLine = line + chars[n];
      let metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, cy);
        line = chars[n];
        cy += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, cy);
    cy += lineHeight;
  });
}

// ---------------------------------------------------------
// 4. 繪圖核心與非同步載圖演算
// ---------------------------------------------------------
async function drawCanvas() {
  if (isDrawing) { drawQueue = true; return; }
  isDrawing = true;
  try {
    await _doDrawCanvas();
  } catch (err) {
    console.error("繪圖發生錯誤:", err);
  } finally {
    isDrawing = false;
    if (drawQueue) { drawQueue = false; drawCanvas(); }
  }
}

async function _doDrawCanvas() {
  // 1. 蒐集並載入所有 Logo
  const logoSources = [];
  document.querySelectorAll('.banner-logo-item').forEach(el => {
    const brand = el.querySelector('.bl-brand').value;
    if (brand === 'custom') {
      const src = el.querySelector('.bl-preview').src;
      if (src && src.length > 10) logoSources.push({ src, brand });
    } else {
      // 🟢 修正：統一吃頂部的色彩模式 (全標準色 / 全反白色)
      const color = currentLogoColorMode; 
      if (typeof logoDB !== 'undefined' && logoDB[brand] && logoDB[brand].layouts) {
         const layout = logoDB[brand].layouts.horizontal ? 'horizontal' : 'standard';
         const rawSvg = logoDB[brand].layouts[layout].colors[color];
         if (rawSvg) logoSources.push({ src: encodeSvg(rawSvg), brand });
      }
    }
  });

  const loadedLogos = await Promise.all(logoSources.map(item => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => resolve({ img, brand: item.brand });
      img.onerror = () => resolve(null);
      img.src = item.src;
    });
  }));
  const validLogos = loadedLogos.filter(obj => obj !== null);

  // 2. 開始繪製畫布設定
  const showSpeaker = document.getElementById('f-show-speaker').checked;
  const showCta = document.getElementById('f-show-cta').checked;
  const primaryColor = document.getElementById('f-color').value;
  const bgStyle = document.getElementById('f-bg-style').value;
  const tagText = document.getElementById('f-tag').value || "";
  const dateText = document.getElementById('f-date').value || "";

  const elementGap = 26;
  
  // 🟢 修正：尺寸與間距全面調整
  const productLogoH = 50;  // 將產品 Logo 稍微縮小
  const uniXecureH = 75;    // 將 uniXecure 母品牌放大
  const customLogoH = 90;   // 將自訂圖片放大至接近母品牌
  const tagH = 45;
  
  // 動態找出這排 Logo 最高的高度，用來計算垂直置中
  let maxLogoH = 0;
  validLogos.forEach(item => {
    let h = productLogoH;
    if (item.brand === 'unixecure') h = uniXecureH;
    else if (item.brand === 'custom') h = customLogoH;
    if (h > maxLogoH) maxLogoH = h;
  });
  
  const row1H = (validLogos.length > 0 || tagText) ? Math.max(maxLogoH, tagText ? tagH : 0) : 0;

  ctx.font = 'bold 58px "Microsoft JhengHei", sans-serif';
  const titleEl = document.getElementById('f-title');
  const titleTokens = getTokensFromNode(titleEl, '#1e293b');
  const maxTitleW = showSpeaker ? 700 : 1050;
  const titleLineH = 75;
  const row2H = measureColoredText(ctx, titleTokens, maxTitleW, titleLineH);

  const row3H = dateText ? 32 : 0;
  const ctaReservedH = 60; 

  let rowsForHeight = [];
  if (row1H > 0) rowsForHeight.push(row1H);
  if (row2H > 0) rowsForHeight.push(row2H);
  if (row3H > 0) rowsForHeight.push(row3H);
  rowsForHeight.push(ctaReservedH); 
  
  const totalContentH = rowsForHeight.reduce((sum, h) => sum + h, 0) + (rowsForHeight.length > 1 ? (rowsForHeight.length - 1) * elementGap : 0);

  const PRESET_FLAT_HEIGHT = 450; 
  let finalHeight = Math.max(PRESET_FLAT_HEIGHT, totalContentH + 120); 
  if (showSpeaker) {
    finalHeight = Math.max(finalHeight, 380 + 80); 
  }

  canvas.width = 1200;
  canvas.height = finalHeight;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 繪製背景風格
  if (bgStyle === 'solid') {
    ctx.fillStyle = '#f1f5f9'; 
    ctx.beginPath();
    ctx.moveTo(canvas.width, canvas.height - 350);
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(canvas.width - 350, canvas.height);
    ctx.closePath();
    ctx.fill();
  } else if (bgStyle === 'dots') {
    ctx.fillStyle = hexToRgba(primaryColor, 0.15);
    for (let x = 25; x < canvas.width; x += 35) {
      for (let y = 25; y < canvas.height; y += 35) {
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (bgStyle === 'gradient') {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, hexToRgba(primaryColor, 0.15));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  let currentY = (finalHeight - totalContentH) / 2;

  // 3. 繪製第一排 (Logos & Tag)
  if (row1H > 0) {
    let tagStartX = 40;
    
    if (validLogos.length > 0) {
      validLogos.forEach(item => {
        if (item.img.height > 0) {
          // 🟢 修正：依據不同類型給予不同高度
          let targetH = productLogoH;
          if (item.brand === 'unixecure') targetH = uniXecureH;
          else if (item.brand === 'custom') targetH = customLogoH;
          
          const logoScale = targetH / item.img.height;
          const logoW = item.img.width * logoScale;
          
          const yOffset = (row1H - targetH) / 2;
          ctx.drawImage(item.img, tagStartX, currentY + yOffset, logoW, targetH);
          
          // 🟢 修正：拉近 Logo 彼此之間的間距
          tagStartX += logoW + 12; 
        }
      });
    }
    
    if (tagText) {
      const yOffset = (row1H - tagH) / 2;
      ctx.font = 'bold 22px "Microsoft JhengHei", sans-serif';
      const tagW = ctx.measureText(tagText).width + 40;
      ctx.fillStyle = primaryColor;
      ctx.fillRect(tagStartX, currentY + yOffset, tagW, tagH); 
      
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tagText, tagStartX + tagW / 2, currentY + yOffset + tagH / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
    currentY += row1H + elementGap;
  }

  // 4. 繪製主標題
  ctx.font = 'bold 58px "Microsoft JhengHei", sans-serif';
  drawColoredText(ctx, titleTokens, 60, currentY, maxTitleW, titleLineH);
  currentY += row2H + elementGap;

  // 5. 繪製日期
  if (row3H > 0) {
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 32px "Microsoft JhengHei", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(dateText, 60, currentY);
    ctx.textBaseline = 'alphabetic';
    currentY += row3H + elementGap;
  }

  // 6. 繪製 CTA 按鈕
  if (showCta) {
    ctx.fillStyle = '#ffb415';
    roundRect(ctx, 60, currentY, 200, ctaReservedH, 6);
    ctx.fill();
    
    ctx.fillStyle = '#21234a';
    ctx.font = 'bold 24px "Microsoft JhengHei", sans-serif';
    const ctaText = document.getElementById('f-cta-text').value || "立即報名";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ctaText, 160, currentY + ctaReservedH / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // 7. 繪製講者卡片
  if (showSpeaker) {
    const cardW = 280;
    const cardH = 380;
    const cardX = 860;
    const cardY = (finalHeight - cardH) / 2;
    
    ctx.shadowColor = hexToRgba(primaryColor, 0.12);
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 15;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fill();
    
    ctx.shadowColor = 'transparent';

    const imgRadius = 90;
    const imgX = cardX + cardW / 2;
    const imgY = cardY + 130;

    ctx.save();
    ctx.beginPath();
    ctx.arc(imgX, imgY, imgRadius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    if (images.speaker && images.speaker.width > 0) {
      const size = Math.min(images.speaker.width, images.speaker.height);
      const sx = (images.speaker.width - size) / 2;
      const sy = (images.speaker.height - size) / 2;
      ctx.drawImage(images.speaker, sx, sy, size, size, imgX - imgRadius, imgY - imgRadius, imgRadius * 2, imgRadius * 2);
    } else {
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
    }
    ctx.restore();

    const speakerName = document.getElementById('f-speaker-name').value || "";
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 28px "Microsoft JhengHei", sans-serif';
    ctx.fillText(speakerName, cardX + cardW / 2, cardY + 280);

    const speakerTitle = document.getElementById('f-speaker-title').value || "";
    ctx.fillStyle = '#64748b';
    ctx.font = '18px "Microsoft JhengHei", sans-serif';
    drawWrappedTextCentered(ctx, speakerTitle, cardX + cardW / 2, cardY + 315, cardW - 40, 26);
    
    ctx.textAlign = 'left';
  }
}

// ---------------------------------------------------------
// 5. 下載與初始化
// ---------------------------------------------------------
function downloadBanner() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  
  try {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${yyyy}${mm}${dd}_banner.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    alert("下載失敗：因為載入了外部網址的圖片，基於瀏覽器安全性 (CORS) 阻擋了下載功能。\n\n解決方法：請將該 Logo 下載到電腦中，改用「上傳檔案」的方式加入，即可正常下載。");
  }
}

window.onload = () => {
  initSortable(document.getElementById('banner-logo-list'));
  addBannerLogo('unixecure'); // 預設新增第一個 uniXecure
};