import { describe, it, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  insertBold,
  insertItalic,
  insertHeading,
  insertCitation,
  insertMathInline,
  insertItemize,
  insertEnumerate,
  insertCodeInline,
  insertCodeBlock,
  insertComment,
  insertCrossRef,
  insertUrl,
  insertAuthor,
  insertMathBlock,
  insertTheorem,
  insertProof,
  insertSubproof,
  insertAssume,
  insertLet,
  insertDefine,
  insertToc,
  RSM_COMMANDS,
  rsmKeymap,
} from "@/composables/useRSMCommands.js";

function createView(doc, anchor, head) {
  const selection = head !== undefined ? { anchor, head } : { anchor };
  const state = EditorState.create({ doc, selection });
  return new EditorView({ state });
}

function docText(view) {
  return view.state.doc.toString();
}

function cursor(view) {
  return view.state.selection.main.head;
}

function selRange(view) {
  const sel = view.state.selection.main;
  return { from: sel.from, to: sel.to };
}

let views = [];
function tracked(view) {
  views.push(view);
  return view;
}

afterEach(() => {
  views.forEach((v) => v.destroy());
  views = [];
});

// --- insertBold ---

describe("insertBold", () => {
  it("inserts bold markers at cursor when no selection", () => {
    const view = tracked(createView("hello world", 5));
    insertBold(view);
    expect(docText(view)).toBe("hello**** world");
    expect(cursor(view)).toBe(7);
  });

  it("wraps selection in bold markers", () => {
    const view = tracked(createView("hello world", 0, 5));
    insertBold(view);
    expect(docText(view)).toBe("**hello** world");
    expect(selRange(view)).toEqual({ from: 2, to: 7 });
  });

  it("wraps mid-text selection", () => {
    const view = tracked(createView("hello world", 6, 11));
    insertBold(view);
    expect(docText(view)).toBe("hello **world**");
  });

  it("returns true", () => {
    const view = tracked(createView("test", 0));
    expect(insertBold(view)).toBe(true);
  });
});

// --- insertItalic ---

describe("insertItalic", () => {
  it("inserts italic markers at cursor when no selection", () => {
    const view = tracked(createView("hello", 5));
    insertItalic(view);
    expect(docText(view)).toBe("hello**");
    expect(cursor(view)).toBe(6);
  });

  it("wraps selection in italic markers", () => {
    const view = tracked(createView("hello world", 0, 5));
    insertItalic(view);
    expect(docText(view)).toBe("*hello* world");
  });
});

// --- insertHeading ---

describe("insertHeading", () => {
  it("inserts ## at start of line with no existing heading", () => {
    const view = tracked(createView("some text", 4));
    insertHeading(view);
    expect(docText(view)).toBe("## some text");
  });

  it("cycles ## to ###", () => {
    const view = tracked(createView("## heading", 5));
    insertHeading(view);
    expect(docText(view)).toBe("### heading");
  });

  it("cycles ### to ####", () => {
    const view = tracked(createView("### heading", 5));
    insertHeading(view);
    expect(docText(view)).toBe("#### heading");
  });

  it("cycles #### back to ##", () => {
    const view = tracked(createView("#### heading", 5));
    insertHeading(view);
    expect(docText(view)).toBe("## heading");
  });

  it("works on correct line in multi-line doc", () => {
    const view = tracked(createView("line one\n## line two\nline three", 14));
    insertHeading(view);
    expect(docText(view)).toBe("line one\n### line two\nline three");
  });
});

// --- insertCitation ---

describe("insertCitation", () => {
  it("inserts :cite::: at cursor when no selection", () => {
    const view = tracked(createView("see ", 4));
    insertCitation(view);
    expect(docText(view)).toBe("see :cite:::");
    expect(cursor(view)).toBe(10);
  });

  it("wraps selection in citation tag", () => {
    const view = tracked(createView("see key2023", 4, 11));
    insertCitation(view);
    expect(docText(view)).toBe("see :cite:key2023::");
  });
});

// --- insertMathInline ---

describe("insertMathInline", () => {
  it("inserts $$ at cursor when no selection", () => {
    const view = tracked(createView("the equation ", 13));
    insertMathInline(view);
    expect(docText(view)).toBe("the equation $$");
    expect(cursor(view)).toBe(14);
  });

  it("wraps selection in $ markers", () => {
    const view = tracked(createView("E=mc^2", 0, 6));
    insertMathInline(view);
    expect(docText(view)).toBe("$E=mc^2$");
  });
});

// --- Code inline (backtick wrap) ---

describe("insertCodeInline", () => {
  it("inserts backtick pair at cursor", () => {
    const view = tracked(createView("text ", 5));
    insertCodeInline(view);
    expect(docText(view)).toBe("text ``");
    expect(cursor(view)).toBe(6);
  });

  it("wraps selection in backticks", () => {
    const view = tracked(createView("some code here", 5, 9));
    insertCodeInline(view);
    expect(docText(view)).toBe("some `code` here");
  });
});

// --- Code block (triple backticks) ---

describe("insertCodeBlock", () => {
  it("inserts triple backtick block after current line", () => {
    const view = tracked(createView("text", 4));
    insertCodeBlock(view);
    expect(docText(view)).toBe("text\n```\n\n```");
    expect(cursor(view)).toBe(9);
  });
});

// --- Comment (% toggle) ---

