# Decision Record: Real-Time Collaborative Editing Spike Approval

**Date**: January 29, 2026
**Status**: Approved
**Decision Maker**: Leo Torres (Founder)
**Context**: Studio V1 development planning

---

## Decision

**APPROVED: 2-3 week spike (20-26 hours) to validate Y.js + CodeMirror 6 integration for real-time collaborative RSM editing.**

Spike will run during Press beta (February-March 2026).

---

## Context

Studio V1 was always intended to include real-time collaborative editing. Computational research is team-based (2-10 co-authors typical). Single-user editors don't compete with Overleaf or Google Docs in 2026.

Real-time collaboration is **table stakes**, not optional, for Studio to compete in the collaborative authoring space.

---

## Technical Decisions

### Editor: CodeMirror 6
- 150KB vs Monaco's 2-3MB (significant for academic users on slow connections)
- Modular, extensible architecture fits RSM-specific features
- Text-centric model matches RSM storage format (text, not structured AST)

### Collaboration: Y.js (CRDTs)
- Battle-tested (Notion, Linear, Figma use it)
- Better editor bindings than Automerge
- Simpler than Operational Transforms (no central conflict resolution)
- Offline-first, handles network partitions gracefully

### LSP: Server-Side (not WASM)
- **OUT OF SPIKE SCOPE** - validated separately in Phase 3
- Backend LSP avoids browser position mapping complexity
- Single source of truth for diagnostics (broadcast to all clients)
- Debounced parsing (500ms) reduces server load

### WebSocket: y-websocket or Hocuspocus
- Spike uses y-websocket (simpler, fewer abstractions)
- Production may use Hocuspocus (auth, persistence, scaling built-in)
- Decision deferred to Phase 2 (production integration)

---

## Spike Plan

### Week 1: Basic Integration (6-8 hours)
- CodeMirror 6 + RSM syntax highlighting
- Y.js binding (`y-codemirror.next`)
- Two browser tabs editing simultaneously
- Basic cursor awareness (see where collaborator is typing)

### Week 2: RSM Semantic Testing (8-10 hours)
**CRITICAL: Test concurrent edits to RSM structures**
- Citations (`[@smith2023]`)
- Math blocks (`$$E=mc^2$$`)
- Cross-references (`[@fig:results]`)
- Metadata (title, authors, abstract)
- Deletion conflicts (User A deletes paragraph User B is editing)
- Copy-paste during concurrent edits (5000+ characters)

**Goal: 95%+ of concurrent edits produce valid RSM**

### Week 3: Performance + Rollback (6-8 hours)
- Benchmark latency (<200ms internet acceptable)
- Benchmark memory (<100MB for 10K-line documents)
- Offline editing + reconnection test (30s disconnect)
- **Rollback prototype**: Snapshot Y.js state every 15 min, restore from PostgreSQL

---

## Success Criteria (GO/NO-GO)

| Criterion | GO Threshold | NO-GO Signal |
|-----------|--------------|--------------|
| **Semantic preservation** | 95%+ valid RSM | <90% (too many edge cases) |
| **Latency** | <200ms internet | >500ms (unusable) |
| **Memory** | <100MB for 10K lines | >500MB (browser crash risk) |
| **Rollback** | 100% snapshot restoration | Snapshots fail to restore |
| **Blocking unknowns** | 0-2 with clear path | 3+ unsolvable blockers |

**If GO**: Proceed to Phase 2 (production integration, 8-10 weeks)
**If NO-GO**: Fallback to single-user Studio V1 or lock-based editing

---

## Risk Mitigation Strategy

### Pragmatic Risk Tolerance

**Philosophy**: Fast recovery via rollback > 99.9% semantic perfection

**Evidence:**
- Overleaf has real-time collab with 15M+ users - occasional merge issues are tolerated
- Typst has real-time collab for structured markup - it works
- Computational research = code/data elsewhere, paper is writeup (not research artifact)
- Y.js is battle-tested in production (Notion, Linear, Figma)

**Mitigation:**
- **Rollback system**: Auto-snapshot every 15 min, manual "Save version" button
- **Zero data loss via recovery** (not via perfect merging)
- User loses max 15 minutes of work if corruption occurs
- Plain RSM export as failsafe (manual recovery option)

**Acceptable outcome**: 95%+ semantic preservation + fast rollback = good enough for V1

### Data Loss Prevention

**Snapshot strategy:**
- Auto-snapshot every 15 minutes during active editing
- Manual "Save version" button for user-initiated checkpoints
- Keep last 50 snapshots (~1-2 days of history)
- Store Y.js binary state + plain RSM text (human-readable failsafe)

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

