import { describe, it, expect, beforeEach } from "vitest";
import router from "@/router";

const signIn = () => {
  localStorage.setItem("accessToken", "token");
  localStorage.setItem("user", JSON.stringify({ id: 1, name: "Alice" }));
};

describe("router configuration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("contains the expected routes", () => {
    const paths = router.getRoutes().map((r) => r.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/login",
        "/register",
        "/",
        "/file/:file_id",
        "/account",
        "/settings",
        "/404",
        "/:pathMatch(.*)*",
      ])
    );
    const notFoundRoute = router.getRoutes().find((r) => r.name === "NotFound");
    expect(notFoundRoute).toBeDefined();
    expect(notFoundRoute.path).toBe("/404");
  });

  it("redirects to /login when navigating to an auth-protected route without token", async () => {
    await router.push("/account");
    expect(router.currentRoute.value.path).toBe("/login");
  });

  it("allows access to public pages without token", async () => {
    await router.push("/login");
    expect(router.currentRoute.value.path).toBe("/login");
    await router.push("/register");
    expect(router.currentRoute.value.path).toBe("/register");
  });

  it("allows access to protected routes when a full session is present", async () => {
    signIn();
    await router.push("/account");
    expect(router.currentRoute.value.path).toBe("/account");
    await router.push("/");
    expect(router.currentRoute.value.path).toBe("/");
  });

  it("redirects unknown routes to login without a session, and to NotFound with one", async () => {
    await router.push("/some/random/path");
    expect(router.currentRoute.value.path).toBe("/login");

    signIn();
    await router.push("/some/random/path");
    expect(router.currentRoute.value.name).toBe("NotFound");
    expect(router.currentRoute.value.path).toBe("/404");
  });

  describe("404 routing behavior", () => {
    beforeEach(() => {
      signIn();
    });

    it("should have a dedicated /404 route", () => {
      const routes = router.getRoutes();
      const notFoundRoute = routes.find((r) => r.path === "/404");
      expect(notFoundRoute).toBeDefined();
      expect(notFoundRoute.name).toBe("NotFound");
    });

    it("should navigate to /404 when NotFound route is pushed by name", async () => {
      await router.push({ name: "NotFound" });
      expect(router.currentRoute.value.path).toBe("/404");
      expect(router.currentRoute.value.name).toBe("NotFound");
    });

    it("should not redirect valid file routes to 404 immediately", async () => {
      await router.push("/file/123");
      expect(router.currentRoute.value.path).toBe("/file/123");
      expect(router.currentRoute.value.name).not.toBe("NotFound");
    });

    it("should preserve route parameters for file routes", async () => {
      await router.push("/file/456");
      expect(router.currentRoute.value.params.file_id).toBe("456");
    });
  });
});

// Regression: a stale access token with no usable stored user used to be enough
// to render a protected route, leaving the app-level user/fileStore refs null
// and crashing Avatar and the home filters (prod Sentry, 2026-09-04).
describe("router guard requires a usable session, not just a token", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("redirects to /login when a token is present but no user is stored", async () => {
    localStorage.setItem("accessToken", "token");
    await router.push("/");
    expect(router.currentRoute.value.path).toBe("/login");
  });

  it("redirects to /login when the stored user is not valid JSON", async () => {
    localStorage.setItem("accessToken", "token");
    localStorage.setItem("user", "{not json");
    await router.push("/");
    expect(router.currentRoute.value.path).toBe("/login");
  });

  it("redirects to /login when the stored user is the literal null", async () => {
    localStorage.setItem("accessToken", "token");
    localStorage.setItem("user", "null");
    await router.push("/");
    expect(router.currentRoute.value.path).toBe("/login");
  });

  it("clears the stale token so the next load starts logged out", async () => {
    localStorage.setItem("accessToken", "token");
    localStorage.setItem("refreshToken", "refresh");
    await router.push("/");
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
  });

  it("allows a protected route when both token and user are stored", async () => {
    localStorage.setItem("accessToken", "token");
    localStorage.setItem("user", JSON.stringify({ id: 1, name: "Alice" }));
    await router.push("/");
    expect(router.currentRoute.value.path).toBe("/");
  });
});
