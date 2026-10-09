import { expect, test } from "@playwright/test";
import empty from "../fixtures/empty-dashboard.json";
test("source transparency, charging search and snapshot API", async ({ page, request }) => {
  const response = await request.get("/api/dashboard");
  expect(response.ok()).toBe(true);
  expect((await response.json()).schemaVersion).toBe(1);
  await page.route("**/api/dashboard", (route) => route.fulfill({json:empty}));
  await page.goto("/");
  await expect(page.getByRole("heading", {level:1})).toContainText("Tesla 在台灣");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path:"/tmp/tesla-desktop.png",fullPage:true});
  await page.getByRole("button", {name:"資料來源", exact:true}).click();
  await expect(page.getByRole("heading", {name:"計算方式與更新原則"})).toBeVisible();
  await page.getByRole("button", {name:"充電網絡",exact:true}).click();
  await page.getByPlaceholder("搜尋站名、地址或地區").fill("台中");
  await expect(page.getByText("尚無可用的充電站資料")).toBeVisible();
});
test("mobile page stays within viewport", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.route("**/api/dashboard", (route) => route.fulfill({json:empty}));
  await page.goto("/");
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path:"/tmp/tesla-mobile.png",fullPage:true});
});
