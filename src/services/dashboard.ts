import { dashboardSchema } from "../types/dashboard";
export const fetchDashboard = async (signal?: AbortSignal) => {
  const response = await fetch("/api/dashboard", { signal, cache: "no-store" });
  if (!response.ok) throw new Error("資料服務暫時無法讀取，已保留目前畫面。");
  return dashboardSchema.parse(await response.json());
};
