/**
 * 影片領取區：試算表即時同步程式（Google Apps Script）
 *
 * 設定方式
 * 1. 開啟影片試算表，選單「擴充功能」→「Apps Script」，把這份程式碼整份貼上取代原本內容
 * 2. 按「部署」→「新增部署作業」→ 類型選「網頁應用程式」
 *    執行身分：我；誰可以存取：所有人
 * 3. 複製產生的網址，貼到 video-hub/script.js 最上方的 VIDEO_API_URL
 *
 * 沒有密碼，網址打開就能看。
 *
 * 欄位：標題列是含「產品」的那一列，依標題文字找欄位，順序調整或插欄都沒問題：
 *   產品／用途／版本／語系／是否配音／公開影片位置／組織內影片位置／路徑／說明（舊標題「備註」也認得）
 *   路徑欄最後一段會當成「專案」名稱
 */

const SHEET_NAME = '所有影片';
const CACHE_KEY = 'video-hub-payload';
const CACHE_SECONDS = 300;

function doGet() {
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

  return { updatedAt: new Date().toISOString(), videos: videos };
}
