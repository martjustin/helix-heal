const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const outputPath = path.join(repoRoot, "site", "assets", "helix-report-preview.png");

async function main() {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });

  await page.setContent(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 960px;
            display: grid;
            place-items: center;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #17202a;
            background:
              radial-gradient(circle at 78% 12%, rgba(23, 122, 100, 0.18), transparent 28%),
              linear-gradient(135deg, #f6f8fb 0%, #ffffff 48%, #eef4f1 100%);
          }

          .shell {
            width: 1180px;
            min-height: 720px;
            display: grid;
            grid-template-columns: 260px 1fr;
            overflow: hidden;
            border: 1px solid #dbe2ea;
            border-radius: 8px;
            background: #ffffff;
            box-shadow: 0 34px 90px rgba(23, 32, 42, 0.18);
          }

          aside {
            padding: 28px;
            background: #17202a;
            color: #f8fafc;
          }

          .mark {
            display: grid;
            place-items: center;
            width: 42px;
            height: 42px;
            margin-bottom: 28px;
            border-radius: 8px;
            background: #177a64;
            font-weight: 900;
          }

          .nav {
            display: grid;
            gap: 12px;
            margin-top: 38px;
          }

          .nav div {
            padding: 12px 14px;
            border-radius: 8px;
            color: #b9c3cf;
            background: rgba(255, 255, 255, 0.06);
          }

          main {
            padding: 34px;
            background: #f5f7fa;
          }

          header {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 24px;
          }

          h1 {
            margin: 0;
            font-size: 36px;
            letter-spacing: 0;
          }

          p {
            margin: 8px 0 0;
            color: #5d6875;
          }

          .badge {
            align-self: start;
            padding: 10px 12px;
            border: 1px solid #b7d7ce;
            border-radius: 8px;
            color: #177a64;
            background: #edf8f5;
            font-weight: 800;
          }

          .stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 18px;
          }

          .stat,
          .panel {
            border: 1px solid #dbe2ea;
            border-radius: 8px;
            background: #ffffff;
          }

          .stat {
            padding: 16px;
          }

          .stat span {
            color: #5d6875;
            font-size: 13px;
          }

          .stat strong {
            display: block;
            margin-top: 8px;
            font-size: 24px;
          }

          .grid {
            display: grid;
            grid-template-columns: 1.1fr 0.9fr;
            gap: 18px;
          }

          .panel {
            padding: 18px;
          }

          .panel h2 {
            margin: 0 0 16px;
            font-size: 19px;
            letter-spacing: 0;
          }

          .candidate {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 14px;
            padding: 14px 0;
            border-top: 1px solid #e7ecf2;
          }

          .candidate:first-of-type {
            border-top: 0;
          }

          code {
            color: #17202a;
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
            font-size: 13px;
          }

          .score {
            min-width: 68px;
            padding: 8px 10px;
            border-radius: 8px;
            color: #177a64;
            background: #edf8f5;
            text-align: center;
            font-weight: 900;
          }

          .warning {
            color: #a66a00;
            background: #fff7e8;
          }

          .timeline {
            display: grid;
            gap: 13px;
          }

          .timeline div {
            display: grid;
            grid-template-columns: 30px 1fr;
            align-items: center;
            gap: 10px;
            color: #384452;
          }

          .dot {
            display: grid;
            place-items: center;
            width: 30px;
            height: 30px;
            border-radius: 8px;
            color: #fff;
            background: #177a64;
            font-weight: 800;
          }

          .line {
            height: 12px;
            border-radius: 999px;
            background: #dbe2ea;
          }

          .line span {
            display: block;
            height: 100%;
            border-radius: inherit;
            background: #bd4f3c;
          }
        </style>
      </head>
      <body>
        <section class="shell" aria-label="Helix Heal report preview">
          <aside>
            <div class="mark">H</div>
            <h2>Helix Heal</h2>
            <p>Selector repair intelligence for Playwright suites.</p>
            <div class="nav">
              <div>Failed locators</div>
              <div>Candidate ranking</div>
              <div>Validation probes</div>
              <div>Patch preview</div>
            </div>
          </aside>
          <main>
            <header>
              <div>
                <h1>Healing report</h1>
                <p>checkout.spec.ts failed after a DOM refactor. Helix found stable replacements.</p>
              </div>
              <div class="badge">Ready for review</div>
            </header>
            <div class="stats">
              <div class="stat"><span>Confidence</span><strong>0.91</strong></div>
              <div class="stat"><span>Selectors healed</span><strong>3</strong></div>
              <div class="stat"><span>Probe result</span><strong>Pass</strong></div>
              <div class="stat"><span>Patch mode</span><strong>Dry run</strong></div>
            </div>
            <div class="grid">
              <section class="panel">
                <h2>Locator candidates</h2>
                <div class="candidate">
                  <div>
                    <strong>Replace brittle CSS selector</strong>
                    <p><code>.checkout-btn.primary:nth-child(2)</code></p>
                    <p><code>page.getByRole("button", { name: "Pay now" })</code></p>
                  </div>
                  <div class="score">0.94</div>
                </div>
                <div class="candidate">
                  <div>
                    <strong>Prefer explicit accessible label</strong>
                    <p><code>#shipping-email</code></p>
                    <p><code>page.getByLabel("Email address")</code></p>
                  </div>
                  <div class="score">0.89</div>
                </div>
                <div class="candidate">
                  <div>
                    <strong>Needs human review</strong>
                    <p><code>[data-test="promo-apply"]</code></p>
                    <p><code>page.getByRole("button", { name: /apply/i })</code></p>
                  </div>
                  <div class="score warning">0.71</div>
                </div>
              </section>
              <section class="panel">
                <h2>Validation pipeline</h2>
                <div class="timeline">
                  <div><span class="dot">1</span><span>Ingest Playwright report</span></div>
                  <div><span class="dot">2</span><span>Extract DOM snapshot</span></div>
                  <div><span class="dot">3</span><span>Rank locator candidates</span></div>
                  <div><span class="dot">4</span><span>Probe candidate live</span></div>
                  <div><span class="dot">5</span><span>Generate patch preview</span></div>
                </div>
                <p style="margin-top: 26px;">Patch confidence</p>
                <div class="line"><span style="width: 91%;"></span></div>
                <p style="margin-top: 18px;">CI minutes saved</p>
                <div class="line"><span style="width: 76%; background: #177a64;"></span></div>
              </section>
            </div>
          </main>
        </section>
      </body>
    </html>
  `);

  await page.screenshot({ path: outputPath, type: "png" });
  await browser.close();
  console.log(`Generated ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
