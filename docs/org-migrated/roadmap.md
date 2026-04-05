# Studio Strategy

**Product**: Studio - Real-time collaborative editor for RSM (Readable Science Markup)

This document contains product-specific strategy for Studio. For Aris Program-wide strategy, see `/program/strategy/business-model.md`.

---

## Strategic Context: RSM is the Foundation

**RSM (Readable Science Markup) is the foundational idea that started the Aris Program.** Studio emerged as the collaborative editor for RSM, demonstrating what web-first scientific authoring could be. Press later emerged as an off-shoot to solve a more fundamental gap in academic publishing infrastructure (HTML-native preprints).

**Current Reality:**
- **Press:** Broader appeal, fills critical infrastructure gap, higher strategic priority (70-80% time)
- **Studio:** Niche tool for researchers who want to write directly in RSM, lower priority (10-20% time)
- **Relationship:** Both products funnel to each other and strengthen the web-first publishing ecosystem

Studio remains actively developed because RSM is core to the Aris vision, even though Press has wider market applicability.

---

## Product Vision

**What is Studio:**
A real-time collaborative web-based editor for writing research manuscripts in RSM. Think Overleaf but for the modern web - natural markup language, real-time collaboration, instant preview, zero installation.

**Core value proposition:**
- "Write research, not code"
- Real-time collaboration for research teams (computational research is team-based)
- Natural, readable markup (not LaTeX syntax)
- Instant preview (no compile errors, no build step)
- One-click publish to Press

**Target audience:**
- Computational research teams (primary beachhead)
- Multi-author papers (2-10 collaborators typical)
- Researchers tired of LaTeX complexity
- Teams wanting Google Docs-style collaboration with LaTeX-like power

---

## Strategic Reality: Multi-Player is V1, Not Future Feature

### Critical Clarification

**Studio was ALWAYS meant to be multi-player from V1.**

In 2026, most computational research is done in teams. Single-user editors don't compete with Overleaf or Google Docs. Real-time collaborative editing is **table stakes**, not a nice-to-have feature.

**V1 Requirements (Launch Blockers):**
1. **Real-time collaborative editing** - Multiple users editing simultaneously with conflict resolution
2. **LSP integration** - Syntax checking, diagnostics, autocomplete for RSM
3. **Live preview** - Instant rendering as you type
4. **Press integration** - One-click publish to Press
5. **Basic RSM features** - Citations, math, figures, tables, cross-references

**V1 includes collaboration + LSP.** After V1 ships, Studio continues active development with 10-20% of founder time allocation (bug fixes, small features, and enhancements based on user feedback).

---

## Competitive Positioning

### We Compete Directly with Overleaf

Studio is NOT just a "funnel to Press" - it's a collaborative authoring environment that competes with Overleaf for computational research teams.

**vs. Overleaf:**
- ✅ Real-time collaboration (same as Overleaf)
- ✅ Zero installation (same as Overleaf)
- ✅ Web-based (same as Overleaf)
- ✅ Multi-author support (same as Overleaf)
- **BETTER**: Natural markup (not LaTeX syntax)
- **BETTER**: Instant preview (no compilation errors)
- **BETTER**: HTML-first output (mobile-friendly, accessible)
- **BETTER**: Integrated with Press (one-click publishing)

**vs. Google Docs:**
- ✅ Real-time collaboration (same as Google Docs)
- ✅ Instant sync (same as Google Docs)
- ✅ Comment and suggestion mode (same as Google Docs)
- **BETTER**: Semantic markup preserved (not WYSIWYG corruption)
- **BETTER**: Version control built in (Git-friendly format)
- **BETTER**: Citations and math native (not awkward add-ons)
- **BETTER**: Export to any format (HTML, PDF, DOCX, LaTeX)

### Positioning Statement

"Studio is where research teams write together. Real-time collaboration like Google Docs, semantic power like LaTeX, web-native output that works everywhere. For teams who want to write naturally and publish beautifully."

---

