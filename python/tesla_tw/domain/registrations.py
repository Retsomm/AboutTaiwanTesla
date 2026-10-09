"""Pure transformations; no network, clock, filesystem or mutable shared state."""
import csv
import io
import re

MISSING = frozenset(("", "-", "—", "…", "...", "NA", "N/A"))

def normalize_period(value: str) -> str:
    text = value.strip()
    match = re.fullmatch(r"(\d{2,4})(?:年|[-/])(\d{1,2})月?", text)
    if not match:
        match = re.fullmatch(r"(\d{3}|\d{4})(\d{2})", text)
    if not match:
        raise ValueError("缺少完整月份")
    year, month = map(int, match.groups())
    year = year + 1911 if year < 1911 else year
    if year < 2000 or year > 2100 or not 1 <= month <= 12:
        raise ValueError("統計月份超出範圍")
    return f"{year:04d}-{month:02d}"

def parse_count(value: str) -> int | None:
    text = value.strip().replace(",", "").replace("，", "")
    if text in MISSING:
        return None
    if not re.fullmatch(r"\d+", text):
        raise ValueError("輛數必須為非負整數")
    return int(text)

def csv_rows(text: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(text.lstrip("\ufeff")))
    if not reader.fieldnames:
        raise ValueError("CSV 無欄位")
    return [{str(k).strip(): (v or "").strip() for k, v in row.items() if k} for row in reader]

def unique_rows(rows: list[dict]) -> list[dict]:
    periods = tuple(row["period"] for row in rows)
    if len(periods) != len(set(periods)):
        raise ValueError("月份重複；拒絕加總以免總計與分項重複")
    return sorted(rows, key=lambda row: row["period"])

def parse_market_csv(text: str) -> list[dict]:
    rows = csv_rows(text)
    if not rows or not {"統計期", "小客車"}.issubset(rows[0]):
        raise ValueError("缺少統計期或小客車欄位")
    result = []
    for row in rows:
        if re.fullmatch(r"\d{2,4}年", row["統計期"]):
            continue
        period = normalize_period(row["統計期"])
        count = parse_count(row["小客車"])
        if count is not None:
            result.append({"period": period, "count": count})
    if not result:
        raise ValueError("沒有可用的月資料")
    return unique_rows(result)

def parse_brand_csv(text: str) -> list[dict]:
    rows = csv_rows(text)
    if not rows or not {"統計期", "廠牌", "小客車"}.issubset(rows[0]):
        raise ValueError("按廠牌 CSV 需要統計期、廠牌、小客車；不能用車種總計推算 Tesla")
    result = []
    for row in rows:
        if row["廠牌"].upper().replace(" ", "") not in ("TESLA", "特斯拉", "特斯拉TESLA", "TESLA特斯拉"):
            continue
        if re.fullmatch(r"\d{2,4}年", row["統計期"]):
            continue
        period = normalize_period(row["統計期"])
        count = parse_count(row["小客車"])
        if count is not None:
            result.append({"period": period, "count": count})
    if not result:
        raise ValueError("來源沒有 Tesla 小客車月資料")
    return unique_rows(result)

def shift_month(period: str, delta: int) -> str:
    year, month = map(int, period.split("-"))
    index = year * 12 + month - 1 + delta
    return f"{index // 12:04d}-{index % 12 + 1:02d}"

def growth(current: int, previous: int | None) -> float | None:
    return round((current - previous) / previous * 100, 2) if previous else None

def analyze(brand: list[dict], market: list[dict]) -> list[dict]:
    counts = {row["period"]: row["count"] for row in unique_rows(brand)}
    totals = {row["period"]: row["count"] for row in unique_rows(market)}
    def convert(row):
        period, count = row["period"], row["count"]
        total = totals.get(period)
        if total is not None and count > total:
            raise ValueError("Tesla 輛數大於全市場；請檢查統計範圍")
        return {**row, "market": total,
                "share": round(count / total * 100, 2) if total else None,
                "mom": growth(count, counts.get(shift_month(period, -1))),
                "yoy": growth(count, counts.get(shift_month(period, -12)))}
    return list(map(convert, unique_rows(brand)))
