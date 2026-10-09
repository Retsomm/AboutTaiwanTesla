# 部署與更新驗證

1. Vercel 專案使用 Next.js，Git 來源為 Retsomm/AboutTaiwanTesla，分支 main。
2. 執行 CI：Python / Vitest / lint / TypeScript / production build / Playwright。
3. 完成正式部署後核對 /api/health 與 /api/dashboard：API 應回傳 JSON，不是 HTML 或 404。
4. Vercel Settings → Git → Deploy Hooks，建立 main 分支 hook。
   將 hook URL 保存為 GitHub Actions Secret VERCEL_DEPLOY_HOOK，工作流會在快照提交後呼叫。
5. 在 GitHub Actions 設定 TDX 金鑰與已驗證的官方資料 URL，手動執行 Refresh official sources，
   查閱 job summary、SHA-256 與前端来源狀態。没有真正成功擷取前不可宣稱 API 已連線。
6. Vercel 預覽與正式部署的存取保護須由專案擁有者確認。
   目前不自動解除登入保護；若需要對外公開，另行明確批准公開存取設定。
7. 確認每日排程有執行，資料月份符合官方發布，前端與 API 返回相同快照。
   「重新讀取」只讀快照，不即時觸發外部政府 API，避免濫用與配額消耗。

## 驗證來源的接受標準

- API URL 來自官方 OpenAPI / 頁面，而非猜測。
- CSV 實際下載成功，欄位、年月、車種與全國範圍檢核通過。
- 掛牌分子與市場分母為相同月份、同樣小客車、自用＋營業。
- 保有量不可當作新領牌數，純電市場不可當作小客車全市場。
- 若來源格式変更，先提交失敗 contract test，再修改 adapter。
- 禁止將測試 fixtures 或估算數字帶入正式資料。