## The Reading Ecosystem: Studio's True Moat

### The "My Copy" Reframe

**Original framing:** "Read together" - collaborative reading of papers
**Reality check:** Reading is solitary. Marginalia is private. "Read together" is not a thing people actually want.

**The real value proposition:**
- **Ownership** - Your copy of the paper, truly yours
- **Persistence** - Your annotations stay with you, not locked in someone else's platform
- **Organization** - Build your personal library with your own notes
- **Control** - Private annotations stay private; shared annotations are curated commentary

**Not collaboration, but ownership transfer:**
- Clone button language: "Add to library" or "Make it yours" — NOT "Read together"
- The paper becomes yours to annotate, organize, and keep
- Private layer is always yours; shared layer is optional curation

### Why This Matters: Zotero's Weakness

Zotero does shared annotations poorly:
- No private annotation layer (everything shared or nothing)
- Clunky sync between group libraries and personal libraries
- No threading or conversation on annotations
- Annotations feel like afterthought, not core feature

**Studio's advantage:**
- Private + shared layers coexist (annotate privately, selectively share)
- Semantic anchoring (annotations survive text changes)
- True ownership transfer (clone = full copy with independent annotation space)

### Clone Button Strategy

**Design principle:** Clone button is part of RSM rendered output, not Press chrome.

**Technical flow:**
1. Button rendered in every RSM document (Press, personal sites, wherever)
2. Click sends: RSM source + origin URL to Studio endpoint
3. Origin URL is canonical identifier (different URLs = different papers in your library)
4. This is why Press matters: permanent URLs = stable identity for clones

**Author control:** Authors can disable via `clone: false` in RSM frontmatter.

**Why this works:**
- Frictionless discovery ("I'm reading on Press, one click to add to my library")
- Origin URL tracking enables future sync (updates from Press → your copy)
- Works anywhere RSM is published (not just Press)

### The Moat: Private + Shared Annotation Layers

**What makes this defensible:**

1. **Semantic anchoring** - Annotations survive document changes (not just character offsets)
2. **Two-layer model** - Private notes + shared commentary in same interface
3. **Ownership model** - Clone transfers ownership, not just read access
4. **Press integration** - Permanent URLs make sync/updates possible
5. **Reading state is implicit** - Via annotations + minimap, no explicit "read/unread" tracking

**This is harder than it looks:**
- Zotero: no private layer, poor shared annotations
- Hypothesis: shared-first, weak personal library
- Readwise: highlights only, no semantic anchoring
- Notion: not designed for papers, weak citation integration

**The full stack moat:** RSM (semantic structure) + BRAIID (quality output) + Clone (ownership transfer) + Annotations (private + shared) + Press (permanent registry).

Nobody else has all of this.

---

## Business Model: Free-First with Optional Future Monetization

### Current Revenue Model: €0 (Free for all users)

Studio is **currently free for all users**. Press is free forever (no revenue target). Forum generates primary revenue (€20-40K/year target, see [founder-context.md](/program/operations/founder-context.md)). Studio's role is primarily strategic, not financial.

**Why free now:**
1. **Trust building** - Free collaborative editor builds credibility and community
2. **Bi-directional funnel** - Studio ↔ Press workflow strengthens both products
3. **Market positioning** - "Free Overleaf alternative" is powerful positioning
4. **Validation** - Must prove product-market fit before monetization

**Free tier (everyone, forever):**
- All core features (real-time editing, LSP, preview, export)
- Public and private documents
- Full Press integration
- Community support
- Basic storage and collaborator limits (sufficient for most users)

### Potential Future Monetization (if user demand exists)

**Freemium model if users request it:**
- **Free (always):** Core functionality never paywalled
- **Pro (€5-10/month):** Increased storage, more collaborators per document, priority support, advanced features based on user requests

**Potential paid features:**
- Increased storage limits (free tier covers typical usage)
- More collaborators per document (free tier sufficient for most research teams)
- Priority support
- Advanced features based on user feedback

