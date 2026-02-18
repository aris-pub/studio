import { test, expect } from "./fixtures.js";

// @core

test("homepage loads successfully @core", async ({ page }) => {
  // For demo tests, test the demo route; for auth tests, test the home route
  const route = process.env.CI_TEST_TYPE === "demo" ? "/demo" : "/";
  await page.goto(route);
  await expect(page).toHaveTitle(/Aris/);
});