### Observability (Minimal for V1)

**Client-side:**
- Y.js sync events logged to browser console
- User-visible sync indicator: `● Connected | ○ Syncing | ✕ Offline`
- No external error tracking initially (add Sentry post-launch if problems emerge)

**Server-side:**
- Console logs for connections, disconnections, room state
- Log large updates (>100KB = suspicious, may indicate issue)
- No external monitoring initially (add if problems emerge)

**For beta with 10-20 users: Console logs sufficient.**

---

## Deferred Decisions

### Not in Spike Scope

- ❌ LSP integration (Phase 3, separate validation)
- ❌ Authentication for WebSocket connections (Phase 2)
- ❌ Document permissions/RBAC (simple owner model for V1)
- ❌ Production monitoring/alerting (add if problems emerge)
- ❌ Mobile browser testing (defer to Phase 2)

### Post-Spike Decisions

**If spike succeeds:**
- Choose between y-websocket vs Hocuspocus (production WebSocket server)
- Define document ownership model (simple: creator owns, invite collaborators)
- Plan Phase 2 timeline (production integration, 8-10 weeks)
- Plan Phase 3 timeline (backend LSP, 3-4 weeks parallel)

---

## Timeline

**Spike**: 2-3 weeks during Press beta (February-March 2026), 20-26 hours total

**If GO (spike succeeds):**
- Phase 2: Production integration (8-10 weeks)
- Phase 3: Backend LSP (3-4 weeks, parallel)
- Phase 4: Beta testing (2-4 weeks, 10-20 research teams)
- **Total: 14-18 weeks (~4-4.5 months at 10-15 hrs/week)**
- **Launch target: Q3 2026 (July-September)**

**If NO-GO (spike fails):**
- Fallback A: Single-user Studio V1 (6-8 weeks)
- Fallback B: Lock-based editing (8-10 weeks, safer than CRDTs)
- Fallback C: Cancel Studio, focus on Press standalone

---

## Expert Panel Consensus

Four specialists reviewed this proposal (CTO, CPO, CAO, Architecture Expert):

**Unanimous recommendation**: ✅ APPROVE the spike

**Key agreements:**
- ✅ Architecture is sound (Y.js + CM6 + backend LSP)
- ✅ RSM semantic validation is the critical unknown (spike must test)
- ✅ Timeline is realistic but tight (4-5 months at 10-15 hrs/week)
- ✅ Fallback plans needed (single-user V1 if spike fails)
- ✅ Pragmatic risk tolerance (95%+ + rollback > 99.9% perfection)

**Technical consensus:**
- ✅ CodeMirror 6 is correct choice (not Monaco)
- ✅ Y.js is correct choice (not Automerge or OT)
- ✅ Backend LSP simpler than WASM (avoid position mapping complexity)
- ✅ Defer LSP to Phase 3 (out of spike scope)

---

## Alternatives Considered

### Why Not Automerge?
- Y.js has better editor bindings (`y-codemirror.next` is well-maintained)
- Larger community, more production deployments
- Automerge is theoretically elegant but less mature for text editing

### Why Not Operational Transforms (OT)?
- CRDTs simpler (no central conflict resolution server required)
- Better offline support (no central authority needed)
- Google Docs uses OT but has 100+ engineers; we have 1 founder

### Why Not ProseMirror?
- ProseMirror is schema-based (enforces document structure)
- RSM is text-based markup (like Markdown), not structured AST
- CodeMirror 6's text-centric model is better fit

### Why Not WASM LSP?
- Position mapping between Y.js and LSP is complex (WASM runs per-client)
- Backend LSP simpler (single source of truth, broadcast diagnostics)
- Academic writing tolerates 500ms diagnostic lag (not real-time IDE)

---

## Next Steps

1. **Start spike immediately** (block out 20-26 hours over next 2-3 weeks)
2. **Focus on Week 2 semantic testing** (this is the critical validation)
3. **Document GO/NO-GO recommendation** with evidence at end of Week 3
4. **Decision meeting**: End of spike (GO → Phase 2, NO-GO → activate fallback)

---

## References

- `/Users/leo.torres/aris/org/products/studio/strategy/roadmap.md` - Updated strategy document
- Y.js documentation: https://docs.yjs.dev/
- CodeMirror 6 documentation: https://codemirror.net/
- Overleaf (15M users, proves real-time collab works for academic writing)
- Typst (real-time collab for structured markup, proves CRDTs work)

---

**Decision approved**: January 29, 2026
**Next review**: End of spike (GO/NO-GO decision, ~3 weeks from start)