**Decision point:** Only build paid tiers if users clearly signal willingness to pay. Basic functionality remains free forever.

---

## V1 Requirements and Roadmap

### V1 Launch Requirements — IMPLEMENTED (March 2026)

All V1 features are implemented. Collaboration spike completed with GO decision (January 29, 2026 approval, validated during Press beta Feb–Mar 2026). 40+ hardening commits since February.

**Core editor:** ✅ ALL COMPLETE
- ✅ CodeMirror 6 with RSM syntax highlighting
- ✅ Real-time collaborative editing (Y.js + CRDT)
- ✅ LSP integration (syntax checking, diagnostics, autocomplete)
- ✅ Multi-user cursor awareness (see where collaborators are typing)
- ✅ Live preview pane (instant RSM → HTML rendering)

**Collaboration features:** ✅ ALL COMPLETE
- ✅ Invite collaborators via link
- ✅ Real-time sync (<200ms P50 localhost, <500ms internet)
- ✅ Conflict resolution (automatic via CRDTs)
- ✅ Offline editing with sync on reconnect
- ✅ Version history (Git-like snapshots)

**RSM features:** ✅ ALL COMPLETE
- ✅ Citations (`[@smith2023]` with BibTeX integration)
- ✅ Math rendering (`$...$` and `$$...$$` with LaTeX-style syntax)
- ✅ Figures and tables
- ✅ Cross-references (`[@fig:results]`, `[@eq:schrodinger]`)
- ✅ Metadata (title, authors, abstract, keywords)

**Press integration:** ✅ ALL COMPLETE
- ✅ One-click "Publish to Press" button
- ✅ Metadata transfer (title, authors, abstract)
- ✅ Preview before publishing
- ✅ Update published papers from Studio

**Infrastructure:** ✅ ALL COMPLETE
- ✅ WebSocket collaboration server (y-websocket, supervisord-managed)
- ✅ Document persistence (PostgreSQL with Y.js snapshots)
- ✅ Authentication and authorization (document ownership and permissions)
- ✅ Export formats (HTML, PDF, DOCX, LaTeX)

### Post-V1: Active Development Continues

**After V1 ships, Studio continues active development** (10-20% of founder time):
- ✅ Bug fixes and security updates
- ✅ Small feature additions based on user feedback
- ✅ Performance improvements
- ✅ Integration enhancements (Press, export formats, etc.)
- ✅ Community contributions accepted (PRs reviewed and merged by founder)
- ✅ 10-20 hours/month development (manageable alongside Press priority work)

**Explicitly DEFERRED features (may reconsider based on demand):**
- ❌ Advanced commenting/suggestion mode (use Google Docs if needed)
- ❌ Track changes (use Git for version control)
- ❌ Offline-first mobile app (web-only is sufficient)
- ❌ Plugin system (adds maintenance burden)
- ❌ AI content generation (generating research content on behalf of the researcher is out of scope)

**Agent collaboration (shipped, annotation-scoped):** Studio's CLI enables AI agents as structured collaboration participants for wordsmithing — prose refinement within the scope of human annotations only. Agents cannot generate content, write new sections, or edit outside annotation boundaries. See vision.md for full details.

**Philosophy:** Studio serves as the living reference implementation of RSM. It does collaborative RSM editing exceptionally well and evolves alongside the RSM specification. New features are added thoughtfully based on user demand and RSM language evolution, but Press remains the higher strategic priority (70-80% vs 10-20% time allocation).

---

## Technical Architecture

### Editor Stack (Validated)

**CodeMirror 6 + Y.js + WebSocket:**
- **CodeMirror 6** - Text editor framework (150KB, modular, extensible)
- **Y.js** - CRDT library for conflict-free real-time sync
- **y-codemirror.next** - Y.js binding for CodeMirror 6
- **WebSocket server** - y-websocket or Hocuspocus for production (auth, persistence, scaling)

