import { test, expect } from "./fixtures.js";
import { AuthHelpers } from "./utils/auth-helpers.js";
import { getTimeouts } from "./utils/timeout-constants.js";

// Smoke for the magic-link invitation landing (std-nbpwwn). One case hits the
// real backend to prove the public route and view are wired end to end; the
// rest mock the invitation endpoint to exercise each landing state, matching
// how email-verification.spec.js covers the sibling flow. All @auth-flows.
const META = {
  invited_email: "coauthor-e2e@example.com",
  file_title: "Shared draft",
  inviter_name: "Ana",
  role: "EDITOR",
};

// The invitation API calls go out as XHR. A path match on /invitations/ alone
// would also catch the SPA document and the dynamically imported view module
// (/src/views/invitations/View.vue), serving them as JSON and breaking the
// page, so only the XHR/fetch calls are mocked.
function isApiCall(request) {
  const type = request.resourceType();
  return type === "fetch" || type === "xhr";
}

async function mockInvitationGet(page, { status, body }) {
  await page.route("**/invitations/**", (route) => {
    const req = route.request();
    if (!isApiCall(req) || req.method() !== "GET") return route.fallback();
    return route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test.describe("Magic-link invitation flow @auth-flows", () => {
  test.beforeEach(async ({ page }) => {
    const authHelpers = new AuthHelpers(page);
    await page.goto("/");
    await authHelpers.clearAuthState();
  });

  test("shows the not-found state for a bogus token against the real backend @auth-flows", async ({
    page,
  }) => {
    const timeouts = getTimeouts();

    await page.goto("/invitations/this-token-does-not-exist");

    await expect(page.locator('[data-testid="state-invalid"]')).toBeVisible({
      timeout: timeouts.contentLoad,
    });
    await expect(page.locator('[data-testid="cta-signin"]')).toBeVisible();
    await expect(page.locator('[data-testid="accept-button"]')).toHaveCount(0);
  });

  test("renders the prefilled signup and strips the token from the URL @auth-flows", async ({
    page,
  }) => {
    const timeouts = getTimeouts();

    await mockInvitationGet(page, { status: 200, body: META });

    await page.goto("/invitations/good-token");

    await expect(page.locator('[data-testid="accept-button"]')).toBeVisible({
      timeout: timeouts.contentLoad,
    });
    await expect(page.locator('[data-testid="invited-email"]')).toHaveValue(META.invited_email);
    await expect(page.locator('[data-testid="invited-email"]')).toBeDisabled();
    // The token must not survive in the address bar.
    await expect(page).toHaveURL(/\/invitations\/?$/);
  });

  test("shows the expired state when the backend returns 410 @auth-flows", async ({ page }) => {
    const timeouts = getTimeouts();

    await mockInvitationGet(page, { status: 410, body: { detail: "expired" } });

    await page.goto("/invitations/expired-token");

    await expect(page.locator('[data-testid="state-expired"]')).toBeVisible({
      timeout: timeouts.contentLoad,
    });
  });

  test("consumes the invite and signs the new user in @auth-flows", async ({ page }) => {
    const timeouts = getTimeouts();

    await page.route("**/invitations/**", (route) => {
      const req = route.request();
      if (!isApiCall(req)) return route.fallback();
      if (req.method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(META),
        });
      }
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "e2e-access",
          refresh_token: "e2e-refresh",
          file_id: 1,
          user: { id: 123, email: META.invited_email, name: "Coauthor E2E", email_verified: false },
        }),
      });
    });
    // Keep the file view the consume redirects into from bouncing the smoke on a 401.
    await page.route("**/files/**", (route) => {
      if (!isApiCall(route.request())) return route.fallback();
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.goto("/invitations/good-token");

    await expect(page.locator('[data-testid="accept-button"]')).toBeVisible({
      timeout: timeouts.contentLoad,
    });
    await page.fill('[data-testid="name-input"]', "Coauthor E2E");
    await page.fill('[data-testid="password-input"]', "supersecret123");

    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/invitations/") &&
          r.url().includes("/consume") &&
          r.request().method() === "POST"
      ),
      page.click('[data-testid="accept-button"]'),
    ]);

    // saveSession wrote the full session, which is what lets protected routes render.
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("accessToken")), {
        timeout: timeouts.navigation,
      })
      .toBe("e2e-access");
    const user = await page.evaluate(() => JSON.parse(localStorage.getItem("user") || "null"));
    expect(user?.email).toBe(META.invited_email);
  });
});
