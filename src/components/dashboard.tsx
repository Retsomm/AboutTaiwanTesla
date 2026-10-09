"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, BarChart3, Bolt, Check,
  ChevronDown, Database, ExternalLink, FileText, Globe2, Info, LayoutDashboard,
  MapPin, RefreshCw, Search, ShieldCheck, TrendingUp, Zap,
} from "lucide-react";
import type { DashboardData, Registration } from "../types/dashboard";
import { formatNumber, formatPercent, formatTime, isStale, selectPeriod, selectRange, toCsv } from "../domain/selectors";
import { fetchDashboard } from "../services/dashboard";

type View = "overview" | "charging" | "news" | "sources";
const navigation = [
  { id: "overview" as const, label: "數據總覽", icon: LayoutDashboard },
  { id: "charging" as const, label: "充電網絡", icon: Zap },
  { id: "news" as const, label: "新聞與政策", icon: FileText },
  { id: "sources" as const, label: "資料來源", icon: Database },
];
const SourceLink = ({ href, children }: { href: string; children: React.ReactNode }) =>
  <a href={href} target="_blank" rel="noopener noreferrer" className="source-link">{children}<ArrowUpRight size={14} /></a>;

const Empty = ({ title, text, icon: Icon = Database }: { title: string; text: string; icon?: typeof Database }) =>
  <div className="empty-state"><span className="empty-icon"><Icon size={24} strokeWidth={1.5}/></span><h3>{title}</h3><p>{text}</p></div>;

const Status = ({ section }: { section: Pick<DashboardData["market"], "status" | "fetchedAt"> }) => {
  const stale = section.status === "stale" || (section.fetchedAt && isStale(section.fetchedAt, new Date().toISOString(), 48));
  return <span className={"status " + (section.status === "ok" && !stale ? "ready" : "pending")}><span />{stale ? "保留上次資料" : section.status === "ok" ? "已驗證來源" : "等待官方資料"}</span>;
};

const Metric = ({ label, value, unit, detail, icon: Icon, accent = false }: {
  label: string; value: string; unit?: string; detail: string; icon: typeof Database; accent?: boolean;
}) => <article className={"metric " + (accent ? "accent" : "")}><div className="metric-label">{label}<Icon size={18}/></div><div className="metric-value">{value}<span>{unit}</span></div><p>{detail}</p></article>;

const Trend = ({ rows, metric }: { rows: Registration[]; metric: "count" | "share" }) => {
  const valid = rows.filter((row) => row[metric] !== null);
  if (!valid.length) return <Empty title="趨勢將從第一筆官方資料開始" text="取得並驗證掛牌資料後，這裡會呈現月度趨勢。缺值不會補成零，也不會繪製推估數字。" icon={TrendingUp}/>;
  const values = valid.map((row) => row[metric] as number);
  const max = Math.max(...values, 1) * 1.12;
  const width = 760, height = 210, pad = 30;
  const x = (index: number) => pad + index / Math.max(valid.length - 1, 1) * (width - pad * 2);
  const y = (value: number) => height - pad - value / max * (height - pad * 2);
  const points = values.map((value, index) => x(index) + "," + y(value)).join(" ");
  return <div className="chart"><svg viewBox={"0 0 " + width + " " + height} role="img" aria-label={metric === "count" ? "Tesla 小客車月度掛牌趨勢" : "Tesla 小客車月度市占率趨勢"}>
    <defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dbe2ed" stopOpacity=".18"/><stop offset="100%" stopColor="#dbe2ed" stopOpacity="0"/></linearGradient></defs>
    {[0, .25, .5, .75, 1].map((fraction) => <g key={fraction}><line x1={pad} y1={y(max * fraction)} x2={width-pad} y2={y(max * fraction)} stroke="#303743" strokeDasharray="3 4"/><text x={pad} y={y(max * fraction)-6} fontSize="13" fill="#a7b3c5">{Math.round(max*fraction)}</text></g>)}
    <polygon points={pad + "," + (height-pad) + " " + points + " " + x(valid.length-1) + "," + (height-pad)} fill="url(#chart-fill)"/>
    <polyline points={points} fill="none" stroke="#e4eaf4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    {valid.map((row, index) => <g key={row.period}><circle cx={x(index)} cy={y(values[index])} r="4" fill="#e4eaf4"><title>{row.period + "：" + values[index] + (metric === "share" ? "%" : " 輛")}</title></circle><text x={x(index)} y={height-8} textAnchor="middle" fontSize="13" fill="#a7b3c5">{row.period.slice(2)}</text></g>)}
  </svg><p className="chart-note">缺漏月份不補值；完整數值請參閱下方資料表。單位：{metric === "count" ? "輛" : "%"}</p></div>;
};

