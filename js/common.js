/* =========================================
   全站共用：品牌與產品 Logo 資料庫
   供 Banner, EDM, Logo 自助站共同讀取
   ========================================= */

const agentList = [
  // 'cisco', 'fortinet' // 未來擴充只需解除註解並確認資料夾結構
];

const logoDB = {
  'unixecure': {
    name: 'uniXecure',
    layouts: {
      'standard': {
        name: '標準 Logo',
        colors: {
          'full': '../assets/logos/unixecure/full.svg',
          'white': '../assets/logos/unixecure/white.svg',
          'dark': '../assets/logos/unixecure/dark.svg',
          'allwhite': '../assets/logos/unixecure/allwhite.svg'
        }
      }
    }
  }
  
  /* =========================================================
   💡 未來擴充指南：
   當 RAVEN, HEIS 等產品的 SVG 做好了，依照下方格式加回來即可：
   'raven': {
     name: 'RAVEN',
     layouts: {
       'horizontal': {
         name: '橫式 Horizontal',
         colors: {
           'full': '../assets/logos/raven/horizontal-full.svg'
         }
       }
     }
   }
   =========================================================
  */
};

// 如果未來有其他跨工具共用的函式 (如格式化日期、HEX 轉換)，也可以統一放在這裡