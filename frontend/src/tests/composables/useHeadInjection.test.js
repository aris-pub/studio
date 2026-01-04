import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { nextTick } from "vue";
import { useHeadInjection } from "@/composables/useHeadInjection.js";

describe("useHeadInjection", () => {
  let originalHead;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Store original head content
    originalHead = document.head.innerHTML;

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original head
    document.head.innerHTML = originalHead;

    // Restore console spies
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    vi.clearAllMocks();
  });

  describe("executeInitScript", () => {
    it("should execute valid JavaScript code", () => {
      const { executeInitScript } = useHeadInjection();
      window.__testExecuted = false;

      executeInitScript("window.__testExecuted = true;");

      expect(window.__testExecuted).toBe(true);
      delete window.__testExecuted;
    });

    it("should execute IIFE scripts", () => {
      const { executeInitScript } = useHeadInjection();
      window.__iifeResult = 0;

      executeInitScript(`
        (function() {
          window.__iifeResult = 42;
        })();
      `);

      expect(window.__iifeResult).toBe(42);
      delete window.__iifeResult;
    });

    it("should handle empty init script", () => {
      const { executeInitScript } = useHeadInjection();

      // Should not throw
      expect(() => executeInitScript("")).not.toThrow();
      expect(() => executeInitScript("   ")).not.toThrow();
      expect(() => executeInitScript(null)).not.toThrow();
      expect(() => executeInitScript(undefined)).not.toThrow();
    });

    it("should log error for invalid JavaScript", () => {
      const { executeInitScript } = useHeadInjection();

      executeInitScript("this is not { valid javascript");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error executing init script:",
        expect.any(Error)
      );
    });

    it("should execute scripts with inline function arrays", () => {
      const { executeInitScript } = useHeadInjection();
      window.__scriptResults = [];

      executeInitScript(`
        var inlineScripts = [
          function() { window.__scriptResults.push(1); },
          function() { window.__scriptResults.push(2); }
        ];
        inlineScripts.forEach(function(fn) { fn(); });
      `);

      expect(window.__scriptResults).toEqual([1, 2]);
      delete window.__scriptResults;
    });

    it("should handle scripts that reference DOM elements", () => {
      const { executeInitScript } = useHeadInjection();

      // Create a test element
      const div = document.createElement("div");
      div.id = "test-chart";
      document.body.appendChild(div);

      executeInitScript(`
        var el = document.getElementById('test-chart');
        el.textContent = 'Chart rendered';
      `);

      expect(div.textContent).toBe("Chart rendered");
      document.body.removeChild(div);
    });

    it("should execute realistic Plotly-like IIFE", () => {
      const { executeInitScript } = useHeadInjection();
      window.__plotlyTest = { scriptsLoaded: 0, executed: false };

      executeInitScript(`
        (function() {
          var scriptsLoaded = 0;
          var totalExternalScripts = 0;
          var inlineScripts = [function() {
            window.__plotlyTest.executed = true;
          }];

          function executeInlineScripts() {
            if (scriptsLoaded >= totalExternalScripts) {
              inlineScripts.forEach(function(fn) { fn(); });
            }
          }

          // No external scripts, execute immediately
          if (totalExternalScripts === 0) {
            executeInlineScripts();
          }
        })();
      `);

      expect(window.__plotlyTest.executed).toBe(true);
      delete window.__plotlyTest;
    });
  });

  describe("injectHeadContent", () => {
    it("should inject stylesheet links", async () => {
      const { injectHeadContent } = useHeadInjection();
      const initialLinkCount = document.head.querySelectorAll("link").length;

      await injectHeadContent('<link rel="stylesheet" href="/test.css">');

      const links = document.head.querySelectorAll("link");
      expect(links.length).toBe(initialLinkCount + 1);
    });

    it("should not duplicate already loaded resources", async () => {
      const { injectHeadContent } = useHeadInjection();

      // Inject same content twice
      await injectHeadContent('<link rel="stylesheet" href="/unique-test.css">');
      const countAfterFirst = document.head.querySelectorAll(
        'link[href="/unique-test.css"]'
      ).length;

      await injectHeadContent('<link rel="stylesheet" href="/unique-test.css">');
      const countAfterSecond = document.head.querySelectorAll(
        'link[href="/unique-test.css"]'
      ).length;

      expect(countAfterFirst).toBe(1);
      expect(countAfterSecond).toBe(1);
    });

    it("should handle empty head content", async () => {
      const { injectHeadContent } = useHeadInjection();

      // Should not throw
      await expect(injectHeadContent("")).resolves.not.toThrow();
      await expect(injectHeadContent("   ")).resolves.not.toThrow();
      await expect(injectHeadContent(null)).resolves.not.toThrow();
    });

    it("should skip jQuery and Tooltipster scripts", async () => {
      const { injectHeadContent } = useHeadInjection();
      const initialScriptCount = document.head.querySelectorAll("script").length;

      await injectHeadContent(`
        <script src="https://cdn.example.com/jquery-3.6.0.js"></script>
        <script src="https://cdn.example.com/tooltipster.bundle.js"></script>
      `);

      // These should be skipped (handled by ManuscriptWrapper)
      const scripts = document.head.querySelectorAll("script");
      expect(scripts.length).toBe(initialScriptCount);
    });
  });

  describe("processStructuredContent", () => {
    it("should process structured content with init_script", async () => {
      const { processStructuredContent } = useHeadInjection();
      window.__processTest = false;

      const structured = {
        head: "",
        body: "<div>Test</div>",
        init_script: "window.__processTest = true;",
      };

      await processStructuredContent(structured);
      await nextTick();

      expect(window.__processTest).toBe(true);
      delete window.__processTest;
    });

    it("should handle structured content without init_script", async () => {
      const { processStructuredContent } = useHeadInjection();

      const structured = {
        head: "",
        body: "<div>Test</div>",
        init_script: "",
      };

      // Should not throw
      await expect(processStructuredContent(structured)).resolves.not.toThrow();
    });

    it("should handle null structured content", async () => {
      const { processStructuredContent } = useHeadInjection();

      // Should not throw
      await expect(processStructuredContent(null)).resolves.not.toThrow();
      await expect(processStructuredContent(undefined)).resolves.not.toThrow();
    });

    it("should inject head content before executing init script", async () => {
      const { processStructuredContent } = useHeadInjection();
      const executionOrder = [];

      // Mock to track execution order
      const originalInjectHead = document.head.appendChild.bind(document.head);
      document.head.appendChild = (node) => {
        if (node.tagName === "LINK") {
          executionOrder.push("head");
        }
        return originalInjectHead(node);
      };

      window.__trackOrder = () => executionOrder.push("script");

      const structured = {
        head: '<link rel="stylesheet" href="/order-test.css">',
        body: "<div>Test</div>",
        init_script: "window.__trackOrder();",
      };

      await processStructuredContent(structured);
      await nextTick();

      expect(executionOrder).toEqual(["head", "script"]);
      delete window.__trackOrder;
    });
  });

  describe("integration scenarios", () => {
    it("should handle Plotly chart initialization flow", async () => {
      const { executeInitScript } = useHeadInjection();

      // Simulate Plotly being available
      window.Plotly = {
        newPlot: vi.fn(),
      };

      // Create chart container
      const chartDiv = document.createElement("div");
      chartDiv.id = "integration-chart";
      document.body.appendChild(chartDiv);

      executeInitScript(`
        (function() {
          var scriptsLoaded = 0;
          var totalExternalScripts = 0;
          var inlineScripts = [function() {
            Plotly.newPlot('integration-chart', [{x: [1,2], y: [1,2]}]);
          }];

          function executeInlineScripts() {
            if (scriptsLoaded >= totalExternalScripts) {
              inlineScripts.forEach(function(fn) { fn(); });
            }
          }

          if (totalExternalScripts === 0) {
            executeInlineScripts();
          }
        })();
      `);

      expect(window.Plotly.newPlot).toHaveBeenCalledWith("integration-chart", [
        { x: [1, 2], y: [1, 2] },
      ]);

      document.body.removeChild(chartDiv);
      delete window.Plotly;
    });

    it("should handle D3 chart initialization flow", async () => {
      const { executeInitScript } = useHeadInjection();

      // Simulate D3 being available
      const mockSelection = {
        append: vi.fn().mockReturnThis(),
        attr: vi.fn().mockReturnThis(),
      };
      window.d3 = {
        select: vi.fn().mockReturnValue(mockSelection),
      };

      executeInitScript(`
        (function() {
          d3.select('#chart')
            .append('circle')
            .attr('r', 50);
        })();
      `);

      expect(window.d3.select).toHaveBeenCalledWith("#chart");
      expect(mockSelection.append).toHaveBeenCalledWith("circle");
      expect(mockSelection.attr).toHaveBeenCalledWith("r", 50);

      delete window.d3;
    });

    it("should handle script with error handling", async () => {
      const { executeInitScript } = useHeadInjection();
      window.__errorHandled = false;

      executeInitScript(`
        (function() {
          var inlineScripts = [function() {
            try {
              throw new Error("Test error");
            } catch (e) {
              window.__errorHandled = true;
            }
          }];
          inlineScripts.forEach(function(fn) { fn(); });
        })();
      `);

      expect(window.__errorHandled).toBe(true);
      delete window.__errorHandled;
    });

    it("should handle multiple chart types in same document", async () => {
      const { executeInitScript } = useHeadInjection();
      window.__chartResults = [];

      executeInitScript(`
        (function() {
          window.__chartResults.push('plotly');
        })();
      `);

      executeInitScript(`
        (function() {
          window.__chartResults.push('d3');
        })();
      `);

      expect(window.__chartResults).toEqual(["plotly", "d3"]);
      delete window.__chartResults;
    });

    it("should not affect DOM content outside chart container", async () => {
      const { executeInitScript } = useHeadInjection();

      // Create a document structure with content before and after chart
      const container = document.createElement("div");
      container.innerHTML = `
        <div id="before">Content before chart</div>
        <div id="chart-container"></div>
        <div id="after">Content after chart</div>
      `;
      document.body.appendChild(container);

      // Execute script that only modifies the chart container
      executeInitScript(`
        (function() {
          var chart = document.getElementById('chart-container');
          if (chart) {
            chart.innerHTML = '<svg>Chart rendered</svg>';
          }
        })();
      `);

      // Verify content before and after chart is preserved
      expect(document.getElementById("before").textContent).toBe("Content before chart");
      expect(document.getElementById("after").textContent).toBe("Content after chart");
      expect(document.getElementById("chart-container").innerHTML).toBe("<svg>Chart rendered</svg>");

      document.body.removeChild(container);
    });

    it("should not throw errors that could interrupt rendering", async () => {
      const { executeInitScript } = useHeadInjection();
      window.__afterError = false;

      // Script with error followed by more code
      executeInitScript(`
        (function() {
          try {
            // This might throw but is caught
            nonExistentFunction();
          } catch (e) {
            // Error handled gracefully
          }
          window.__afterError = true;
        })();
      `);

      expect(window.__afterError).toBe(true);
      delete window.__afterError;
    });
  });
});
