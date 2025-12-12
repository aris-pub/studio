import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { downloadBlob } from "@/utils/download.js";

describe("download.js", () => {
  let mockLink;
  let mockCreateObjectURL;
  let mockRevokeObjectURL;
  let appendChildSpy;
  let removeChildSpy;

  beforeEach(() => {
    mockLink = {
      href: "",
      download: "",
      click: vi.fn(),
    };

    vi.spyOn(document, "createElement").mockReturnValue(mockLink);
    appendChildSpy = vi.spyOn(document.body, "appendChild").mockImplementation(() => {});
    removeChildSpy = vi.spyOn(document.body, "removeChild").mockImplementation(() => {});

    mockCreateObjectURL = vi.fn().mockReturnValue("blob:http://localhost/fake-url");
    mockRevokeObjectURL = vi.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("downloadBlob", () => {
    it("creates an object URL from the blob", () => {
      const blob = new Blob(["test content"], { type: "text/html" });
      downloadBlob(blob, "test.html");

      expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
    });

    it("creates an anchor element with correct attributes", () => {
      const blob = new Blob(["test content"], { type: "text/html" });
      downloadBlob(blob, "manuscript.html");

      expect(document.createElement).toHaveBeenCalledWith("a");
      expect(mockLink.href).toBe("blob:http://localhost/fake-url");
      expect(mockLink.download).toBe("manuscript.html");
    });

    it("appends link to body, clicks it, and removes it", () => {
      const blob = new Blob(["test content"], { type: "text/html" });
      downloadBlob(blob, "test.html");

      expect(appendChildSpy).toHaveBeenCalledWith(mockLink);
      expect(mockLink.click).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalledWith(mockLink);
    });

    it("revokes the object URL after download", () => {
      const blob = new Blob(["test content"], { type: "text/html" });
      downloadBlob(blob, "test.html");

      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/fake-url");
    });

    it("handles filenames with special characters", () => {
      const blob = new Blob(["content"], { type: "text/html" });
      downloadBlob(blob, "My Research Paper (Draft).html");

      expect(mockLink.download).toBe("My Research Paper (Draft).html");
    });

    it("handles empty blob", () => {
      const blob = new Blob([], { type: "text/html" });
      downloadBlob(blob, "empty.html");

      expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
      expect(mockLink.click).toHaveBeenCalled();
    });
  });
});
