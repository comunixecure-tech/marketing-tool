const canvas = document.getElementById('bannerCanvas');
const ctx = canvas.getContext('2d');

let images = {
  logo: null,
  speaker: null
};

let currentPrimaryHex = '#3c49ba';

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
  if (type === 'logo') {
    document.getElementById('f-logo-url').value = ''; 
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() { images[type] = img; drawCanvas(); }
    img.src = e.target.result;
  }
  reader.readAsDataURL(file);
}

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

function drawCanvas() {
  try {
    const showSpeaker = document.getElementById('f-show-speaker').checked;
    const showCta = document.getElementById('f-show-cta').checked;
    const primaryColor = document.getElementById('f-color').value;
    const bgStyle = document.getElementById('f-bg-style').value;
    const tagText = document.getElementById('f-tag').value || "";
    const dateText = document.getElementById('f-date').value || "";

    const elementGap = 26;

    const logoH = 45;
    const tagH = 45;
    const row1H = (images.logo || tagText) ? Math.max(logoH, tagH) : 0;

    ctx.font = 'bold 58px "Microsoft JhengHei", sans-serif';
    const titleEl = document.getElementById('f-title');
    const titleTokens = getTokensFromNode(titleEl, '#1e293b');
    const maxTitleW = showSpeaker ? 700 : 1050;
    const titleLineH = 75;
    const row2H = measureColoredText(ctx, titleTokens, maxTitleW, titleLineH);

    const row3H = dateText ? 32 : 0;
    const row4H = showCta ? 60 : 0;

    let rows = [];
    if (row1H > 0) rows.push(row1H);
    if (row2H > 0) rows.push(row2H);
    if (row3H > 0) rows.push(row3H);
    if (row4H > 0) rows.push(row4H);
    
    const totalContentH = rows.reduce((sum, h) => sum + h, 0) + (rows.length > 1 ? (rows.length - 1) * elementGap : 0);

    const PRESET_FLAT_HEIGHT = 450; 
    let finalHeight = Math.max(PRESET_FLAT_HEIGHT, totalContentH + 120); 
    if (showSpeaker) {
      finalHeight = Math.max(finalHeight, 380 + 80); 
    }

    canvas.width = 1200;
    canvas.height = finalHeight;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (bgStyle === 'dots') {
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

    if (row1H > 0) {
      let tagStartX = 60;
      if (images.logo && images.logo.height > 0) {
        const logoScale = logoH / images.logo.height;
        const logoW = images.logo.width * logoScale;
        ctx.drawImage(images.logo, 60, currentY, logoW, logoH);
        tagStartX += logoW + 24;
      }
      
      if (tagText) {
        ctx.font = 'bold 22px "Microsoft JhengHei", sans-serif';
        const tagW = ctx.measureText(tagText).width + 40;
        ctx.fillStyle = primaryColor;
        ctx.fillRect(tagStartX, currentY, tagW, tagH); 
        
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tagText, tagStartX + tagW / 2, currentY + tagH / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
      currentY += row1H + elementGap;
    }

    ctx.font = 'bold 58px "Microsoft JhengHei", sans-serif';
    drawColoredText(ctx, titleTokens, 60, currentY, maxTitleW, titleLineH);
    currentY += row2H + elementGap;

    if (row3H > 0) {
      ctx.fillStyle = '#333333';
      ctx.font = 'bold 32px "Microsoft JhengHei", sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(dateText, 60, currentY);
      ctx.textBaseline = 'alphabetic';
      currentY += row3H + elementGap;
    }

    if (row4H > 0) {
      ctx.fillStyle = '#ffb415';
      roundRect(ctx, 60, currentY, 200, row4H, 6);
      ctx.fill();
      
      ctx.fillStyle = '#21234a';
      ctx.font = 'bold 24px "Microsoft JhengHei", sans-serif';
      const ctaText = document.getElementById('f-cta-text').value || "立即報名";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, 160, currentY + row4H / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

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

  } catch (err) {
    canvas.width = 1200; canvas.height = 450;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1200, 450);
    ctx.fillStyle = '#E1251B'; ctx.font = '24px sans-serif';
    ctx.fillText('繪圖發生錯誤，請檢查輸入內容：', 50, 100);
    ctx.fillText(err.message, 50, 140);
    console.error(err);
  }
}

// 將純 SVG 原始碼轉為安全的 Data URI (加上 Base64 防護)
function encodeSvg(svgString) {
  if (!svgString) return '';
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
}

// 根據 logoDB 初始化下拉選單
function initLogoSelect() {
  const select = document.getElementById('f-logo-select');
  if (!select || typeof logoDB === 'undefined') return;

  // 🟢 1. 加入 uniXecure 標準版 (Full) 與反白版 (White)
  if (logoDB['unixecure'] && logoDB['unixecure'].layouts.standard) {
    let uniFull = logoDB['unixecure'].layouts.standard.colors.full;
    let uniWhite = logoDB['unixecure'].layouts.standard.colors.white;
    select.add(new Option('uniXecure (標準色)', encodeSvg(uniFull)));
    select.add(new Option('uniXecure (反白色)', encodeSvg(uniWhite)));
  }

  // 2. 加入四產品的橫式 (Full & White)
  const products = ['raven', 'heis', 'lucas', 'srmas'];
  products.forEach(p => {
    if (logoDB[p] && logoDB[p].layouts.horizontal) {
      let fullSvg = logoDB[p].layouts.horizontal.colors.full;
      let whiteSvg = logoDB[p].layouts.horizontal.colors.white;
      select.add(new Option(`${logoDB[p].name} (橫式 - 標準色)`, encodeSvg(fullSvg)));
      select.add(new Option(`${logoDB[p].name} (橫式 - 反白色)`, encodeSvg(whiteSvg)));
    }
  });

  // 3. 允許不顯示 Logo
  select.add(new Option('不使用 Logo', 'none'));
}

function loadLogoUrl() {
  const val = document.getElementById('f-logo-select').value;
  if (val === 'none' || !val) {
    images.logo = null;
    drawCanvas();
    return;
  }
  
  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.onload = () => { images.logo = img; drawCanvas(); };
  img.onerror = () => { images.logo = null; drawCanvas(); };
  img.src = val; // 下拉選單的值已經是轉碼後的 Data URI 了
}



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
    if (error.name === "SecurityError") {
      alert("下載失敗：因為載入了外部網址的圖片，基於瀏覽器安全性 (CORS) 阻擋了下載功能。\n\n解決方法：請將該 Logo 下載到電腦中，改用「上傳檔案」的方式加入，即可正常下載。");
    } else {
      alert("下載時發生未知的錯誤：" + error.message);
    }
  }
}

window.onload = () => {
  initLogoSelect(); // 啟動時先建立選單
  loadLogoUrl();
  drawCanvas();
};