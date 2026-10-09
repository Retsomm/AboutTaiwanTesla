import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    return process.env.NODE_ENV === "development" ?
      [{source: "/api/dashboard", destination: "http://127.0.0.1:8000/api/dashboard"},
       {source: "/api/health", destination: "http://127.0.0.1:8000/api/health"}] : [];
  },
};
export default config;
