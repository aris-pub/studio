# Studio Strategy

**Product**: Studio - Web-native manuscript editor
**Last Updated**: January 8, 2026

This document contains product-specific strategy for Studio. For Aris Program-wide strategy, see `/Users/leo.torres/.claude/specialists/STRATEGY.md`.

---

## Product Vision

**What is Studio:**
A web-native manuscript editor that enables researchers to write manuscripts in HTML from the start - no Pandoc, no conversion, no afterthought.

**Core value proposition:**
- "Write web-native manuscripts from the start"
- No LaTeX → Pandoc → HTML conversion pipeline
- Direct integration with Press (one-click publish)
- Markdown-based with live preview

**Target audience:**
- Computational researchers writing interactive papers
- Anyone frustrated with LaTeX → PDF → HTML conversion
- Researchers who want to write once, publish everywhere (web-first)

---

## Strategic Role in Portfolio

### Studio is NOT a Revenue Product

**Business model:** Free forever, feature-frozen

**Why free:**
- Drives users into Press (write in Studio → publish in Press)
- Completes the "web-native from start" narrative
- Low maintenance burden (no feature requests to fulfill)
- Community goodwill (generous free tier builds trust)

**Why feature-frozen:**
- Solo founder has 10-15 hrs/week total capacity
- Press and Forum are revenue products (priority)
- Studio at "basic level" is sufficient for MVP value
- Avoid feature creep and ongoing development burden

### Studio as Press Funnel

**User flow:**
1. Researcher discovers Press (reads a paper)
2. Wants to publish their own paper
3. "Write in Studio" CTA on Press
4. Writes in Studio (free)
5. Publishes to Press (free or paid)

**Studio's job:** Feed users into Press ecosystem

**Success metric:** % of Press papers authored in Studio (target: 30-50%)

---

## Product Scope: "Basic Level" Definition

### What Studio IS (Launch Features)

**Core features only:**
1. **Markdown editor** with live HTML preview
2. **Press integration** - One-click export to Press format
3. **Basic collaboration** - Share draft link with co-authors (read-only)
4. **Auto-save** - Don't lose work (local storage + cloud sync)
5. **Export** - Download as HTML, Markdown, PDF (basic)
6. **Templates** - 3-5 basic paper templates (IMRaD, etc.)

**Time to build:** Already 90% complete

**Maintenance burden:** 5-10 hours/month (bug fixes, minimal support)

### What Studio is NOT (Explicitly Excluded)

**NOT included (to keep it "basic"):**
- ❌ Real-time collaborative editing (too complex, use Google Docs if needed)
- ❌ Advanced version control (use git or defer)
- ❌ Reference management (integrate Zotero externally or defer)
- ❌ Advanced formatting tools (keep it simple, Markdown-based)
- ❌ Paid features (no monetization, ever)
- ❌ Team workspaces (defer to Press institutional tier)
- ❌ Offline-first mode (web-only is fine for MVP)

**Philosophy:** Studio does ONE thing well (write web-native manuscripts), not everything.

---

## Launch Strategy

### Timing: Launch with Press (Q1 2026)

**Why together:**
- Both products are 90%+ ready
- Complete "write → publish" story from day one
- Stronger portfolio positioning ("Aris Program ecosystem")
- Natural integration (Studio → Press workflow)

**Why not separate:**
- Studio alone has no destination (where do you publish?)
- Press alone has friction (where do you write web-native content?)
- Together they tell a complete story

### Beta Testing (2-3 Weeks Before Public Launch)

**Beta goals:**
- 10-20 researchers test Studio
- Validate Studio → Press workflow works
- Fix critical bugs
- Gather testimonials for launch

**Beta process:**
- Invite computational researchers (target audience)
- Ask them to write a short paper in Studio
- Publish to Press in one click
- Collect feedback on friction points

### Public Launch (Q1 2026)

**Launch messaging:**
- "Studio: Write web-native manuscripts from the start"
- "No Pandoc, no conversion, no afterthought"
- "Publish directly to Press in one click"

**Launch channels:**
- Hacker News: "Show HN: Studio + Press – Web-native research publishing"
- Academic Twitter: Demo of write → publish workflow
- Reddit (r/AskAcademia, computational science subreddits)

---

## Feature-Frozen Policy

### What "Feature-Frozen" Means

**After launch:**
- No new features added
- Bug fixes only
- Security updates only
- Minimal UI polish if critical usability issues

