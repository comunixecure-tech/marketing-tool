// =========================================================
// 設定
// =========================================================
// 貼上 Apps Script 部署後的網址，就會即時讀取試算表（密碼也由試算表 A1 欄位把關）
// 留空時是本機測試模式：改讀同資料夾的 data.local.json（含測試用密碼，不會上傳到 GitHub）
const VIDEO_API_URL = 'https://script.google.com/macros/s/AKfycbzxNRvc0EesLOeoyZp4vVuC21SjFk_fRmYzaSgB2ijxA9sabMueG3LZ62i-t_nugZ3IqA/exec';

// 產品欄位的值直接取自試算表，這裡只負責顯示名稱
const PRODUCT_LABEL = { SOC: 'Autonomous SOC' };
const productName = (k) => PRODUCT_LABEL[k] || k;
// 產品識別色：RAVEN 藍、HEIS 綠、LUCAS 橘、SRMAS 紫（公司規範），其餘自訂；沒登記的用深灰藍
const PRODUCT_COLOR = { RAVEN: '#3c49ba', HEIS: '#15803d', LUCAS: '#c2410c', SRMAS: '#7e3af2', SOC: '#232e8a', uberAgent: '#0284c7', 'Q-Atlas': '#0e7490' };
const productColor = (k) => PRODUCT_COLOR[k] || '#475569';
const LANG_LABEL = { TC: '繁體中文', EN: '英文', JP: '日文', ID: '印尼文' };
const NEW_DAYS = 30;

// =========================================================
// 狀態
// =========================================================
let allVideos = [];
let dataSource = '';
let updatedAt = '';
const filters = { q: '', group: '', lang: '', products: new Set(), dubs: new Set(['配音', '無']) };
let viewMode = 'group';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const groupOf = (v) => v.purpose || '';


// =========================================================
// 資料載入與密碼
// =========================================================
async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

async function fetchData() {
  if (VIDEO_API_URL) {
    const data = await fetchJson(VIDEO_API_URL);
    if (!Array.isArray(data.videos)) throw new Error('格式不符');
    return { data, label: 'live' };
  }
  return { data: await fetchJson('data.local.json'), label: 'backup' };
}

function tagVideo(v) {
  // 產品欄可複選：下拉多選在儲存格裡是用逗號分隔的文字，也容許頓號、換行
  v.products = String(v.product || '').split(/[,，、;；\n]+/).map((p) => p.trim()).filter(Boolean);
  if (!v.products.length) v.products = ['其他'];
  v.product = v.products[0];
  v.search = `${v.products.map(productName).join(' ')} ${v.purpose} ${v.desc} ${v.version} ${v.fileName} ${groupOf(v)} ${v.note} ${LANG_LABEL[v.lang] || v.lang}`.toLowerCase();
}

async function start() {
  $('vh-list').innerHTML = '<div class="vh-skel"></div>'.repeat(8);
  try {
    const { data, label } = await fetchData();
    allVideos = data.videos;
    allVideos.forEach(tagVideo);
    dataSource = label;
    updatedAt = data.updatedAt || '';
    renderMeta();
    buildFilters();
    render();
  } catch (e) {
    $('vh-list').innerHTML = '<div class="vh-state"><h3>讀取不到影片清單</h3><p>請檢查網路後按右上角「重新整理」</p></div>';
    $('vh-count').textContent = '';
  }
}


