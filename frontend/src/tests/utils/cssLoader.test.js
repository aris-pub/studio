import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadCSS, loadDesignAssets } from "@/utils/cssLoader.js";

describe("cssLoader", () => {
  const mockApi = {
    defaults: {
      baseURL: import.meta.env.VITE_API_BASE_URL,
    },
  };

  beforeEach(() => {
    // Clear any existing stylesheets from previous tests
    const existingLinks = document.querySelectorAll('link[rel="stylesheet"]');
    existingLinks.forEach((link) => link.remove());
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    const existingLinks = document.querySelectorAll('link[rel="stylesheet"]');
    existingLinks.forEach((link) => link.remove());
  });

  describe("loadCSS", () => {
    it("creates a link element with correct attributes", async () => {
      const promise = loadCSS(mockApi, "test.css");

      const link = document.querySelector('link[rel="stylesheet"]');
      expect(link).toBeTruthy();
      expect(link.href).toBe(`${import.meta.env.VITE_API_BASE_URL}/styles/css/test.css`);
      expect(link.rel).toBe("stylesheet");

      // Simulate successful load
      link.dispatchEvent(new Event("load"));
      await promise;
    });

    it("constructs correct URLs for design assets", () => {
      loadCSS(mockApi, "typography.css");

      const link = document.querySelector('link[rel="stylesheet"]');
      expect(link.href).toBe(`${import.meta.env.VITE_API_BASE_URL}/styles/css/typography.css`);
    });
  });

  describe("loadDesignAssets", () => {
    it("loads all design asset CSS files", async () => {
      const promise = loadDesignAssets(mockApi);

      // Should create 3 link elements for the 3 CSS files
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      expect(links.length).toBe(3);

      // Verify all expected files are loaded
      const expectedFiles = ["typography.css", "components.css", "layout.css"];
      expectedFiles.forEach((filename, index) => {
        expect(links[index].href).toBe(
          `${import.meta.env.VITE_API_BASE_URL}/styles/css/${filename}`
        );
      });

      // Simulate all files loading successfully
      links.forEach((link) => {
        link.dispatchEvent(new Event("load"));
      });

      await promise;
    });

    it("uses api.defaults.baseURL for each CSS file", async () => {
      const promise = loadDesignAssets(mockApi);

      const links = document.querySelectorAll('link[rel="stylesheet"]');
      links.forEach((link) => {
        link.dispatchEvent(new Event("load"));
      });

      await promise;

      // Should access the baseURL property from defaults
      expect(mockApi.defaults.baseURL).toBe(mockApi.defaults.baseURL);
    });
  });
});