describe("insertComment", () => {
  it("adds % prefix to uncommented line", () => {
    const view = tracked(createView("some text", 4));
    insertComment(view);
    expect(docText(view)).toBe("% some text");
  });

  it("removes % prefix from commented line", () => {
    const view = tracked(createView("% some text", 5));
    insertComment(view);
    expect(docText(view)).toBe("some text");
  });
});

// --- Other inline tags ---

describe("insertCrossRef", () => {
  it("inserts :ref::: at cursor", () => {
    const view = tracked(createView("see ", 4));
    insertCrossRef(view);
    expect(docText(view)).toBe("see :ref:::");
    expect(cursor(view)).toBe(9);
  });
});

describe("insertUrl", () => {
  it("inserts :url::: at cursor", () => {
    const view = tracked(createView("visit ", 6));
    insertUrl(view);
    expect(docText(view)).toBe("visit :url:::");
    expect(cursor(view)).toBe(11);
  });
});

// --- Block tag commands ---

describe("insertItemize (block)", () => {
  it("inserts itemize block after current line", () => {
    const view = tracked(createView("intro text", 5));
    insertItemize(view);
    expect(docText(view)).toBe("intro text\n:itemize:\n\n  \n\n::");
  });
});

describe("insertEnumerate (block)", () => {
  it("inserts enumerate block", () => {
    const view = tracked(createView("intro", 3));
    insertEnumerate(view);
    expect(docText(view)).toBe("intro\n:enumerate:\n\n  \n\n::");
  });
});

describe("insertMathBlock", () => {
  it("inserts $$ math block after current line", () => {
    const view = tracked(createView("text", 2));
    insertMathBlock(view);
    expect(docText(view)).toBe("text\n$$\n\n$$");
    expect(cursor(view)).toBe(8);
  });
});

describe("insertTheorem", () => {
  it("inserts theorem block", () => {
    const view = tracked(createView("text", 4));
    insertTheorem(view);
    expect(docText(view)).toBe("text\n:theorem:\n\n  \n\n::");
  });
});

describe("insertProof", () => {
  it("inserts proof block", () => {
    const view = tracked(createView("text", 4));
    insertProof(view);
    expect(docText(view)).toBe("text\n:proof:\n\n  \n\n::");
  });
});

describe("insertSubproof", () => {
  it("inserts :p: block", () => {
    const view = tracked(createView("text", 4));
    insertSubproof(view);
    expect(docText(view)).toBe("text\n:p:\n\n  \n\n::");
  });
});

describe("insertAuthor", () => {
  it("inserts author block", () => {
    const view = tracked(createView("text", 4));
    insertAuthor(view);
    expect(docText(view)).toBe("text\n:author:\n\n  \n\n::");
  });
});

describe("insertToc", () => {
  it("inserts :toc: directive", () => {
    const view = tracked(createView("intro", 3));
    insertToc(view);
    expect(docText(view)).toBe("intro\n:toc:\n");
  });
});

// --- Constructs ---

describe("insertAssume", () => {
  it("inserts :assume::: at cursor", () => {
    const view = tracked(createView("", 0));
    insertAssume(view);
    expect(docText(view)).toBe(":assume:::");
    expect(cursor(view)).toBe(8);
  });
});

describe("insertLet", () => {
  it("inserts :let::: at cursor", () => {
    const view = tracked(createView("", 0));
    insertLet(view);
    expect(docText(view)).toBe(":let:::");
    expect(cursor(view)).toBe(5);
  });
});

describe("insertDefine", () => {
  it("wraps selection in :define: tag", () => {
    const view = tracked(createView("variable", 0, 8));
    insertDefine(view);
    expect(docText(view)).toBe(":define:variable::");
  });
});

// --- Registry and keymap ---

describe("RSM_COMMANDS", () => {
  it("contains all Phase A commands", () => {
    const ids = RSM_COMMANDS.map((c) => c.id);
    expect(ids).toContain("bold");
    expect(ids).toContain("italic");
    expect(ids).toContain("heading");
    expect(ids).toContain("citation");
    expect(ids).toContain("mathInline");
  });

  it("has execute functions for all commands", () => {
    RSM_COMMANDS.forEach((cmd) => {
      expect(typeof cmd.execute).toBe("function");
    });
  });

  it("has required fields for all commands", () => {
    RSM_COMMANDS.forEach((cmd) => {
      expect(cmd).toHaveProperty("id");
      expect(cmd).toHaveProperty("label");
      expect(cmd).toHaveProperty("category");
    });
  });

  it("includes all categories", () => {
    const categories = [...new Set(RSM_COMMANDS.map((c) => c.category))];
    expect(categories).toContain("formatting");
    expect(categories).toContain("insert");
    expect(categories).toContain("sections");
    expect(categories).toContain("math");
    expect(categories).toContain("environments");
    expect(categories).toContain("proofs");
    expect(categories).toContain("constructs");
  });

  it("uses correct RSM tags (itemize not list)", () => {
    const itemize = RSM_COMMANDS.find((c) => c.id === "itemize");
    expect(itemize).toBeDefined();
    expect(itemize.label).toBe("List");
  });

  it("has shortcuts for more than just citation", () => {
    const withShortcuts = RSM_COMMANDS.filter((c) => c.shortcut);
    expect(withShortcuts.length).toBeGreaterThan(5);
  });
});

describe("rsmKeymap", () => {
  it("is a valid CodeMirror extension", () => {
    expect(rsmKeymap).toBeDefined();
  });
});
