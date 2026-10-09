import type { Registration } from "../types/dashboard";

export const selectPeriod = (rows: readonly Registration[], period: string) =>
  rows.find((row) => row.period === period);

export const selectRange = (rows: readonly Registration[], months: number) => {
  const sorted = [...rows].sort((a, b) => a.period.localeCompare(b.period));
  const latest = sorted.at(-1);
  if (!latest) return [];
  const [year, month] = latest.period.split("-").map(Number);
  const index = year * 12 + month - 1 - months + 1;
  const cutoff = String(Math.floor(index / 12)).padStart(4, "0") + "-" +
    String(index % 12 + 1).padStart(2, "0");
  return sorted.filter((row) => row.period >= cutoff);
};

export const isStale = (fetchedAt: string | null, now: string, hours: number) =>
  !fetchedAt || Date.parse(now) - Date.parse(fetchedAt) > hours * 3_600_000;

export const toCsv = (rows: readonly Registration[]) =>
  "\uFEFF月份,Tesla小客車新領牌,全市場小客車新領牌,市占率(%),月增率(%),年增率(%)\r\n" +
  rows.map(({ period, count, market, share, mom, yoy }) =>
    [period, count, market, share, mom, yoy].map((value) => value ?? "").join(",")).join("\r\n");

export const formatNumber = (value: number | null | undefined) =>
  value == null ? "—" : new Intl.NumberFormat("zh-TW").format(value);
export const formatPercent = (value: number | null | undefined) =>
  value == null ? "—" : value.toFixed(2) + "%";
export const formatTime = (value: string | null) => value ?
  new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "尚未成功更新";