**Banner on Studio:**
> "Studio is in maintenance mode. Core features are stable and free forever. For advanced features, we recommend integrating with [other tools]."

**Redirect feature requests:**
- "Studio is feature-frozen to keep it free and simple"
- "For advanced collaboration, try Google Docs + Studio export"
- "For version control, use git with Studio's Markdown files"
- "Focus is on Press (publishing platform)"

### When to Unfreeze (Rare Exceptions)

**Only unfreeze if:**
1. Critical security vulnerability requires feature change
2. Press integration breaks and requires Studio update
3. Studio becomes MORE popular than Press (strategic pivot)
4. After Forum + Press generate €50k+ ARR and can fund Studio development

**Otherwise: Stay frozen, stay simple, stay free**

---

## Pricing Model

### Free Forever

**All features free for everyone:**
- Students, researchers, faculty, institutions
- No paid tiers, no freemium
- No premium features locked behind paywall

**Why this works:**
- Studio doesn't generate revenue (Press does)
- Studio drives Press adoption (its value is strategic, not financial)
- Generous free product builds trust for paid Press features

---

## Integration Strategy

### Press Integration (Critical)

**Goal:** Seamless Studio → Press publishing workflow

**Implementation:**
- "Publish to Press" button in Studio
- Export Studio document to Press-compatible format
- Metadata transfer (title, authors, abstract, keywords)
- Preview before publishing
- One-click publish (no copy-paste, no manual export)

**Success metric:** 30-50% of Press papers authored in Studio

### External Tool Integration (Future, Low Priority)

**Possible integrations (only if trivial to implement):**
- Zotero (reference management, if they have an API)
- Quarto (convert Quarto documents to Studio format)
- Jupyter (import Jupyter notebooks into Studio)

**Decision criteria:** Only integrate if <10 hours effort and high user demand

---

## Technical Constraints

### Architecture

**Current stack:**
- Frontend: Vue.js (or similar)
- Storage: Cloud sync (S3 or equivalent)
- Authentication: Shared with Press (single account across products)

**Keep it simple:**
- No complex backend (mostly frontend + storage)
- No real-time sync (auto-save every 30 seconds is fine)
- No complex collaboration (read-only sharing is sufficient)

### Scalability

**Not a concern:**
- Studio is mostly client-side (browser does the work)
- Storage costs are low (text files are tiny)
- Marginal cost per user: ~€0.10/month

**If costs become an issue:**
- Cap free tier to 50 documents (generous but not infinite)
- Or require users to pay for Press if they want unlimited Studio docs

---

## Success Metrics

### Launch Success (Q1 2026)

- ✅ 200+ Studio signups in first month
- ✅ 50+ manuscripts written in Studio
- ✅ 20+ papers published to Press from Studio
- ✅ Studio → Press workflow works smoothly (no major bugs)

### Ongoing Success (Maintenance Mode)

- ✅ 30-50% of Press papers authored in Studio
- ✅ <5 hours/month maintenance time
- ✅ <€100/month infrastructure costs
- ✅ Low support burden (<5 tickets/month)

### Failure Signals (When to Sunset)

- ❌ <10% of Press papers use Studio (not fulfilling funnel role)
- ❌ >20 hours/month maintenance (becoming a burden)
- ❌ High support burden (feature requests, bugs, complaints)
- ❌ After 12 months, no traction (consider sunsetting)

**If any failure signal persists for 6+ months → Consider sunsetting Studio**

---

## Competitive Positioning

### Direct Competitors (Web-Based Writing Tools)

**Overleaf (LaTeX editor):**
- Strengths: Established, powerful, LaTeX ecosystem
- Weaknesses: LaTeX complexity, PDF-first, conversion required for web
- Our differentiation: Web-native from start, simpler, Markdown-based

**Google Docs:**
- Strengths: Real-time collaboration, familiar UI
- Weaknesses: Not designed for academic papers, poor export options
- Our differentiation: Academic-first, direct Press integration

**Notion:**
- Strengths: Flexible, beautiful, popular
- Weaknesses: Not academic-focused, no publishing workflow
- Our differentiation: Academic use case, Press integration

**Quarto / RMarkdown:**
- Strengths: Powerful, reproducible, open source
- Weaknesses: Requires R/Python knowledge, command-line based
- Our differentiation: Web-based, no code required, simpler

### Positioning Statement

