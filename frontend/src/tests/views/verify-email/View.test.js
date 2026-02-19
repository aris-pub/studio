import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { nextTick } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import Button from "@/components/base/Button.vue";
import Icon from "@/components/base/Icon.vue";
import LoadingSpinner from "@/components/base/LoadingSpinner.vue";

const pushMock = vi.fn();
const TOKEN = "test-token-abc123";

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: pushMock }),
  useRoute: () => ({ params: { token: TOKEN } }),
}));

// Imported after mocks are in place
const { default: VerifyEmailView } = await import("@/views/verify-email/View.vue");

function mountView(apiPost) {
  return mount(VerifyEmailView, {
    global: {
      components: { Button, Icon, LoadingSpinner },
      provide: { api: { post: apiPost } },
    },
    attachTo: document.body,
  });
}

describe("VerifyEmailView", () => {
  beforeEach(() => {
    pushMock.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  it("shows loading state immediately on mount before API resolves", () => {
    // Never resolves during this test
    const apiPost = vi.fn(() => new Promise(() => {}));
    const wrapper = mountView(apiPost);

    expect(wrapper.find('[data-testid="state-loading"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="state-success"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="state-already-verified"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="state-error"]').exists()).toBe(false);
  });

  it("calls the verify-email API with the token from the route", async () => {
    const apiPost = vi.fn().mockResolvedValue({});
    mountView(apiPost);
    await flushPromises();

    expect(apiPost).toHaveBeenCalledWith(`/users/verify-email/${TOKEN}`);
  });

  // ---------------------------------------------------------------------------
  // Success state
  // ---------------------------------------------------------------------------

  it("shows success state when API resolves", async () => {
    const wrapper = mountView(vi.fn().mockResolvedValue({}));
    await flushPromises();

    expect(wrapper.find('[data-testid="state-loading"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="state-success"]').exists()).toBe(true);
  });

  it("renders correct heading and body copy in success state", async () => {
    const wrapper = mountView(vi.fn().mockResolvedValue({}));
    await flushPromises();

    const el = wrapper.find('[data-testid="state-success"]');
    expect(el.find("h2").text()).toBe("Email verified");
    expect(el.find("p").text()).toContain("confirmed");
  });

  it("updates localStorage user.email_verified on success when user exists", async () => {
    localStorage.setItem("user", JSON.stringify({ id: 1, email_verified: false }));
    mountView(vi.fn().mockResolvedValue({}));
    await flushPromises();

    const stored = JSON.parse(localStorage.getItem("user"));
    expect(stored.email_verified).toBe(true);
  });

  it("does not throw if localStorage has no user on success", async () => {
    const wrapper = mountView(vi.fn().mockResolvedValue({}));
    await expect(flushPromises()).resolves.not.toThrow();
    expect(wrapper.find('[data-testid="state-success"]').exists()).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Auth-aware CTA — success state
  // ---------------------------------------------------------------------------

  it("shows 'Open Studio' CTA when authenticated", async () => {
    localStorage.setItem("accessToken", "some-jwt");
    const wrapper = mountView(vi.fn().mockResolvedValue({}));
    await flushPromises();

    const btn = wrapper.find('[data-testid="cta-primary"]');
    expect(btn.text()).toContain("Open Studio");
  });

  it("shows 'Sign in' CTA when not authenticated", async () => {
    const wrapper = mountView(vi.fn().mockResolvedValue({}));
    await flushPromises();

    const btn = wrapper.find('[data-testid="cta-primary"]');
    expect(btn.text()).toContain("Sign in");
  });

  it("navigates to / when authenticated and CTA clicked", async () => {
    localStorage.setItem("accessToken", "some-jwt");
    const wrapper = mountView(vi.fn().mockResolvedValue({}));
    await flushPromises();

    await wrapper.find('[data-testid="cta-primary"]').trigger("click");
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  it("navigates to /login when unauthenticated and CTA clicked", async () => {
    const wrapper = mountView(vi.fn().mockResolvedValue({}));
    await flushPromises();

    await wrapper.find('[data-testid="cta-primary"]').trigger("click");
    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  // ---------------------------------------------------------------------------
  // Already verified state (400)
  // ---------------------------------------------------------------------------

  it("shows already-verified state on 400", async () => {
    const err = { response: { status: 400 } };
    const wrapper = mountView(vi.fn().mockRejectedValue(err));
    await flushPromises();

    expect(wrapper.find('[data-testid="state-already-verified"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="state-loading"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="state-error"]').exists()).toBe(false);
  });

  it("renders correct heading in already-verified state", async () => {
    const err = { response: { status: 400 } };
    const wrapper = mountView(vi.fn().mockRejectedValue(err));
    await flushPromises();

    expect(wrapper.find('[data-testid="state-already-verified"]').find("h2").text()).toBe(
      "Already verified"
    );
  });

  it("shows auth-aware CTA in already-verified state", async () => {
    localStorage.setItem("accessToken", "some-jwt");
    const err = { response: { status: 400 } };
    const wrapper = mountView(vi.fn().mockRejectedValue(err));
    await flushPromises();

    expect(wrapper.find('[data-testid="cta-primary"]').text()).toContain("Open Studio");
  });

  // ---------------------------------------------------------------------------
  // Expired / invalid token state (404)
  // ---------------------------------------------------------------------------

  it("shows error state on 404", async () => {
    const err = { response: { status: 404 } };
    const wrapper = mountView(vi.fn().mockRejectedValue(err));
    await flushPromises();

    expect(wrapper.find('[data-testid="state-error"]').exists()).toBe(true);
  });

  it("shows error state on unexpected error", async () => {
    const wrapper = mountView(vi.fn().mockRejectedValue(new Error("Network error")));
    await flushPromises();

    expect(wrapper.find('[data-testid="state-error"]').exists()).toBe(true);
  });

  it("renders correct heading and body in error state", async () => {
    const err = { response: { status: 404 } };
    const wrapper = mountView(vi.fn().mockRejectedValue(err));
    await flushPromises();

    const el = wrapper.find('[data-testid="state-error"]');
    expect(el.find("h2").text()).toBe("Link expired");
    expect(el.find("p").text()).toContain("account settings");
  });

  it("renders account settings and home buttons in error state", async () => {
    const err = { response: { status: 404 } };
    const wrapper = mountView(vi.fn().mockRejectedValue(err));
    await flushPromises();

    expect(wrapper.find('[data-testid="cta-primary"]').text()).toContain("account settings");
    expect(wrapper.find('[data-testid="cta-secondary"]').text()).toContain("home");
  });

  it("navigates to /account/security when primary error CTA clicked", async () => {
    const err = { response: { status: 404 } };
    const wrapper = mountView(vi.fn().mockRejectedValue(err));
    await flushPromises();

    await wrapper.find('[data-testid="cta-primary"]').trigger("click");
    expect(pushMock).toHaveBeenCalledWith("/account/security");
  });

  it("navigates to / when secondary error CTA clicked", async () => {
    const err = { response: { status: 404 } };
    const wrapper = mountView(vi.fn().mockRejectedValue(err));
    await flushPromises();

    await wrapper.find('[data-testid="cta-secondary"]').trigger("click");
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  // ---------------------------------------------------------------------------
  // No unintended side effects
  // ---------------------------------------------------------------------------

  it("does not modify localStorage on error", async () => {
    localStorage.setItem("user", JSON.stringify({ id: 1, email_verified: false }));
    const err = { response: { status: 404 } };
    mountView(vi.fn().mockRejectedValue(err));
    await flushPromises();

    const stored = JSON.parse(localStorage.getItem("user"));
    expect(stored.email_verified).toBe(false);
  });
});
