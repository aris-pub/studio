import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the toast service the same way the rest of the suite does.
vi.mock("@/utils/toast.js", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

import { toast } from "@/utils/toast.js";
import { formatRetryAfter, handleRateLimit, _resetRateLimitDedupe } from "@/utils/rateLimit.js";

function err(status, url, headers = {}) {
  return { response: { status, headers }, config: { url } };
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetRateLimitDedupe();
});

describe("formatRetryAfter", () => {
  it("returns empty string when the header is missing", () => {
    expect(formatRetryAfter(undefined)).toBe("");
    expect(formatRetryAfter("")).toBe("");
  });

  it("formats a seconds value under a minute", () => {
    expect(formatRetryAfter("30")).toBe("30 seconds");
    expect(formatRetryAfter("1")).toBe("1 second");
  });

  it("rounds up to whole minutes at or above 60 seconds", () => {
    expect(formatRetryAfter("60")).toBe("1 minute");
    expect(formatRetryAfter("90")).toBe("2 minutes");
  });

  it("handles an HTTP-date value in the future", () => {
    const future = new Date(Date.now() + 120 * 1000).toUTCString();
    expect(formatRetryAfter(future)).toBe("2 minutes");
  });

  it("returns empty string for a zero or past value", () => {
    expect(formatRetryAfter("0")).toBe("");
    const past = new Date(Date.now() - 5000).toUTCString();
    expect(formatRetryAfter(past)).toBe("");
  });
});

describe("handleRateLimit", () => {
  it("ignores non-429 errors and reports not handled", () => {
    expect(handleRateLimit(err(500, "/render"))).toBe(false);
    expect(handleRateLimit({})).toBe(false);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("shows a login-specific message with the retry time", () => {
    expect(
      handleRateLimit(err(429, "https://api.example.com/login", { "retry-after": "60" }))
    ).toBe(true);
    expect(toast.warning).toHaveBeenCalledWith("Too many login attempts. Try again in 1 minute.");
  });

  it("shows a sign-up message for register", () => {
    handleRateLimit(err(429, "/register", { "retry-after": "30" }));
    expect(toast.warning).toHaveBeenCalledWith(
      "Too many sign-up attempts. Try again in 30 seconds."
    );
  });

  it("shows a rendering message for render", () => {
    handleRateLimit(err(429, "/render", { "retry-after": "60" }));
    expect(toast.warning).toHaveBeenCalledWith(
      "Rendering paused: too many requests a minute. Resuming in 1 minute."
    );
  });

  it("shows a new-document message for the file create route", () => {
    handleRateLimit(err(429, "/files", { "retry-after": "60" }));
    expect(toast.warning).toHaveBeenCalledWith("Too many new documents. Try again in 1 minute.");
  });

  it("shows an uploads message for the asset route (not new-document)", () => {
    handleRateLimit(err(429, "/files/42/assets", { "retry-after": "60" }));
    expect(toast.warning).toHaveBeenCalledWith("Too many uploads. Try again in 1 minute.");
  });

  it("leaves an unknown route alone so a component can handle it inline", () => {
    expect(handleRateLimit(err(429, "/users/lookup", { "retry-after": "60" }))).toBe(false);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("shows a soft, retry-time-free message for collab/start", () => {
    handleRateLimit(err(429, "/collab/start", { "retry-after": "5" }));
    expect(toast.warning).toHaveBeenCalledWith("Live collaboration is catching up, one moment.");
  });

  it("falls back to a generic message when the Retry-After header is absent", () => {
    handleRateLimit(err(429, "/login"));
    expect(toast.warning).toHaveBeenCalledWith("Too many login attempts. Please slow down.");
  });

  it("does not repeat the same message within the dedupe window", () => {
    const e = err(429, "/render", { "retry-after": "60" });
    handleRateLimit(e);
    handleRateLimit(e);
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });
});