function renderMeta() {
  const d = updatedAt ? new Date(updatedAt) : null;
  const pad = (n) => String(n).padStart(2, '0');
  const when = d && !isNaN(d) ? `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
  $('vh-updated').textContent = `${dataSource === 'live' ? '清單更新於' : '備份資料'} ${when}`.trim();
}

// =========================================================
// 篩選
// =========================================================
function buildFilters() {
  const groups = [...new Set(allVideos.map(groupOf).filter(Boolean))];
  const langs = [...new Set(allVideos.map((v) => v.lang).filter(Boolean))];
  fillSelect('f-group', 'group', '全部專案', groups.map((g) => [g, g]));
  fillSelect('f-lang', 'lang', '全部語系', langs.map((l) => [l, LANG_LABEL[l] || l]));
  const productCount = {};
  allVideos.forEach((v) => v.products.forEach((p) => { productCount[p] = (productCount[p] || 0) + 1; }));
  const productKeys = Object.keys(productCount).sort((x, y) => productCount[y] - productCount[x]);
  filters.products = new Set([...filters.products].filter((p) => productKeys.includes(p)));
  $('f-product').innerHTML = [['', '全部'], ...productKeys.map((k) => [k, productName(k)])]
    .map(([val, label]) => `<button type="button" class="vh-pillbtn" data-product="${esc(val)}"${val ? ` style="--pc:${productColor(val)}"` : ''} aria-pressed="false">${esc(label)}</button>`).join('');
  syncProductButtons();
}

function fillSelect(id, key, allLabel, items) {
  const el = $(id);
  el.innerHTML = [['', allLabel], ...items].map(([val, label]) => `<option value="${esc(val)}">${esc(label)}</option>`).join('');
  el.value = filters[key] || '';
  el.classList.toggle('on', !!filters[key]);
}

function syncProductButtons() {
  document.querySelectorAll('#f-product .vh-pillbtn').forEach((b) => {
    const val = b.dataset.product;
    b.setAttribute('aria-pressed', String(val === '' ? filters.products.size === 0 : filters.products.has(val)));
  });
}

function matches(v) {
  if (filters.q && !v.search.includes(filters.q.toLowerCase())) return false;
  if (filters.group && groupOf(v) !== filters.group) return false;
  if (filters.products.size && !v.products.some((p) => filters.products.has(p))) return false;
  if (filters.lang && v.lang !== filters.lang) return false;
  if (!filters.dubs.has(v.dub === '配音' ? '配音' : '無')) return false;
  return true;
}

// =========================================================
// 繪製
// =========================================================
function fmtDate(d) {
  if (/^\d{8}$/.test(d)) return `${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6)}`;
  if (/^\d{6}$/.test(d)) return `${d.slice(0, 4)}/${d.slice(4)}`;
  return d;
}

function isNew(d) {
  if (!/^\d{8}$/.test(d)) return false;
  const t = new Date(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6));
  return (Date.now() - t.getTime()) / 86400000 <= NEW_DAYS;
}

function noteLabel(v) {
  if (v.note) return v.note;
  if (/canva\./i.test(v.noteUrl)) return 'Canva 連結';
  return '相關連結';
}

const ICON_COPY = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
const ICON_OPEN = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';
const ICON_PLAY = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z"></path></svg>';
const ICON_FILM = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="16" rx="2"></rect><line x1="7" y1="4" x2="7" y2="20"></line><line x1="17" y1="4" x2="17" y2="20"></line><line x1="2.5" y1="9" x2="7" y2="9"></line><line x1="2.5" y1="15" x2="7" y2="15"></line><line x1="17" y1="9" x2="21.5" y2="9"></line><line x1="17" y1="15" x2="21.5" y2="15"></line></svg>';

function linkBtn(url, id) {
  if (!url) return '';
  return `<button type="button" class="vh-btn" data-copy data-id="${esc(id)}" title="複製影片連結">${ICON_COPY}複製連結</button><a class="vh-btn" href="${esc(url)}" target="_blank" rel="noopener" title="在新分頁開啟">${ICON_OPEN}開啟</a>`;
}

function productsHTML(v) {
  return v.products.map((p) => `<span class="vh-prod" style="color:${productColor(p)}">${esc(productName(p))}</span>`).join('<span class="vh-plus">x</span>');
}

function headHTML(v) {
  const chips = [];
  const langTitle = `<span class="vh-langt">${esc(LANG_LABEL[v.lang] || v.lang || '語系未填')}</span><span class="vh-sep">｜</span>`;
  if (v.version) chips.push(`<span class="vh-chip ver">${esc(v.version)}</span>`);
  if (v.dub === '配音') chips.push('<span class="vh-chip dub">有配音</span>');
  return `<div class="vh-head">
        <h3 class="vh-title">${langTitle}${productsHTML(v)}${v.purpose ? `<span class="vh-sep">｜</span><span class="vh-purpose">${esc(v.purpose)}</span>` : ''}</h3>
        ${chips.join('')}
      </div>`;
}

function descHTMLOf(v) {
  // 用途與備註接在一起當說明內文；備註若帶連結就把備註文字做成連結
  const noteHTML = v.noteUrl
    ? `<a href="${esc(v.noteUrl)}" target="_blank" rel="noopener">${esc(noteLabel(v))}</a>`
    : esc(v.note);
  const descText = v.desc;
  return [esc(descText), noteHTML].filter(Boolean).join('　');
}

function cardHTML(v) {
  const actionsHTML = linkBtn(v.publicUrl, v.id);
  const descHTML = descHTMLOf(v);
  // 有公開連結就能點：能直接串流的在卡片下方展開播放，其餘在新分頁開啟 SharePoint 播放頁
  const inPage = !!v.playUrl;
  const can = inPage || !!v.publicUrl;
  const tip = inPage ? '點擊展開播放' : '這支影片的分享設定不開放在這裡直接播放，點擊會在新分頁開啟連結';
  const thumb = v.thumb ? `<img src="${esc(v.thumb)}" alt="" loading="lazy">` : (can ? '' : ICON_FILM);
  return `<article class="vh-card${can ? ' can-preview' : ''}" style="--pc:${productColor(v.products[0])}${v.products.length > 1 ? `;--pc2:${productColor(v.products[1])}` : ''}" ${can ? `data-preview="${esc(v.id)}" tabindex="0" role="button" title="${tip}" aria-label="${esc(v.products.map(productName).join('、'))}：${tip}"${inPage ? ' aria-expanded="false"' : ''}` : 'title="尚未提供公開連結"'}>
    <div class="vh-thumb">${thumb}${isNew(v.date) ? '<span class="vh-new">新</span>' : ''}${inPage ? `<span class="vh-play">${ICON_PLAY}</span>` : ''}<span class="vh-date">${esc(fmtDate(v.date))}</span></div>
    <div class="vh-info">
      ${headHTML(v)}
      ${descHTML ? `<p class="vh-desc">${descHTML}</p>` : ''}
      <p class="vh-udate">更新時間　${esc(fmtDate(v.date))}</p>
    </div>
    ${actionsHTML ? `<div class="vh-actions">${actionsHTML}</div>` : ''}
  </article>`;
}

function render() {
  // 依更新時間新到舊，同一天維持試算表原本的順序
  const list = allVideos.filter(matches).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const filtered = list.length !== allVideos.length;
  $('vh-count').innerHTML = filtered ? `符合 <b>${list.length}</b> / ${allVideos.length} 支` : `共 <b>${list.length}</b> 支`;
  document.querySelectorAll('.vh-select').forEach((s) => s.classList.toggle('on', !!filters[s.dataset.key]));
  const box = $('vh-list');
  if (!list.length) {
    box.innerHTML = '<div class="vh-state"><h3>沒有符合的影片</h3><p>換個關鍵字，或把篩選條件調整一下</p></div>';
    return;
  }
  if (viewMode === 'date') {
    box.innerHTML = list.map(cardHTML).join('');
    return;
  }
  // 依專案：專案順序依各專案最新一支影片的日期，專案內同樣新到舊
  const groups = [];
  list.forEach((v) => {
    const name = groupOf(v);
    let g = groups.find((x) => x.name === name);
    if (!g) { g = { name, items: [] }; groups.push(g); }
    g.items.push(v);
  });
  box.innerHTML = groups.map((g) => `<h2 class="vh-group">${esc(g.name || '未分類')}<small>${g.items.length} 支</small></h2>${g.items.map(cardHTML).join('')}`).join('');
}

// =========================================================
// 預覽：能直接串流的在卡片下方展開播放，其他開新分頁
// =========================================================
function collapseCard(card) {
  const player = card.querySelector('.vh-player');
  if (!player) return;
  const video = player.querySelector('video');
  video.pause();
  video.removeAttribute('src');
  video.load();
  player.remove();
  card.classList.remove('open');
  card.setAttribute('aria-expanded', 'false');
}

function watch(id) {
  const v = allVideos.find((x) => x.id === id);
  const card = document.querySelector(`.vh-card[data-preview="${CSS.escape(id)}"]`);
  if (!v || !card) return;
  if (!v.playUrl) {
    window.open(v.publicUrl, '_blank', 'noopener');
    return;
  }
  if (card.classList.contains('open')) { collapseCard(card); return; }
  document.querySelectorAll('.vh-card.open').forEach(collapseCard); // 一次只展開一支
  card.classList.add('open');
  card.setAttribute('aria-expanded', 'true');
  card.insertAdjacentHTML('beforeend', `<div class="vh-player">
    <video controls playsinline preload="metadata"></video>
    <div class="err"><div>這支影片暫時無法在這裡播放<br>請改用右上方的「開啟」在新分頁觀看</div></div>
    <button type="button" class="vh-collapse" data-collapse>收合</button>
  </div>`);
  const player = card.querySelector('.vh-player');
  const video = player.querySelector('video');
  video.onerror = () => player.classList.add('failed');
  video.src = v.playUrl;
  const p = video.play();
  if (p && p.catch) p.catch(() => { /* 瀏覽器擋自動播放時使用者自己按播放 */ });
  player.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// =========================================================
// 複製連結與提示
// =========================================================
let toastTimer = null;
function toast(msg) {
  const t = $('vh-toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

async function copyLink(id) {
  const v = allVideos.find((x) => x.id === id);
  const url = v && v.publicUrl;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('已複製連結');
}

// =========================================================
// 事件
// =========================================================
document.addEventListener('click', (e) => {
  const copyBtn = e.target.closest('[data-copy]');
  if (copyBtn) { copyLink(copyBtn.dataset.id); return; }
  const collapseBtn = e.target.closest('[data-collapse]');
  if (collapseBtn) { collapseCard(collapseBtn.closest('.vh-card')); return; }
  if (e.target.closest('.vh-player')) return; // 操作播放器本身不收合
  if (e.target.closest('a')) return; // 備註連結等照常開新分頁，不觸發預覽
  const viewBtn = e.target.closest('#vh-view button');
  if (viewBtn) {
    viewMode = viewBtn.dataset.view;
    document.querySelectorAll('#vh-view button').forEach((b) => b.setAttribute('aria-pressed', String(b === viewBtn)));
    render();
    return;
  }
  const prodBtn = e.target.closest('[data-product]');
  if (prodBtn) {
    const val = prodBtn.dataset.product;
    if (val === '') filters.products.clear();
    else if (filters.products.has(val)) filters.products.delete(val);
    else filters.products.add(val);
    syncProductButtons();
    render();
    return;
  }
  const card = e.target.closest('.vh-card[data-preview]');
  if (card) watch(card.dataset.preview);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.vh-card.open').forEach(collapseCard);
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.vh-card[data-preview]')) {
    e.preventDefault();
    watch(e.target.dataset.preview);
  }
});

document.querySelectorAll('.vh-select').forEach((sel) => {
  sel.addEventListener('change', () => { filters[sel.dataset.key] = sel.value; render(); });
});

// 配音可多選，但至少要保留一個，兩個都勾等於不篩選
document.querySelectorAll('input[name="dub"]').forEach((box) => {
  box.addEventListener('change', () => {
    const checked = [...document.querySelectorAll('input[name="dub"]:checked')];
    if (!checked.length) {
      box.checked = true;
      toast('配音至少要選一個');
      return;
    }
    filters.dubs = new Set(checked.map((c) => c.value));
    render();
  });
});

$('vh-q').addEventListener('input', (e) => { filters.q = e.target.value.trim(); render(); });
$('vh-refresh').addEventListener('click', start);

start();

