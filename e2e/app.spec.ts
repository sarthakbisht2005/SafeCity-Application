import { expect, test } from "@playwright/test";

test("the app renders its root route", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("MySafeCity");
  await expect(page.getByRole("heading", { name: /Safer Together/ })).toBeVisible();
});