**LSP Integration (Backend):**
- **Server-side RSM LSP** (not WASM - simpler, no position mapping complexity)
- LSP server watches Y.Doc updates via WebSocket
- Parses RSM on change (debounced 500ms)
- Broadcasts diagnostics to all clients via WebSocket
- CodeMirror 6 diagnostic extension renders errors/warnings

**Why this stack:**
- Battle-tested (Y.js used by Notion, Linear, Figma-like tools; Overleaf and Typst prove real-time collab works)
- Open source (MIT license, self-hostable)
- Scalable (WebSocket server handles 1000+ concurrent editors)
- Maintainable (backend LSP avoids browser position mapping complexity)
- Pragmatic (95%+ semantic preservation + rollback > 99.9% perfection)

### Implementation Timeline — COMPLETED

**Phase 1: Spike — COMPLETE (Feb–Mar 2026)**
- Approved January 29, 2026. Validated during Press beta (Feb 3 – Mar 9, 2026).
- **Decision: GO.** All criteria met:
  - ✅ 95%+ semantic preservation under concurrent edits
  - ✅ Latency <200ms (P50 localhost), <500ms internet
  - ✅ Memory <100MB for 10K-line documents
  - ✅ Rollback from snapshot: 100% reliability
  - ✅ No blocking edge cases

**Phase 2: Production Integration — COMPLETE**
- WebSocket server (y-websocket, backend-as-client architecture)
- Document persistence (PostgreSQL with Y.js snapshots, 500ms debounce)
- Snapshot system (version history with named snapshots)
- Rollback UI (restore from any historical version)
- Connection state UI (connected/syncing/offline indicator)
- Document ownership and collaborator invitations

**Phase 3: Backend LSP Integration — COMPLETE**
- RSM LSP server running via supervisord alongside backend and multiplayer
- Parses RSM on change (debounced)
- Generates diagnostics (syntax errors, warnings)
- Broadcasts diagnostics to all clients via WebSocket
- CodeMirror 6 diagnostic extension renders errors inline
- Semantic token highlighting (BRAIID color system)

**Phase 4: Invite-Only Beta — CURRENT (blocked on bug fixes)**
- Studio V1 feature-complete but significant bugs remain — not ready for closed beta yet
- Beta blocklist being defined (March 2026) to establish clear gate for inviting research teams
- First waitlist signup received from Press showcase paper exposure (March 2026) — validates demand
- Target: 10-20 research teams (2-5 members each)
- Write multi-author papers in Studio
- Collect bugs, edge cases, testimonials
- 16 collaboration-specific E2E tests validating multi-user editing, persistence, cleanup, semantic preservation
- 40+ hardening commits since February (backslash preservation, DB deadlock fixes, E2E reliability)

### Rollback Strategy (Data Loss Prevention)

**Philosophy:** Fast recovery > perfect preservation. Y.js will occasionally produce invalid merges. Rollback lets users recover quickly instead of requiring 99.9% semantic perfection.

**Implementation:**
- **Auto-snapshot every 15 minutes** during active editing
- **Manual "Save version" button** when user wants checkpoint
- **Keep last 50 snapshots** per document (~1-2 days of history)
- Store both Y.js binary state + plain RSM text (for emergency recovery)

**Rollback UI:**
```
[Document corrupted or wrong edits?]
┌─────────────────────────────────────┐
│ Restore from earlier version:       │
│ ○ 5 minutes ago                     │
│ ○ 15 minutes ago                    │
│ ○ 1 hour ago                        │
│ ○ 3 hours ago                       │
│ [Restore] [Cancel]                  │
└─────────────────────────────────────┘
```

**Risk mitigation:**
- If Y.js garbles 1-2 sentences → User restores from 5-15 min ago (loses minutes of work, not hours)
- If Y.js completely corrupts document → Restore from last snapshot (max 15 min loss)
- Plain RSM export available as failsafe (manual recovery if all else fails)

**Implementation time:** 2-3 days in Phase 2

### Observability Strategy (Minimal for V1)

