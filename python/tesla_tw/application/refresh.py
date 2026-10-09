"""Functional orchestration with isolated filesystem boundary."""
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from tesla_tw.domain.registrations import parse_market_csv, parse_brand_csv, analyze
from tesla_tw.infrastructure.sources import fetch, fetch_market, fetch_news, fetch_tdx, decode_csv, normalize_stations, parse_feed

ROOT = Path(__file__).resolve().parents[3]
SNAPSHOT = ROOT / "public/data/dashboard.json"
RAW = ROOT / "data/raw"

def merge_section(previous: dict, fresh: dict | None, attempted_at: str, error: str | None = None) -> dict:
    if fresh is not None:
        return {**fresh, "status":"ok", "fetchedAt":attempted_at,"attemptedAt":attempted_at,"error":None}
    return {**previous,"status":"stale" if previous.get("fetchedAt") else "unavailable",
            "attemptedAt":attempted_at,"error":error}

def persist_raw(name: str, body: bytes) -> str:
    digest = hashlib.sha256(body).hexdigest()
    RAW.mkdir(parents=True, exist_ok=True)
    (RAW / f"{name}-{digest}.txt").write_bytes(body)
    return digest

def update_section(name: str, previous: dict, now: str, load, transform) -> dict:
    try:
        body, url = load()
        rows = transform(body)
        if not rows:
            # A valid empty news feed is meaningful; empty statistics/stations are not.
            if name != "news":
                raise ValueError("來源沒有可用資料")
        digest = persist_raw(name, body)
        return merge_section(previous, {**previous,"rows":rows,"downloadUrl":url,"sha256":digest}, now)
    except Exception as error:
        # Do not log request headers, OAuth payloads or credentials.
        message = str(error) if isinstance(error, ValueError) else f"官方來源暫時無法讀取（{type(error).__name__}）"
        return merge_section(previous, None, now, message)

def refresh(previous: dict, env: dict, now: str) -> dict:
    market = update_section("market", previous["market"], now,
                            lambda: fetch_market(env.get("THB_MARKET_CSV_URL") or None),
                            lambda body: parse_market_csv(decode_csv(body)))
    def load_brand():
        url = env.get("THB_BRAND_CSV_URL")
        if not url:
            raise ValueError("尚未取得公路局按廠牌分 CSV 下載端點")
        return fetch(url), url
    brand = update_section("registrations",previous["registrations"],now,load_brand,
                           lambda body: parse_brand_csv(decode_csv(body)))
    charging = update_section("charging",previous["charging"],now,
                              lambda: fetch_tdx(env.get("TDX_CLIENT_ID",""),env.get("TDX_CLIENT_SECRET",""),
                                               (env.get("TDX_STATIONS_URL") or "https://tdx.transportdata.tw/api/basic/v1/EV/Station/City/Taichung?$format=JSON")),
                              lambda body: normalize_stations(json.loads(body)))
    news = update_section("news",previous["news"],now,
                          lambda:fetch_news(env.get("THB_NEWS_RSS_URL") or None),
                          lambda body:parse_feed(body.decode("utf-8-sig")))
    try:
        analyzed = analyze(brand["rows"], market["rows"])
    except ValueError:
        analyzed = analyze(brand["rows"], [])
        brand = {**brand,"status":"stale","error":"兩來源統計範圍不一致，市占率暫停計算"}
    return {**previous,"generatedAt":now,"registrations":{**brand,"rows":analyzed},
            "market":market,"charging":charging,"news":news}

def main():
    previous = json.loads(SNAPSHOT.read_text())
    now = datetime.now(timezone.utc).isoformat()
    result = refresh(previous, dict(os.environ), now)
    temp = SNAPSHOT.with_suffix(".tmp")
    temp.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    temp.replace(SNAPSHOT)
    for name in ("market","registrations","charging","news"):
        print(f"{name}: {result[name]['status']}")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as output:
            output.write("## 官方資料更新\n\n" + "\n".join(f"- {name}: {result[name]['status']}" for name in ("market","registrations","charging","news")))

if __name__ == "__main__":
    main()
