"""Official-source adapters. Side effects are isolated in this layer."""
import hashlib
import json
import re
import time
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from urllib.parse import urlparse, urlencode, urljoin
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError
from xml.etree import ElementTree

ALLOWED = ("thb.gov.tw", "motc.gov.tw", "data.gov.tw", "tdx.transportdata.tw")
CATALOG = "https://data.gov.tw/dataset/30202"
TDX_TOKEN = "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token"

def validate_official_url(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("只接受官方 HTTPS 來源")
    if not any(host == suffix or host.endswith("." + suffix) for suffix in ALLOWED):
        raise ValueError("來源必須是交通部、公路局、TDX 或政府資料平臺")
    return url

class OfficialRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_official_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def fetch(url: str, *, data: bytes | None = None, headers: dict | None = None) -> bytes:
    validate_official_url(url)
    request = Request(url, data=data, headers={"User-Agent": "AboutTaiwanTesla/1.0", **(headers or {})})
    for attempt in range(3):
        try:
            with build_opener(OfficialRedirect()).open(request, timeout=15) as response:
                body = response.read(10_000_001)
                if len(body) > 10_000_000:
                    raise ValueError("來源超出 10 MB 上限")
                return body
        except HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
        except (URLError, TimeoutError):
            if attempt == 2:
                raise
        time.sleep(2 ** attempt)
    raise RuntimeError("來源無法連線")

def decode_csv(body: bytes) -> str:
    for encoding in ("utf-8-sig", "big5"):
        try:
            return body.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("未知 CSV 編碼")

class ResourceLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.current = None
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.current = dict(attrs).get("href")
    def handle_data(self, data):
        if self.current and "CSV" in data.upper():
            self.links.append(self.current)
    def handle_endtag(self, tag):
        if tag == "a":
            self.current = None

def discover_csv(html: str) -> str:
    parser = ResourceLinks()
    parser.feed(html)
    for href in parser.links:
        url = urljoin(CATALOG, href)
        try:
            validate_official_url(url)
            return url
        except ValueError:
            continue
    raise ValueError("官方目錄未提供可驗證的 CSV 下載連結")

def discover_news_feed(html: str) -> str:
    class FeedLinks(HTMLParser):
        def __init__(self):
            super().__init__()
            self.current = None
            self.links = []
        def handle_starttag(self, tag, attrs):
            if tag == "a":
                self.current = dict(attrs).get("href")
        def handle_data(self, data):
            if self.current and "最新消息" in data:
                self.links.append(self.current)
        def handle_endtag(self, tag):
            if tag == "a":
                self.current = None
    parser = FeedLinks()
    parser.feed(html)
    for href in parser.links:
        url = urljoin("https://www.thb.gov.tw/cp.aspx?n=219", href)
        if "rss" in url.lower():
            return validate_official_url(url)
    raise ValueError("公路局 RSS 頁面未提供可驗證的最新消息 feed")

def fetch_news(url: str | None = None) -> tuple[bytes, str]:
    source = url or discover_news_feed(fetch("https://www.thb.gov.tw/cp.aspx?n=219").decode("utf-8"))
    return fetch(source), source

def fetch_market(url: str | None = None) -> tuple[bytes, str]:
    source = url or discover_csv(fetch(CATALOG).decode("utf-8"))
    return fetch(source), source

def fetch_tdx(client_id: str, client_secret: str, endpoint: str) -> tuple[bytes, str]:
    if not client_id or not client_secret:
        raise ValueError("尚未設定 TDX API 金鑰")
    if not endpoint.startswith("https://tdx.transportdata.tw/api/basic/v1/EV/"):
        raise ValueError("充電站端點必須使用 TDX 官方 EV v1 API")
    payload = urlencode({"grant_type":"client_credentials", "client_id":client_id,"client_secret":client_secret}).encode()
    token = json.loads(fetch(TDX_TOKEN, data=payload, headers={"Content-Type":"application/x-www-form-urlencoded"}))["access_token"]
    return fetch(endpoint, headers={"Authorization":f"Bearer {token}"}), endpoint

def normalize_stations(payload) -> list[dict]:
    updated = None
    if isinstance(payload, dict):
        updated = payload.get("UpdateTime")
        rows = payload.get("Stations")
        if isinstance(rows, list) and payload.get("Count") is not None and payload["Count"] > len(rows):
            raise ValueError("TDX 回應不完整；不可把分頁結果當作站點總數")
    else:
        rows = payload
    if not isinstance(rows, list):
        raise ValueError("TDX 回應缺少 Stations 陣列")
    unique = {}
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("充電站資料格式錯誤")
        name = row.get("StationName", "")
        name = name.get("Zh_tw", "") if isinstance(name, dict) else name
        address = (row.get("Location") or {}).get("Address") or {}
        uid = row.get("StationUID")
        if not uid:
            if not name or not row.get("OperatorID") or row.get("PositionLat") is None or row.get("PositionLon") is None:
                raise ValueError("充電站缺少可辨識的站名、業者與座標")
            identity = json.dumps([row["OperatorID"],name,row["PositionLat"],row["PositionLon"]],ensure_ascii=False)
            uid = hashlib.sha256(identity.encode()).hexdigest()[:20]
        if uid not in unique:
            unique[uid] = {"id":uid,"name":name or uid,
                           "city":address.get("City", row.get("City","")),
                           "town":address.get("Town", row.get("Town","")),
                           "address":"".join(address.get(key) or "" for key in ("City","Town","Road","Lane","Alley","No")) if address else row.get("Address",""),
                           "updatedAt":row.get("UpdateTime") or updated}
    return sorted(unique.values(), key=lambda row: row["id"])

def parse_feed(text: str) -> list[dict]:
    if "<!DOCTYPE" in text.upper() or "<!ENTITY" in text.upper():
        raise ValueError("不接受含實體宣告的 XML")
    root = ElementTree.fromstring(text)
    unique = {}
    for item in root.findall(".//item"):
        title, url = item.findtext("title", "").strip(), item.findtext("link", "").strip()
        if not re.search(r"Tesla|特斯拉|電動車|充電|電動汽車", title, re.I):
            continue
        validate_official_url(url)
        raw_date = item.findtext("pubDate", "")
        published = parsedate_to_datetime(raw_date).isoformat() if raw_date else None
        unique[url] = {"title":title,"url":url,"publishedAt":published,"publisher":"交通部公路局",
                       "category":"Tesla" if re.search(r"Tesla|特斯拉", title, re.I) else "政策"}
    return sorted(unique.values(), key=lambda row: row["publishedAt"] or "", reverse=True)[:40]