**Philosophy:** Start simple, add complexity only if problems emerge. With 10-20 beta users, console logs + UI indicator is sufficient.

**Client-side (Browser):**
- Y.js sync events logged to console (`update`, `status`, `sync`)
- User-visible sync indicator: `● Connected | ○ Syncing | ✕ Offline`
- No external error tracking initially (add Sentry post-launch if needed)

**Server-side (WebSocket server):**
- Log connections, disconnections, room state
- Log large updates (>100KB is suspicious, may indicate issue)
- Simple console logging (no external monitoring initially)

**Post-launch (if issues arise):**
- Add error tracking (Sentry) for crashes
- Add metrics (connection count, update rate)
- Add alerting (WebSocket server down)

**For beta with 10-20 users: Console logs sufficient. Add monitoring only if problems emerge.**

---

## Success Metrics

### Invite-Only Beta (Q1-Q2 2026, CURRENT)

**Beta format: Invite-only.** Recruit 10-20 computational research teams (2-5 members each) who are actively writing papers. Focus on teams that will exercise real-time collaboration, not curious individuals.

**Beta metrics:**
- 10-20 beta testers (research teams with 2-5 members)
- 5+ multi-author documents successfully written
- <5 critical bugs reported
- 10+ testimonials collected

**Success criteria for public launch:**
- Beta users can write multi-author papers without corruption
- Real-time sync works reliably (<200ms P50 latency, no data loss)
- LSP diagnostics are helpful (not annoying or buggy)
- "Would you recommend Studio?" - 8/10 or higher from beta users

### Post-Launch (V1 Validation, Q4 2026)

**Primary metric: Do Studio and Press reinforce each other?**
- **Target**: By Q4 2026, 20-40% of Press papers authored in Studio
- **Target**: Studio authors regularly publish to Press (bi-directional funnel)
- Both products strengthen each other's value proposition
- **Note**: Press is in showcase/public beta phase (March–April 2026). Studio → Press funnel metrics depend on Press having active community users.

**Secondary metrics:**
- Weekly Active Users: 200+ by Q4 2026
- Documents with 2+ collaborators: 60%+ (validation that multi-player is used)
- 30-day retention: 40%+ (researchers return to Studio)
- Average session length: 30+ minutes (deep writing sessions)

**Qualitative:**
- 10+ unsolicited testimonials ("Studio changed my workflow")
- 5+ research teams switch from Overleaf to Studio
- Community contributions (PRs, bug reports, feature requests)

### Ongoing Development (2027-2030)

**Time allocation:**
- 10-20 hours/month development (bug fixes, small features, enhancements)
- Press remains higher priority (70-80% vs 10-20% allocation)
- Community PRs accepted and reviewed by founder (1-3 per quarter)

**If development burden exceeds 30 hours/month consistently:**
- WARNING SIGNAL - Studio competing with Press priority, re-evaluate scope

---

## Go-to-Market Strategy

### Launch Strategy (Q1-Q3 2026)

**Invite-only beta (Q1-Q2 2026, CURRENT):**
- V1 features complete — recruiting 10-20 computational research teams
- Focus on teams actively writing papers (not just curious lurkers)
- Collect feedback on collaboration workflow
- Fix critical bugs before public launch
- Gather testimonials for launch day

**Public launch (Q2-Q3 2026):**
- Bluesky thread with multi-author editing demo
- Post in Posit Community and Quarto GitHub Discussions
- Academic Twitter thread
- Mastodon cross-post (fosstodon.org, scholar.social)
- Reddit: r/LaTeX, r/AskAcademia, r/compsci
- Emphasize: "Free Overleaf alternative for web-native research"

**Launch goals:**
- 100 signups in first week
- 20 multi-author documents created in first month
- 5+ testimonials from beta users
- 15%+ referral rate (word-of-mouth)

### Growth Channels (Organic Only)

**Primary channels:**
- Word-of-mouth in computational research communities
- Press integration (Studio → Press workflow showcases Studio)
- GitHub (open source visibility)
- Academic Twitter/Mastodon
- Conference talks (1-2 talks/year, demo multi-author editing)

