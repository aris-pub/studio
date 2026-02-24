import { keymap } from "@codemirror/view";

// --- Inline wrap helpers ---

function wrapSelection(view, before, after) {
  const { from, to } = view.state.selection.main;
  if (from === to) {
    view.dispatch({
      changes: { from, insert: before + after },
      selection: { anchor: from + before.length },
    });
  } else {
    const selected = view.state.sliceDoc(from, to);
    view.dispatch({
      changes: { from, to, insert: before + selected + after },
      selection: { anchor: from + before.length, head: to + before.length },
    });
  }
  return true;
}

// --- Inline tag helpers ---

function insertInlineTag(view, tag) {
  const { from, to } = view.state.selection.main;
  if (from === to) {
    const insert = `:${tag}:::`;
    view.dispatch({
      changes: { from, insert },
      selection: { anchor: from + tag.length + 2 },
    });
  } else {
    const selected = view.state.sliceDoc(from, to);
    view.dispatch({
      changes: { from, to, insert: `:${tag}:${selected}::` },
    });
  }
  return true;
}

// --- Block tag helpers ---

function insertBlockTag(view, tag) {
  const { head } = view.state.selection.main;
  const line = view.state.doc.lineAt(head);
  const insert = `\n:${tag}:\n\n  \n\n::`;
  const insertAt = line.to;
  view.dispatch({
    changes: { from: insertAt, insert },
    selection: { anchor: insertAt + tag.length + 6 },
  });
  return true;
}

// --- Formatting commands ---

export function insertBold(view) {
  return wrapSelection(view, "**", "**");
}

export function insertItalic(view) {
  return wrapSelection(view, "*", "*");
}

