// =========================================================
// 設定
// =========================================================
// 貼上 Apps Script 部署後的網址，就會即時讀取試算表（密碼也由試算表 A1 欄位把關）
// 留空時是本機測試模式：改讀同資料夾的 data.local.json（含測試用密碼，不會上傳到 GitHub）
const VIDEO_API_URL = 'https://script.google.com/macros/s/AKfycbzxNRvc0EesLOeoyZp4vVuC21SjFk_fRmYzaSgB2ijxA9sabMueG3LZ62i-t_nugZ3IqA/exec';

// 產品欄位的值直接取自試算表，這裡只負責顯示名稱
const PRODUCT_LABEL = {};
const productName = (k) => PRODUCT_LABEL[k] || k;
// 產品識別色：RAVEN 藍、HEIS 綠、LUCAS 橘、SRMAS 紫（公司規範），其餘自訂；沒登記的用深灰藍
const PRODUCT_COLOR = { RAVEN: '#3c49ba', HEIS: '#15803d', LUCAS: '#c2410c', SRMAS: '#7e3af2', SOC: '#232e8a', uberAgent: '#0284c7', 'Q-Atlas': '#0e7490' };
const productColor = (k) => PRODUCT_COLOR[k] || '#475569';
const LANG_LABEL = { TC: '繁中', EN: '英文', JP: '日文', ID: '印尼' };
const NEW_DAYS = 30;

// =========================================================
// 狀態
// =========================================================
let allVideos = [];
let dataSource = '';
let updatedAt = '';
const filters = { q: '', group: '', lang: '', products: new Set(), dubs: new Set(['配音', '無']) };

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

const CACHE_KEY = 'vh-last-payload';
function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; } }
function writeCache(data) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* 無痕模式或容量滿了就略過 */ } }

function show(data, label) {
  allVideos = data.videos;
  allVideos.forEach(tagVideo);
  dataSource = label;
  updatedAt = data.updatedAt || '';
  renderMeta();
  buildFilters();
  render();
}

// 讀取慢（試算表要現算）時，先用上次存在這台電腦的清單頂著，新資料回來再換掉
async function start() {
  const cached = readCache();
  if (cached && Array.isArray(cached.videos)) {
    show(cached, 'cache');
    $('vh-updated').textContent = '正在更新清單…';
  } else {
    $('vh-list').innerHTML = '<div class="vh-skel"></div>'.repeat(8);
  }
  try {
    const { data, label } = await fetchData();
    if (label === 'live') writeCache(data);
    show(data, label);
  } catch (e) {
    if (cached) { renderMeta(); return; }
    $('vh-list').innerHTML = '<div class="vh-state"><h3>讀取不到影片清單</h3><p>請檢查網路後按右上角「重新整理」</p></div>';
    $('vh-count').textContent = '';
  }
}