export const Dashboard = ({ initialData }: { initialData: DashboardData }) => {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<View>("overview");
  const [period, setPeriod] = useState(initialData.registrations.rows.at(-1)?.period ?? "");
  const [range, setRange] = useState(12);
  const [metric, setMetric] = useState<"count" | "share">("count");
  const [query, setQuery] = useState("");
  const [newsFilter, setNewsFilter] = useState("全部");
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const latest = selectPeriod(data.registrations.rows, period);
  const rows = useMemo(() => selectRange(data.registrations.rows, range), [data.registrations.rows, range]);
  const stations = data.charging.rows.filter((station) => [station.name, station.city, station.town, station.address].join(" ").toLowerCase().includes(query.toLowerCase()));
  const news = data.news.rows.filter((item) => newsFilter === "全部" || item.category === newsFilter);
  const refresh = async () => {
    setRefreshing(true); setMessage("");
    try {
      const next = await fetchDashboard();
      setData(next);
      setPeriod((current) => next.registrations.rows.some((row) => row.period === current) ? current : next.registrations.rows.at(-1)?.period ?? "");
      setMessage("已讀取最新公開資料快照。來源資料由每日排程更新。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "更新失敗，已保留目前資料。"); }
    finally { setRefreshing(false); }
  };
  useEffect(() => {
    const controller = new AbortController();
    fetchDashboard(controller.signal).then((next) => {
      setData(next);
      setPeriod((current) => current || next.registrations.rows.at(-1)?.period || "");
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  const download = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "tesla-taiwan-registrations.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">跳到主要內容</a>
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="Tesla Taiwan Observatory 首頁"><span className="brand-mark">t<span>.</span></span><div>TESLA TAIWAN<small>OBSERVATORY</small></div></Link>
      <div className="sidebar-caption">台灣特斯拉觀測站</div>
      <nav aria-label="主要導覽">{navigation.map(({id, label, icon: Icon}) => <button key={id} onClick={() => setView(id)} className={view === id ? "nav-item active" : "nav-item"} aria-label={label} aria-current={view === id ? "page" : undefined}><Icon size={18} strokeWidth={1.7}/><span>{label}</span>{view === id && <span className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="trust-mark"><ShieldCheck size={20}/><span>數據有據可查<small>Open data. Clear perspective.</small></span></div><p>從官方資料出發，<br/>看見台灣電動車的下一步。</p><SourceLink href="https://github.com/Retsomm/AboutTaiwanTesla">開源專案</SourceLink></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">觀測站 <span>/</span> <strong>{navigation.find((item) => item.id === view)?.label}</strong></div><div className="topbar-right"><span className="region"><Globe2 size={14}/> TAIWAN · TW</span><span className="header-separator"/><span className="source-tag"><ShieldCheck size={14}/> 官方來源</span></div></header>
      <main id="main-content">
        <div className="page-heading"><div><p className="eyebrow">THE TAIWAN PERSPECTIVE</p><h1>{view === "overview" ? <>用數據，看見<span>Tesla 在台灣。</span></> : view === "charging" ? <>探索<span>充電網絡。</span></> : view === "news" ? <>掌握<span>新聞與政策。</span></> : <>每筆數據，<span>都有來處。</span></>}</h1><p className="heading-description">{view === "overview" ? "掛牌趨勢、充電建設與政策動態。一個更清楚的台灣特斯拉視角。" : view === "charging" ? "從交通部 TDX 公開資料，了解收錄的公共充電站。" : view === "news" ? "追蹤特斯拉與電動車政策的官方公告，直接閱讀第一手來源。" : "統計口徑、原始來源與更新紀錄，讓每個數字都能被核對。"}</p></div><button className="button secondary refresh-button" onClick={refresh} disabled={refreshing}><RefreshCw size={15} className={refreshing ? "spinning" : ""}/>{refreshing ? "讀取中" : "重新讀取"}</button></div>
        {message && <div role="status" className="notice">{message}</div>}
        <div className="data-strip"><span><span className="strip-dot"/> 官方資料 · 每日更新排程待啟用</span><span className="strip-update">最近檢查：{formatTime(data.generatedAt)}</span><button onClick={() => setView("sources")}>資料說明 <ArrowUpRight size={13}/></button></div>
        {view === "overview" && <>
          <section className="overview-header"><h2>市場概況 <span>MARKET SNAPSHOT</span></h2><label className="select-wrap"><span className="sr-only">統計月份</span><select aria-label="統計月份" value={period} onChange={(event) => setPeriod(event.target.value)} disabled={!data.registrations.rows.length}>{!data.registrations.rows.length && <option value="">等待官方月份</option>}{[...data.registrations.rows].reverse().map((row) => <option key={row.period} value={row.period}>{row.period.replace("-", " 年 ")} 月</option>)}</select><ChevronDown size={14}/></label></section>
          <section className="metrics-grid" aria-label="核心指標"><Metric label="Tesla 每月新領牌" value={formatNumber(latest?.count)} unit="輛" detail={latest ? period + " · 小客車，自用＋營業" : "等待按廠牌官方月資料"} icon={BarChart3} accent/><Metric label="小客車市場占有率" value={formatPercent(latest?.share)} detail="Tesla ÷ 同月份全市場小客車" icon={TrendingUp}/><Metric label="較上月變化" value={formatPercent(latest?.mom)} detail="僅比較連續月份，缺值不推估" icon={ArrowUpRight}/><Metric label="公開充電站" value={data.charging.fetchedAt ? formatNumber(data.charging.rows.length) : "—"} unit="站" detail={data.charging.scope} icon={Zap}/></section>
          <div className="content-grid">
            <section className="panel trend-panel"><div className="panel-heading"><div><h2>掛牌趨勢</h2><p>每個月，都是市場的一個切面。</p></div><div className="segmented" aria-label="趨勢期間">{[6,12,24].map((months) => <button key={months} className={range === months ? "selected" : ""} onClick={() => setRange(months)} aria-pressed={range === months}>{months} 個月</button>)}</div></div><div className="chart-toolbar"><div className="chart-tabs"><button onClick={() => setMetric("count")} className={metric === "count" ? "active" : ""}>掛牌數</button><button onClick={() => setMetric("share")} className={metric === "share" ? "active" : ""}>市占率</button></div><span className="legend"><span/> Tesla 小客車</span></div><Trend rows={rows} metric={metric}/><div className="panel-footer"><SourceLink href={data.registrations.sourceUrl}>交通部公路局</SourceLink><Status section={data.registrations}/></div></section>
            <aside className="insight-panel"><div className="insight-top"><span className="insight-icon"><Bolt size={20}/></span><span>READING THE DATA</span></div><h2>先理解數字，<br/>再理解市場。</h2><p>新領牌數反映當月新增車輛；保有量則是月底仍在籍的車輛。兩者代表不同的市場視角。</p><div className="insight-rule"/><div className="insight-detail"><span>本頁統計口徑</span><strong>小客車 · 自用＋營業</strong><small>市占率分母為全市場小客車，<br/>不是純電車市場。</small></div><button onClick={() => setView("sources")}>了解計算方式 <ArrowRight size={16}/></button><div className="insight-decoration" aria-hidden="true"><span/><span/><span/></div></aside>
          </div>
          <section className="panel records-panel"><div className="panel-heading"><div><h2>月度掛牌明細</h2><p>原始數字與計算結果，一起公開。</p></div><button className="button secondary" onClick={download} disabled={!rows.length}><ArrowDownToLine size={14}/>下載 CSV</button></div>{rows.length ? <div className="table-scroll"><table><caption className="sr-only">Tesla 台灣小客車月度新領牌明細</caption><thead><tr><th>統計月份</th><th>Tesla 新領牌</th><th>全市場小客車</th><th>市占率</th><th>月增率</th><th>年增率</th></tr></thead><tbody>{[...rows].reverse().map((row) => <tr key={row.period}><th scope="row">{row.period}</th><td>{formatNumber(row.count)}</td><td>{formatNumber(row.market)}</td><td>{formatPercent(row.share)}</td><td>{formatPercent(row.mom)}</td><td>{formatPercent(row.yoy)}</td></tr>)}</tbody></table></div> : <div className="table-empty"><Database size={17}/><span>等待官方資料</span><p>{data.registrations.error}。來源驗證完成後將自動顯示。</p></div>}</section>
          <section className="news-preview"><div className="overview-header"><h2>值得關注 <span>NEWS & POLICY</span></h2><button className="text-button" onClick={() => setView("news")}>查看全部 <ArrowRight size={15}/></button></div>{data.news.rows.length ? <div className="news-grid">{data.news.rows.slice(0,3).map((item) => <NewsCard key={item.url} item={item}/>)}</div> : <div className="news-resource-grid"><ResourceCard number="01" title="Tesla 台灣最新消息" text="品牌官方公告與產品資訊" href="https://www.tesla.com/zh_tw/blog"/><ResourceCard number="02" title="公路局新聞公告" text="交通政策、監理與車輛公告" href="https://www.thb.gov.tw/"/><ResourceCard number="03" title="政府開放資料" text="直接核對每月新車領牌統計" href="https://data.gov.tw/dataset/30202"/></div>}</section>
        </>}
        {view === "charging" && <section className="panel"><div className="panel-heading"><div><h2>公開充電站目錄</h2><p>{data.charging.scope}；不代表 Tesla 超級充電站總數。</p></div><Status section={data.charging}/></div><div className="search-field"><Search size={17}/><input placeholder="搜尋站名、地址或地區" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜尋充電站"/></div><div className="scope-note"><Info size={16}/><span>站點存在不等於車型相容。使用前請向營運商確認充電接頭、轉接器及開放條件。</span></div>{stations.length ? <div className="station-grid">{stations.map((station) => <article className="station-card" key={station.id}><MapPin size={21}/><h3>{station.name}</h3><p>{station.city} {station.town}</p><p>{station.address}</p><small>來源更新：{station.updatedAt ?? "未提供"}</small></article>)}</div> : <Empty title="尚無可用的充電站資料" text={query ? "沒有符合搜尋的已驗證站點。" : data.charging.error ?? "來源尚未成功擷取。" } icon={MapPin}/>}<div className="panel-footer"><SourceLink href={data.charging.sourceUrl}>TDX 官方 API 說明</SourceLink><span>{formatTime(data.charging.fetchedAt)}</span></div></section>}
        {view === "news" && <section><div className="news-controls"><div className="segmented">{["全部","Tesla","政策"].map((filter) => <button key={filter} className={newsFilter === filter ? "selected" : ""} aria-pressed={newsFilter === filter} onClick={() => setNewsFilter(filter)}>{filter}</button>)}</div><Status section={data.news}/></div>{news.length ? <div className="news-grid">{news.map((item) => <NewsCard key={item.url} item={item}/>)}</div> : <div className="panel"><Empty title="目前沒有可顯示的官方新聞" text={data.news.error ?? "來源目前沒有符合條件的特斯拉或電動車公告。"} icon={FileText}/></div>}<p className="footnote">本區只收錄來源標題、發布日期與原文連結。品牌公告與政府政策分別辨識，未經驗證的新聞不列入。</p></section>}
        {view === "sources" && <><div className="sources-grid">{[
          {key:"registrations" as const,title:"公路局｜按廠牌新領牌",detail:"特斯拉小客車月度新領牌數。需取得按廠牌分官方資料，不以媒體數字替代。"},
          {key:"market" as const,title:"公路局｜新車領牌數",detail:"政府資料集 30202。使用同月份的小客車總數作為市占率分母。"},
          {key:"charging" as const,title:"交通部｜TDX 充電樁",detail:data.charging.scope + "。OAuth 認證由 Python 伺服器端處理。"},
          {key:"news" as const,title:"公路局｜新聞 RSS",detail:"以特斯拉、電動車與充電關鍵字篩選官方公告，保留發布日期與原文。"},
        ].map(({key,title,detail}) => <article className="panel source-card" key={key}><div className="source-card-top"><Database size={21}/><Status section={data[key]}/></div><h2>{title}</h2><p>{detail}</p><dl><div><dt>成功擷取</dt><dd>{formatTime(data[key].fetchedAt)}</dd></div><div><dt>最近嘗試</dt><dd>{formatTime(data[key].attemptedAt)}</dd></div><div><dt>資料狀態</dt><dd>{data[key].error ?? "來源已通過格式檢查"}</dd></div></dl>{data[key].sha256 && <details><summary>原始檔 SHA-256</summary><code>{data[key].sha256}</code></details>}<SourceLink href={data[key].downloadUrl ?? data[key].sourceUrl}>前往官方來源</SourceLink></article>)}</div><section className="panel methodology"><h2>計算方式與更新原則</h2><div className="method-grid"><div><Check size={16}/><h3>市場占有率</h3><p>Tesla 小客車新領牌 ÷ 同月份全市場小客車新領牌 × 100%。缺少任一來源就不計算。</p></div><div><Check size={16}/><h3>月增率與年增率</h3><p>分別對照上一個日曆月、去年同月。前期缺值或為零時顯示「—」。</p></div><div><Check size={16}/><h3>每日檢查，依來源發布</h3><p>排程設定為每天台灣時間 08:23，待 GitHub 寫入授權與來源設定後啟用。統計資料依政府月度發布；新聞與站點依來源提供情況更新。</p></div><div><Check size={16}/><h3>更新失敗時保留資料</h3><p>保留上次成功快照與日期，標示過期狀態。未驗證的資料不進入統計。</p></div></div></section></>}
        <footer className="footer"><span>TESLA TAIWAN OBSERVATORY <span className="footer-year">© {new Date().getFullYear()}</span></span><span>獨立開源觀測站 · 非 Tesla 官方網站</span></footer>
      </main>
    </div>
  </div>;
};
const NewsCard = ({item}: {item:DashboardData["news"]["rows"][number]}) =>
  <article className="news-card"><span className="news-category">{item.category === "Tesla" ? "TESLA" : "POLICY"}</span><h3>{item.title}</h3><div className="news-meta"><span>{item.publisher} · {item.publishedAt ? formatTime(item.publishedAt) : "日期未提供"}</span><SourceLink href={item.url}>閱讀原文</SourceLink></div></article>;
const ResourceCard = ({number,title,text,href}:{number:string;title:string;text:string;href:string}) =>
  <a href={href} className="resource-card" target="_blank" rel="noopener noreferrer"><span className="resource-number">{number}</span><div><span className="resource-label">官方來源入口</span><h3>{title}</h3><p>{text}</p></div><ExternalLink size={17}/></a>;
