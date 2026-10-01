import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  // The GitHub reporter annotates the diff; the list keeps the log readable.
  reporter: process.env.CI ? [["github"], ["list"]] : "list",

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // The studio renders through WebGL, which needs a software rasteriser
          // on headless CI machines.
          args: [
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        },
      },
    },
  ],

  webServer: {
    // Tests run against a production build: no compile-on-demand, and the build
    // output itself gets verified. Always rebuilt, so a stale server can never
    // make a run pass against old code.
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
