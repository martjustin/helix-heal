import { test } from "@playwright/test";

test("ambiguous selectors are not patched", async ({ page }) => {
  await page.getByText("Sign in").click();
  await page.getByText("Sign in").click();
});
