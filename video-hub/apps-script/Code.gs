/**
 * 影片領取區：試算表即時同步程式（Google Apps Script）
 *
 * 設定方式
 * 1. 開啟影片試算表，選單「擴充功能」→「Apps Script」，把這份程式碼整份貼上取代原本內容
 * 2. 按「部署」→「新增部署作業」→ 類型選「網頁應用程式」
 *    執行身分：我；誰可以存取：所有人
 * 3. 複製產生的網址，貼到 video-hub/script.js 最上方的 VIDEO_API_URL
 *
 * 密碼：寫在工作表的 A1 儲存格。A 欄固定是「更新時間」，A1 因為要放密碼所以不寫標題。
 *   前端輸入的密碼由這支程式在伺服器端比對，正確才會回傳影片清單，所以改 A1 就能讓舊密碼立刻失效。
 *   A1 留空（或還是「更新時間」）時，所有人都進不來。
 *
 * 欄位：標題列是含「產品」的那一列，依標題文字找欄位，順序調整或插欄都沒問題：
 *   產品／用途／版本／語系／是否配音／公開影片位置／組織內影片位置／路徑／說明（舊標題「備註」也認得）
 *   路徑欄最後一段會當成「專案」名稱
 */

const SHEET_NAME = '所有影片';
const CACHE_KEY = 'video-hub-payload';
const CACHE_SECONDS = 300;
const PLAY_CACHE_KEY = 'video-hub-play';

function doGet(e) {
  const given = String((e && e.parameter && e.parameter.pw) || '').trim();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const secret = sheet ? String(sheet.getRange('A1').getDisplayValue()).trim() : '';

  if (!secret || secret === '更新時間') return json_({ ok: false, error: 'nopw' });
  if (given !== secret) {
    Utilities.sleep(1500); // 放慢猜密碼的速度
    return json_({ ok: false, error: 'auth' });
  }

  const cache = CacheService.getScriptCache();
  let body = cache.get(CACHE_KEY);
  if (!body) {
    body = JSON.stringify(Object.assign({ ok: true }, buildPayload_()));
    if (body.length < 90000) cache.put(CACHE_KEY, body, CACHE_SECONDS);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function buildPayload_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('找不到工作表：' + SHEET_NAME);
  const range = sheet.getDataRange();
  const values = range.getDisplayValues();
  const rich = range.getRichTextValues();

  const headerRow = values.findIndex((r) => r.some((c) => String(c).trim() === '產品'));
  if (headerRow < 0) throw new Error('找不到標題列（需要有一欄標題是「產品」）');
  const col = {};
  values[headerRow].forEach((t, i) => {
    [['product', '產品'], ['purpose', '用途'], ['version', '版本'], ['lang', '語系'], ['dub', '是否配音'],
      ['pub', '公開影片位置'], ['org', '組織內影片位置'], ['path', '路徑'], ['note', '說明'], ['note', '備註']]
      .forEach(([key, kw]) => { if (String(t).indexOf(kw) >= 0 && col[key] === undefined) col[key] = i; });
  });
  const cellText = (row, key) => (col[key] === undefined ? '' : String(row[col[key]] || '').trim());

  const linkOf = (r, c) => {
    if (c === undefined) return '';
    const cell = rich[r][c];
    const direct = cell.getLinkUrl();
    if (direct) return direct;
    const run = cell.getRuns().map((x) => x.getLinkUrl()).find(Boolean);
    if (run) return run;
    const v = String(values[r][c]).trim();
    return /^https?:\/\//.test(v) ? v : '';
  };

  const videos = [];
  for (let r = headerRow + 1; r < values.length; r++) {
    const row = values[r];
    const product = cellText(row, 'product');
    const publicUrl = linkOf(r, col.pub);
    const orgUrl = linkOf(r, col.org);
    if (!product && !publicUrl && !orgUrl) continue;

    const lines = cellText(row, 'purpose').split('\n').map((x) => x.trim()).filter(Boolean);
    const noteText = cellText(row, 'note');
    const path = cellText(row, 'path');
    videos.push({
      id: 'r' + (r + 1),
      date: String(row[0]).replace(/\D/g, ''),
      product: product,
      group: path ? path.split('/').pop().trim() : '',
      purpose: lines[0] || '',
      desc: lines.slice(1).join(' '),
      version: cellText(row, 'version'),
      lang: cellText(row, 'lang').toUpperCase(),
      dub: cellText(row, 'dub'),
      fileName: cellText(row, 'pub') || cellText(row, 'org'),
      publicUrl: publicUrl,
      orgUrl: orgUrl,
      note: /^https?:\/\//.test(noteText) ? '' : noteText,
      noteUrl: linkOf(r, col.note)
    });
  }

  resolvePlayable_(videos);
  return { updatedAt: new Date().toISOString(), videos: videos };
}

/**
 * 公開連結（SharePoint 匿名分享）本身是網頁，瀏覽器沒辦法直接播放。
 * 這裡順著轉址取出分享代碼，組成可以直接播放的檔案網址，再確認連結還有效；
 * 抓不到影片本體的（例如設成不可下載的連結）就不提供線上預覽，改由前端開新分頁觀看。
 */
function resolvePlayable_(videos) {
  // 逐支確認很慢（每支都要連到 SharePoint），結果另外存起來：能播的存 6 小時，不能播的存 1 小時
  const cache = CacheService.getScriptCache();
  let known = {};
  try { known = JSON.parse(cache.get(PLAY_CACHE_KEY) || '{}'); } catch (err) { known = {}; }
  const now = Date.now();
  let dirty = false;
  videos.forEach((v) => {
    v.playUrl = '';
    if (!v.publicUrl) return;
    const hit = known[v.publicUrl];
    if (hit && now - hit.t < (hit.p ? 6 : 1) * 3600 * 1000) { v.playUrl = hit.p; return; }
    v.playUrl = checkPlayable_(v.publicUrl);
    known[v.publicUrl] = { p: v.playUrl, t: now };
    dirty = true;
  });
  if (dirty) {
    try { cache.put(PLAY_CACHE_KEY, JSON.stringify(known), 21600); } catch (err) { /* 太大放不下就下次重算 */ }
  }
}

function checkPlayable_(publicUrl) {
  const play = resolvePlayUrl_(publicUrl);
  if (!play) return '';
  try {
    const res = UrlFetchApp.fetch(play, { headers: { Range: 'bytes=0-0' }, muteHttpExceptions: true, followRedirects: true });
    const code = res.getResponseCode();
    const type = String(res.getHeaders()['Content-Type'] || '');
    if ((code === 200 || code === 206) && type.indexOf('video') === 0) return play;
  } catch (err) { /* 抓不到影片本體就維持不能線上預覽，仍可用連結開啟 */ }
  return '';
}

function resolvePlayUrl_(url) {
  let u = url;
  for (let i = 0; i < 5; i++) {
    let res;
    try {
      res = UrlFetchApp.fetch(u, { followRedirects: false, muteHttpExceptions: true });
    } catch (e) { return ''; }
    const loc = res.getHeaders()['Location'] || res.getHeaders()['location'];
    if (!loc) return '';
    const share = loc.match(/[?&]share=([^&]+)/);
    const base = loc.match(/^(https?:\/\/[^\/]+)(\/personal\/[^\/]+)\/_layouts/);
    if (share && base) return base[1] + base[2] + '/_layouts/15/download.aspx?share=' + share[1];
    u = /^https?:/.test(loc) ? loc : u.match(/^(https?:\/\/[^\/]+)/)[1] + loc;
  }
  return '';
}
