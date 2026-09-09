import { describe, it, expect, beforeEach } from "vitest";
import { readSession, saveSession, clearSession } from "@/auth/session.js";

describe("session", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("readSession", () => {
    it("returns null with nothing stored", () => {
      expect(readSession()).toBeNull();
    });

    it("returns null with a token but no user", () => {
      localStorage.setItem("accessToken", "token");
      expect(readSession()).toBeNull();
    });

    it("returns null with a user but no token", () => {
      localStorage.setItem("user", JSON.stringify({ id: 1 }));
      expect(readSession()).toBeNull();
    });

    it("returns null when the token is only whitespace", () => {
      localStorage.setItem("accessToken", "   ");
      localStorage.setItem("user", JSON.stringify({ id: 1 }));
      expect(readSession()).toBeNull();
    });

    it("returns null when the stored user is not valid JSON", () => {
      localStorage.setItem("accessToken", "token");
      localStorage.setItem("user", "{not json");
      expect(readSession()).toBeNull();
    });

    it("returns null when the stored user is the literal null", () => {
      localStorage.setItem("accessToken", "token");
      localStorage.setItem("user", "null");
      expect(readSession()).toBeNull();
    });

    it("returns null when the stored user is not an object", () => {
      localStorage.setItem("accessToken", "token");
      localStorage.setItem("user", '"alice"');
      expect(readSession()).toBeNull();
    });

    it("returns the session when token and user are both stored", () => {
      localStorage.setItem("accessToken", "token");
      localStorage.setItem("refreshToken", "refresh");
      localStorage.setItem("user", JSON.stringify({ id: 1, name: "Alice" }));

      expect(readSession()).toEqual({
        token: "token",
        refreshToken: "refresh",
        user: { id: 1, name: "Alice" },
      });
    });
  });

  describe("saveSession", () => {
    it("writes all three keys together", () => {
      saveSession({ accessToken: "at", refreshToken: "rt", user: { id: 1 } });

      expect(localStorage.getItem("accessToken")).toBe("at");
      expect(localStorage.getItem("refreshToken")).toBe("rt");
      expect(JSON.parse(localStorage.getItem("user"))).toEqual({ id: 1 });
    });

    it("refuses to write a token with no user", () => {
      expect(() => saveSession({ accessToken: "at", refreshToken: "rt", user: null })).toThrow();
      expect(localStorage.getItem("accessToken")).toBeNull();
    });

    it("refuses to write a user with no token", () => {
      expect(() => saveSession({ accessToken: "", user: { id: 1 } })).toThrow();
      expect(localStorage.getItem("user")).toBeNull();
    });

    it("round-trips through readSession", () => {
      saveSession({ accessToken: "at", refreshToken: "rt", user: { id: 7, name: "Bob" } });
      expect(readSession().user).toEqual({ id: 7, name: "Bob" });
    });
  });

  describe("clearSession", () => {
    it("removes all three keys", () => {
      saveSession({ accessToken: "at", refreshToken: "rt", user: { id: 1 } });
      clearSession();

      expect(localStorage.getItem("accessToken")).toBeNull();
      expect(localStorage.getItem("refreshToken")).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
      expect(readSession()).toBeNull();
    });
  });
});
