import type { Metadata } from "next";
import "@fontsource/noto-sans-tc/400.css";
import "@fontsource/noto-sans-tc/500.css";
import "@fontsource/noto-sans-tc/600.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "Tesla Taiwan Observatory｜台灣特斯拉觀測站",
  description: "以官方資料理解特斯拉在台灣的掛牌趨勢、充電網絡與政策動態。每筆數據皆附來源與統計口徑。",
};
const RootLayout = ({ children }: Readonly<{ children: React.ReactNode }>) =>
  <html lang="zh-Hant"><body>{children}</body></html>;
export default RootLayout;