**Secondary channels:**
- Technical blog posts ("Building real-time collaboration for research")
- Comparison posts ("Overleaf vs Studio", "Google Docs vs Studio for research")
- University mailing lists (selective, respectful announcements)

**Avoid:**
- Paid advertising (no budget, not cost-effective)
- Product Hunt (consumer bias, low academic presence)
- Mass email campaigns (spam risk)

---

## Integration Strategy

### Press Integration (Critical)

**Goal:** Studio ↔ Press bi-directional funnel strengthens both products.

**Studio → Press (one-click publish):**
- "Publish to Press" button in Studio (one-click)
- Metadata transfer (title, authors, abstract, keywords)
- Preview before publishing (see what Press paper will look like)
- Update published papers from Studio (edit and re-publish)

**Press → Studio (optional editing flow):**
- Press papers can link: "Edit this paper in Studio" (if originally RSM)
- Promotes Studio as authoring environment for web-native papers
- Cross-pollination strengthens both products

**Success metric:** By Q4 2026, 20-40% of Press papers authored in Studio (after Studio V1 ships Q3)

### Reference Manager Integration

**Supported:**
- Zotero import (researchers paste BibTeX library)
- Autocomplete citations (type `[@smi` → suggest Smith et al.)
- BibTeX export (for users who want to migrate to LaTeX)

**Why:** Citations are NON-NEGOTIABLE for academic papers. This is table stakes.

### External Tool Integration (Future, Maybe)

**Potential (NOT V1):**
- Import from Google Docs (markdown conversion)
- Import from LaTeX (syntax conversion to RSM)
- Import from Quarto (markdown dialect compatibility)
- Git integration (version control for power users)

**Decision:** Defer until V1 validated. Focus on core collaboration first.

---

## Competitive Moats and Defensibility

### What Is NOT a Moat

**Semantic markup alone:**
- AI can increasingly infer structure from plain text (GPT-4 can convert LaTeX → structured JSON)
- Semantic slicing is nice but not novel enough to justify learning new markup
- Typst has semantic structure, Quarto has structured output
- Moat is weakening as AI improves

**"Read together" collaboration:**
- People don't actually want this (reading is solitary, marginalia is private)
- Google Docs already does real-time for those who want it
- Not a differentiator in academic workflow

**Semantic slicing/reuse:**
- Nice feature but not compelling enough standalone
- Curvenote has this, hasn't driven massive adoption
- Content reuse is future-thinking, but researchers write papers, not modular content blocks

### What IS a Moat

**1. Web-native from the start (not PDF-first with HTML export):**
- Typst is PDF-first, HTML is afterthought
- LaTeX is PDF-only
- RSM is designed for web, PDF is export target
- BRAIID quality as default output (not "good enough" HTML)

**2. Static + interactive (not executable documents):**
- Quarto is executable-first (notebooks, code execution)
- RSM is static with interactive embeds (no runtime, no dependency rot)
- Works forever, no "kernel died" or "dependencies outdated"

**3. The reading ecosystem (clone, annotate, own):**
- Nobody else has: clone button → personal library → private + shared annotations
- Ownership transfer model (not just read access)
- Semantic anchoring for annotations
- This is the real moat - the full reading workflow, not just authoring

**4. BRAIID quality as default:**
- Distill-level quality with 1% of the effort
- "Write RSM. Get BRAIID." - beautiful output is default, not optional
- Design system can become certification standard (if Aris gains traction)

**5. Press as permanent registry:**
- Permanent URLs that don't break
- DOIs for HTML-native research
- Clone button works because URLs are stable
- Future: sync updates from Press → your clone

### The Full Stack Is the Moat

No single piece is defensible. The combination is:

**RSM** (semantic structure) + **BRAIID** (quality rendering) + **Clone** (ownership transfer) + **Annotations** (private + shared layers) + **Press** (permanent URLs) = **Reading ecosystem nobody else has**

