# Tesla Taiwan Observatory｜台灣特斯拉觀測站

Next.js / React / Yarn / Tailwind CSS 前端，Python 官方資料介接與分析，部署至 Vercel。
這是獨立開源專案，與 Tesla 無隸屬關係。

## 現況

網站、Python API、純函式分析與每日排程已實作。正式掛牌數不使用展示資料：
取得公路局「按廠牌分」CSV 並驗證格式前，Tesla 輛數與市占率顯示缺值。
TDX OAuth 與臺中市 Station API 已成功驗證，快照包含 446 筆公開充電站，原始回應與 SHA-256 校驗碼保存在 data/raw。
此數量為本次擷取結果，不是全臺或 Tesla 超級充電站總數。憑證已設定於 Vercel 正式環境的敏感變數，沒有写入原始碼。
GitHub 排程尚未啟用；啟用前需儲存庫寫入權限並在 GitHub Actions 設定相同名稱的 Secrets。
新聞來源是政府官方 RSS，另提供 Tesla 官方消息入口。

## 開發

需求：Node.js 22+（CI / Vercel 使用 24）、Python 3.12、Corepack。

```bash
corepack enable
yarn install --immutable
# 終端機 1
yarn dev:api
# 終端機 2
yarn dev
```

開啟 http://localhost:3000。Next.js 開發模式將 /api/dashboard、/api/health 轉送至 Python :8000。
Vercel 使用根目錄 api/*.py 的原生 Python Functions，Next.js 只負責 UI。
requirements.txt 不引入 FastAPI / Flask，避免 Python framework preset 取代 Next.js 路由。

## 分層與函數式設計

- src/types：Zod 資料契約；攔截不合法快照、非官方來源。
- src/domain：純函式日期篩選、格式化、CSV 匯出。
- src/services：HTTP 邊界。
- src/components：React 視圖，狀態採不可變更新。
- python/tesla_tw/domain：純函式 CSV 驗證、民國年月轉換、市占率與成長率。
- python/tesla_tw/infrastructure：HTTP、TDX OAuth、官方來源限制、CSV / RSS 解析。
- python/tesla_tw/application：資料刷新編排；錯誤時保留最後成功快照。
- api：薄 HTTP 控制層，只讀快照；不接受使用者提供的下載網址。

TypeScript / React 函式使用箭頭函數。Python 使用 def 定義可測試純函式，邊界編排使用 lambda；
Python 沒有 JavaScript 箭頭函數語法，HTTP handler 類別僅是 Vercel 執行介面。

## 測試與 TDD

先寫行為測試，確認失敗，再實作通過：
民國年月、缺值與零、重複月份、同口徑市場分母、連續月份成長率、
TDX 官方 Stations wrapper、巢狀地址、更新失敗保留、官方來源白名單；
前端涵蓋資料缺值、日期篩選、CSV、頁籤與搜尋。Playwright 驗證跨層 API 與手機版。

```bash
yarn test:python
yarn test
yarn typecheck
yarn lint
yarn build
yarn exec playwright install chromium
yarn test:e2e
```

測試資料只存在測試案例，正式公開快照不包含虛构掛牌數。

## 官方資料與限制

| 資料 | 原始來源 | 用法 |
| --- | --- | --- |
| 小客車市場總數 | [政府資料集 30202](https://data.gov.tw/dataset/30202) | 每月小客車新領牌，包含自用與營業 |
| Tesla 新領牌 | [公路局按廠牌分查詢](https://stat.thb.gov.tw/hb01/webMain.aspx?sys=210&funid=1120003&type=1&kind=21) | 需可持續下載的官方 CSV，不能以全市場總計代替 |
| 公開充電站 | [TDX EV v1](https://tdx.transportdata.tw/api-service/swagger/basic/b378d320-04a9-4fba-80b8-0df1b96dd5e8) | 預設臺中市、OAuth client credentials |
| 新聞 | [公路局 RSS 訂閱](https://www.thb.gov.tw/cp.aspx?n=219) | 特斯拉、電動車、充電關鍵字篩選 |

市場占有率 = Tesla 小客車新領牌 ÷ 同月全市場小客車新領牌 × 100%。
這不是純電車市占率，也不是全汽車市占率或車輛保有量占比。
月增率比較上一個日曆月，年增率比較去年同月；缺值或分母為零不計算。
原始月份不完整、不合法輛數、重複月份、Tesla 大於市場總數皆拒絕。
原始文件保存在 data/raw，以 SHA-256 命名，方便追蹤政府修訂。

## 定期更新

GitHub Actions 的 Refresh official sources 每天 UTC 00:23（台灣 08:23）檢查來源。
政府統計仍依每月發布節奏；每天擷取不代表政府每天發布。
排程可能延遲，公開 repository 的排程也可能因長期不活動被停用。
每次擷取寫入 public/data/dashboard.json，保留嘗試時間與成功時間；
來源失敗時保留舊資料並標示 stale / unavailable。

在 GitHub Settings → Secrets and variables → Actions 設定：

| 名稱 | 類型 | 說明 |
| --- | --- | --- |
| TDX_CLIENT_ID | Secret | TDX 金鑰；不得使用 NEXT_PUBLIC 前綴 |
| TDX_CLIENT_SECRET | Secret | TDX 秘密；不可寫入 Git |
| TDX_STATIONS_URL | Variable | 可選，官方 EV v1 城市站點 API；範圍變更需同步 scope |
| THB_MARKET_CSV_URL | Variable | 可選，官方 CSV；未設定則解析政府資料目錄下載連結 |
| THB_BRAND_CSV_URL | Variable | 必要，官方按廠牌分 CSV；欄位為統計期、廠牌、小客車 |
| THB_NEWS_RSS_URL | Variable | 官方公路局 RSS feed |

若按廠牌資料只有互動式報表或欄位不同，需新增對應 adapter / contract test 後才能啟用，
不要將未驗證的網頁 URL 填成 CSV 端點。
資料來源需 HTTPS 且隸屬交通部、公路局、TDX 或 data.gov.tw；不接受第三方鏡像。
TDX 使用官方 OAuth token URL；回應 Count 大於實際列數時拒絕發布不完整站點統計。
站點數不代表 Tesla 超級充電站數，也不保證車型 / 接頭相容。

## Vercel

匯入 Retsomm/AboutTaiwanTesla，Framework Next.js，Node 24。
安裝指令 corepack yarn install --immutable，建置 corepack yarn build。
vercel.json 保留 Next.js 與 Python api/*.py 的原生設定，不使用覆蓋路由的 legacy builds。
連接 Git repository 後一般使用者 push 觸發部署。
Actions 的 GITHUB_TOKEN commit 不保證觸發第三方 Git 整合，建議設定 Vercel Deploy Hook
（詳見 docs/deployment.md），讓資料快照更新後重新建置。
前端不保管 TDX 金鑰；排程金鑰只需設定 GitHub Actions Secrets。
