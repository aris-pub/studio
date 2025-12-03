import { test, expect } from "@playwright/test";
import { AuthHelpers } from "./utils/auth-helpers.js";

// Minimal RSM source with just one inline math expression
const MINIMAL_SOURCE = `:rsm:
# Title

Math: $x^2$

::`;

test("mjx-container nesting bug - minimal repro @auth", async ({ page, request }) => {
  const baseURL = process.env.VITE_API_BASE_URL;
  if (!baseURL) throw new Error("VITE_API_BASE_URL required");

  // Capture console logs
  page.on("console", (msg) => {
    if (msg.text().includes("[typesetMath]") ||
        msg.text().includes("[onload]") ||
        msg.text().includes("[onrender]") ||
        msg.text().includes("[executeRender]") ||
        msg.text().includes("span.math")) {
      console.log("BROWSER:", msg.text());
    }
  });

  const authHelpers = new AuthHelpers(page);
  await authHelpers.ensureLoggedIn();

  const accessToken = await page.evaluate(() => localStorage.getItem("accessToken"));
  const userData = await page.evaluate(() => JSON.parse(localStorage.getItem("user")));

  // Create test file via API
  const createResponse = await request.post(`${baseURL}/files`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { title: "Minimal Math Test", owner_id: userData.id, source: MINIMAL_SOURCE },
  });
  const fileId = (await createResponse.json()).id;

  try {
    // Navigate and wait for render
    await page.goto(`/file/${fileId}`);
    await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({ timeout: 10000 });
    await page.waitForFunction(() => document.querySelectorAll("mjx-container").length > 0, { timeout: 10000 });

    // Count initial state with structure
    const initial = await page.evaluate(() => {
      const containers = document.querySelectorAll("mjx-container");
      const structure = Array.from(containers).map(c => ({
        parent: c.parentElement?.tagName + '.' + c.parentElement?.className,
      }));
      return {
        total: containers.length,
        nested: document.querySelectorAll("mjx-container mjx-container").length,
        structure,
      };
    });
    console.log("INITIAL:", JSON.stringify(initial));

    // Open editor and make a trivial edit to the title
    await page.locator(".sb-item").filter({ hasText: "source" }).click();
    await expect(page.locator("textarea.editor")).toBeVisible({ timeout: 5000 });
    await page.locator("textarea.editor").click();
    await page.keyboard.press("Control+Home");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("End");
    await page.keyboard.type(" edited");

    // Wait for re-render
    await page.waitForTimeout(4000);

    // Count after edit and inspect structure
    const afterEdit = await page.evaluate(() => {
      const containers = document.querySelectorAll("mjx-container");
      const structure = Array.from(containers).map(c => ({
        parent: c.parentElement?.tagName + '.' + c.parentElement?.className,
        hasNestedContainer: c.querySelector('mjx-container') !== null,
      }));
      return {
        total: containers.length,
        nested: document.querySelectorAll("mjx-container mjx-container").length,
        structure,
      };
    });
    console.log("AFTER EDIT:", JSON.stringify(afterEdit));

    // Check for VISUAL duplication (ignoring assistive MathML)
    const visualContainers = await page.evaluate(() => {
      // Count only top-level mjx-containers (not inside mjx-assistive-mml)
      return document.querySelectorAll("span.math > mjx-container, div.mathblock mjx-container:not(mjx-assistive-mml mjx-container)").length;
    });
    console.log("VISUAL CONTAINERS:", visualContainers);

    // The real bug: visual containers should equal initial count
    expect(visualContainers).toBe(1);

  } finally {
    await request.delete(`${baseURL}/files/${fileId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
});