Overleaf has authoring. Zotero has library management. Hypothesis has annotations. Press has archival.

Studio has all of it, integrated.

---

## Strategic Risks

### Risk 1: Collaboration Complexity Underestimated — RESOLVED

**Original concern:** Y.js + RSM semantic validation might take 6+ months.

**Outcome:** Spike completed Feb–Mar 2026 with GO decision. All V1 features implemented. 95%+ semantic preservation, <200ms P50 latency, 100% rollback reliability. 40+ hardening commits since February. This risk is retired.

### Risk 2: Y.js Produces Invalid RSM Merges (LOW-MEDIUM IMPACT)

**If Y.js occasionally garbles sentences or corrupts syntax during concurrent edits:**
- User frustration ("I lost 5 minutes of work")
- Some users abandon Studio for Overleaf
- Negative word-of-mouth in academic communities

**Reality check (pragmatic risk assessment):**
- Overleaf and Typst have real-time collab - occasional merge issues are tolerated
- Computational research = code/data elsewhere, paper is writeup (not research artifact itself)
- Garbled sentence ≠ lost research (unlike wet lab notebook corruption)
- Users understand collaborative editing has tradeoffs

**Mitigation:**
- **Rollback system** - Restore from snapshot (every 15 min) if corruption occurs
- **Zero data loss via recovery** (not via perfect merging)
- User loses max 15 minutes of work, not hours/days
- Export plain RSM as failsafe (manual recovery option)
- Beta testing with 10-20 teams surfaces major edge cases before public launch

**Acceptable outcome:** 95%+ semantic preservation + fast rollback = good enough for V1

### Risk 3: Studio Becomes Maintenance Burden (MEDIUM IMPACT)

**If ongoing development exceeds 30 hours/month consistently:**
- Studio competes with Press priority (should be 70-80% Press, 10-20% Studio)
- Real-time sync bugs are hard to debug (Y.js, WebSockets, CRDTs)
- Founder time diverted from higher-priority Press work

**Mitigation:**
- Keep V1 scope tight (no feature creep during development)
- Comprehensive testing before V1 (reduce post-launch bugs)
- Simple observability (console logs sufficient initially)
- Backend LSP simpler than WASM (avoids position mapping complexity)
- If burden exceeds 30 hrs/month for 2+ quarters: Re-evaluate Studio scope or sunset

### Risk 4: Users Don't Need Real-Time Sync (LOW IMPACT)

**If <40% of documents have 2+ collaborators, or users prefer async collaboration:**
- Real-time sync overhead not justified
- Users could use simpler async tools (Google Docs + export, Git-based workflow)

**Counter-evidence:**
- Overleaf's 15M users prove academics want real-time collab
- Computational research is team-based (60%+ multi-author papers)
- Strategy already validated target audience wants this

**Mitigation:**
- Beta test with research TEAMS (not solo researchers)
- Measure: 60%+ of documents should have 2+ collaborators
- If metric fails: Collaboration is available but not primary use case (acceptable outcome)

### Risk 5: Studio ↔ Press Funnel Doesn't Work (MEDIUM IMPACT)

**If <10% of Press papers authored in Studio AND Studio users don't publish to Press:**
- Bi-directional funnel fails
- Studio and Press don't reinforce each other
- Studio development doesn't justify 4-5 months investment

**Mitigation:**
- Studio → Press integration is seamless (one-click publish, metadata transfer)
- Press → Studio optional ("Edit in Studio" link for RSM papers)
- Target: 20-40% of Press papers from Studio (bi-directional funnel working)
- If metric fails: Re-evaluate Studio scope or reduce to maintenance mode

---

## Identified Gaps and Deferred Work

### V1 Implementation Gaps

These require design/implementation work before V1 launch:

**User experience flows:**
- Ownership transfer UI (how to gift/transfer document ownership)
- Invitation flow details (email invites, link sharing, permission selection)
- Error states (network errors, sync failures, invalid RSM)
- Loading states (initial load, background sync, publishing to Press)
- Empty states (no documents, no collaborators, no annotations)

