let isInit = true;
let isEventNameManuallyEdited = false;

// 🟢 新增：將純 SVG 原始碼轉為安全的 Data URI (加上 Base64 防護)
function encodeSvg(svgString) {
  if (!svgString) return '';
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
}

// 1. 啟動與資料載入
function init() {
  const hasSaved = loadData();
  
  // 如果沒有暫存資料 (第一次打開，或按了清除記憶)
  if (!hasSaved) {
    // 確保預設寫入 Banner 網址
    document.getElementById('f-banner').value = "https://www.unixecure.com/images/index-banner-image.png";
    
    setDefaultDate();
    addAgendaItem({time: "14:00 - 14:10", topic: "開場致詞", speaker: "王小明", title: "產品經理", img: ""});
    
    // 🟢 預設主辦單位：從共用資料庫 (common.js) 拉取 uniXecure 的 SVG 並自動轉碼
    let uniSvgDataUri = "";
    if (typeof logoDB !== 'undefined' && logoDB['unixecure']) {
      const rawSvg = logoDB['unixecure'].layouts.standard.colors.full;
      uniSvgDataUri = encodeSvg(rawSvg);
    }
    // 將轉換好的 SVG 丟入主辦單位列表
    addLogoItem(uniSvgDataUri);
  }
  
  isInit = false;
  updateThumb('f-banner', 'banner-thumb');
  updateListThumbs();
  updatePreview();
  
  // 監聽所有輸入框變動以即時更新預覽
  document.addEventListener('input', (e) => {
    if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      updatePreview();
    }
  });

  initSortable(document.getElementById('agenda-list'));
  initSortable(document.getElementById('logo-list'));

  // 監聽活動名稱同步邏輯
  document.getElementById('f-title').addEventListener('input', function() {
    if (!isEventNameManuallyEdited) {
      document.getElementById('f-event-name').value = this.value;
      updatePreview();
    }
  });
  document.getElementById('f-event-name').addEventListener('input', function() { 
    isEventNameManuallyEdited = true; 
  });
}

function setDefaultDate() {
  const today = new Date();
  const dateStr = `${today.getFullYear()}/${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}`;
  const days = ['日','一','二','三','四','五','六'];
  document.getElementById('f-date').value = `${dateStr} (${days[today.getDay()]}) 14:00 ~ 17:00`;
}

// --- LocalStorage 核心邏輯 ---
function saveData() {
  if(isInit) return;
  const data = {
    banner: document.getElementById('f-banner').value,
    title: document.getElementById('f-title').value,
    desc: document.getElementById('f-desc').innerHTML,
    eventName: document.getElementById('f-event-name').value,
    date: document.getElementById('f-date').value,
    location: document.getElementById('f-location').value,
    locationUrl: document.getElementById('f-location-url').value,
    contact: document.getElementById('f-contact').value,
    btnText: document.getElementById('f-btn-text').value,
    link: document.getElementById('f-link').value,
    reminder: document.getElementById('f-reminder').value,
    notice: document.getElementById('f-notice').value,
    hasAgenda: document.getElementById('f-has-agenda').checked,
    agenda: Array.from(document.querySelectorAll('.agenda-item')).map(item => ({
      time: item.querySelector('.a-time').value,
      topic: item.querySelector('.a-topic').value,
      speaker: item.querySelector('.a-speaker').value,
      title: item.querySelector('.a-title').value,
      img: item.querySelector('.a-img').value
    })),
    hasOrganizer: document.getElementById('f-has-organizer').checked,
    logos: Array.from(document.querySelectorAll('.logo-item')).map(item => item.querySelector('.l-url').value)
  };
  localStorage.setItem('edm_generator_data', JSON.stringify(data));
  
  const status = document.getElementById('save-status');
  status.textContent = '💾 儲存中...';
  setTimeout(() => status.textContent = '已自動存檔', 800);
}

function loadData() {
  const saved = localStorage.getItem('edm_generator_data');
  if(!saved) return false;
  try {
    const data = JSON.parse(saved);
    document.getElementById('f-banner').value = data.banner || '';
    document.getElementById('f-title').value = data.title || '';
    if(data.desc) document.getElementById('f-desc').innerHTML = data.desc;
    document.getElementById('f-event-name').value = data.eventName || '';
    document.getElementById('f-date').value = data.date || '';
    document.getElementById('f-location').value = data.location || '';
    document.getElementById('f-location-url').value = data.locationUrl || '';
    document.getElementById('f-contact').value = data.contact || '';
    document.getElementById('f-btn-text').value = data.btnText || '立即報名';
    document.getElementById('f-link').value = data.link || '';
    document.getElementById('f-reminder').value = data.reminder !== undefined ? data.reminder : '';
    if(data.notice) document.getElementById('f-notice').value = data.notice;
    
    document.getElementById('f-has-agenda').checked = data.hasAgenda;
    toggleSection('agenda-section', data.hasAgenda);
    (data.agenda || []).forEach(a => addAgendaItem(a));

    document.getElementById('f-has-organizer').checked = data.hasOrganizer;
    toggleSection('organizer-section', data.hasOrganizer);
    (data.logos || []).forEach(l => addLogoItem(l));

    return true;
  } catch(e) {
    console.error('資料載入失敗', e);
    return false;
  }
}

