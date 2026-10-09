import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Dashboard } from "../src/components/dashboard";
import snapshot from "./fixtures/empty-dashboard.json";
import { dashboardSchema } from "../src/types/dashboard";
afterEach(cleanup);
describe("dashboard user behavior", () => {
  it("shows missing values honestly and exposes source links", () => {
    render(<Dashboard initialData={dashboardSchema.parse(snapshot)} />);
    expect(screen.getAllByText("等待官方資料").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", {name: "資料來源"}));
    expect(screen.getByText("公路局｜新車領牌數")).toBeTruthy();
  });
  it("switches to charging and can search empty verified results", () => {
    render(<Dashboard initialData={dashboardSchema.parse(snapshot)} />);
    fireEvent.click(screen.getByRole("button", {name: "充電網絡"}));
    fireEvent.change(screen.getByPlaceholderText("搜尋站名、地址或地區"), {target:{value:"台中"}});
    expect(screen.getByText("尚無可用的充電站資料")).toBeTruthy();
  });
});
