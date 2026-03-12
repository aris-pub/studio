import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateCurrentMatch,
  highlightMathMatches,
  highlightSearchMatches,
  clearHighlights,
  highlightClass,
  currentHighlightClass,
  mathContainerClass,
} from "@/utils/highlightSearchMatches.js";

describe("highlightSearchMatches utils", () => {
  describe("updateCurrentMatch", () => {
    let mockMatches;

    beforeEach(() => {
      mockMatches = [
        {
          mark: {
            classList: {
              remove: vi.fn(),
              add: vi.fn(),
            },
          },
        },
        {
          mark: {
            classList: {
              remove: vi.fn(),
              add: vi.fn(),
            },
          },
        },
        {
          mark: {
            classList: {
              remove: vi.fn(),
              add: vi.fn(),
            },
          },
        },
      ];
    });

    it("should remove current highlight from all matches and add regular highlight", () => {
      updateCurrentMatch(mockMatches, 1);

      // All matches should have current highlight removed and regular highlight added
      mockMatches.forEach((match) => {
        expect(match.mark.classList.remove).toHaveBeenCalledWith(currentHighlightClass);
        expect(match.mark.classList.add).toHaveBeenCalledWith(highlightClass);
      });
    });

    it("should add current highlight to the specified match", () => {
      const currentIndex = 1;
      updateCurrentMatch(mockMatches, currentIndex);

      // The current match should have regular highlight removed and current highlight added
      expect(mockMatches[currentIndex].mark.classList.remove).toHaveBeenCalledWith(highlightClass);
      expect(mockMatches[currentIndex].mark.classList.add).toHaveBeenCalledWith(
        currentHighlightClass
      );
    });

    it("should handle edge case when currentIndex is negative", () => {
      updateCurrentMatch(mockMatches, -1);

      // All matches should have current highlight removed and regular highlight added
      mockMatches.forEach((match) => {
        expect(match.mark.classList.remove).toHaveBeenCalledWith(currentHighlightClass);
        expect(match.mark.classList.add).toHaveBeenCalledWith(highlightClass);
      });

      // No match should get current highlight since index is invalid
      mockMatches.forEach((match) => {
        expect(match.mark.classList.remove).not.toHaveBeenCalledWith(highlightClass);
        expect(match.mark.classList.add).not.toHaveBeenCalledWith(currentHighlightClass);
      });
    });

    it("should handle edge case when currentIndex is out of bounds", () => {
      updateCurrentMatch(mockMatches, 5);

      // All matches should have current highlight removed and regular highlight added
      mockMatches.forEach((match) => {
        expect(match.mark.classList.remove).toHaveBeenCalledWith(currentHighlightClass);
        expect(match.mark.classList.add).toHaveBeenCalledWith(highlightClass);
      });

      // No match should get current highlight since index is out of bounds
      mockMatches.forEach((match) => {
        expect(match.mark.classList.remove).not.toHaveBeenCalledWith(highlightClass);
        expect(match.mark.classList.add).not.toHaveBeenCalledWith(currentHighlightClass);
      });
    });

    it("should handle matches with no mark property", () => {
      const matchesWithoutMark = [
        { mark: null },
        { mark: mockMatches[1].mark },
        {
          /* no mark property */
        },
      ];

      // Should not throw an error
      expect(() => updateCurrentMatch(matchesWithoutMark, 1)).not.toThrow();

      // Only the match with a valid mark should have methods called
      expect(mockMatches[1].mark.classList.remove).toHaveBeenCalledWith(currentHighlightClass);
      expect(mockMatches[1].mark.classList.add).toHaveBeenCalledWith(highlightClass);
      expect(mockMatches[1].mark.classList.remove).toHaveBeenCalledWith(highlightClass);
      expect(mockMatches[1].mark.classList.add).toHaveBeenCalledWith(currentHighlightClass);
    });

    it("should handle empty matches array", () => {
      // Should not throw an error
      expect(() => updateCurrentMatch([], 0)).not.toThrow();
    });

    it("should handle zero index correctly", () => {
      updateCurrentMatch(mockMatches, 0);

      // First match should get current highlight
      expect(mockMatches[0].mark.classList.remove).toHaveBeenCalledWith(highlightClass);
      expect(mockMatches[0].mark.classList.add).toHaveBeenCalledWith(currentHighlightClass);

      // Other matches should only get regular highlight
      for (let i = 1; i < mockMatches.length; i++) {
        expect(mockMatches[i].mark.classList.remove).toHaveBeenCalledWith(currentHighlightClass);
        expect(mockMatches[i].mark.classList.add).toHaveBeenCalledWith(highlightClass);
        expect(mockMatches[i].mark.classList.remove).not.toHaveBeenCalledWith(highlightClass);
        expect(mockMatches[i].mark.classList.add).not.toHaveBeenCalledWith(currentHighlightClass);
      }
    });

    it("should handle mathEls matches (math scope)", () => {
      const el1 = { classList: { remove: vi.fn(), add: vi.fn() } };
      const el2 = { classList: { remove: vi.fn(), add: vi.fn() } };
      const el3 = { classList: { remove: vi.fn(), add: vi.fn() } };

      const mathMatches = [
        { mark: el1, mathEls: [el1, el2] },
        { mark: el3, mathEls: [el3] },
      ];

      updateCurrentMatch(mathMatches, 0);

      // Current match: both el1 and el2 get current highlight
      expect(el1.classList.add).toHaveBeenCalledWith(currentHighlightClass);
      expect(el2.classList.add).toHaveBeenCalledWith(currentHighlightClass);
      // Non-current: el3 gets regular highlight
      expect(el3.classList.remove).toHaveBeenCalledWith(currentHighlightClass);
      expect(el3.classList.add).toHaveBeenCalledWith(highlightClass);
    });

    it("should switch current between mathEls matches", () => {
      const el1 = { classList: { remove: vi.fn(), add: vi.fn() } };
      const el2 = { classList: { remove: vi.fn(), add: vi.fn() } };

      const mathMatches = [
        { mark: el1, mathEls: [el1] },
        { mark: el2, mathEls: [el2] },
      ];

      updateCurrentMatch(mathMatches, 1);

      expect(el1.classList.remove).toHaveBeenCalledWith(currentHighlightClass);
      expect(el1.classList.add).toHaveBeenCalledWith(highlightClass);
      expect(el2.classList.add).toHaveBeenCalledWith(currentHighlightClass);
    });
  });

  describe("highlightMathMatches", () => {
    function buildMathDOM(latex) {
      // Simulate Temml output: <span class="math"><math><mrow><mi>...</mi></mrow></math></span>
      const container = document.createElement("div");
      const span = document.createElement("span");
      span.className = "math";
      const math = document.createElementNS("http://www.w3.org/1998/Math/MathML", "math");
      const mrow = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mrow");

      // Split latex into individual character MathML elements
      for (const ch of latex) {
        const tag = /[0-9]/.test(ch) ? "mn" : /[a-zA-Z]/.test(ch) ? "mi" : "mo";
        const el = document.createElementNS("http://www.w3.org/1998/Math/MathML", tag);
        el.textContent = ch;
        mrow.appendChild(el);
      }

      math.appendChild(mrow);
      span.appendChild(math);
      container.appendChild(span);
      return container;
    }

    it("finds matches in inline math", () => {
      const root = buildMathDOM("a+b=c");
      const matches = highlightMathMatches(root, "b=c");

      expect(matches).toHaveLength(1);
      expect(matches[0].mathEls).toHaveLength(3); // b, =, c
      expect(matches[0].mathEls[0].textContent).toBe("b");
      expect(matches[0].mathEls[1].textContent).toBe("=");
      expect(matches[0].mathEls[2].textContent).toBe("c");
    });

    it("applies highlight class to matched elements", () => {
      const root = buildMathDOM("x+y");
      highlightMathMatches(root, "x");

      const mi = root.querySelector("mi");
      expect(mi.classList.contains(highlightClass)).toBe(true);
    });

    it("is case-insensitive by default", () => {
      const root = buildMathDOM("ABC");
      const matches = highlightMathMatches(root, "abc");
      expect(matches).toHaveLength(1);
    });

    it("respects caseSensitive option", () => {
      const root = buildMathDOM("ABC");
      const matches = highlightMathMatches(root, "abc", { caseSensitive: true });
      expect(matches).toHaveLength(0);
    });

    it("finds multiple matches in one container", () => {
      const root = buildMathDOM("a+a+a");
      const matches = highlightMathMatches(root, "a");
      expect(matches).toHaveLength(3);
    });

    it("returns empty array when no math containers exist", () => {
      const root = document.createElement("div");
      root.textContent = "plain text";
      const matches = highlightMathMatches(root, "plain");
      expect(matches).toEqual([]);
    });

    it("finds matches in display math (div.mathblock)", () => {
      const root = document.createElement("div");
      const block = document.createElement("div");
      block.className = "mathblock";
      const math = document.createElementNS("http://www.w3.org/1998/Math/MathML", "math");
      const mi = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mi");
      mi.textContent = "x";
      math.appendChild(mi);
      block.appendChild(math);
      root.appendChild(block);

      const matches = highlightMathMatches(root, "x");
      expect(matches).toHaveLength(1);
      expect(matches[0].mathEls[0].textContent).toBe("x");
    });

    it("adds container wash to display math (div.mathblock)", () => {
      const root = document.createElement("div");
      const block = document.createElement("div");
      block.className = "mathblock";
      const math = document.createElementNS("http://www.w3.org/1998/Math/MathML", "math");
      const mi = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mi");
      mi.textContent = "y";
      math.appendChild(mi);
      block.appendChild(math);
      root.appendChild(block);

      highlightMathMatches(root, "y");
      expect(block.classList.contains(mathContainerClass)).toBe(true);
    });

    it("applies container wash independently per container", () => {
      const root = buildMathDOM("a+b");
      // Add a second math container with no match
      const span2 = document.createElement("span");
      span2.className = "math";
      const math2 = document.createElementNS("http://www.w3.org/1998/Math/MathML", "math");
      const mi2 = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mi");
      mi2.textContent = "z";
      math2.appendChild(mi2);
      span2.appendChild(math2);
      root.appendChild(span2);

      highlightMathMatches(root, "a");

      const containers = root.querySelectorAll("span.math");
      expect(containers[0].classList.contains(mathContainerClass)).toBe(true);
      expect(containers[1].classList.contains(mathContainerClass)).toBe(false);
    });

    it("sets mark to first element for scrollIntoView", () => {
      const root = buildMathDOM("x+y");
      const matches = highlightMathMatches(root, "x+y");
      expect(matches[0].mark).toBe(matches[0].mathEls[0]);
    });

    it("adds container wash class to math container", () => {
      const root = buildMathDOM("x+y");
      highlightMathMatches(root, "x");
      const container = root.querySelector("span.math");
      expect(container.classList.contains(mathContainerClass)).toBe(true);
    });

    it("does not add container wash when no matches", () => {
      const root = buildMathDOM("x+y");
      highlightMathMatches(root, "z");
      const container = root.querySelector("span.math");
      expect(container.classList.contains(mathContainerClass)).toBe(false);
    });
  });

  describe("highlightSearchMatches (document scope)", () => {
    it("skips text nodes inside math containers", () => {
      const root = document.createElement("div");
      root.innerHTML = '<p>hello world</p><span class="math"><math><mi>x</mi></math></span>';
      const result = highlightSearchMatches(root, "x");
      // Returns 0 (no matches) since "x" is inside a math container
      expect(result).toBe(0);
    });

    it("still matches text outside math containers", () => {
      const root = document.createElement("div");
      root.innerHTML = '<p>hello world</p><span class="math"><math><mi>x</mi></math></span>';
      const matches = highlightSearchMatches(root, "hello");
      expect(matches).toHaveLength(1);
    });

    it("skips text inside display math (div.mathblock)", () => {
      const root = document.createElement("div");
      root.innerHTML = '<p>text</p><div class="mathblock"><math><mi>n</mi></math></div>';
      const result = highlightSearchMatches(root, "n");
      expect(result).toBe(0);
    });
  });

  describe("clearHighlights", () => {
    it("clears math highlight classes", () => {
      const root = document.createElement("div");
      root.innerHTML =
        '<span class="math"><math><mi class="aris-search-highlight">x</mi></math></span>';
      clearHighlights(root);
      const mi = root.querySelector("mi");
      expect(mi.classList.contains(highlightClass)).toBe(false);
    });

    it("clears both mark and math highlights", () => {
      const root = document.createElement("div");
      root.innerHTML = `
        <p><mark class="${highlightClass}">hello</mark></p>
        <span class="math"><math><mi class="${currentHighlightClass}">x</mi></math></span>
      `;
      clearHighlights(root);
      expect(root.querySelector("mark")).toBeNull();
      expect(root.querySelector("mi").classList.contains(currentHighlightClass)).toBe(false);
    });

    it("clears container wash class", () => {
      const root = document.createElement("div");
      root.innerHTML = `<span class="math ${mathContainerClass}"><math><mi>x</mi></math></span>`;
      clearHighlights(root);
      expect(root.querySelector("span.math").classList.contains(mathContainerClass)).toBe(false);
    });
  });
});