function resetData() {
  if(confirm('確定要清除所有記憶並恢復預設值嗎？這將會清空您剛才打的所有內容。')) {
    localStorage.removeItem('edm_generator_data');
    location.reload();
  }
}

function execCmd(cmd, value) {
  document.execCommand(cmd, false, value === 'var(--primary)' ? '#3c49ba' : value);
  updatePreview();
}

function updateThumb(inputId, thumbId) {
  document.getElementById(thumbId).src = document.getElementById(inputId).value || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
}

function updateListThumbs() {
  document.querySelectorAll('.agenda-item').forEach(item => {
    const url = item.querySelector('.a-img').value;
    item.querySelector('.a-img-preview').src = url || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  });
  document.querySelectorAll('.logo-item').forEach(item => {
    const url = item.querySelector('.l-url').value;
    item.querySelector('.l-img-preview').src = url || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  });
}

function toggleSection(id, show) {
  document.getElementById(id).style.display = show ? 'block' : 'none';
  updatePreview();
}

// 拖曳排序邏輯
function initSortable(container) {
  container.addEventListener('dragstart', (e) => {
    if(!e.target.classList.contains('sortable-item')) return;
    e.target.classList.add('dragging');
  });
  container.addEventListener('dragend', (e) => {
    e.target.classList.remove('dragging');
    updatePreview();
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

function addAgendaItem(data = null) {
  const t = data ? data.time : "14:10 - 14:40";
  const tp = data ? data.topic : "新技術專題";
  const sp = data ? data.speaker : "陳小美";
  const ti = data ? data.title : "資深顧問";
  const img = data ? data.img : "";
  
  const html = `<div class="sortable-item agenda-item" draggable="true">
        <div class="drag-handle">:::</div>
        <div class="sortable-content" style="background:#fff; padding:12px; border-radius:6px; border:1px solid var(--border-color);">
          <input type="text" class="input-field a-time" value="${t}" oninput="updatePreview()">
          <input type="text" class="input-field a-topic" value="${tp}" oninput="updatePreview()">
          <div style="display:flex; gap:5px;"><input type="text" class="input-field a-speaker" value="${sp}" oninput="updatePreview()"><input type="text" class="input-field a-title" value="${ti}" oninput="updatePreview()"></div>
          <div style="display:flex; gap:8px; align-items:center;">
            <img class="thumb-preview a-img-preview" src="${img}"><input type="text" class="input-field a-img" value="${img}" style="margin-bottom:0" placeholder="講者照片 URL (選填)" oninput="updateListThumbs(); updatePreview();">
            <button type="button" class="btn-delete" onclick="this.closest('.agenda-item').remove(); updatePreview();">刪除</button>
          </div>
        </div></div>`;
  document.getElementById('agenda-list').insertAdjacentHTML('beforeend', html);
  if(!isInit) updatePreview();
}

function addLogoItem(url = "") {
  const html = `<div class="sortable-item logo-item" draggable="true">
        <div class="drag-handle">:::</div>
        <div style="display:flex; gap:8px; align-items:center; flex-grow:1;">
          <img class="thumb-preview l-img-preview" src="${url}"><input type="text" class="input-field l-url" value="${url}" style="margin-bottom:0" placeholder="圖片網址" oninput="updateListThumbs(); updatePreview();">
          <button type="button" class="btn-delete" onclick="this.closest('.logo-item').remove(); updatePreview();">刪除</button>
        </div></div>`;
  document.getElementById('logo-list').insertAdjacentHTML('beforeend', html);
  if(!isInit) updatePreview();
}

// 產生最終 HTML 程式碼
function generateEDM() {
  const pColor = '#3c49ba';
  const sColor = '#ffb415';
  const banner = document.getElementById('f-banner').value;
  const title = document.getElementById('f-title').value;
  const desc = document.getElementById('f-desc').innerHTML;
  const eventName = document.getElementById('f-event-name').value;
  const date = document.getElementById('f-date').value;
  
  const locText = document.getElementById('f-location').value;
  const locUrl = document.getElementById('f-location-url').value.trim();
  const locationHTML = locUrl 
    ? `<a href="${locUrl}" style="color: ${pColor}; text-decoration: underline;" target="_blank">${locText}</a>`
    : locText;
  
  const contact = document.getElementById('f-contact').value.replace(/\n/g, '<br>');
  const btnText = document.getElementById('f-btn-text').value || '立即報名';
  const link = document.getElementById('f-link').value;
  const reminder = document.getElementById('f-reminder').value.trim();
  const notice = document.getElementById('f-notice').value.replace(/\n/g, '<br>');

  let agendaHTML = '';
  if (document.getElementById('f-has-agenda').checked) {
    let rows = '';
    document.querySelectorAll('.agenda-item').forEach((item, idx, arr) => {
      const time = item.querySelector('.a-time').value;
      const topic = item.querySelector('.a-topic').value;
      const speaker = item.querySelector('.a-speaker').value;
      const sTitle = item.querySelector('.a-title').value;
      const img = item.querySelector('.a-img').value.trim();
      const border = (idx === arr.length - 1) ? '' : `border-bottom: 1px solid #e2e8f0;`;
      
      const photoHTML = img ? `<td width="48" valign="middle" style="padding-right: 12px;"><img src="${img}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover;"></td>` : '';

      rows += `<tr>
          <td valign="top" width="28%" style="padding: 20px 10px 20px 30px; font-size: 15px; color: #333; ${border}">${time}</td>
          <td valign="top" width="72%" style="padding: 20px 30px 20px 15px; ${border}">
            <div style="color: ${pColor}; font-weight: bold; font-size: 16px; margin-bottom: 8px;">${topic}</div>
            <table cellpadding="0" cellspacing="0" border="0"><tr>${photoHTML}<td valign="middle" style="font-size: 15px; color: #555;">${speaker} ${sTitle}</td></tr></table>
          </td></tr>`;
    });
    agendaHTML = `<div style="font-size: 18px; font-weight: bold; color: #333; margin: 40px 0 15px;">議程</div>
                  <table width="100%" bgcolor="#ffffff" style="line-height: 1.5; border-radius: 6px; overflow: hidden;">${rows}</table>`;
  }

  let organizerHTML = '';
  if (document.getElementById('f-has-organizer').checked) {
    let logos = '';
    document.querySelectorAll('.l-url').forEach(input => {
      if (input.value.trim()) {
        logos += `<img src="${input.value.trim()}" height="60" style="display: inline-block; height: 60px; max-width: 250px; width: auto; margin-right: 25px; margin-bottom: 15px; vertical-align: middle;">`;
      }
    });
    if (logos) organizerHTML = `<div style="font-size: 18px; font-weight: bold; color: #333; margin: 40px 0 15px;">主辦單位</div><div style="text-align: left;">${logos}</div>`;
  }

  let reminderHTML = '';
  if (reminder) {
    reminderHTML = `<div style="margin-top: 15px; font-size: 14px; color: #E1251B; font-weight: bold; letter-spacing: 0.5px;">${reminder}</div>`;
  }

  let noticeHTML = '';
  if (notice) {
    noticeHTML = `<tr><td style="padding: 0 40px 40px 40px;">
      <div style="font-size: 12px; color: #888888; line-height: 1.6; text-align: left;">${notice}</div>
    </td></tr>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body { margin: 0; padding: 0; background-color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
.container { width: 100%; max-width: 650px; margin: 0 auto; background-color: #ffffff; }
.btn { display: inline-block; padding: 14px 45px; background-color: ${sColor}; color: #21234a; text-decoration: none; font-size: 18px; font-weight: bold; border-radius: 6px; }
</style></head><body>
<table width="100%" bgcolor="#ffffff" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><img src="${banner}" style="width: 100%; max-width: 900px; display: block; margin: 0 auto;"></td></tr></table>
<table width="100%" bgcolor="#ffffff" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
<table class="container" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding: 40px; line-height: 1.8; font-size: 15px; text-align: left;">${desc}</td></tr>
  <tr><td style="padding: 10px 40px 30px;"><table width="100%" bgcolor="#f5f5f5" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 40px;">
    <div style="font-size: 18px; font-weight: bold; color: #333; margin-bottom: 15px;">活動資訊</div>
    <table style="font-size: 15px; color: #333; line-height: 1.8;" cellpadding="0" cellspacing="0" border="0">
      <tr><td valign="top" width="15">&#8226;&nbsp;</td><td><strong>名稱：</strong>${eventName}</td></tr>
      <tr><td valign="top">&#8226;&nbsp;</td><td><strong>時間：</strong>${date}</td></tr>
      <tr><td valign="top">&#8226;&nbsp;</td><td><strong>地點：</strong>${locationHTML}</td></tr>
    </table>
    ${agendaHTML}
    ${organizerHTML}
    <div style="font-size: 18px; font-weight: bold; color: #333; margin: 40px 0 15px;">聯絡窗口</div>
    <div style="font-size: 15px; color: #333; line-height: 1.8;">${contact}</div>
  </td></tr></table></td></tr>
  <tr><td style="padding: 20px 40px 40px; text-align: center;">
    <a href="${link}" class="btn">${btnText}</a>
    ${reminderHTML}
  </td></tr>
  ${noticeHTML}
</table>
</td></tr></table></body></html>`;
}

function updatePreview() {
  try {
    const html = generateEDM();
    const iframe = document.getElementById('preview-frame');
    iframe.srcdoc = html;
    saveData(); 
  } catch (err) {
    console.error("預覽更新失敗", err);
  }
}

function downloadHTML() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const filename = `${yyyy}${mm}${dd}_edm.html`;

  const blob = new Blob([generateEDM()], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

window.onload = init;