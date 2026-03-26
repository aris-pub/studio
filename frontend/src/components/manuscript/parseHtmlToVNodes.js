/**
 * parseHtmlToVNodes.js
 *
 * Converts an HTML string into Vue VNodes using htmlparser2 (SAX-style parser).
 * Zero intermediate DOM nodes — only lightweight JS objects.
 *
 * Replaces the DOMParser-based approach that created ~11,600 browser DOM nodes
 * per recompile, causing renderer RSS to balloon with detached nodes.
 */

import { Parser } from "htmlparser2";
import { h } from "vue";
import FeedbackIcon from "./FeedbackIcon.vue";
import FigureToggle from "./FigureToggle.vue";
import MathElement from "./MathElement.vue";

/**
 * Parse an HTML string and return an array of Vue VNodes.
 */
export function parseHtmlToVNodes(htmlString) {
  const tree = buildTree(htmlString);
  return tree.children.map(toVNode).filter((v) => v != null && v !== "");
}

// --- Phase 1: Build a lightweight JS object tree via SAX ---

function buildTree(htmlString) {
  const root = { tag: null, attrs: {}, children: [], parentIsMathblock: false };
  const stack = [root];
  let skipDepth = 0;

  const parser = new Parser(
    {
      onopentag(name, attrs) {
        if (skipDepth > 0) {
          skipDepth++;
          return;
        }
        if (name === "script") {
          skipDepth = 1;
          return;
        }

        const classes = attrs.class ? attrs.class.split(/\s+/).filter(Boolean) : [];
        const isMathblock =
          name === "div" && classes.includes("mathblock");

        const parent = stack[stack.length - 1];
        const node = {
          tag: name,
          attrs,
          children: [],
          parentIsMathblock: parent.tag === "div" && hasClass(parent, "mathblock"),
          isMathblock,
        };
        parent.children.push(node);
        stack.push(node);
      },

      ontext(text) {
        if (skipDepth > 0) return;
        if (text) {
          stack[stack.length - 1].children.push(text);
        }
      },

      onclosetag() {
        if (skipDepth > 0) {
          skipDepth--;
          return;
        }
        stack.pop();
      },
    },
    { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: false },
  );

  parser.write(htmlString);
  parser.end();

  return root;
}

function hasClass(node, className) {
  if (!node.attrs || !node.attrs.class) return false;
  return node.attrs.class.split(/\s+/).includes(className);
}

// --- Phase 2: Convert JS object tree to VNodes ---

function toVNode(node) {
  if (typeof node === "string") return node;

  const { tag, attrs, children } = node;
  const data = processAttrs(attrs);
  const classes = data.class || [];

  // Inline math → MathElement component
  if (tag === "span" && classes.includes("math")) {
    const text = extractText(children);
    const latex =
      text.startsWith("\\(") && text.endsWith("\\)")
        ? text.slice(2, -2)
        : text;
    return h(MathElement, { ...data, latex, display: false });
  }

  // Display math: .hr-content-zone inside a .mathblock parent
  if (
    tag === "div" &&
    classes.includes("hr-content-zone") &&
    node.parentIsMathblock
  ) {
    const text = extractText(children).trim();
    if (text.startsWith("$$") && text.endsWith("$$")) {
      const latex = text.slice(2, -2).trim();
      return h("div", data, [h(MathElement, { latex, display: true })]);
    }
  }

  const vnodeChildren = children.map(toVNode).filter((v) => v != null && v !== "");

  // Inject FeedbackIcon into .hr-info divs
  if (tag === "div" && classes.includes("hr-info")) {
    vnodeChildren.push(h(FeedbackIcon));
  }

  // Inject FigureToggle into figure[data-static]
  if (tag === "figure" && attrs["data-static"] != null) {
    vnodeChildren.push(h(FigureToggle));
  }

  return h(tag, data, vnodeChildren.length ? vnodeChildren : undefined);
}

// --- Attribute processing (ported from Manuscript.vue) ---

const KNOWN_ATTRS = new Set(["id", "href", "data-nodeid", "tabindex", "data-source-start", "data-source-end"]);

function processAttrs(rawAttrs) {
  const data = {};
  const extra = {};

  for (const [name, value] of Object.entries(rawAttrs)) {
    if (name === "style") {
      data.style = parseStyle(value);
    } else if (name === "class") {
      data.class = value.split(/\s+/).filter(Boolean);
    } else if (name.startsWith("on") && name.length > 2) {
      extra[name] = value;
    } else if (KNOWN_ATTRS.has(name)) {
      data[name] = value;
    } else {
      extra[name] = value;
    }
  }

  if (Object.keys(extra).length) {
    Object.assign(data, extra);
  }

  return data;
}

function parseStyle(styleStr) {
  const obj = {};
  styleStr.split(";").forEach((part) => {
    const colonIdx = part.indexOf(":");
    if (colonIdx === -1) return;
    const prop = part.slice(0, colonIdx).trim();
    const val = part.slice(colonIdx + 1).trim();
    if (prop && val) {
      obj[prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = val;
    }
  });
  return obj;
}

function extractText(children) {
  return children
    .map((c) => (typeof c === "string" ? c : extractText(c.children || [])))
    .join("");
}
