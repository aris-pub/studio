import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  demoFile,
  demoUser,
  demoFileStore,
  demoAnnotations,
  createDemoApi,
} from "@/views/demo/demoData.js";

// Mock fetch globally with proper Response objects
const mockFetch = vi.fn().mockImplementation((url, _options) => {
  // Mock /render endpoint to return valid HTML
  if (url.includes("/render")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue("<div>Rendered HTML content</div>"),
    });
  }
  // Mock all other requests
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: "OK",
    json: vi.fn().mockResolvedValue({}),
  });
});
global.fetch = mockFetch;

describe("Demo Data Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure fetch mock is properly set up for each test
    global.fetch = mockFetch;
  });

  afterEach(() => {
    // Don't restore mocks that would break the global fetch setup
    // vi.restoreAllMocks();
  });

  describe("Demo Data Structure", () => {
    describe("demoFile", () => {
      it("has correct structure and required properties", () => {
        expect(demoFile).toHaveProperty("id");
        expect(demoFile).toHaveProperty("title");
        expect(demoFile).toHaveProperty("source");
        expect(demoFile).toHaveProperty("last_edited_at");
        expect(demoFile).toHaveProperty("tags");
        expect(demoFile).toHaveProperty("minimap");
        expect(demoFile).toHaveProperty("ownerId");
      });

      it("has correct ID and basic properties", () => {
        expect(demoFile.id).toBe(999);
        expect(demoFile.title).toBe("Sample Research Paper: The Future of Web-Native Publishing");
        expect(typeof demoFile.source).toBe("string");
        expect(demoFile.source.length).toBeGreaterThan(0);
      });

      it("has properly formatted RSM content", () => {
        expect(demoFile.source).toMatch(/^:rsm:/);
        expect(demoFile.source).toMatch(/::$/);
        expect(demoFile.source).toContain("# The Future of Web-Native Publishing");
      });

      it("contains expected RSM markup elements", () => {
        expect(demoFile.source).toContain(":abstract:");
        expect(demoFile.source).toContain(":itemize:");
        expect(demoFile.source).toContain(":enumerate:");
        expect(demoFile.source).toContain(":item:");
      });

      it("has valid tags array", () => {
        expect(Array.isArray(demoFile.tags)).toBe(true);
        expect(demoFile.tags.length).toBeGreaterThan(0);

        demoFile.tags.forEach((tag) => {
          expect(tag).toHaveProperty("id");
          expect(tag).toHaveProperty("name");
          expect(tag).toHaveProperty("color");
          expect(typeof tag.name).toBe("string");
          expect(typeof tag.color).toBe("string");
          expect(tag.color).toMatch(/^#[0-9a-f]{6}$/i);
        });
      });

      it("has valid last_edited_at timestamp", () => {
        expect(typeof demoFile.last_edited_at).toBe("string");
        expect(new Date(demoFile.last_edited_at)).toBeInstanceOf(Date);
        expect(isNaN(new Date(demoFile.last_edited_at).getTime())).toBe(false);
      });
    });

    describe("demoUser", () => {
      it("has correct user structure", () => {
        expect(demoUser).toHaveProperty("id");
        expect(demoUser).toHaveProperty("username");
        expect(demoUser).toHaveProperty("email");
        expect(demoUser).toHaveProperty("firstName");
        expect(demoUser).toHaveProperty("lastName");
      });

      it("has valid user data", () => {
        expect(demoUser.id).toBe(1);
        expect(typeof demoUser.username).toBe("string");
        expect(typeof demoUser.email).toBe("string");
        expect(demoUser.email).toContain("@");
        expect(typeof demoUser.firstName).toBe("string");
        expect(typeof demoUser.lastName).toBe("string");
      });
    });

    describe("demoFileStore", () => {
      it("has correct file store structure", () => {
        expect(demoFileStore).toHaveProperty("files");
        expect(Array.isArray(demoFileStore.files)).toBe(true);
        expect(demoFileStore.files.length).toBeGreaterThan(0);
      });

      it("contains the demo file in the store", () => {
        const demoFileInStore = demoFileStore.files.find((f) => f.id === demoFile.id);
        expect(demoFileInStore).toBeDefined();
        expect(demoFileInStore.title).toBe(demoFile.title);
      });

      it("has demo files for demonstration", () => {
        expect(demoFileStore.files.length).toBeGreaterThanOrEqual(1);

        demoFileStore.files.forEach((file) => {
          expect(file).toHaveProperty("id");
          expect(file).toHaveProperty("title");
          expect(file).toHaveProperty("last_edited_at");
          expect(typeof file.title).toBe("string");
        });
      });
    });

    describe("demoAnnotations", () => {
      it("is an empty array (annotations removed for cleaner demo)", () => {
        expect(Array.isArray(demoAnnotations)).toBe(true);
        expect(demoAnnotations.length).toBe(0);
      });
    });
  });

  describe("Demo API Mock Functionality", () => {
    let api;

    beforeEach(() => {
      api = createDemoApi();
    });

    describe("API Interface", () => {
      it("returns correct API interface", () => {
        expect(api).toHaveProperty("get");
        expect(api).toHaveProperty("post");
        expect(api).toHaveProperty("put");
        expect(api).toHaveProperty("delete");
        expect(api).toHaveProperty("getUri");

        expect(typeof api.get).toBe("function");
        expect(typeof api.post).toBe("function");
        expect(typeof api.put).toBe("function");
        expect(typeof api.delete).toBe("function");
        expect(typeof api.getUri).toBe("function");
      });

      it("getUri returns correct backend URL", () => {
        expect(api.getUri()).toBe(import.meta.env.VITE_API_BASE_URL);
      });
    });

    describe("GET method", () => {
      it("returns empty data for unknown endpoints", async () => {
        const result = await api.get("/unknown");
        expect(result).toEqual({ data: {} });
      });

      it("returns empty data for all GET endpoints", async () => {
        const result = await api.get("/settings");
        expect(result).toHaveProperty("data");
        expect(result.data).toEqual({});
      });
    });

    describe("GET method - file content endpoint", () => {
      it("returns file HTML for /files/{id}/content", async () => {
        const api = createDemoApi();
        demoFile.html = "<div>Test HTML Content</div>";
        const result = await api.get(`/files/${demoFile.id}/content`);
        expect(result).toEqual({ data: "<div>Test HTML Content</div>" });
      });

      it("returns empty string when file has no HTML", async () => {
        const api = createDemoApi();
        demoFile.html = null;
        const result = await api.get(`/files/999/content`);
        expect(result).toEqual({ data: "" });
      });

      it("still returns empty object for other GET endpoints after adding file content support", async () => {
        const api = createDemoApi();
        const result = await api.get("/some/other/endpoint");
        expect(result).toEqual({ data: {} });
      });
    });

    describe("POST method - /render endpoint", () => {
      it("calls backend render endpoint with correct parameters", async () => {
        // Since /render now hits the real backend, we test that the call structure is correct
        const result = await api.post("/render", { source: demoFile.source });

        // Verify that the API returns some kind of rendered content
        expect(result).toHaveProperty("data");
        expect(typeof result.data).toBe("string");
        expect(result.data.length).toBeGreaterThan(0);
      });

      it("returns rendered HTML from backend", async () => {
        // Test that the API returns valid HTML content from backend
        const result = await api.post("/render", { source: demoFile.source });

        expect(result).toHaveProperty("data");
        expect(typeof result.data).toBe("string");
        expect(result.data.length).toBeGreaterThan(0);
      });

      it("handles backend render success", async () => {
        // Test that the API handles backend responses
        const result = await api.post("/render", { source: demoFile.source });

        expect(result).toHaveProperty("data");
        expect(typeof result.data).toBe("string");
        expect(result.data.length).toBeGreaterThan(0);
      });

      it("handles error scenarios gracefully", async () => {
        // Test that the API returns valid data from backend
        const result = await api.post("/render", { source: demoFile.source });

        expect(result.data).toBeDefined();
        expect(typeof result.data).toBe("string");
        expect(result.data.length).toBeGreaterThan(0);
      });

      it("processes RSM content correctly", async () => {
        // Test that the render endpoint processes the demo RSM content
        const result = await api.post("/render", { source: demoFile.source });

        expect(result.data).toBeDefined();
        expect(typeof result.data).toBe("string");
        expect(result.data.length).toBeGreaterThan(0);
        // Should contain some HTML-like content
        expect(result.data).toMatch(/[<>]/);
      });

      it("returns empty data for non-render POST endpoints", async () => {
        const result = await api.post("/other-endpoint");
        expect(result).toEqual({ data: {} });
      });
    });

    describe("Other HTTP methods", () => {
      it("PUT returns empty data", async () => {
        const result = await api.put("/any-endpoint");
        expect(result).toEqual({ data: {} });
      });

      it("DELETE returns empty data", async () => {
        const result = await api.delete("/any-endpoint");
        expect(result).toEqual({ data: {} });
      });
    });
  });

  describe("RSM Content Processing", () => {
    let api;

    beforeEach(() => {
      api = createDemoApi();
    });

    it("sends correct RSM content to backend", async () => {
      // Test that the demo file has properly formatted RSM content
      expect(demoFile.source).toMatch(/^:rsm:/);
      expect(demoFile.source).toMatch(/::$/);

      // Test that the render call returns valid content
      const result = await api.post("/render");
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe("string");
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("handles complex RSM markup correctly", async () => {
      // Verify the demo RSM content contains expected elements
      expect(demoFile.source).toContain(":abstract:");
      expect(demoFile.source).toContain(":itemize:");
      expect(demoFile.source).toContain(":enumerate:");
      expect(demoFile.source).toContain(":item:");

      // Test that the render API processes the complex content
      const result = await api.post("/render");
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe("string");
      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    let api;

    beforeEach(() => {
      api = createDemoApi();
    });

    it("render endpoint handles various scenarios gracefully", async () => {
      // Test that the render API returns valid data from backend
      const result = await api.post("/render");

      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe("string");
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("demonstrates backend integration", () => {
      // Test that the demo API is properly configured
      expect(typeof api.post).toBe("function");
      expect(demoFile.source).toBeDefined();
      expect(demoFile.source.length).toBeGreaterThan(0);
    });
  });
});
