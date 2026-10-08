import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref } from "vue";
import { mount, flushPromises, RouterLinkStub } from "@vue/test-utils";

import InvitationView from "@/views/invitations/View.vue";
import AuthLayout from "@/components/layout/AuthLayout.vue";
import InputText from "@/components/forms/InputText.vue";
import PasswordInput from "@/components/forms/PasswordInput.vue";
import PasswordStrength from "@/components/ui/PasswordStrength.vue";
import Button from "@/components/base/Button.vue";

const pushMock = vi.fn();
vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useRouter: () => ({ push: pushMock }),
    useRoute: () => ({ params: { token: "tok-123" } }),
  };
});

const saveSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/auth/session.js", () => ({ saveSession: saveSessionMock }));
const createFileStoreMock = vi.hoisted(() => vi.fn(() => ({})));
vi.mock("@/store/FileStore.js", () => ({ createFileStore: createFileStoreMock }));

const META = {
  invited_email: "coauthor@example.com",
  file_title: "Doc",
  inviter_name: "Ana",
  role: "EDITOR",
};

function mountView(api) {
  return mount(InvitationView, {
    global: {
      components: { AuthLayout, InputText, PasswordInput, PasswordStrength, Button },
      stubs: { RouterLink: RouterLinkStub, Icon: true, LoadingSpinner: true },
      provide: { api, user: ref(null), fileStore: ref(null) },
    },
  });
}

describe("InvitationView", () => {
  beforeEach(() => {
    pushMock.mockClear();
    saveSessionMock.mockClear();
    createFileStoreMock.mockClear();
  });

  it("fetches the invitation and shows the prefilled form", async () => {
    const api = { get: vi.fn().mockResolvedValue({ data: META }), post: vi.fn() };
    const w = mountView(api);
    await flushPromises();

    expect(api.get).toHaveBeenCalledWith("/invitations/tok-123");
    expect(w.find('[data-testid="accept-button"]').exists()).toBe(true);
    expect(w.find('[data-testid="invited-email"]').exists()).toBe(true);
    expect(w.text()).toContain("Ana");
  });

  it("shows the right state for expired, used, and unknown tokens", async () => {
    for (const [status, testid] of [
      [410, "state-expired"],
      [409, "state-used"],
      [404, "state-invalid"],
    ]) {
      const api = { get: vi.fn().mockRejectedValue({ response: { status } }), post: vi.fn() };
      const w = mountView(api);
      await flushPromises();
      expect(w.find(`[data-testid="${testid}"]`).exists()).toBe(true);
      expect(w.find('[data-testid="accept-button"]').exists()).toBe(false);
    }
  });

  it("consumes, saves the session, and routes into the file", async () => {
    const api = {
      get: vi.fn().mockResolvedValue({ data: META }),
      post: vi.fn().mockResolvedValue({
        data: {
          access_token: "a",
          refresh_token: "r",
          file_id: 7,
          user: { id: 2, email: "coauthor@example.com", name: "New User" },
        },
      }),
    };
    const w = mountView(api);
    await flushPromises();

    await w.find('[data-testid="name-input"]').setValue("New User");
    await w.find('[data-testid="password-input"]').setValue("password123");
    await w.vm.onAccept();
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith("/invitations/tok-123/consume", {
      name: "New User",
      password: "password123",
    });
    expect(saveSessionMock).toHaveBeenCalledWith({
      accessToken: "a",
      refreshToken: "r",
      user: { id: 2, email: "coauthor@example.com", name: "New User" },
    });
    expect(pushMock).toHaveBeenCalledWith("/file/7");
  });

  it("falls into the used state if consume returns 409", async () => {
    const api = {
      get: vi.fn().mockResolvedValue({ data: META }),
      post: vi.fn().mockRejectedValue({ response: { status: 409 } }),
    };
    const w = mountView(api);
    await flushPromises();
    await w.vm.onAccept();
    await flushPromises();
    expect(w.find('[data-testid="state-used"]').exists()).toBe(true);
  });
});