**Data and assets:**
- Asset management (images, data files embedded in documents)
- Undo behavior (local undo vs distributed undo in collaborative context)

**Note:** These are documented as beads in the studio repo, not here.

### Operational Gaps

Infrastructure concerns for production deployment:

**Scalability:**
- y-websocket scaling strategy (single server vs distributed)
- Y.js document persistence strategy (PostgreSQL, backup frequency)
- Asset storage (S3-compatible, CDN strategy)
- Rate limiting (prevent abuse, fair usage limits)

**Reliability:**
- Connection pooling and load balancing
- Graceful degradation when services fail
- Data backup and disaster recovery

### Observability Gaps

Monitoring and metrics for production:

**Key metrics to track:**
- Error rates (sync failures, LSP crashes, rendering errors)
- Latency (WebSocket round-trip, LSP response time, rendering time)
- Funnels (signup → first document, document → publish to Press)
- User behavior (session length, documents per user, collaboration patterns)

**Implementation:** Start with simple logging (V1), add comprehensive monitoring post-launch based on actual needs.

### AI Integration (Deferred to V3+)

Potential AI features NOT in V1 or V2:

- Semantic-aware writing assistance (citation suggestions, structure feedback)
- Natural language queries ("find papers about X in my library")
- Automatic metadata extraction from citations
- Smart annotation suggestions

**Decision:** Focus on core editing/reading workflow first. AI adds complexity and cost. Consider only after product-market fit is proven.

---

## Decision-Making Framework

### When Evaluating Studio Feature Requests

**Ask:**
1. Is this required for V1 launch? (collaboration, LSP, preview, Press integration)
2. Does this improve retention or just delight?
3. Can this be deferred to community contributions?
4. What's the maintenance burden?
5. Does this support RSM evolution or respond to validated user demand?

**If 3+ answers are "no" or "high burden" → Defer or reject.**

**Note:** Studio continues active development after V1 (10-20% time allocation), serving as the living RSM reference implementation. See `decisions/2026-02-studio-development-model.md` for details.

### When Considering Sunsetting Studio

**Triggers for sunsetting:**
- Maintenance burden >20 hours/month for 2+ quarters
- <10% Press adoption rate (Studio fails funnel job)
- Community contributions drop to zero (no one cares)
- Emerging tool makes Studio obsolete (e.g., Overleaf adds HTML support)

**If sunsetting:** Recommend Overleaf or Google Docs, sunset gracefully with 6-month notice.

---

## Success Criteria

### By Q2-Q3 2026 (V1 Launch)

- ✅ Real-time collaboration works reliably (no data loss, <200ms P50 latency)
- ✅ LSP provides useful diagnostics (not annoying or buggy)
- ✅ 10+ beta teams successfully write multi-author papers
- ✅ Studio → Press integration is seamless
- ✅ 5+ testimonials: "Studio changed my workflow"

### By Q4 2026 (Post-Launch Validation)

- ✅ 200+ weekly active users
- ✅ By Q4 2026, 20-40% of Press papers authored in Studio (after Studio V1 ships Q3)
- ✅ 60%+ of documents have 2+ collaborators (validation of multi-player)
- ✅ 40%+ 30-day retention
- ✅ 10-20 hours/month development time (manageable alongside Press priority)

### By 2027-2030 (Ongoing Development)

- ✅ Studio continues active development with 10-20 hours/month founder time
- ✅ Studio and Press strengthen each other (bi-directional funnel working)
- ✅ Small feature additions based on user feedback
- ✅ Studio remains stable, reliable, manageable
- ✅ Evaluation of monetization potential (if 500+ active users reached)

**If any "CRITICAL METRIC" fails: Re-evaluate Studio's role in portfolio. Consider reducing scope or sunsetting if not providing value.**

---

**Next review**: After invite-only beta results (Q2 2026) or after public launch (Q2-Q3 2026)
