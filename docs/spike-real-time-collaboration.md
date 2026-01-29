# Spike: Real-Time Collaborative Editing for RSM Studio

**Timeline**: During Press beta (February-March 2026)
**Outcome**: GO/NO-GO decision for V1 collaborative editing feature

---

## Overview

Validate that Y.js (CRDT library) + CodeMirror 6 can support real-time collaborative
editing of RSM documents with acceptable semantic preservation and performance.

**Critical validation**: Can concurrent edits to RSM maintain semantic validity
(citations, math, cross-references, metadata)? CRDTs guarantee character-level
convergence but NOT semantic correctness.

**Why this matters**: Single-user Studio doesn't compete with Overleaf or Google Docs.
Real-time collaboration is table stakes for V1 launch. This spike determines if the
technical approach is viable.

---

## Technical Stack

### Core Components

**CodeMirror 6**
- Text editor framework (~150KB, modular)
- Why: Extensible for RSM-specific features, text-centric model matches RSM storage format
- Alternative rejected: Monaco (2-3MB, VS Code philosophy, fights customization)

**Y.js**
- CRDT library for conflict-free real-time sync
- Why: Battle-tested (Notion, Linear, Figma), best editor bindings, open source
- Alternative rejected: Automerge (less mature editor bindings), OT (more complex)

**y-codemirror.next**
- Official Y.js binding for CodeMirror 6
- Handles document sync, cursor awareness, undo/redo

**y-websocket**
- WebSocket provider for Y.js (use this for spike, not Hocuspocus)
- Why: Simpler, fewer abstractions, easier to understand primitives

### Out of Scope

**NOT in this spike:**
- LSP integration
- Authentication/authorization
- Production WebSocket server
- Persistence strategy
- Mobile browser support

---

## Phase 1: Basic Integration

### Goal
Prove that CodeMirror 6 + Y.js can sync edits between two clients in real-time.

### Tasks

**Task 1.1: CodeMirror 6 Setup**
- Set up CM6 editor instance in Studio frontend
- Implement basic RSM syntax highlighting (Lezer grammar or StreamParser)
- Verify: Editor renders RSM with correct syntax highlighting

**Task 1.2: Y.js Integration**
- Create Y.Doc instance with Y.Text for document content
- Bind Y.Text to CodeMirror 6 using `y-codemirror.next`
- Set up local WebSocket server using `y-websocket`
- Verify: Single editor updates Y.Doc state

**Task 1.3: Multi-Client Sync**
- Open two browser tabs pointing to same Y.Doc
- Type in one tab, observe updates in other tab
- Verify: Edits appear in both tabs with <200ms latency (local network)

**Task 1.4: Cursor Awareness**
- Enable Y.js awareness protocol
- Show remote cursor position/selection in editor
- Verify: Can see where collaborator is typing with colored cursor

### Success Criteria

- ✅ Two browser tabs can edit same document simultaneously
- ✅ Changes sync between tabs with <200ms latency on localhost
- ✅ Remote cursors visible and track correctly
- ✅ RSM syntax highlighting preserved during edits
- ✅ No crashes, memory leaks, or console errors

---

## Phase 2: RSM Semantic Testing

### Goal
Validate that Y.js CRDT merges preserve RSM semantic validity during concurrent edits.

**This is the CRITICAL validation.** CRDTs guarantee character convergence, NOT semantic
correctness. We must test if concurrent edits produce valid RSM syntax.

### Test Scenarios

**Test 2.1: Citation Editing**
- Scenario: User A edits `:cite:smith2023:` → `:cite:smith2023, @jones2024:`
- Simultaneously: User B edits `:cite:smith2023:` → `:cite:smith2023, see discussion:`
- Expected: Merged result is valid RSM citation syntax
- Measure: Does merge produce syntactically valid citation?

**Test 2.2: Math Block Editing**
- Scenario: User A edits `$E=mc^2$` → `$E=mc^2 + \hbar\omega$`
- Simultaneously: User B converts to display math `$$E=mc^2$$`
- Expected: Delimiters match (`$...$` or `$$...$$`), no orphaned delimiters
- Measure: Does merge produce valid math block?

**Test 2.3: Cross-Reference Editing**
- Scenario: User A renames figure label `:label:old` → `:label:new:`
- Simultaneously: User B adds reference `:ref:old`
- Expected: Either reference updates or remains `:ref:old:` (invalid but detectable)
- Measure: Does merge break cross-reference resolution?

**Test 2.4: Metadata Editing**
- Scenario: User A edits title
- Simultaneously: User B edits author list
- Expected: Entire document remains valid
- Measure: Does merge produce parseable RSM?

**Test 2.5: Deletion Conflicts**
- Scenario: User A deletes paragraph
- Simultaneously: User B edits that paragraph
- Expected: Either edit wins or deletion wins (CRDT determines), no corrupted half-paragraph
- Measure: Result is valid RSM

**Test 2.6: Large Paste During Concurrent Edit**
- Scenario: User A pastes 5000+ characters
- Simultaneously: User B typing in nearby location
- Expected: Both edits preserved, no data loss
- Measure: Full paste appears, User B's edits intact

