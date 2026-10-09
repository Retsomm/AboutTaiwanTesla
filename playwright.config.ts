import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:3000", browserName: "chromium" },
  webServer: [
    {command:"python python/dev_server.py", url:"http://127.0.0.1:8000/api/health",reuseExistingServer:!process.env.CI},
    {command:"NEXT_DIST_DIR=.next-e2e corepack yarn dev --hostname 127.0.0.1", url:"http://127.0.0.1:3000",reuseExistingServer:!process.env.CI},
  ],
});