export function insertHeading(view) {
  const { head } = view.state.selection.main;
  const line = view.state.doc.lineAt(head);
  const text = line.text;

  const match = text.match(/^(#{2,4})\s/);
  if (match) {
    const current = match[1];
    const next = current.length >= 4 ? "##" : current + "#";
    view.dispatch({
      changes: { from: line.from, to: line.from + current.length, insert: next },
    });
  } else {
    view.dispatch({
      changes: { from: line.from, insert: "## " },
    });
  }
  return true;
}

// --- Insert menu commands ---

export function insertItemize(view) {
  return insertBlockTag(view, "itemize");
}

export function insertEnumerate(view) {
  return insertBlockTag(view, "enumerate");
}

export function insertFigure(view) {
  return insertBlockTag(view, "figure");
}

export function insertTable(view) {
  return insertBlockTag(view, "table");
}

export function insertCodeInline(view) {
  return wrapSelection(view, "`", "`");
}

export function insertCodeBlock(view) {
  const { head } = view.state.selection.main;
  const line = view.state.doc.lineAt(head);
  const insert = "\n```\n\n```";
  const insertAt = line.to;
  view.dispatch({
    changes: { from: insertAt, insert },
    selection: { anchor: insertAt + 5 },
  });
  return true;
}

export function insertComment(view) {
  const { head } = view.state.selection.main;
  const line = view.state.doc.lineAt(head);
  if (line.text.startsWith("% ")) {
    view.dispatch({
      changes: { from: line.from, to: line.from + 2, insert: "" },
    });
  } else {
    view.dispatch({
      changes: { from: line.from, insert: "% " },
    });
  }
  return true;
}

export function insertCrossRef(view) {
  return insertInlineTag(view, "ref");
}

export function insertCitation(view) {
  const { from, to } = view.state.selection.main;
  if (from === to) {
    view.dispatch({
      changes: { from, insert: ":cite:::" },
      selection: { anchor: from + 6 },
    });
  } else {
    const selected = view.state.sliceDoc(from, to);
    view.dispatch({
      changes: { from, to, insert: `:cite:${selected}::` },
    });
  }
  return true;
}

export function insertUrl(view) {
  return insertInlineTag(view, "url");
}

// --- Sections menu commands ---

export function insertAuthor(view) {
  return insertBlockTag(view, "author");
}

export function insertAbstract(view) {
  return insertBlockTag(view, "abstract");
}

export function insertToc(view) {
  const { head } = view.state.selection.main;
  const line = view.state.doc.lineAt(head);
  view.dispatch({
    changes: { from: line.to, insert: "\n:toc:\n" },
    selection: { anchor: line.to + 6 },
  });
  return true;
}

export function insertAppendix(view) {
  return insertBlockTag(view, "appendix");
}

export function insertReferences(view) {
  return insertBlockTag(view, "references");
}

export function insertBibEntry(view) {
  const { head } = view.state.selection.main;
  const line = view.state.doc.lineAt(head);
  const insert = "\n@article{label,\n  title={},\n  author={},\n  year={},\n}";
  const insertAt = line.to;
  view.dispatch({
    changes: { from: insertAt, insert },
    selection: { anchor: insertAt + 10, head: insertAt + 15 },
  });
  return true;
}

// --- Math commands ---

export function insertMathBlock(view) {
  const { head } = view.state.selection.main;
  const line = view.state.doc.lineAt(head);
  const insert = "\n$$\n\n$$";
  const insertAt = line.to;
  view.dispatch({
    changes: { from: insertAt, insert },
    selection: { anchor: insertAt + 4 },
  });
  return true;
}

export function insertMathInline(view) {
  return wrapSelection(view, "$", "$");
}

// --- Environments ---

export function insertTheorem(view) {
  return insertBlockTag(view, "theorem");
}

export function insertProposition(view) {
  return insertBlockTag(view, "proposition");
}

export function insertLemma(view) {
  return insertBlockTag(view, "lemma");
}

export function insertCorollary(view) {
  return insertBlockTag(view, "corollary");
}

export function insertProblem(view) {
  return insertBlockTag(view, "problem");
}

export function insertExercise(view) {
  return insertBlockTag(view, "exercise");
}

// --- Proofs ---

export function insertProof(view) {
  return insertBlockTag(view, "proof");
}

export function insertProofStep(view) {
  return insertBlockTag(view, "step");
}

export function insertSubproof(view) {
  return insertBlockTag(view, "p");
}

// --- Constructs ---

export function insertAssume(view) {
  return insertInlineTag(view, "assume");
}

export function insertCase(view) {
  return insertBlockTag(view, "case");
}

export function insertClaim(view) {
  return insertInlineTag(view, "claim");
}

export function insertDefine(view) {
  return insertInlineTag(view, "define");
}

export function insertLet(view) {
  return insertInlineTag(view, "let");
}

export function insertNew(view) {
  return insertInlineTag(view, "new");
}

export function insertPick(view) {
  return insertInlineTag(view, "pick");
}

export function insertProve(view) {
  return insertInlineTag(view, "prove");
}

export function insertSuchThat(view) {
  return insertInlineTag(view, "st");
}

export function insertSuffices(view) {
  return insertInlineTag(view, "suffices");
}

export function insertSuppose(view) {
  return insertInlineTag(view, "suppose");
}

export function insertThen(view) {
  return insertInlineTag(view, "then");
}

export function insertWlog(view) {
  return insertInlineTag(view, "wlog");
}

export function insertWrite(view) {
  return insertInlineTag(view, "write");
}

// --- Command registry for toolbar integration ---

export const RSM_COMMANDS = [
  // Formatting
  {
    id: "bold",
    label: "Bold",
    icon: "Bold",
    shortcut: "Mod-b",
    category: "formatting",
    execute: insertBold,
  },
  {
    id: "italic",
    label: "Italic",
    icon: "Italic",
    shortcut: "Mod-i",
    category: "formatting",
    execute: insertItalic,
  },
  {
    id: "heading",
    label: "Heading",
    icon: "Heading",
    shortcut: "Mod-Shift-h",
    category: "formatting",
    execute: insertHeading,
  },

  // Insert
  { id: "itemize", label: "List", icon: "List", category: "insert", execute: insertItemize },
  {
    id: "enumerate",
    label: "Numbered List",
    icon: "ListNumbers",
    category: "insert",
    execute: insertEnumerate,
  },
  { id: "figure", label: "Figure", icon: "Photo", category: "insert", execute: insertFigure },
  { id: "table", label: "Table", icon: "Table", category: "insert", execute: insertTable },
  {
    id: "codeInline",
    label: "Code Inline",
    icon: "Code",
    shortcut: "Mod-e",
    category: "insert",
    execute: insertCodeInline,
  },
  {
    id: "codeBlock",
    label: "Code Block",
    icon: "SourceCode",
    category: "insert",
    execute: insertCodeBlock,
  },
  {
    id: "comment",
    label: "Comment",
    icon: "SquareRoundedPercentage",
    shortcut: "Mod-/",
    category: "insert",
    execute: insertComment,
  },
  {
    id: "crossRef",
    label: "Cross-Reference",
    icon: "FileSymlink",
    category: "insert",
    execute: insertCrossRef,
  },
  {
    id: "citation",
    label: "Citation",
    icon: "Quote",
    shortcut: "Mod-Shift-c",
    category: "insert",
    execute: insertCitation,
  },
  {
    id: "url",
    label: "URL",
    icon: "Link",
    shortcut: "Mod-k",
    category: "insert",
    execute: insertUrl,
  },

  // Sections
  { id: "author", label: "Author", icon: "UserEdit", category: "sections", execute: insertAuthor },
  {
    id: "abstract",
    label: "Abstract",
    icon: "FileDescription",
    category: "sections",
    execute: insertAbstract,
  },
  {
    id: "toc",
    label: "Table of Contents",
    icon: "ListDetails",
    category: "sections",
    execute: insertToc,
  },
  {
    id: "appendix",
    label: "Appendix",
    icon: "SectionSign",
    category: "sections",
    execute: insertAppendix,
  },
  {
    id: "references",
    label: "References",
    icon: "SectionSign",
    category: "sections",
    execute: insertReferences,
  },
  {
    id: "bibEntry",
    label: "Bib Entry",
    icon: "Book2",
    category: "sections",
    execute: insertBibEntry,
  },
  // Math
  {
    id: "mathBlock",
    label: "Math Block",
    icon: "LayoutRows",
    shortcut: "Mod-Shift-m",
    category: "math",
    execute: insertMathBlock,
  },
  {
    id: "mathInline",
    label: "Math Inline",
    icon: "LayoutGrid",
    shortcut: "Mod-m",
    category: "math",
    execute: insertMathInline,
  },

  // Environments
  { id: "theorem", label: "Theorem", icon: "", category: "environments", execute: insertTheorem },
  {
    id: "proposition",
    label: "Proposition",
    icon: "",
    category: "environments",
    execute: insertProposition,
  },
  { id: "lemma", label: "Lemma", icon: "", category: "environments", execute: insertLemma },
  {
    id: "corollary",
    label: "Corollary",
    icon: "",
    category: "environments",
    execute: insertCorollary,
  },
  { id: "problem", label: "Problem", icon: "", category: "environments", execute: insertProblem },
  {
    id: "exercise",
    label: "Exercise",
    icon: "",
    category: "environments",
    execute: insertExercise,
  },

  // Proofs
  { id: "proof", label: "Proof", icon: "", category: "proofs", execute: insertProof },
  { id: "proofStep", label: "Proof Step", icon: "", category: "proofs", execute: insertProofStep },
  { id: "subproof", label: "Subproof", icon: "", category: "proofs", execute: insertSubproof },

  // Constructs
  { id: "assume", label: "Assumption", icon: "", category: "constructs", execute: insertAssume },
  { id: "case", label: "Case", icon: "", category: "constructs", execute: insertCase },
  { id: "claim", label: "Claim", icon: "", category: "constructs", execute: insertClaim },
  { id: "define", label: "Definition", icon: "", category: "constructs", execute: insertDefine },
  { id: "let", label: "Let", icon: "", category: "constructs", execute: insertLet },
  { id: "new", label: "New", icon: "", category: "constructs", execute: insertNew },
  { id: "pick", label: "Pick", icon: "", category: "constructs", execute: insertPick },
  { id: "prove", label: "Prove", icon: "", category: "constructs", execute: insertProve },
  { id: "st", label: "Such That", icon: "", category: "constructs", execute: insertSuchThat },
  { id: "suffices", label: "Suffices", icon: "", category: "constructs", execute: insertSuffices },
  { id: "suppose", label: "Suppose", icon: "", category: "constructs", execute: insertSuppose },
  { id: "then", label: "Then", icon: "", category: "constructs", execute: insertThen },
  { id: "wlog", label: "WLOG", icon: "", category: "constructs", execute: insertWlog },
  { id: "write", label: "Write", icon: "", category: "constructs", execute: insertWrite },
];

// --- Keymap extension for CodeMirror ---

export const rsmKeymap = keymap.of([
  { key: "Mod-b", run: insertBold },
  { key: "Mod-i", run: insertItalic },
  { key: "Mod-Shift-h", run: insertHeading },
  { key: "Mod-Shift-c", run: insertCitation },
  { key: "Mod-m", run: insertMathInline },
  { key: "Mod-Shift-m", run: insertMathBlock },
  { key: "Mod-e", run: insertCodeInline },
  { key: "Mod-k", run: insertUrl },
  { key: "Mod-/", run: insertComment },
]);
