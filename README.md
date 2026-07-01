# uniXecure Marketing Tools Hub

本專案是一個模組化、現代化的行銷資產生成工具集，旨在提升 R&D 與行銷團隊在部署活動素材時的效率與視覺一致性。

## 專案架構
本專案採用純靜態網頁架構（HTML5 / CSS3 / Vanilla JavaScript），無需任何後端伺服器，完全透過 GitHub Pages 進行免費託管與自動化部署。

```text
marketing-tools/
├── index.html          # Dashboard 主控制台，提供所有工具的統一入口
├── style.css           # 全域共用樣式表，定義 UI 變數、通用按鈕、卡片與輸入框樣式
├── banner-maker/       # Banner 自動生成器模組
│   └── index.html      # 包含 Canvas 繪圖引擎、文字自動換行與圖片上傳邏輯
└── edm-editor/         # EDM 視覺化編輯器模組
    └── index.html      # 包含富文字編輯、議程拖曳排序、LocalStorage 自動存檔與 iframe 即時預覽


## 核心功能說明
1. Dashboard 導覽中心 (/index.html)
現代化高科技視覺：採用乾淨的純白背景與幾何風格圖示，呈現俐落的專業感。
統一入口管理：整合所有行銷自動化工具，便於行銷團隊單一網址操作，並具備未來高度的擴充性。

2. Banner 自動生成器 (/banner-maker/)
品牌識別控制：內建自訂主色系功能（支援恢復預設藍），以及科技點陣（Dot Matrix）、微光漸層（Gradient）等背景裝飾風格。
智慧排版引擎：
    自動化處理主標題的動態延展與長文案斷行，確保 1200x450 完美比例置中。
    支援主辦單位 Logo URL 載入（具備防 CORS 崩潰機制）與本地檔案上傳。
    包含右側講者卡片生成，支援講者照片自動裁切為圓形、職稱自動換行。
高清輸出：可即時預覽繪圖結果，並支援一鍵下載為 PNG 高畫質圖片。

3. EDM 視覺化編輯器 (/edm-editor/)
即時編輯與預覽：左側面板欄位修改，右側 iframe 視窗即時同步模擬桌面版信箱的渲染效果。
強大組件管理：
    支援主視覺 Banner 網址、活動簡介富文字編輯（加粗、下底線、列表、動態顏色）。
    內建可拖曳排序的議程表（Agenda List）與主辦單位 Logo 清單，操作直覺。
    聯絡窗口、報名按鈕、提醒事項、底部注意事項等全面參數化。
資料持久化：自動整合 LocalStorage 隱含存檔機制，確保網頁重新整理或誤關時內容不遺失，並提供一鍵清除記憶恢復預設值功能。
標準代碼輸出：自動將資料轉譯為符合各大信箱規範的響應式 HTML 郵件格式程式碼，並支援一鍵下載 .html 檔案。

## 開發與運作流程指南
本專案已透過 Git 與 GitHub 倉庫（Repository）進行綁定，維護與更新流程已高度自動化：
1. 同步最新進度 (Pull)：每次在本地端（如 VS Code）修改前，建議先執行 Pull（拉取），確保本地代碼與雲端同步。
2. 本地微調與開發：在 VS Code 中開啟專案目錄。
    若需調整整體品牌視覺、顏色變數或通用按鈕，優先修改最外層的 style.css。
    若需調整特定工具功能，則進入對應資料夾的 index.html。
3. 本地測試：可使用 VS Code 的 Live Server 擴充功能在瀏覽器中進行即時偵錯。
4. 一鍵提交與同步 (Commit & Push)：
    開啟 VS Code 的「原始檔控制（Source Control）」面板（或使用 GitHub Desktop 軟體）。
    點擊 + (Stage Changes) 暫存修改過的檔案。
    輸入本次微調的說明文字（例如：Fix banner word-wrap padding）。
    點擊 Commit 提交，並按下 Push origin 推送至 GitHub 雲端。
5. 自動化部署 (GitHub Pages)：雲端偵測到 main 分支更新後，會在 1-2 分鐘內自動重新編譯網站，行銷團隊直接重新整理專案網址即可看到最新功能。

## 擴充新工具策略
未來若需要開發第三個小工具：
1. 在專案根目錄下建立新資料夾（如 /new-tool/）。
2. 在該資料夾內建立 index.html，並在頂部引入全域樣式：<link rel="stylesheet" href="../style.css">。
3. 修改最外層的 /index.html，在 tools-grid 內複製一份 tool-card 區塊，並將 href 指向新的路徑即可無縫上線。

本專案由 R&D 團隊設計開發，專供 uniXecure 內部行銷與營銷推廣團隊部署活動使用。