**Test 2.7: Rapid Typing**
- Scenario: Both users typing rapidly in same paragraph (100+ chars/min)
- Expected: No character loss, no duplication
- Measure: Final document contains all typed characters

**Test 2.8: Nested Structure Editing**
- Scenario: User A edits :span: inside :caption: inside :figure:
- Simultaneously: User B deletes figure wrapper
- Expected: Figure caption preserved (orphaned) or deleted entirely (no half-structure)
- Measure: No malformed nesting (dangling delimiters)

### Semantic Preservation Measurement

**For each test scenario:**
1. Run test 10 times (randomize timing of concurrent edits)
2. Export merged RSM to plain text
3. Run RSM validator/parser on result
4. Record: Valid (✅) or Invalid (❌)

**Success threshold**: 95%+ of test runs produce valid RSM (38/40 or better)

**If <90% valid**: NO-GO (too many edge cases, CRDTs + RSM incompatible)

### Tasks

**Task 2.1: Build Test Harness**
- Automated script to simulate concurrent edits
- Runs each scenario 10 times with randomized timing
- Exports merged document, validates RSM syntax
- Generates report: X/Y scenarios passed

**Task 2.2: Execute Test Suite**
- Run all 8 scenarios (80 total tests)
- Document failures: which scenarios, what broke
- Categorize: Syntax errors vs semantic errors vs data loss

**Task 2.3: Edge Case Documentation**
- Document any Y.js behaviors that surprise (undo, position tracking, etc.)
- Note scenarios where merges are "valid but weird" (need UX consideration)
- Identify blocking issues (unresolvable semantic corruption)

### Success Criteria

- ✅ 95%+ of test scenarios produce valid RSM (76/80 or better)
- ✅ No data loss (characters dropped) in any scenario
- ✅ Edge cases documented with reproduction steps
- ✅ No blocking issues discovered (all problems have mitigation path)

---

## Phase 3: Performance & Rollback

### Goal
Validate performance is acceptable and rollback system can recover from corruption.

### Performance Testing

**Test 3.1: Latency Benchmarking**
- Measure: Time from keypress to remote update visible
- Test environments:
  - Localhost (same machine, two tabs)
  - LAN (two machines, local network)
  - Internet (two machines, WiFi → WiFi)
- Target: <200ms P50, <500ms P99 for internet connection
- Measure 100 keystrokes, record distribution

**Test 3.2: Memory Usage**
- Measure: Browser memory usage with Y.Doc loaded
- Test document sizes:
  - Small (1K lines, ~50KB)
  - Medium (5K lines, ~250KB)
  - Large (10K lines, ~500KB)
- Target: <100MB total memory for 10K-line document
- Monitor: Memory growth during 30-minute editing session (check for leaks)

**Test 3.3: Large Document Performance**
- Load 10K-line RSM document into Y.Doc
- Add 5 concurrent editors (5 browser tabs)
- Type in all tabs simultaneously (simulate busy editing session)
- Measure: Latency, memory, CPU usage
- Target: No degradation compared to small document (<10% slowdown)

**Test 3.4: Offline Editing + Reconnection**
- Disconnect client (close WebSocket connection)
- Make 50+ edits offline (simulate 5 minutes of typing)
- Reconnect
- Measure: Time to sync (target: <2 seconds), data integrity (no loss)

### Rollback System

**Test 3.5: Snapshot & Restore Prototype**
- Implement: Snapshot Y.Doc state every 15 minutes
- Store: Y.js binary update + plain RSM text in PostgreSQL
- Implement: Restore from snapshot (load Y.js update, apply to new Y.Doc)
- Verify: Restored document identical to original (character-perfect)

**Test 3.6: Rollback UI Prototype**
- Build simple UI: List of snapshots (timestamp, "5 min ago", "1 hour ago")
- User selects snapshot, clicks "Restore"
- Document state reverts to selected snapshot
- Verify: User can recover from corruption within 15 minutes max

### Tasks

**Task 3.1: Performance Benchmark Suite**
- Automate latency measurement (100 keystrokes, P50/P99)
- Memory profiler integration (track heap size over time)
- Large document stress test (10K lines, 5 clients)
- Generate report: Latency/memory/CPU metrics

**Task 3.2: Offline Sync Test**
- Simulate network disconnect (close WebSocket)
- Make edits offline, reconnect
- Verify: All edits preserved, sync time acceptable

**Task 3.3: Snapshot System Prototype**
- PostgreSQL schema for snapshots (document_id, timestamp, y_update blob, rsm_text)
- Auto-snapshot function (runs every 15 min during editing)
- Restore function (load Y.js update, apply to Y.Doc)
- Test: Snapshot → restore → verify identical

**Task 3.4: Rollback UI Mockup**
- Simple HTML/Vue component: Snapshot list, restore button
- Wire to snapshot system (fetch snapshots, trigger restore)
- Verify: User can click "Restore" and document reverts

### Success Criteria

