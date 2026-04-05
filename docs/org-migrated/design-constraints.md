# Studio Design Constraints

Core technical and architectural constraints that shape Studio product decisions.

---

## AI-Mediated Consumption Pattern (Added Feb 2026)

**Context:** [Scholarly Kitchen research](https://scholarlykitchen.sspnet.org/2026/02/12/guest-post-theres-an-elephant-in-the-room-but-not-in-your-usage-reports/) shows researchers increasingly access scholarly content through AI intermediaries rather than reading directly. Research is consumed by AI tools that synthesize and redistribute it.

**Design Constraint:** Authors using Studio should write assuming AI-mediated consumption as the primary access pattern, not just direct human reading.

### Implications for Studio Architecture

**1. Semantic Clarity is Primary, Not Optional**
- RSM's semantic structure ensures AI tools correctly understand and cite research
- Authors need to produce machine-readable content by default
- Syntax checking is table stakes; semantic validation becomes critical
- Studio should guide authors toward AI-interpretable structure

**2. LSP Should Validate Semantic Clarity (Future)**
- Beyond syntax errors: warn when structure might confuse AI synthesis
- Example warnings:
  - "This section heading is ambiguous—consider more specific label"
  - "Citation reference unclear—specify which finding you're referencing"
  - "Figure without semantic alt text—AI tools won't understand context"
- Post-V1 enhancement, not launch blocker

**3. Metadata Completeness is Critical**
- Title, authors, affiliations, keywords, abstract must be complete and structured
- AI tools rely on metadata for discovery and citation
- Studio should validate metadata completeness before publishing to Press
- Template/scaffolding should encourage comprehensive metadata

**4. Export Formats Must Preserve Semantics**
- HTML export: Full RSM semantic structure preserved
- PDF export: Embedded metadata for AI parsing (structured PDF/A)
- Plain text export: Markdown-like with semantic annotations
- AI tools should get same semantic content regardless of format

**5. Citation Infrastructure**
- BibTeX integration is non-negotiable (already planned for V1)
- Citation autocomplete helps authors cite accurately
- Proper citation metadata ensures AI tools can verify and link sources
- Citation graph becomes discovery infrastructure for AI tools

### What Authors Need to Know

**Capturing for RX:** Authors need to write assuming AI-mediated consumption. This means:

- **Clear structure:** Section headings that explicitly state content (not clever/vague)
- **Explicit citations:** "Smith et al. (2023) found X" not just "[1] found X"
- **Semantic markup:** Use RSM features (cross-refs, labels) so AI can link content
- **Complete metadata:** AI discovery depends on accurate keywords/affiliations

**Studio's role:** Guide authors toward AI-interpretable content without adding friction.

### Decision Points

**V1 Launch (No AI-specific features):**
- ✅ RSM semantic structure is already AI-friendly by design
- ✅ Metadata validation ensures completeness
- ✅ Citation infrastructure (BibTeX) supports proper attribution
- ❌ No AI-specific warnings/suggestions (deferred to post-V1)

**Post-V1 (if user demand exists):**
- [ ] LSP semantic clarity warnings (e.g., "ambiguous section heading")
- [ ] Metadata completeness checklist before publish
- [ ] "AI-readiness score" showing how machine-interpretable paper is (optional, user-requested only)

**Never Build:**
- AI writing assistance (authors write, not AI)
- AI-generated summaries in Studio
- AI recommendation for what to write

### Why This Constraint Matters for Studio

**Competitive advantage:** Studio produces RSM, which is natively machine-readable. Competitors (Overleaf with LaTeX, Google Docs with WYSIWYG) produce content AI tools must parse heuristically.

**Authors benefit:** Papers written in Studio are more discoverable and correctly cited by AI tools, increasing research impact.

**Network effects:** As AI-mediated access grows, researchers will prefer authoring tools that produce AI-friendly output.

---

## Other Design Constraints

### Real-Time Collaboration is V1 Requirement

Multi-player editing is table stakes, not future feature. Computational research is team-based. See [Studio Roadmap](/products/studio/strategy/roadmap.md).

### Web-Native Output, Not PDF-First

RSM designed for web, PDF is export target (not primary format). Static + interactive, not executable.

### LSP Integration for Syntax Validation

Server-side RSM LSP for syntax checking, diagnostics, autocomplete. Not WASM (avoids position mapping complexity).

---

**Related Documentation:**
- [AI-Mediated Access Research](/cross/market/research/2026-02-ai-mediated-access.md)
- [Studio Roadmap](/products/studio/strategy/roadmap.md)
- [RX Insights](/program/strategy/rx-insights.md)
