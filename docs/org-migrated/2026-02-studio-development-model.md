# Studio Development Model - Active Development, No Feature Freeze

**Date:** February 8, 2026
**Status:** Decided
**Context:** Resolving contradiction between roadmap.md (active development) and vision.md (feature-freeze)

---

## Decision

Studio will continue active development after V1 launch with 10-20% of founder time allocation. **There are no plans to freeze Studio's feature set.**

---

## Rationale

### 1. Studio as Living RSM Reference Implementation

Studio serves as the canonical reference implementation of RSM (Readable Science Markup). As the RSM specification evolves, Studio must evolve with it to validate new language features and design patterns.

**Implication:** Studio development is tied to RSM language evolution, not just user feature requests. As long as RSM is actively developed, Studio needs active maintenance and feature additions.

### 2. Competitive Reality: Overleaf Comparison

Studio competes with Overleaf for computational research teams. Overleaf continuously adds features based on user feedback. A "feature-frozen" Studio would quickly fall behind competitive alternatives.

**Implication:** To remain competitive as a collaborative authoring tool, Studio needs ongoing feature development based on user needs and RSM evolution.

### 3. Pragmatic Resource Allocation

10-20% of founder time (~2-6 hours per week, or 8-24 hours per month) is sustainable alongside Press (70-80% priority) and allows:
- Bug fixes and security updates
- Small feature additions based on user feedback
- RSM language evolution support
- Integration improvements (Press, export formats)
- Performance optimizations

**Implication:** "Active development" doesn't mean building major new systems—it means thoughtful evolution based on actual usage and RSM needs.

### 4. Community Contributions Welcome

Even with 10-20% founder time, Studio can accept community contributions (PRs, bug reports, feature requests). This makes it sustainable long-term without becoming a maintenance burden.

**Implication:** Studio's development velocity is founder time + community contributions, not just founder time alone.

---

## What "Active Development" Means

### ✅ Will Do
- Bug fixes and security updates
- Small feature additions based on user feedback (e.g., keyboard shortcuts, UI improvements)
- RSM language evolution support (new syntax, new primitives)
- Integration enhancements (Press publishing flow, export formats)
- Performance improvements
- Community contributions (review and merge PRs from external contributors)

### ❌ Won't Do (Unless Strong Demand Emerges)
- Major architectural rewrites
- Building completely new systems (e.g., AI content generation, plugin system)
- Features that require >40 hours of development without clear user demand
- Scope creep into non-RSM domains (e.g., lab management, project tracking)

---

## What Changed from Earlier Thinking

### Old Model (From vision.md, outdated):
- "Post-V1: Feature-freeze (2027+)"
- "Bug fixes only, NO new features"
- "<10 hours/month maintenance"
- Clear transition from "active development" to "maintenance mode"

### New Model (From roadmap.md, current):
- "After V1 ships, Studio continues active development (10-20% time)"
- "Studio serves as the living reference implementation of RSM"
- "10-20 hours/month development (manageable alongside Press priority work)"
- No sharp transition—gradual shift from "building V1" to "evolving Studio alongside RSM"

### Why the Change

The original "feature-freeze" model assumed:
1. Studio's purpose was solely to launch Press (funnel product)
2. RSM would stabilize and not need evolution
3. Users wouldn't request features after V1
4. Studio could be fully community-maintained with zero founder time

**Reality check:**
1. Studio also serves as RSM reference implementation (not just Press funnel)
2. RSM needs active evolution as web standards and researcher needs change
3. Users will request features, and some will be valuable for RSM validation
4. Community contributions are valuable but need founder review/merge

---

## Impact on Other Documents

### Files to Update
1. ✅ `/products/studio/readme.md` — Updated to reflect active development model
2. ✅ `/products/studio/strategy/vision.md` — Updated: feature-freeze language removed, active development model in place
3. ✅ Decision stack — No change needed (doesn't specify Studio development model)

### Cross-Product Implications
- **Press:** Still 70-80% priority (Studio 10-20% doesn't change this)
- **Forum:** Still lowest priority (<5% time)
- **RSM:** Studio development directly supports RSM language evolution

---

## Success Criteria

Studio "active development" model is working if:
- Studio remains competitive with Overleaf for basic use cases
- Development time stays within 10-20% allocation (8-24 hrs/month)
- Community contributions supplement founder work (1-3 PRs per quarter)
- Studio successfully validates new RSM language features as they're designed
- Users report Studio is stable, reliable, and improving over time

---

## Risk Mitigation

**Risk:** Studio development exceeds 20% time allocation consistently (>30 hrs/month for 2+ quarters)

**Mitigation:**
- Track actual time spent monthly
- If exceeds 30 hrs/month for 2+ quarters, re-evaluate scope or consider sunsetting
- Prioritize RSM validation features over user-requested features
- Defer or reject features that don't align with RSM reference implementation role

---

## Next Actions

1. ✅ Create this decision document
2. ✅ Update `/products/studio/strategy/vision.md` to remove feature-freeze language
3. ✅ Ensure all Studio documentation references "active development" consistently

---

**Authority:** Leo Torres (Founder)
**Effective Date:** February 8, 2026
**Next Review:** After Studio V1 ships (Q3 2026) — validate actual time spent vs. 10-20% target