- ✅ Latency <200ms P50, <500ms P99 for internet connection
- ✅ Memory <100MB for 10K-line document, no leaks detected
- ✅ Large document (10K lines, 5 clients) performs acceptably (<10% slowdown)
- ✅ Offline edits sync correctly on reconnect (<2s sync time)
- ✅ Snapshot system works reliably (100% restoration accuracy)
- ✅ Rollback UI functional (user can restore from snapshot)

---

## Deliverables

### Technical Artifacts

**Phase 1 Deliverables:**
- Working demo: Two browser tabs editing RSM document simultaneously
- CodeMirror 6 + Y.js integration code
- Basic cursor awareness implementation

**Phase 2 Deliverables:**
- Test harness: Automated concurrent edit testing
- Test report: 80 test results (valid/invalid, failure analysis)
- Edge case documentation (surprising behaviors, UX considerations)

**Phase 3 Deliverables:**
- Performance report: Latency/memory/CPU benchmarks
- Snapshot system prototype (PostgreSQL schema + snapshot/restore functions)
- Rollback UI mockup (functional prototype)

### Decision Document

**Final Deliverable: GO/NO-GO Recommendation**

Write a concise report (2-3 pages) addressing:

**1. Semantic Preservation (CRITICAL)**
- What percentage of concurrent edits produced valid RSM? (Target: 95%+)
- Which scenarios failed? Are failures acceptable or blocking?
- Can failures be mitigated with rollback, or do they require perfect merging?

**2. Performance**
- Latency: P50/P99 for localhost, LAN, internet
- Memory: Usage for small/medium/large documents
- Large document: Does performance degrade with 10K+ lines?

**3. Rollback System**
- Does snapshot/restore work reliably?
- Can user recover from corruption within 15 minutes?
- Is rollback UX intuitive?

**4. Blocking Issues**
- Any discovered issues that have no mitigation path?
- Examples: Y.js fundamentally incompatible with RSM structure, performance unacceptable, rollback doesn't work

**5. Recommendation**
- **GO**: Proceed to production integration
  - Justification: Semantic preservation >95%, performance acceptable, rollback works
  - Risks to monitor: [list known edge cases]

- **NO-GO**: Do not proceed with Y.js approach
  - Justification: Semantic preservation <90%, or blocking issues, or performance unacceptable
  - Recommended fallback: Single-user Studio V1 or lock-based editing
  - Alternative exploration needed: [specify what to try instead]

---

## Success Criteria Summary

### GO Decision Requires ALL of:

| Criterion | Threshold | Measured By |
|-----------|-----------|-------------|
| **Semantic preservation** | ≥95% valid RSM | Phase 2 test suite (76/80 tests pass) |
| **Latency (internet)** | P50 <200ms, P99 <500ms | Phase 3 benchmark (100 keystrokes) |
| **Memory (10K lines)** | <100MB, no leaks | Phase 3 profiler (30-min session) |
| **Rollback reliability** | 100% restoration | Phase 3 snapshot test (10/10 restores) |
| **No blocking issues** | 0-2 edge cases with mitigation | Phase 2 edge case analysis |

### NO-GO Triggered By ANY of:

- ❌ Semantic preservation <90% (too many corruption scenarios)
- ❌ Latency P99 >500ms (unusable UX)
- ❌ Memory >500MB for 10K lines (browser crash risk)
- ❌ Rollback system unreliable (<90% restoration success)
- ❌ 3+ blocking issues with no mitigation path

---

## Context for Developers

### Why This Spike Matters

Studio was always intended to have real-time collaboration for V1. Computational
research is team-based (2-10 co-authors typical). Single-user editors don't compete with
Overleaf or Google Docs in 2026.

This spike determines if the chosen technical approach (Y.js CRDTs) can handle RSM's
semantic structure. If it can't, we need a different approach (lock-based editing, OT,
or defer collaboration to V2).

### Risk Philosophy

**Pragmatic tolerance**: 95%+ semantic preservation + fast rollback is good enough. We
don't need 99.9% perfection.

**Evidence**: Overleaf (15M users) and Typst both have real-time collab with occasional
merge issues. Academics tolerate this because rollback/undo exists.

**For Studio**: If Y.js garbles a sentence, user restores from 5-15 minutes ago.
Annoying but not career-ending. Computational research = code/data elsewhere, paper is
writeup (not the research artifact itself).

### What Happens After Spike

**If GO**:
- Production integration - WebSocket server, persistence, auth
- Backend LSP - Server-side RSM diagnostics
- Beta testing - 10-20 research teams
- Launch: Q3 2026

**If NO-GO**:
- Evaluate fallback options:
  - Fallback A: Single-user Studio V1 - defer collaboration to V2
  - Fallback B: Lock-based editing - Google Docs-style paragraph locking
  - Fallback C: Cancel Studio - focus on Press standalone

---

## Questions During Spike

**Technical questions**: Ask Leo (founder/technical lead)

**Scope questions**: Refer to this document. If something isn't listed, it's out of
scope for the spike.

**Blocked on decisions**: Document the decision needed and continue with other tasks.
Decisions can be made at end-of-phase sync.

---

**Spike approved**: January 29, 2026
**Start date**: During Press beta (February-March 2026)
**Decision meeting**: End of Phase 3 (GO/NO-GO)
