import { test, expect } from "@playwright/test";

test("user can sign in", async ({ page }) => {
  await page.setContent(`
      <main>
        <h1>Welcome back</h1>
        <button aria-label="Log in" data-testid="login-submit">Log in</button>
      </main>
  `);

  await page.getByText("Sign in").click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});
