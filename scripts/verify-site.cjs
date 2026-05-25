const path = require("node:path");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const siteUrl = process.env.HELIX_SITE_URL || `file://${path.join(repoRoot, "site", "index.html").replace(/\\/g, "/")}`;

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

  const accessibilityIssues = await page.evaluate(() => {
    const issues = [];
    const hasName = (element) => {
      const text = element.textContent?.trim();
      return Boolean(text || element.getAttribute("aria-label") || element.getAttribute("title"));
    };

    if (!document.querySelector("main")) {
      issues.push("Missing main landmark");
    }

    if (!document.querySelector("nav[aria-label]")) {
      issues.push("Primary navigation needs an accessible label");
    }

    document.querySelectorAll("a, button").forEach((element) => {
      if (!hasName(element)) {
        issues.push(`Interactive element lacks accessible name: ${element.tagName.toLowerCase()}`);
      }
    });

    document.querySelectorAll("img").forEach((image) => {
      if (!image.getAttribute("alt")) {
        issues.push(`Image is missing alt text: ${image.getAttribute("src") || "unknown source"}`);
      }
    });

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      const href = link.getAttribute("href");
      if (href && href !== "#" && !document.querySelector(href)) {
        issues.push(`Internal link target missing: ${href}`);
      }
    });

    const luminance = (rgb) => {
      const values = rgb.map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
    };

    const parseRgb = (color) => {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
    };

    const contrastRatio = (foreground, background) => {
      const fg = parseRgb(foreground);
      const bg = parseRgb(background);
      if (!fg || !bg) return null;
      const light = Math.max(luminance(fg), luminance(bg));
      const dark = Math.min(luminance(fg), luminance(bg));
      return (light + 0.05) / (dark + 0.05);
    };

    const samples = [
      document.querySelector(".intro p:not(.eyebrow)"),
      document.querySelector(".kpi-card p"),
      document.querySelector("nav a"),
      document.querySelector(".module-heading p"),
      document.querySelector("pre"),
    ].filter(Boolean);

    samples.forEach((element) => {
      const style = window.getComputedStyle(element);
      let background = style.backgroundColor;
      let parent = element.parentElement;

      while (parent && (background === "rgba(0, 0, 0, 0)" || background === "transparent")) {
        background = window.getComputedStyle(parent).backgroundColor;
        parent = parent.parentElement;
      }

      const ratio = contrastRatio(style.color, background);
      if (ratio !== null && ratio < 4.5) {
        issues.push(`Low text contrast on ${element.tagName.toLowerCase()}: ${ratio.toFixed(2)}`);
      }
    });

    return issues;
  });

  if (accessibilityIssues.length > 0) {
    throw new Error(`Accessibility/usability issues in ${viewportName} viewport:\n${accessibilityIssues.join("\n")}`);
  }

  if (viewportName === "desktop") {
    const beforeColumns = await page.locator(".app-shell").evaluate((element) => {
      return window.getComputedStyle(element).gridTemplateColumns;
    });
    await page.locator("[data-nav-toggle]").click();
    const afterColumns = await page.locator(".app-shell").evaluate((element) => {
      return window.getComputedStyle(element).gridTemplateColumns;
    });
    const isCollapsed = await page.evaluate(() => document.body.classList.contains("nav-collapsed"));

    if (!isCollapsed || beforeColumns === afterColumns) {
      throw new Error("Navigation collapse control did not change layout state");
    }

    await page.locator("[data-nav-toggle]").click();

    await page.locator("[data-module-search]").fill("validation");
    const visibleAfterSearch = await page.locator("[data-searchable]:visible").count();
    const validationVisible = await page.locator("article", { hasText: "Validation Probe" }).isVisible();

    if (visibleAfterSearch < 1 || !validationVisible) {
      throw new Error("Module search did not surface the validation module");
    }

    await page.locator("[data-module-search]").fill("no-such-module");
    const emptyVisible = await page.locator("[data-empty-state]").isVisible();

    if (!emptyVisible) {
      throw new Error("Module search empty state did not appear");
    }

    await page.locator("[data-module-search]").fill("");

    await page.evaluate(() => {
      for (const selector of ['[data-analytics="install_click"]', '[data-analytics="repo_click"]']) {
        const element = document.querySelector(selector);
        element?.addEventListener("click", (event) => event.preventDefault(), { once: true });
        element?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      }
    });
    const analyticsEvents = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem("helix_analytics_events") || "[]").map((event) => event.event);
    });

    for (const expectedEvent of ["page_view", "install_click", "repo_click"]) {
      if (!analyticsEvents.includes(expectedEvent)) {
        throw new Error(`Analytics event was not recorded: ${expectedEvent}`);
      }
    }
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  await assertPage(page, "desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await assertPage(page, "mobile");

  await browser.close();
  console.log(`Site E2E usability and accessibility verification passed for desktop and mobile: ${siteUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
