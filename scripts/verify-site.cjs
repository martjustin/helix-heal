const path = require("node:path");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const siteUrl = `file://${path.join(repoRoot, "site", "index.html").replace(/\\/g, "/")}`;

async function assertPage(page, viewportName) {
  await page.goto(siteUrl);
  await page.locator("h1", { hasText: "Helix Heal" }).waitFor();

  const imageLoaded = await page.locator('img[alt^="Helix Heal report preview"]').evaluate((img) => {
    return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
  });

  if (!imageLoaded) {
    throw new Error(`Preview image failed to load in ${viewportName} viewport`);
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  if (overflow) {
    throw new Error(`Horizontal overflow detected in ${viewportName} viewport`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  await assertPage(page, "desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await assertPage(page, "mobile");

  await browser.close();
  console.log("Site verification passed for desktop and mobile");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