"Studio is for researchers who want to write web-native manuscripts without LaTeX or Pandoc. Unlike Overleaf or Google Docs, Studio is purpose-built for academic papers that publish as interactive HTML, not PDFs."

---

## Competitive Positioning vs Curvenote SCMS

### Key Differentiators

**Universal Format Support vs MyST Lock-In:**
- Studio: Write in Typst, LaTeX, Markdown, Quarto, Jupyter, or MyST - export to any format
- Curvenote SCMS: MyST Markdown only, limited to Jupyter ecosystem
- Advantage: We're a universal layer, not a format-specific tool. Researchers choose their preferred workflow, we adapt.

**Write in Any Format, Publish Anywhere:**
- Studio: Format-agnostic editor that exports to Press, arXiv, journals, or any destination
- Curvenote SCMS: Tightly coupled authoring and publishing platform (vendor lock-in)
- Advantage: Studio is a tool, not a platform. No lock-in, no forced ecosystem.

**MyST Support as Input Format (Embrace the Standard):**
- Priority integration: Add MyST Markdown import/export (2-3 days of work)
- Position Studio as "works with MyST + everything else"
- Don't fight the standard - support it alongside Typst, LaTeX, and Quarto
- Advantage: MyST users can use Studio without abandoning their ecosystem

**Simplicity vs All-in-One Complexity:**
- Studio: Focused writing tool that does ONE thing well (manuscript editing)
- Curvenote SCMS: Monolithic platform trying to be authoring + CMS + publishing + collaboration
- Advantage: Unix philosophy - do one thing excellently rather than everything adequately

**Strategic Positioning:** Studio is not competing with Curvenote's institutional platform. We're a standalone editor that happens to integrate with Press. If researchers prefer MyST, we'll support it. Our moat is format freedom, not format control.

---

## Strategic Risks

### Risk 1: No One Uses Studio

**If researchers prefer writing in Overleaf/Google Docs:**
- Studio doesn't fulfill funnel role
- Wasted development time (even if only 10% effort)

**Mitigation:**
- Low sunk cost (already 90% built)
- Keep it simple (feature-frozen = low ongoing burden)
- If no traction after 12 months, sunset Studio

### Risk 2: Studio Becomes More Popular Than Press

**If Studio gets traction but Press doesn't:**
- Strategic mismatch (free product popular, paid product not)
- Consider pivoting to monetize Studio instead
- Or keep both free and monetize Forum only

**Mitigation:**
- Good problem to have (pivot strategy if this happens)
- Studio success still validates "web-native writing" thesis

### Risk 3: Maintenance Burden Higher Than Expected

**If Studio requires >10 hours/month maintenance:**
- Diverts time from Press/Forum (revenue products)
- Becomes a drag on founder capacity

**Mitigation:**
- Feature-freeze immediately (no new features = fewer bugs)
- Sunset if burden persists (cut losses)
- Press integration is only critical feature (maintain that, drop everything else if needed)

---

## Decision Framework

### When to Add Features (Rare)

**Only add features if ALL of these are true:**
1. Critical to Press integration (e.g., export format breaks)
2. <5 hours of development time
3. No ongoing maintenance burden
4. Requested by 20+ users

**Otherwise: Say no, redirect to alternatives, keep feature-frozen**

### When to Sunset Studio

**Sunset if ANY of these are true:**
1. <10% of Press papers use Studio after 12 months
2. Maintenance burden >20 hours/month for 3+ consecutive months
3. Infrastructure costs >€500/month (unsustainable for free product)
4. Press pivots away from web-native publishing (strategic mismatch)

**Sunsetting process:**
1. 6-month warning to users
2. Export all data to Markdown files
3. Open-source codebase (users can self-host if they want)
4. Redirect Studio domain to Press

---

## Success Criteria

### By Q3 2026 (6 Months Post-Launch)

- ✅ 20%+ of Press papers authored in Studio
- ✅ <10 hours/month maintenance time
- ✅ Studio is net-positive (drives more Press users than it costs in time/money)

### By Q4 2027 (18 Months Post-Launch)

- ✅ 30-50% of Press papers authored in Studio
- ✅ Feature-frozen and stable
- ✅ Low support burden (users understand it's maintenance mode)
- ✅ Press + Studio ecosystem working smoothly

---

**Last updated**: January 8, 2026
**Next review**: After Q3 2026 (6 months post-launch) to evaluate traction and maintenance burden