function renderMeta() {
  const d = updatedAt ? new Date(updatedAt) : null;
  const pad = (n) => String(n).padStart(2, '0');
  const when = d && !isNaN(d) ? `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
  $('vh-updated').textContent = `${{ live: '清單更新於', cache: '上次載入的清單', backup: '備份資料' }[dataSource]} ${when}`.trim();
}

// =========================================================
// 篩選
// =========================================================
function buildFilters() {
  const groups = [...new Set(allVideos.map(groupOf).filter(Boolean))];
  const langs = [...new Set(allVideos.map((v) => v.lang).filter(Boolean))];
  fillSelect('f-group', 'group', '專案', groups.map((g) => [g, g]));
  fillSelect('f-lang', 'lang', '語系', langs.map((l) => [l, LANG_LABEL[l] || l]));
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

const ICON_CHECK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const ICON_COPY = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
const ICON_OPEN = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';

function linkBtn(url, id) {
  if (!url) return '';
  return `<button type="button" class="vh-btn" data-copy data-id="${esc(id)}" title="複製影片連結">${ICON_COPY}複製</button><a class="vh-btn" href="${esc(url)}" target="_blank" rel="noopener" title="在新分頁開啟">${ICON_OPEN}開啟</a>`;
}

function productsHTML(v) {
  return v.products.map((p) => `<span class="vh-prod" style="color:${productColor(p)}">${esc(productName(p))}</span>`).join('<span class="vh-plus">x</span>');
}

const langName = (v) => LANG_LABEL[v.lang] || v.lang || '語系未填';

function descHTMLOf(v) {
  // 用途與備註接在一起當說明內文；備註若帶連結就把備註文字做成連結
  const noteHTML = v.noteUrl
    ? `<a href="${esc(v.noteUrl)}" target="_blank" rel="noopener">${esc(noteLabel(v))}</a>`
    : esc(v.note);
  const descText = v.desc;
  return [esc(descText), noteHTML].filter(Boolean).join('　');
}

// 一支影片一行：語系｜產品＋標籤，說明截成一行，右側日期與按鈕
function rowHTML(v) {
  const can = !!v.publicUrl;
  const descHTML = descHTMLOf(v);
  const descText = [v.desc, v.note].filter(Boolean).join('　');
  const chips = [];
  if (isNew(v.date)) chips.push('<span class="vh-new">新</span>');
  if (v.version) chips.push(`<span class="vh-chip ver">${esc(v.version)}</span>`);
  if (v.dub === '配音') chips.push('<span class="vh-chip dub">有配音</span>');
  const tip = can ? '點擊在新分頁開啟影片' : '尚未提供公開連結';
  return `<div class="vh-item${can ? ' can-open' : ''}" style="--pc:${productColor(v.products[0])}" ${can ? `data-preview="${esc(v.id)}" tabindex="0" role="button" aria-label="${esc(v.products.map(productName).join('、'))}：${tip}"` : ''} title="${esc(descText ? `${descText}\n\n${tip}` : tip)}">
    <span class="vh-lang">${esc(langName(v))}</span>
    <div class="vh-main">
      <span class="vh-title">${productsHTML(v)}</span>
      ${chips.join('')}
      ${descHTML ? `<span class="vh-desc">${descHTML}</span>` : ''}
    </div>
    ${v.date ? `<span class="vh-when">${esc(fmtDate(v.date))}</span>` : ''}
    <div class="vh-actions">${linkBtn(v.publicUrl, v.id)}</div>
  </div>`;
}

function render() {
  // 依更新時間新到舊，同一天維持試算表原本的順序
  const list = allVideos.filter(matches).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const filtered = list.length !== allVideos.length;
  $('vh-count').innerHTML = filtered ? `符合 <b>${list.length}</b> / ${allVideos.length} 支` : `共 <b>${list.length}</b> 支`;
  document.querySelectorAll('.vh-select').forEach((s) => s.classList.toggle('on', !!filters[s.dataset.key]));
  // 手機版「篩選」按鈕上顯示目前套用了幾個條件
  const active = (filters.group ? 1 : 0) + (filters.lang ? 1 : 0) + (filters.dubs.size < 2 ? 1 : 0) + filters.products.size;
  $('vh-fcount').textContent = active ? String(active) : '';
  const box = $('vh-list');
  if (!list.length) {
    box.innerHTML = '<div class="vh-state"><h3>沒有符合的影片</h3><p>換個關鍵字，或把篩選條件調整一下</p></div>';
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
  box.innerHTML = groups.map((g) => `<section class="vh-gcard">
    <h2 class="vh-group">${esc(g.name || '未分類')}<small>${g.items.length} 支</small></h2>
    ${g.items.map((v) => rowHTML(v)).join('')}
  </section>`).join('');
}

// =========================================================
// 開啟影片
// =========================================================
function watch(id) {
  const v = allVideos.find((x) => x.id === id);
  if (v && v.publicUrl) window.open(v.publicUrl, '_blank', 'noopener');
}

// =========================================================
// 複製連結
// =========================================================
let toastTimer = null;
function toast(msg, isError) {
  const t = $('vh-toast');
  t.textContent = msg;
  t.classList.toggle('error', !!isError);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), isError ? 3500 : 1800);
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    // 瀏覽器不給用剪貼簿時改用舊方法，並確認真的有複製到
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    ta.remove();
    return ok;
  }
}

async function copyLink(id, btn) {
  const v = allVideos.find((x) => x.id === id);
  const url = v && v.publicUrl;
  if (!url) return;
  const ok = await writeClipboard(url);
  if (!ok) { toast('複製失敗，請按「開啟」後從網址列複製', true); return; }
  toast('已複製連結');
  if (btn) {
    const old = btn.innerHTML;
    btn.classList.add('done');
    btn.innerHTML = `${ICON_CHECK}已複製`;
    setTimeout(() => { btn.classList.remove('done'); btn.innerHTML = old; }, 1600);
  }
}

// =========================================================
// 事件
// =========================================================
document.addEventListener('click', (e) => {
  const copyBtn = e.target.closest('[data-copy]');
  if (copyBtn) { copyLink(copyBtn.dataset.id, copyBtn); return; }
  if (e.target.closest('a')) return; // 備註連結等照常開新分頁，不觸發預覽
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
  const card = e.target.closest('.vh-item[data-preview]');
  if (card) watch(card.dataset.preview);
});

document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.vh-item[data-preview]')) {
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

$('vh-ftoggle').addEventListener('click', (e) => {
  const open = $('vh-toolbar').classList.toggle('open');
  e.currentTarget.setAttribute('aria-expanded', String(open));
});
$('vh-q').addEventListener('input', (e) => { filters.q = e.target.value.trim(); render(); });
$('vh-refresh').addEventListener('click', start);

start();

